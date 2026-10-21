// H2-A fixed synthetic acceptance journey. Rehearsal never reads a key or calls a provider.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {parseEnv} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {fork,type ChildProcess} from 'node:child_process';
import {chromium,expect,type BrowserContext,type Page} from '@playwright/test';
import {Database} from '../packages/database/src/connection.ts';
import {Store} from '../packages/database/src/store.ts';
import {migrate} from '../packages/database/src/migrate.ts';
import {seed,IDENTITY_IDS} from '../packages/database/src/seed.ts';
import {stageExpression} from '../packages/character-core/src/index.ts';
import {DialogueBudget,openaiCandidate} from '../packages/adapters/src/openai.ts';
import {knowledgeNegativeFixture} from './knowledge-negative-fixture.ts';
import {captureStageCaption} from './browser/caption.ts';

const args=process.argv.slice(2),mode=args[0],live=mode==='--live';
assert(['--preflight','--rehearsal','--live'].includes(mode??'')&&args[1]==='--attempt'&&/^r[1-3]$/.test(args[2]??''),'explicit_mode_and_attempt_required');
assert.equal(args.length,live?5:3);if(live)assert.deepEqual(args.slice(3),['--synthetic-inputs','--allow-paid-providers']);
const base='J:/ai/ai-character-runtime',attempt=args[2]!,root=resolve(`${base}/home-assistant-h2a-${live?'live':'rehearsal'}-20261017-${attempt}`);
const actualLedger=`${base}/openai-generation-20261014/budget.json`,profile=parseEnv(readFileSync(`${base}/text-mvp-20261015/app.env`,'utf8'));
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8')),hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const fixture=read('evals/fixtures/persistence-v1.json');assert.equal(fixture.syntheticOnly,true);assert.equal(fixture.liveScenes.length,9);
const sourceFiles=['evals/persistence-stage.ts','evals/persistence-stage-runtime.ts','evals/knowledge-negative-fixture.ts','evals/jev-fixture.ts','evals/fixtures/persistence-v1.json','evals/browser/caption.ts','packages/database/migrations/0006_home_assistant_persistence.sql','packages/database/src/store.ts','packages/database/src/knowledge-store.ts','packages/database/src/personal-fact-store.ts','packages/adapters/src/openai.ts','packages/adapters/src/openai-conversation.ts','packages/adapters/src/openai-interaction.ts','packages/adapters/src/openai-interaction-v3.ts','packages/adapters/src/openai-interaction-v5.ts','packages/adapters/src/dialogue-request.ts','packages/adapters/src/postgres-knowledge.ts','packages/character-core/src/index.ts','packages/contracts/src/ai-ports.ts','packages/contracts/src/domain.ts','packages/contracts/src/personal-facts.ts','packages/contracts/src/local-config.ts','apps/runtime/src/providers.ts','apps/runtime/src/coordinator/index.ts','apps/runtime/src/http/server.ts','apps/studio/src/main.tsx','apps/studio/src/personal-facts.tsx','apps/studio/src/style.css','apps/studio/src/wire.ts'];
const studioDist=resolve(`${base}/home-assistant-h2a-20261017/ui-r1`),index=resolve(studioDist,'index.html');
const assets=[...readFileSync(index,'utf8').matchAll(/(?:src|href)="(\/assets\/[A-Za-z0-9_.-]+)"/g)].map(m=>resolve(studioDist,'.'+m[1]));
assert(assets.some(p=>p.endsWith('.js')&&readFileSync(p,'utf8').includes('personal-facts')),'h2a_ui_required');
const sourceHashes=Object.fromEntries(sourceFiles.map(p=>[p,hash(p)])),studioHashes=Object.fromEntries([index,...assets].map(p=>[p,hash(p)]));
const assertSources=()=>{for(const [p,digest] of Object.entries({...sourceHashes,...studioHashes}))assert.equal(hash(p),digest,'source_changed: '+p);};
assert(!existsSync(actualLedger+'.lock'),'ledger_in_use');
const original=read(actualLedger),originalHash=hash(actualLedger),historical={count:profile.OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID,dialogue:profile.OPENAI_ACKNOWLEDGED_DIALOGUE_ENTRY_ID};
assert.equal(original.version,1);assert.equal(original.model,openaiCandidate.model);assert([3.5,3.6].includes(original.limitUsd),'unexpected_ledger_limit');
assert.equal(new Set(original.entries.map((e:any)=>e.id)).size,original.entries.length);
const unresolved=original.entries.filter((e:any)=>e.status!=='completed');
assert.equal(unresolved.length,2);assert(unresolved.every((e:any)=>e.status==='unknown'&&historical[e.kind as keyof typeof historical]===e.id),'new_unresolved_usage');
const counts=(ledger:any)=>Object.fromEntries(['count','dialogue','decision'].map(kind=>[kind,ledger.entries.filter((e:any)=>e.kind===kind).length]));
const actualBefore=counts(original),caps={count:18,dialogue:9,decision:6};
const actualAuth={authorization:live?`User-approved H2-A synthetic validation: nine scenes, at most nine dialogue, six decision and eighteen count calls within the separately approved ledger ceiling USD${original.limitUsd}. Preserve historical reservations; stop on failure.`:'H2-A read-only preflight. No authorization for new calls or a ledger limit change.',maxDialogueCalls:actualBefore.dialogue+caps.dialogue,maxDecisionCalls:actualBefore.decision+caps.decision,acknowledgedCountEntryId:historical.count,acknowledgedDialogueEntryId:historical.dialogue};
const actualBudget=new DialogueBudget(actualLedger,original.limitUsd,undefined,actualAuth),actualSummary=actualBudget.summary();
const rehearsalRoot=resolve(`${base}/home-assistant-h2a-rehearsal-20261017-${attempt}`);
function preflight(){
 const p=resolve(rehearsalRoot,'results.json'),rehearsal=existsSync(p)?read(p):null;
 const valid=rehearsal?.status==='REHEARSAL_PASS'&&JSON.stringify(rehearsal.sourceHashes)===JSON.stringify(sourceHashes)&&JSON.stringify(rehearsal.studioHashes)===JSON.stringify(studioHashes);
 // All reservations retained, even though successful model usage normally releases most of them.
 const rows=valid?rehearsal.requests.map((r:any)=>({kind:r.kind,bytes:Buffer.byteLength(JSON.stringify(r.body)),usd:((Buffer.byteLength(JSON.stringify(r.body))+1024)*(r.kind==='decision'?.1:2.5)+(r.kind==='dialogue'?256*10:0))/1e6})):[];
 const observedReservationUsd=rows.reduce((sum:number,r:any)=>sum+r.usd,0);
 const used=Object.fromEntries(Object.keys(caps).map(kind=>[kind,rows.filter((r:any)=>r.kind===kind).length]));
 const extraCounts=Math.max(0,caps.count-used.count),largestCount=Math.max(0,...rows.filter((r:any)=>r.kind==='count').map((r:any)=>r.usd));
 const planningEstimateUsd=valid?observedReservationUsd*1.25+extraCounts*largestCount:null;
 return {status:valid?'PREPARED_NOT_AUTHORIZED':'REHEARSAL_REQUIRED',caps,actualSummary,observedReservationUsd,planningEstimateUsd,estimateIsHardBound:false,withinCurrentGuard:planningEstimateUsd!==null&&planningEstimateUsd<=actualSummary.remainingGuardUsd,suggestedTotalLimitUsd:planningEstimateUsd===null?null:Math.ceil((actualSummary.enforcedTotalUsd+planningEstimateUsd)*10)/10,scope:'Original eight scenes plus unrelated greeting; explicit synthetic injection and controlled concealment. No retries. A larger ledger limit requires separate approval and is never written by this harness.',rehearsalRoot,sourceHashes,studioHashes};
}
if(mode==='--preflight'){console.log(JSON.stringify(preflight(),null,2));process.exit(0);}
if(live){const check=preflight();assert.equal(check.status,'PREPARED_NOT_AUTHORIZED');assert(check.withinCurrentGuard,'planning_estimate_exceeds_guard');}
assert(!existsSync(root),'evidence_exists');mkdirSync(root);mkdirSync(resolve(root,'tmp'));
process.env.TEMP=resolve(root,'tmp');process.env.TMP=process.env.TEMP;
const ledger=live?actualLedger:resolve(root,'mock-budget.json');
if(!live)writeFileSync(ledger,JSON.stringify({version:1,model:openaiCandidate.model,limitUsd:10,entries:[]}));
const before=read(ledger),starting=counts(before),limitUsd=before.limitUsd;
const authorization=live?actualAuth:{authorization:'H2-A offline rehearsal only. Dummy key and intercepted HTTP; no paid authorization.',maxDialogueCalls:caps.dialogue,maxDecisionCalls:caps.decision};
const budget=new DialogueBudget(ledger,limitUsd,undefined,authorization),budgetBefore=budget.summary();
const url=new URL(profile.DATABASE_URL!);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55434');
url.pathname=`/character_runtime_h2a_${live?'live':'rehearsal'}_20261017_${attempt}`;
assert.equal(profile.APPRAISAL_PROVIDER,'openai-decisions-v5');assert.equal(profile.DIALOGUE_PROVIDER,'openai');
const key=live?parseEnv(readFileSync('runtime-data/dialogue-api.env','utf8')).DIALOGUE_API_KEY:'synthetic-no-network';assert(key?.trim(),'key_missing');
const env={...process.env,...profile,DATABASE_URL:url.href,DIALOGUE_API_KEY:key,TYPESAFE_API_KEY:'',STUDIO_DIST_PATH:studioDist,LOCAL_ONLY:'false',ALLOW_PAID_PROVIDERS:'true',DIALOGUE_BUDGET_PATH:ledger,DIALOGUE_BUDGET_USD:String(limitUsd),OPENAI_BUDGET_AUTHORIZATION:authorization.authorization,OPENAI_MAX_DIALOGUE_CALLS:String(starting.dialogue+caps.dialogue),OPENAI_MAX_DECISION_CALLS:String(starting.decision+caps.decision),OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID:live?historical.count:'',OPENAI_ACKNOWLEDGED_DIALOGUE_ENTRY_ID:live?historical.dialogue:'',H2A_MAX_COUNT_CALLS:String(starting.count+caps.count),TEMP:resolve(root,'tmp'),TMP:resolve(root,'tmp')};
const result:any={status:'RUNNING',mode,scenes:fixture.liveScenes,sourceHashes,studioHashes,caps,budgetBefore,steps:[],requests:[],interventions:[],packets:[],browserErrors:[],children:[],claims:{actualProviders:live,semanticQuality:'NOT_VERIFIED',naturalConcealment:'NOT_TESTED',userAcceptance:'NOT_VERIFIED'}};
const persist=()=>writeFileSync(resolve(root,'results.json'),JSON.stringify(result,null,2)+'\n');
writeFileSync(resolve(root,'ledger-before.json'),JSON.stringify(before,null,2)+'\n');persist();
const db=new Database(url.href),store=new Store(db),operator=IDENTITY_IDS[3];
let child:ChildProcess|undefined,browser:BrowserContext|undefined,page:Page|undefined,stage:Page|undefined,sessionId:string|undefined,code='',armed=false;
async function stopChild(){
 if(!child||child.exitCode!==null||child.signalCode!==null)return;
 child.send('stop');try{await expect.poll(()=>child!.exitCode!==null||child!.signalCode!==null,{timeout:10000}).toBe(true);}catch{child.kill();await expect.poll(()=>child!.exitCode!==null||child!.signalCode!==null,{timeout:5000}).toBe(true);}
}
async function start(){
 code='';child=fork('evals/persistence-stage-runtime.ts',[live?'--live':'--rehearsal'],{execArgv:['--experimental-transform-types'],env,windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});result.children.push(child.pid);
 child.stderr!.on('data',()=>{});child.on('message',(m:any)=>{if(m.type==='ready')code=m.code;if(m.type==='request')result.requests.push({...m,at:Date.now()});if(m.type==='intervention')result.interventions.push(m);if(m.type==='armed')armed=true;});
 await expect.poll(()=>{assert.equal(child!.exitCode,null,'child_failed');return code;},{timeout:20000}).not.toBe('');
 browser=await chromium.launchPersistentContext(resolve(root,'chrome-'+result.children.length),{headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',viewport:{width:1400,height:1000},env,downloadsPath:resolve(root,'downloads')});
 page=await browser.newPage();page.on('pageerror',e=>result.browserErrors.push(e.message));await page.goto('http://127.0.0.1:3001/studio');await page.getByLabel('일회용 연결 코드').fill(code);await page.getByRole('button',{name:'연결',exact:true}).click();await expect(page.getByRole('heading',{name:'캐릭터 작업실'})).toBeVisible();
 assert.equal(await store.currentSession(),null);await newMeeting();
}
async function newMeeting(){
 if(stage)await stage.close();
 if(sessionId)await page!.getByRole('button',{name:'만남 종료'}).click();
 await page!.getByRole('button',{name:'새 만남 시작'}).click();await expect(page!.getByRole('button',{name:'만남 종료'})).toBeVisible();sessionId=(await store.currentSession())!.id;
 await expect(page!.getByLabel('대화 상대')).toHaveCount(0);
 const popup=browser!.waitForEvent('page');await page!.getByRole('button',{name:'Stage 열기'}).click();stage=await popup;stage.on('pageerror',e=>result.browserErrors.push(e.message));
 stage.on('websocket',socket=>socket.on('framereceived',frame=>{const p=JSON.parse(String(frame.payload));if(['response.start','speech.segment','response.cancel'].includes(p.type))result.packets.push(p);}));
 await stage.waitForLoadState();await expect(page!.getByRole('button',{name:'출력 선택'})).toBeEnabled();await page!.getByRole('button',{name:'출력 선택'}).click();await expect(stage.locator('.stage-status')).toContainText('자막 출력 중');await expect(stage.locator('.caption')).toHaveText('');
}
async function http(path:string,method='GET',body?:unknown,headers:Record<string,string>={}){
 return page!.evaluate(async({path,method,body,headers})=>{const r=await fetch(path,{method,headers:{Authorization:`Bearer ${sessionStorage.getItem('accessToken')}`,Origin:location.origin,...(method==='GET'?{}:{'Idempotency-Key':crypto.randomUUID()}),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});const value=await r.json();if(!r.ok)throw Error(value.error?.code??'http_failure');return value.data;},{path,method,body,headers});
}
const factsPath=()=>`/api/sessions/${sessionId}/personal-facts`,docsPath=()=>`/api/sessions/${sessionId}/knowledge`;
async function dataState(){return {facts:(await db.pool.query('SELECT id,key,value,revision,deleted_at FROM personal_facts ORDER BY id')).rows,docs:(await db.pool.query('SELECT id,title,revision,deleted_at FROM knowledge_documents ORDER BY id')).rows};}
try{
 const adminUrl=new URL(url);adminUrl.pathname='/postgres';const admin=new Database(adminUrl.href);
 try{assert.equal((await admin.pool.query('SELECT 1 FROM pg_database WHERE datname=$1',[url.pathname.slice(1)])).rowCount,0,'database_exists');await admin.pool.query('CREATE DATABASE '+url.pathname.slice(1));}finally{await admin.close();}
 await migrate(db);await seed(db);await start();
 const fact=await http(factsPath(),'POST',{key:fixture.fact.key,value:fixture.fact.value});
 await http(factsPath(),'POST',fixture.adversarialFact);
 const document=await http(docsPath(),'POST',{title:fixture.document.title,body:fixture.document.body,retention:'persistent'});
 await http(docsPath(),'POST',{...fixture.distractorDocument,retention:'persistent'});
 await http(docsPath(),'POST',{title:'합성 임시 자료',body:'이번 만남에만 남는다.'});
 for(const scene of fixture.liveScenes){
  assertSources();assert.equal(await store.busy(),false);
  if(scene.id==='new-meeting'||scene.id==='persistent-document')await newMeeting();
  if(scene.id==='restart'){
   await browser!.close();browser=undefined;stage=undefined;await stopChild();sessionId=undefined;await start();
   assert((await http(factsPath())).facts.some((f:any)=>f.id===fact.id&&f.value===fixture.fact.value));
   assert(!(await http(docsPath())).some((d:any)=>d.title==='합성 임시 자료'));
  }
  if(scene.id==='edit')await http(`${factsPath()}/${fact.id}`,'PATCH',{key:fixture.fact.key,value:fixture.fact.replacement},{'If-Match':'"1"'});
  if(scene.id==='delete')await http(`${factsPath()}/${fact.id}`,'DELETE',undefined,{'If-Match':'"2"'});
  const step:any={id:scene.id,question:scene.question,expected:scene.expected,sessionId,before:(await store.state()).body};result.steps.push(step);
  if(scene.id==='edit-document-concealed'){
   await http(docsPath(),'POST',{documentId:document.documentId,title:fixture.document.title,body:fixture.document.replacement,retention:'persistent',expectedRevision:'1'});
   step.intervention=await knowledgeNegativeFixture(store,sessionId!,operator);assert((await store.state()).body.affect.frustration.value>.1);
   armed=false;child!.send('conceal-next');await expect.poll(()=>armed,{timeout:5000}).toBe(true);
  }
  if(scene.id==='delete-document')await http(`${docsPath()}/${document.documentId}`,'DELETE',undefined,{'If-Match':'"2"'});
  const knowledge=['persistent-document','edit-document-concealed','delete-document'].includes(scene.id),intent=knowledge?'knowledge':'chat',dataBefore=await dataState();
  step.submittedAt=Date.now();persist();await page!.getByLabel('입력 종류').selectOption(intent);await page!.getByLabel('할 말').fill(scene.question);await page!.getByRole('button',{name:'입력 보내기'}).click();
  let event:any,response:any;
  await expect.poll(async()=>{event=(await db.pool.query("SELECT id,attention_status FROM events WHERE session_id=$1 AND kind='chat.final' AND payload->>'text'=$2 AND id<>ALL($3::uuid[]) ORDER BY received_at DESC LIMIT 1",[sessionId,scene.question,result.steps.filter((s:any)=>s.eventId).map((s:any)=>s.eventId)])).rows[0];if(event?.attention_status==='expired')throw Error('input_expired');return event?.attention_status;},{timeout:60000}).toBe('observed');step.eventId=event.id;
  response=(await db.pool.query('SELECT r.* FROM response_runs r JOIN events phase ON phase.id=r.trigger_event_id WHERE phase.parent_event_id=$1',[event.id])).rows[0];assert(response,'no_response_no_forced_retry');step.responseId=response.id;
  step.visibleCaption=await captureStageCaption(stage!,resolve(root,scene.id+'.png'));step.firstCaptionMs=Date.now()-step.submittedAt;
  step.visibleCitations=await stage!.locator('.knowledge-citations').allTextContents();
  await expect.poll(async()=>{response=(await db.pool.query('SELECT * FROM response_runs WHERE id=$1',[response.id])).rows[0];if(['failed','cancelled','interrupted'].includes(response.status))throw Error('output_'+response.cancel_reason);return response.status;},{timeout:60000}).toBe('completed');
  step.plan=response.plan;step.personal=response.personal_context;step.knowledge=response.knowledge_context;
  step.segments=(await db.pool.query('SELECT id,text,text_shown_at,delivery_status FROM speech_segments WHERE response_id=$1 ORDER BY segment_index',[response.id])).rows;step.caption=step.segments.map((s:any)=>s.text).join(' ');assert.equal(step.visibleCaption,step.segments[0].text);
  step.acks=(await db.pool.query("SELECT kind,payload->>'segmentId' AS segment FROM events WHERE session_id=$1 AND kind IN ('caption.shown','caption.finished') AND payload->>'responseId'=$2",[sessionId,response.id])).rows;
  assert.equal(step.acks.length,step.segments.length*2);for(const s of step.segments){assert(s.text_shown_at);assert.equal(s.delivery_status,'finished');for(const kind of ['caption.shown','caption.finished'])assert.equal(step.acks.filter((a:any)=>a.kind===kind&&a.segment===s.id).length,1);}
  const startPacket=result.packets.find((p:any)=>p.type==='response.start'&&p.payload.responseId===response.id);assert(startPacket);assert.equal(startPacket.payload.expression,stageExpression(response.plan));
  if(knowledge){
   const expectedStatus=scene.id==='delete-document'?'not_found':'answered';assert.equal(step.knowledge.answer.status,expectedStatus);step.citations=startPacket.payload.knowledge.citations;
   if(expectedStatus==='not_found')assert.equal(step.citations.length,0);else assert(step.citations.some((c:any)=>c.documentId===document.documentId&&c.revision===(scene.id==='persistent-document'?'1':'2')));
   for(const c of step.citations){assert(step.knowledge.chunks.some((s:any)=>JSON.stringify(s)===JSON.stringify(c)),'citation_not_current_source');assert(step.visibleCitations.join(' ').includes(c.title),'citation_not_rendered');}
   assert.equal(step.personal,null);
  }else{
   assert.equal(step.personal.identityId,operator);const saved=step.personal.facts.find((f:any)=>f.id===fact.id);if(scene.id==='delete')assert.equal(saved,undefined);else assert.equal(saved.value,scene.id==='edit'?fixture.fact.replacement:fixture.fact.value);
  }
  if(scene.id==='edit-document-concealed'){assert.equal(step.plan.speechStyle.concealAffect,true);assert.equal(step.plan.speechStyle.register,'formal');assert.equal(startPacket.payload.expression,'neutral');assert((await store.state()).body.affect.frustration.value>.1);}
  assert.deepEqual(await dataState(),dataBefore,'provider_must_not_mutate_saved_data');assert.deepEqual(result.browserErrors,[]);assert.equal(await store.busy(),false);
  step.after=(await store.state()).body;step.status=live?'TECHNICAL_PASS_REVIEW_PENDING':'REHEARSAL_PASS';step.completedMs=Date.now()-step.submittedAt;persist();console.log(JSON.stringify({id:scene.id,status:step.status,caption:step.caption}));
 }
 assert.equal(result.interventions.length,1);result.status=live?'TECHNICAL_PASS_REVIEW_PENDING':'REHEARSAL_PASS';
}catch(error){result.status='FAIL';result.failure=error instanceof Error?error.message:String(error);process.exitCode=1;}
finally{
 if(page&&sessionId)await page.getByRole('button',{name:'만남 종료'}).click({timeout:3000}).catch(()=>{});
 // Do not interrupt a physical provider call after a logical timeout: wait for its accounting outcome.
 for(let n=0;n<3;n++){if(!read(ledger).entries.slice(before.entries.length).some((e:any)=>e.status==='reserved'))break;await expect.poll(()=>read(ledger).entries.slice(before.entries.length).filter((e:any)=>e.status==='reserved').length,{timeout:45000,intervals:[500,1000]}).toBe(0).catch(()=>{});}
 await browser?.close().catch(()=>{});await stopChild();await db.close();
 const after=read(ledger);result.budgetAfter=budget.summary();result.newEntries=after.entries.slice(before.entries.length);result.ledgerPreserved=JSON.stringify(after.entries.slice(0,before.entries.length))===JSON.stringify(before.entries)&&after.limitUsd===before.limitUsd;
 result.actualLedgerUnchanged=!live?hash(actualLedger)===originalHash:undefined;result.childExited=!child||child.exitCode!==null||child.signalCode!==null;
 result.cost={modelUsageEstimateUsd:result.budgetAfter.modelUsageEstimateUsd-budgetBefore.modelUsageEstimateUsd,enforcedGuardDeltaUsd:result.budgetAfter.enforcedTotalUsd-budgetBefore.enforcedTotalUsd,billingVerified:false};
 const times=result.steps.filter((s:any)=>s.firstCaptionMs).map((s:any)=>s.firstCaptionMs).sort((a:number,b:number)=>a-b);result.latency={measure:'submit_to_first_captured_stage_caption_ms',count:times.length,p50:times[Math.ceil(times.length*.5)-1]??null,p95:times[Math.ceil(times.length*.95)-1]??null};
 const delta=Object.fromEntries(Object.keys(caps).map(k=>[k,counts(after)[k]-starting[k]]));result.callDelta=delta;
 if(!result.ledgerPreserved||!live&&!result.actualLedgerUnchanged||result.newEntries.some((e:any)=>e.status!=='completed')||Object.entries(caps).some(([k,v])=>delta[k]>v)||['REHEARSAL_PASS','TECHNICAL_PASS_REVIEW_PENDING'].includes(result.status)&&(delta.dialogue!==9||delta.decision!==6)){result.status='FAIL';result.accountingFailure=true;process.exitCode=1;}
 for(const p of sourceFiles){const dest=resolve(root,'source',p);mkdirSync(dirname(dest),{recursive:true});copyFileSync(p,dest);if(hash(p)!==sourceHashes[p]){result.status='FAIL';result.sourceChanged=true;process.exitCode=1;}}
 persist();console.log(JSON.stringify({status:result.status,failure:result.failure,root,calls:delta,cost:result.cost,childExited:result.childExited,actualLedgerUnchanged:result.actualLedgerUnchanged}));
}
