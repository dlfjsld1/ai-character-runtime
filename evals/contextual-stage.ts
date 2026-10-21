// Dedicated generation -> Store -> native Stage verification. No judgment API.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,copyFileSync} from 'node:fs';
import {resolve,relative,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {parseArgs,parseEnv} from 'node:util';
import {chromium,expect,type BrowserContext,type Page} from '@playwright/test';
import {Database} from '../packages/database/src/connection.ts';
import {migrate} from '../packages/database/src/migrate.ts';
import {seed} from '../packages/database/src/seed.ts';
import {Store} from '../packages/database/src/store.ts';
import {createServer} from '../apps/runtime/src/http/server.ts';
import {DeepSeekDialogue,deepseekPayload} from '../packages/adapters/src/deepseek.ts';
import {deepseekCandidate} from '../packages/adapters/src/deepseek-budget.ts';
import {buildDialogueRequest} from '../packages/adapters/src/dialogue-request.ts';
import type {DialogueGenerator,DialogueContext,AppraisalProvider} from '../packages/contracts/src/ai-ports.ts';
import type {Plan} from '../packages/contracts/src/domain.ts';
import type {ConversationSnapshot} from '../packages/contracts/src/conversation.ts';
import {contextualStageScenes,seedContextualStageSources,prepareContextualStageTurn} from './contextual-stage-fixture.ts';
import {stageBudgetPolicy,openStageBudget} from './contextual-stage-guard.ts';
import {installStageObserver,readStageObservations,assertStageEvidence} from './contextual-stage-evidence.ts';

const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const hash=(path:string)=>sha(readFileSync(path));
const json=(value:unknown)=>JSON.stringify(value,(_key,item)=>typeof item==='bigint'?item.toString():item,2)+'\n';
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const files=(root:string):string[]=>readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(root,e.name)):[join(root,e.name)]).sort();
export function sourceHashes(){
 const selected=[...files('packages'),...files('apps/runtime/src'),...files('apps/studio/src')].filter(p=>/\.(ts|tsx|css|sql)$/.test(p)&&!p.endsWith('.test.ts'));
 selected.push('evals/contextual-stage.ts','evals/contextual-stage-fixture.ts','evals/contextual-stage-guard.ts','evals/contextual-stage-evidence.ts','apps/studio/index.html','apps/studio/vite.config.ts','fixtures/puzzles/problems.json','package.json','pnpm-lock.yaml');
 return Object.fromEntries(selected.sort().map(p=>[p.replaceAll('\\','/'),hash(p)]));
}
const uiHashes=(root:string)=>Object.fromEntries(files(root).map(p=>[relative(root,p).replaceAll('\\','/'),hash(p)]));
function artifactPath(path:string){const resolved=resolve(path);assert(/^J:[\\/]ai[\\/]/i.test(resolved),'artifacts_must_be_in_ai_directory');return resolved;}
export function parseStageArgs(argv:string[]){
 const {values:v}=parseArgs({args:argv,strict:true,allowPositionals:false,options:{prepare:{type:'boolean'},rehearse:{type:'boolean'},live:{type:'boolean'},out:{type:'string'},ui:{type:'string'},prepared:{type:'string'},'prepared-hash':{type:'string'},database:{type:'string'},chrome:{type:'string'},ledger:{type:'string'},'ledger-hash':{type:'string'},origin:{type:'string'},'origin-hash':{type:'string'},'key-file':{type:'string'},'allow-paid-providers':{type:'boolean'},'synthetic-inputs':{type:'boolean'},'approved-max-calls':{type:'string'},'approved-additional-usd':{type:'string'}}});
 assert.equal([v.prepare,v.rehearse,v.live].filter(Boolean).length,1,'one_explicit_mode_required');
 assert(v.out&&v.ui,'output_and_built_ui_required');
 const out=artifactPath(v.out),ui=artifactPath(v.ui);
 const paid=['ledger','ledger-hash','origin','origin-hash','key-file','approved-max-calls','approved-additional-usd'] as const;
 if(!v.live)assert(paid.every(k=>v[k]===undefined)&&!v['allow-paid-providers'],'paid_flags_for_live_only');
 if(v.prepare)assert(!v.database&&!v.prepared&&!v['prepared-hash']&&!v.chrome&&!v['synthetic-inputs'],'prepare_has_no_execution_flags');
 else{
  assert(v.prepared&&v['prepared-hash']&&/^[a-f0-9]{64}$/.test(v['prepared-hash'])&&v.database&&v.chrome&&v['synthetic-inputs'],'execution_scope_required');
  const url=new URL(v.database);assert(['postgres:','postgresql:'].includes(url.protocol)&&url.hostname==='127.0.0.1'&&url.port==='55434'&&!url.search&&!url.hash,'isolated_local_database_required');
  assert(new RegExp('^/character_runtime_cx_stage_'+(v.live?'live':'mock')+'_20261018_r[1-9][0-9]*$').test(url.pathname),'fresh_named_database_required');
 }
 if(v.live){assert(paid.every(k=>v[k])&&v['allow-paid-providers'],'explicit_live_authorization_required');assert.equal(v['approved-max-calls'],'159');assert.equal(v['approved-additional-usd'],'0.20');artifactPath(v.ledger!);artifactPath(v.origin!);}
 return {...v,out,ui};
}

// A single armed fixture input is the only route to paid reservation. Any
// background agenda, duplicate dispatch or prior failure closes admission.
export class StageAdmission {
 private id:string|null=null;private used=false;private failed=false;calls=0;
 arm(id:string){assert(!this.failed&&!this.id,'stage_admission_not_idle');this.id=id;this.used=false;}
 check(context:DialogueContext){if(this.failed||!this.id||context.currentInput?.id!==this.id||this.used){this.failed=true;throw Error('stage_unexpected_generation');}}
 consume(context:DialogueContext){this.check(context);if(this.calls>=8){this.failed=true;throw Error('stage_call_limit');}this.used=true;this.calls++;}
 done(){assert(this.used,'stage_generation_missing');this.id=null;}
 stop(){this.failed=true;}
}

// HTTP attempts are observations, not a quantity reconstructed from a ledger
// that may itself be the reason the run failed.
export function finishStageRunAccounting(guard:ReturnType<typeof openStageBudget>|undefined,calls:{transportCalls:number;apiCalls:number},physicalDrained:boolean){
 const result:{transportCalls:number;apiCalls:number;accounting?:ReturnType<ReturnType<typeof openStageBudget>['accounting']>;accountingErrors:string[];lockReleased:boolean}={...calls,accountingErrors:[],lockReleased:false};
 if(!guard)return result;
 try{result.accounting=guard.accounting();}catch(e){result.accountingErrors.push(e instanceof Error?e.message:'accounting_failure');}
 try{assert(physicalDrained,'physical_drain_unconfirmed');guard.close({physicalDrained:true});result.lockReleased=true;}catch(e){result.accountingErrors.push(e instanceof Error?e.message:'lock_release_failure');}
 return result;
}

// Collect partial evidence before cancellation/closing changes the observable
// state. A failed read is recorded separately, never substituted with PASS.
export async function collectStageStep(step:any,store:Store,page:Page|undefined,packets:any[],sentAcks:any[]){
 const responseId=step.fixture.response?.id;
 step.evidenceErrors??=[];step.response??=null;
 for(const field of ['segments','packets','observations','dbAcks','sources','sentAcks'])step[field]??=[];
 const attempt=async(label:string,fn:()=>Promise<void>)=>{try{await fn();}catch(e){step.evidenceErrors.push(label+': '+(e instanceof Error?e.message:'unavailable'));}};
 await Promise.all([
  attempt('response',async()=>{if(responseId)step.response=(await store.db.pool.query('SELECT * FROM response_runs WHERE id=$1',[responseId])).rows[0]??null;}),
  attempt('segments',async()=>{if(responseId)step.segments=(await store.db.pool.query('SELECT * FROM speech_segments WHERE response_id=$1 ORDER BY segment_index',[responseId])).rows;}),
  attempt('dbAcks',async()=>{step.dbAcks=(await store.db.pool.query("SELECT id,kind,source_key,payload FROM events WHERE kind IN ('caption.shown','caption.finished') AND "+(responseId?"payload->>'responseId'=$1":"session_id=$1")+' ORDER BY received_at,id',[responseId??step.sessionId])).rows;}),
  attempt('sources',async()=>{if(responseId)step.sources=(await store.db.pool.query('SELECT * FROM response_sources WHERE response_id=$1',[responseId])).rows;}),
  attempt('busy',async()=>{step.busy=await store.busy();}),
  attempt('observations',async()=>{assert(page&&!page.isClosed(),'stage_page_unavailable');const all=await readStageObservations(page);step.observations=responseId?all.filter(e=>e.payload.responseId===responseId):all.slice(step.observationOffset);}),
 ]);
 const ids=new Set(step.observations.map((e:any)=>e.requestId));
 step.packets=packets.slice(step.packetOffset).filter(p=>responseId?(p.payload.responseId===responseId||p.type==='command.result'&&ids.has(p.payload.requestId)):['response.start','speech.segment','response.sealed','response.cancel'].includes(p.type));
 step.sentAcks=responseId?sentAcks.filter(p=>p.payload.responseId===responseId):sentAcks.slice(step.sentAckOffset);
}

export async function runContextualStage(argv:string[]){
 const o=parseStageArgs(argv),source=sourceHashes(),ui=uiHashes(o.ui);assert(ui['index.html'],'built_ui_required');assert(!existsSync(o.out),'evidence_exists');
 const specification={version:1,scope:'generation-db-stage',sourceHashes:source,uiHashes:ui,scenes:contextualStageScenes,budget:stageBudgetPolicy,
  controls:{appraisal:'recorded synthetic',affect:'explicit joy/frustration .7 with actual accepted cause UUIDs',expression:'controlled intent at Store response entry',sentenceLimit:'first scene explicitly allows two; rehearsal emits identical consecutive sentences',clock:'frozen synthetic clock +100ms per turn',transport:'real HTTP/WebSocket/DB/Chrome; only provider HTTP is fake in rehearsal'},
  claims:{koreanQuality:'DEFERRED_CX-SF01',naturalAppraisal:'NOT_TESTED',naturalStrongAffect:'NOT_TESTED',operationalProviderReplacement:'NOT_TESTED'},
  stop:'first provider/decoder/accounting/delivery failure; no retries'};
 if(o.prepare){mkdirSync(o.out,{recursive:true});writeFileSync(join(o.out,'prepared.json'),json(specification));console.log(json({status:'READY_NOT_EXECUTED',preparedHash:hash(join(o.out,'prepared.json')),calls:8,reservationUsd:stageBudgetPolicy.reservationUsd}));return;}
 assert.equal(hash(o.prepared!),o['prepared-hash'],'prepared_hash_changed');assert.deepEqual(read(o.prepared!),specification,'prepared_source_or_ui_changed');
 mkdirSync(o.out,{recursive:true});mkdirSync(join(o.out,'tmp'));mkdirSync(join(o.out,'downloads'));
 const persist=(name:string,value:unknown)=>writeFileSync(join(o.out,name),json(value));
 persist('manifest.json',specification);
 for(const p of Object.keys(source)){const dest=join(o.out,'source',p);mkdirSync(dirname(dest),{recursive:true});copyFileSync(p,dest);}
 const requestHash=sha(json({prepared:o['prepared-hash'],database:o.database,out:o.out,mode:o.live?'live':'mock'}));
 const result:any={status:'RUNNING',mode:o.live?'live':'mock',requestHash,preparedHash:o['prepared-hash'],steps:[],browserErrors:[],failures:[],claims:{...specification.claims,actualGeneration:'NOT_VERIFIED',dbStageDelivery:'NOT_VERIFIED'}};
 const calls={transportCalls:0,apiCalls:0};
 let guard:ReturnType<typeof openStageBudget>|undefined,db:Database|undefined,store:Store|undefined,runtime:Awaited<ReturnType<typeof createServer>>|undefined,browser:BrowserContext|undefined,page:Page|undefined,sessionId:string|undefined,physical:Promise<void>=Promise.resolve(),physicalDone=true;
 const admission=new StageAdmission();let armed:any,currentStep:any,syntheticClock=Date.parse('2026-10-18T01:00:00Z');
 const packets:any[]=[],sentAcks:any[]=[];
 try{
  guard=openStageBudget({mode:o.live?'live':'mock',ledgerPath:o.live?o.ledger!:join(o.out,'mock-ledger.json'),authorization:'CX Stage eight fixed generations; synthetic inputs; original additional USD0.20 preserved',requestHash,
   ...(o.live?{expectedLedgerHash:o['ledger-hash'],expectedPriorCalls:151,approvedMaxCalls:159,authorizationOriginLedger:o.origin,approvedOriginHash:o['origin-hash'],approvedAdditionalUsd:.20}:{})});
  persist('ledger-before.json',guard.before);
  // Credentials are never read in prepare/rehearsal and never copied to artifacts.
  const key=o.live?parseEnv(readFileSync(o['key-file']!,'utf8')).DEEPSEEK_API_KEY:'synthetic-stage-key';assert(key?.trim(),'deepseek_key_missing');
  let settlePhysical:()=>void=()=>{};
  const transport:typeof fetch=async(url,init)=>{
   assert(armed,'unarmed_transport');const body=JSON.parse(String(init?.body));assert.deepEqual(body,armed.request,'wire_request_changed');
   physicalDone=false;physical=new Promise<void>(done=>settlePhysical=done);
   calls.transportCalls++;if(o.live){calls.apiCalls++;return fetch(url,init);}
   const plan=armed.plan as Plan,formal=plan.speechStyle?.register==='formal';
   const sentence=plan.reengagement?'지금은 말하고 싶지 않아.':armed.scene.text.includes('파란색')?(formal?'파란색입니다.':'파란색이야.'):armed.scene.text.includes('3시')?(formal?'오후 3시입니다.':'오후 3시야.'):(formal?'해결되었다니 다행입니다.':'해결됐다니 다행이야.');
   // Deliberately identical consecutive captions prove segment identity, not text-change observation.
   const sentences=Array.from({length:Math.min(2,plan.maxSentences)},()=>sentence);
   const content=JSON.stringify({...(!plan.reengagement?{content:sentence}:{}),sentences});
   return new Response(JSON.stringify({model:deepseekCandidate.model,choices:[{finish_reason:'stop',message:{role:'assistant',content}}],usage:{prompt_tokens:100,completion_tokens:40}}),{status:200,headers:{'content-type':'application/json'}});
  };
  const provider=new DeepSeekDialogue({localOnly:false,allowPaidProviders:true,apiKey:key!,budget:guard.budget,fetcher:transport,onResponse:r=>{armed.raw=r;},onCall:r=>{armed.call=r;physicalDone=true;settlePhysical();}});
  const wrapped:DialogueGenerator={name:provider.name,model:provider.model,counter:provider.counter,readiness:()=>provider.readiness(),
   fitConversation:async(plan,context)=>{admission.check(context);return provider.fitConversation(plan,context);},
   dialogue:async(plan,context)=>{
    admission.consume(context);armed.plan=plan;armed.context=context;
    armed.request=deepseekPayload(buildDialogueRequest(plan,context,provider.model,{promptVariant:'conversation-history-v1'}),256);armed.requestHash=sha(json(armed.request));
    armed.decoded=await provider.dialogue(plan,context);return armed.decoded;
   }};
  const appraiser:AppraisalProvider={name:'synthetic-stage-control',model:'recorded',promptVersion:'cx-stage-v1',readiness:()=>({status:'blocked',inferenceVerified:false,errorCode:'unexpected_appraisal'}),evaluate:async()=>{throw Error('unexpected_appraisal');}};
  const url=new URL(o.database!),adminUrl=new URL(url);adminUrl.pathname='/postgres';const admin=new Database(adminUrl.href);
  try{assert.equal((await admin.pool.query('SELECT 1 FROM pg_database WHERE datname=$1',[url.pathname.slice(1)])).rowCount,0,'test_database_exists');await admin.pool.query('CREATE DATABASE '+url.pathname.slice(1));}finally{await admin.close();}
  db=new Database(url.href);await migrate(db);await seed(db,syntheticClock);store=new Store(db,undefined,()=>syntheticClock);
  await db.own(store.characterId,()=>admission.stop());
  const prepSession=randomUUID();await store.startSession(prepSession,randomUUID(),'1');result.seed=await seedContextualStageSources(store,prepSession);await store.stopSession(prepSession,randomUUID());
  runtime=await createServer(store,wrapped,appraiser,{timer:false,syntheticIdentities:true,staticRoot:o.ui});
  const originalFailure=runtime.coordinator.sink.failure;runtime.coordinator.sink.failure=code=>{admission.stop();result.failures.push(code);originalFailure(code);};
  await runtime.app.listen({host:'127.0.0.1',port:3001});
  const exchange=await runtime.app.inject({method:'POST',url:'/api/auth/exchange',headers:{origin:'http://127.0.0.1:3001','content-type':'application/json'},payload:{code:runtime.studioCode,clientInstanceId:randomUUID()}});assert.equal(exchange.statusCode,200);const token=exchange.json().data.accessToken;
  const api=async(path:string,body?:unknown)=>{const r=await runtime!.app.inject({method:body===undefined?'GET':'POST',url:path,headers:{authorization:'Bearer '+token,origin:'http://127.0.0.1:3001','idempotency-key':randomUUID(),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{payload:body as any})});assert.equal(r.statusCode,200,'local_api_'+path+'_'+r.body);return r.json().data;};
  browser=await chromium.launchPersistentContext(join(o.out,'chrome-profile'),{headless:true,executablePath:o.chrome,viewport:{width:1280,height:800},downloadsPath:join(o.out,'downloads'),env:{...process.env,TEMP:join(o.out,'tmp'),TMP:join(o.out,'tmp')}});
  await installStageObserver(browser);await browser.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:3001'?route.continue():route.abort());
  let group='',previous:any;
  for(const scene of contextualStageScenes){
   assert.deepEqual(result.failures,[],'prior_runtime_failure');
   assert.deepEqual(sourceHashes(),source,'source_changed_during_run');assert.deepEqual(uiHashes(o.ui),ui,'ui_changed_during_run');
   if(group!==scene.group){
    if(sessionId)await api('/api/sessions/'+sessionId+'/stop',{reason:'operator_stop'});await page?.close();
    sessionId=randomUUID();await api('/api/sessions',{sessionId,characterId:store.characterId,configVersion:'1'});group=scene.group;previous=undefined;
    const pairing=await api('/api/stage-pairings',{});page=await browser.newPage();page.on('pageerror',e=>{result.browserErrors.push(e.message);result.failures.push('browser_page_error');admission.stop();});
    page.on('websocket',socket=>{socket.on('framereceived',frame=>{const p=JSON.parse(String(frame.payload));if(['response.start','speech.segment','response.sealed','response.cancel','command.result','runtime.status'].includes(p.type))packets.push({...p,receivedAtMs:performance.now()});});socket.on('framesent',frame=>{const p=JSON.parse(String(frame.payload));if(['caption.shown','caption.finished'].includes(p.type))sentAcks.push({...p,observedAtMs:performance.now()});});});
    await page.goto('http://127.0.0.1:3001/stage#pair='+pairing.code);
    let stages:any[]=[];await expect.poll(async()=>{stages=await api('/api/stages');return stages.filter(s=>s.ready).length;},{timeout:15000}).toBe(1);
    await api('/api/sessions/'+sessionId+'/output-owner',{stageClientId:stages.find(s=>s.ready).clientId,previousStageClosed:false});await expect(page.locator('.stage-status')).toContainText('자막 출력 중');
   }
   syntheticClock+=100;const beforeCalls:number=guard.accounting().newCalls,beforePackets=packets.length,beforeObs:number=(await readStageObservations(page!)).length;
   const fixture:Awaited<ReturnType<typeof prepareContextualStageTurn>>=await runtime.coordinator.control(()=>prepareContextualStageTurn(store!,sessionId!,scene));
   for(const cause of result.seed.causes){const emotion=cause.emotion as 'joy'|'frustration';assert(fixture.after.affect[emotion].value>=.6,'controlled_affect_lost');assert(fixture.after.affect[emotion].causes.some(c=>c.eventId===cause.eventId),'controlled_cause_lost');}
   const step:any={scene,fixture,sessionId,packetOffset:beforePackets,observationOffset:beforeObs,sentAckOffset:sentAcks.length};currentStep=step;result.steps.push(step);persist('results.json',result);
   if(!fixture.response){
    await runtime.coordinator.tick();await page!.waitForTimeout(250);assert.equal(guard.accounting().newCalls,beforeCalls);assert.equal((await readStageObservations(page!)).length,beforeObs);assert.equal(packets.slice(beforePackets).filter(p=>['response.start','speech.segment','response.sealed'].includes(p.type)).length,0);await expect(page!.locator('.caption')).toHaveText('');
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM speech_segments s JOIN response_runs r ON r.id=s.response_id WHERE r.session_id=$1',[sessionId])).rows[0].n,0);
    await collectStageStep(step,store,page,packets,sentAcks);assert.deepEqual(step.evidenceErrors,[]);assert.equal(step.sentAcks.length,0);assert.equal(step.dbAcks.length,0);assert.equal(step.busy,false);
    step.status='SILENCE_PASS';currentStep=undefined;persist('results.json',result);continue;
   }
   if(previous){const history:ConversationSnapshot['turns'][number]|undefined=fixture.context!.conversation!.turns.find(t=>t.source.id===previous.response.id);assert(history,'delivered_history_missing');assert.equal(history.text,previous.decoded.join(' '));assert.deepEqual(history.source,{kind:'response',id:previous.response.id,generationEpoch:previous.response.generation_epoch});}
   armed=step;admission.arm(fixture.inputId);const started=performance.now();
   const dispatch=runtime.coordinator.dispatch(fixture.response.id);await dispatch;await physical;
   assert.equal(guard.accounting().newCalls,beforeCalls+1);assert(step.raw&&!step.raw.truncated&&step.decoded,'generation_record_missing');
   await expect(page!.locator('.caption')).not.toHaveText('',{timeout:12000});await page!.screenshot({path:join(o.out,scene.id.replaceAll('/','-')+'.png')});
   await expect.poll(async()=>{step.response=(await db!.pool.query('SELECT * FROM response_runs WHERE id=$1',[fixture.response!.id])).rows[0];if(['failed','cancelled','interrupted'].includes(step.response.status))throw Error('delivery_'+step.response.status);return step.response.status;},{timeout:45000}).toBe('completed');
   const observations=(await readStageObservations(page!)).filter(e=>e.payload.responseId===fixture.response!.id),ackIds=new Set(observations.map(e=>e.requestId));await expect.poll(()=>packets.filter(p=>p.type==='command.result'&&ackIds.has(p.payload.requestId)).length,{timeout:5000}).toBe(observations.length);
   await collectStageStep(step,store,page,packets,sentAcks);assert.deepEqual(step.evidenceErrors,[]);
   if(!scene.expected.concealAffect)for(const cause of result.seed.causes)assert(step.sources.some((s:any)=>s.event_id===cause.eventId&&s.source_version===cause.evidence.revision),'cause_dependency_missing');
   assertStageEvidence({response:step.response,expectedExpression:scene.expected.expression,decoded:step.decoded,segments:step.segments,packets:step.packets,observations:step.observations,dbAcks:step.dbAcks});
   assert.equal(step.sentAcks.length,step.decoded.length*2);
   step.latency={firstSegmentMs:step.packets.find((p:any)=>p.type==='speech.segment').receivedAtMs-started,firstCaptionAckMs:step.sentAcks.find((p:any)=>p.type==='caption.shown').observedAtMs-started,completionMs:performance.now()-started};
   assert.equal(step.busy,false);assert.deepEqual(result.browserErrors,[]);admission.done();previous=step;step.status='DELIVERY_PASS_QUALITY_DEFERRED';armed=undefined;currentStep=undefined;persist('results.json',result);console.log(json({id:scene.id,status:step.status,segments:step.decoded.length}));
  }
  assert.equal(admission.calls,8);assert.equal(guard.accounting().newCalls,8);assert.deepEqual(result.browserErrors,[]);assert.deepEqual(result.failures,[]);
  if(sessionId){await api('/api/sessions/'+sessionId+'/stop',{reason:'operator_stop'});sessionId=undefined;}
  assert.deepEqual(sourceHashes(),source);assert.deepEqual(uiHashes(o.ui),ui);
  result.status='TECHNICAL_PASS_QUALITY_DEFERRED';result.claims.dbStageDelivery='PASS';result.claims.actualGeneration=o.live?'PASS':'NOT_TESTED_SYNTHETIC_HTTP';
 }catch(error){admission.stop();result.status='FAIL';result.failures.push(error instanceof Error?error.message:'unknown_failure');if(currentStep)currentStep.status='FAIL';process.exitCode=1;}
 finally{
  await physical;result.physicalDrained=physicalDone;
  if(currentStep&&store)await collectStageStep(currentStep,store,page,packets,sentAcks);
  result.cleanup={errors:[]};const cleanup=async(label:string,fn:()=>Promise<unknown>)=>{try{await fn();}catch(e){result.cleanup.errors.push(label+': '+(e instanceof Error?e.message:'unavailable'));}};
  // Retain pre-cleanup evidence above, then end only this isolated run's session.
  if(sessionId&&store&&runtime)await cleanup('session',async()=>{await runtime!.coordinator.cancelAll(sessionId!,'operator_stop');await runtime!.coordinator.control(()=>store!.stopSession(sessionId!,randomUUID()));});
  if(store)await cleanup('final-state',async()=>{result.cleanup.busyAfter=await store!.busy();result.cleanup.responses=(await store!.db.pool.query('SELECT id,status,cancel_reason FROM response_runs WHERE id=ANY($1::uuid[])',[result.steps.flatMap((s:any)=>s.fixture.response?[s.fixture.response.id]:[])])).rows;});
  if(browser)await cleanup('browser',()=>browser!.close());if(runtime)await cleanup('runtime',()=>runtime!.app.close());if(db)await cleanup('database',()=>db!.close());
  Object.assign(result,finishStageRunAccounting(guard,calls,physicalDone));
  if(result.accountingErrors.length||result.cleanup.errors.length){result.status='FAIL';result.failures.push(...result.accountingErrors,...result.cleanup.errors);process.exitCode=1;}
  persist('results.json',result);console.log(json({status:result.status,steps:result.steps.length,apiCalls:result.apiCalls,failures:result.failures}));
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await runContextualStage(process.argv.slice(2));
