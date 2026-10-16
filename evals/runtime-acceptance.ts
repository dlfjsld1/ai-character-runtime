// Fixed G3-S through the normal app and Chrome. Fixtures and authorized live
// runs share inputs and checks; fixture answers never reach live providers.
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {chromium,expect,type BrowserContext,type Page} from '@playwright/test';
import {Database} from '../packages/database/src/connection.ts';
import {Store} from '../packages/database/src/store.ts';
import {migrate} from '../packages/database/src/migrate.ts';
import {seed} from '../packages/database/src/seed.ts';
import {decay} from '../packages/character-core/src/index.ts';
import {captureStageCaption} from './browser/caption.ts';
import {acceptanceScenario} from './runtime-acceptance-cases.ts';

const args=process.argv.slice(2),live=args[0]==='--live',attempt=args[2],uncertainRepeat=!live&&args.length===4&&args[3]==='--uncertain-repeat';
if((live?(args.length!==5||args[3]!=='--synthetic-inputs'||args[4]!=='--allow-paid-providers'):((args.length!==3&&!uncertainRepeat)||args[0]!=='--synthetic-fixtures'))||args[1]!=='--attempt'||!/^r[1-9]\d*$/.test(attempt??''))throw Error('explicit_acceptance_scope_required');
const acceptanceScenes=acceptanceScenario(uncertainRepeat);
const mode=live?'live':'fixture';
const root=resolve('J:/ai/ai-character-runtime/g3-acceptance-'+mode+'-20261015-'+attempt),baseline=resolve('J:/ai/ai-character-runtime/runtime-baseline-20261015');
const databaseName='character_runtime_g3_'+mode+'_'+attempt;
if(existsSync(root))throw Error('acceptance_evidence_exists');
const paidLedger=resolve('J:/ai/ai-character-runtime/openai-generation-20261014/budget.json');
const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex'),paidBefore=hash(paidLedger);
const profile=parseEnv(readFileSync(resolve(baseline,'app-live.env'),'utf8')),url=new URL(profile.DATABASE_URL!);
const beforeLedger=JSON.parse(readFileSync(paidLedger,'utf8'));
const authorization=live?JSON.parse(readFileSync(resolve(baseline,'g3-hysteresis-authorization.json'),'utf8')):undefined;
if(live&&(authorization.afterHash!==paidBefore||authorization.nextRun.attempt!==attempt||beforeLedger.limitUsd!==3||beforeLedger.entries.length!==311||beforeLedger.entries.filter((e:any)=>e.kind==='decision').length!==96||beforeLedger.entries.filter((e:any)=>e.kind==='dialogue').length!==45))throw Error('live_ledger_changed_review_required');
const key=live?parseEnv(readFileSync(resolve('runtime-data/dialogue-api.env'),'utf8')).DIALOGUE_API_KEY:'synthetic-acceptance-key';
if(!key?.trim())throw Error('dialogue_key_missing');
url.pathname='/'+databaseName;if(url.hostname!=='127.0.0.1'||url.port!=='55434')throw Error('dedicated_database_required');
mkdirSync(root);mkdirSync(resolve(root,'tmp'));
const env:NodeJS.ProcessEnv={...process.env,...profile,DATABASE_URL:url.href,APPRAISAL_PROVIDER:'openai-decisions-v4',DIALOGUE_API_KEY:'synthetic-acceptance-key',TYPESAFE_API_KEY:'synthetic-unused',DIALOGUE_BUDGET_PATH:resolve(root,'synthetic-budget.json'),OPENAI_MAX_DECISION_CALLS:'16',OPENAI_MAX_DIALOGUE_CALLS:'11',OPENAI_BUDGET_AUTHORIZATION:'Synthetic fixed G3-S rehearsal only; external fetch forbidden',OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID:'',OPENAI_ACKNOWLEDGED_DIALOGUE_ENTRY_ID:'',RUNTIME_ACCEPTANCE_FIXTURES:'true',RUNTIME_ACCEPTANCE_ATTEMPT:attempt,TEMP:resolve(root,'tmp'),TMP:resolve(root,'tmp')};
if(live)Object.assign(env,{DIALOGUE_API_KEY:key,DIALOGUE_BUDGET_PATH:paidLedger,DIALOGUE_BUDGET_USD:'3',OPENAI_MAX_DECISION_CALLS:'112',OPENAI_MAX_DIALOGUE_CALLS:'56',OPENAI_BUDGET_AUTHORIZATION:authorization.authorization,OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID:'3f1c4f32-41f7-42f2-b05e-dfe0d65aaaef',OPENAI_ACKNOWLEDGED_DIALOGUE_ENTRY_ID:authorization.acknowledgedDialogueEntryId,RUNTIME_ACCEPTANCE_FIXTURES:'false'});
env.RUNTIME_ACCEPTANCE_SCENARIO=uncertainRepeat?'uncertain-repeat':'baseline';
const sources=['evals/runtime-acceptance.ts','evals/runtime-acceptance-cases.ts','evals/runtime-acceptance-fixtures.ts','evals/interaction-fixture.ts','evals/browser/caption.ts','apps/runtime/src/index.ts','apps/runtime/src/providers.ts','apps/runtime/src/http/server.ts','apps/runtime/src/coordinator/index.ts','apps/studio/src/main.tsx','apps/studio/src/wire.ts','packages/database/src/store.ts','packages/adapters/src/openai.ts','packages/adapters/src/openai-interaction.ts','packages/adapters/src/openai-interaction-v3.ts','packages/adapters/src/openai-interaction-v4.ts','packages/adapters/src/dialogue-request.ts','packages/contracts/src/conversation.ts','packages/contracts/src/domain.ts','packages/contracts/src/local-config.ts','packages/character-core/src/index.ts'];
const result:any={status:'RUNNING',scope:'G3-S fixed 16-input rehearsal; normal app and Chrome, synthetic provider transport',sourceHashes:Object.fromEntries(sources.map(p=>[p,hash(p)])),paidLedgerBeforeHash:paidBefore,scenes:acceptanceScenes,steps:[],packets:[],browserErrors:[],claims:{actualProviderQuality:'NOT_VERIFIED',koreanNaturalness:'NOT_VERIFIED',naturalConcealment:'NOT_VERIFIED',fixtureConcealmentReachability:'NOT_VERIFIED',creatorAcceptance:'NOT_VERIFIED'}};
result.scenario=env.RUNTIME_ACCEPTANCE_SCENARIO;result.unreached=[];
if(live){result.scope='G3-S fixed 16 synthetic inputs; actual Decisions v4 and OpenAI generation, normal app and Chrome';result.scenes=acceptanceScenes.map(({acts,intensity,caption,...s})=>s);result.authorization=authorization;}
writeFileSync(resolve(root,'manifest.json'),JSON.stringify({scope:result.scope,scenes:result.scenes,sourceHashes:result.sourceHashes,paidLedgerBeforeHash:paidBefore,limits:live?{usd:3,decision:112,dialogue:56}:{usd:1,decision:16,dialogue:11},models:{appraisal:env.APPRAISAL_MODEL,dialogue:env.DIALOGUE_MODEL}},null,2)+'\n');
const persist=()=>writeFileSync(resolve(root,'results.json'),JSON.stringify(result,null,2)+'\n');persist();
const db=new Database(url.href);let child:ChildProcess|undefined,browser:BrowserContext|undefined,page:Page|undefined,stage:Page|undefined,sessionId:string|undefined;
try{
 const adminUrl=new URL(url);adminUrl.pathname='/postgres';const admin=new Database(adminUrl.href);
 try{if((await admin.pool.query('SELECT 1 FROM pg_database WHERE datname=$1',[databaseName])).rowCount)throw Error('acceptance_database_exists');await admin.pool.query('CREATE DATABASE '+databaseName);}finally{await admin.close();}
 await migrate(db);await seed(db);const store=new Store(db);
 let stdout='',stderr='';child=spawn(process.execPath,['--experimental-transform-types',...(live?[]:['--import','./evals/runtime-acceptance-fixtures.ts']),'apps/runtime/src/index.ts'],{cwd:process.cwd(),env,windowsHide:true,stdio:['ignore','pipe','pipe']});result.pid=child.pid;child.stdout!.on('data',x=>stdout+=String(x));child.stderr!.on('data',x=>stderr+=String(x));
 await expect.poll(()=>{if(child?.exitCode!==null)throw Error('acceptance_entry_failed_'+stderr.split(/\r?\n/).filter(x=>x.startsWith('Runtime unavailable:')).join(''));return /일회용 Studio 코드: ([a-f0-9]{64})/.exec(stdout)?.[1]??'';},{timeout:15000}).not.toBe('');
 browser=await chromium.launchPersistentContext(resolve(root,'chrome-profile'),{headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',viewport:{width:1400,height:1000},env,downloadsPath:resolve(root,'downloads')});page=await browser.newPage();page.on('pageerror',e=>result.browserErrors.push(e.message));await page.goto('http://127.0.0.1:3001/studio');await page.getByLabel('일회용 연결 코드').fill(/일회용 Studio 코드: ([a-f0-9]{64})/.exec(stdout)![1]!);await page.getByRole('button',{name:'연결',exact:true}).click();await expect(page.getByRole('heading',{name:'캐릭터 작업실'})).toBeVisible();
 await page.getByRole('button',{name:'새 만남 시작'}).click();await expect(page.getByRole('button',{name:'만남 종료'})).toBeVisible();sessionId=(await store.currentSession())!.id;result.sessionId=sessionId;
 const popup=browser.waitForEvent('page');await page.getByRole('button',{name:'Stage 열기'}).click();stage=await popup;stage.on('pageerror',e=>result.browserErrors.push(e.message));stage.on('websocket',socket=>socket.on('framereceived',frame=>{const p=JSON.parse(String(frame.payload));if(['speech.segment','response.start','response.cancel'].includes(p.type))result.packets.push(p);}));await stage.waitForLoadState();await expect(page.getByRole('button',{name:'출력 선택'})).toBeEnabled();await page.getByRole('button',{name:'출력 선택'}).click();await expect(stage.locator('.stage-status')).toContainText('자막 출력 중');
 for(const scene of acceptanceScenes){
  if(scene.pauseMs)await new Promise(r=>setTimeout(r,scene.pauseMs));
  const step:any={id:scene.id,text:scene.text,expectedSpeech:scene.speak,startedAt:Date.now(),before:(await store.state()).body};result.steps.push(step);persist();
  await page.getByLabel('할 말').fill(scene.text);await page.getByRole('button',{name:'입력 보내기'}).click();let event:any;
  await expect.poll(async()=>{event=(await db.pool.query("SELECT id,attention_status,identity_id FROM events WHERE session_id=$1 AND kind='chat.final' AND payload->>'text'=$2 AND id<>ALL($3::uuid[]) ORDER BY received_at DESC LIMIT 1",[sessionId,scene.text,result.steps.filter((s:any)=>s.eventId).map((s:any)=>s.eventId)])).rows[0];return event?.attention_status;},{timeout:live?90000:15000}).toBe('observed');step.eventId=event.id;step.identityId=event.identity_id;
  step.appraisal=(await db.pool.query('SELECT status,provider,model,prompt_version,failure_code,context_refs,provider_result,usage FROM appraisals WHERE event_id=$1',[event.id])).rows[0];step.after=(await store.state()).body;
  step.transition=(await db.pool.query('SELECT t.effects FROM transitions t JOIN events phase ON phase.id=t.source_event_id WHERE phase.parent_event_id=$1 ORDER BY t.state_version DESC LIMIT 1',[event.id])).rows[0];
  expect(step.appraisal).toMatchObject({status:'accepted',prompt_version:'openai-interaction-v4',failure_code:null});
  const response=(await db.pool.query('SELECT r.id,r.status,r.plan FROM response_runs r JOIN events phase ON phase.id=r.trigger_event_id WHERE phase.parent_event_id=$1',[event.id])).rows[0];
  if(!scene.speak){
   expect(response).toBeUndefined();step.silence=step.after.turn.recentSilences.find((s:any)=>s.eventId===event.id);expect(step.silence?.reason).toBe(scene.silence);expect(await store.busy()).toBe(false);await expect(stage.locator('.caption')).toHaveText('');
  }else{
   expect(response).toBeDefined();step.response=response;persist();
   step.visibleCaption=await captureStageCaption(stage,resolve(root,scene.id+'-stage.png'));
   await expect.poll(async()=>{const row=(await db.pool.query('SELECT status,cancel_reason FROM response_runs WHERE id=$1',[response.id])).rows[0];if(['failed','cancelled','interrupted'].includes(row.status))throw Error('output_'+row.cancel_reason);return row.status;},{timeout:15000}).toBe('completed');
   step.segments=(await db.pool.query('SELECT id,text,text_shown_at,delivery_status FROM speech_segments WHERE response_id=$1 ORDER BY segment_index',[response.id])).rows;
   if(!live)expect(step.segments.map((s:any)=>s.text)).toEqual([scene.caption]);expect(step.visibleCaption).toBe(step.segments[0].text);expect(step.segments.every((s:any)=>s.text_shown_at&&s.delivery_status==='finished')).toBe(true);expect(await store.busy()).toBe(false);
   // Reachability is a product target, not a transport failure. Preserve misses
   // without abandoning the remaining fixed conversation or calling them PASS.
   if(scene.disclosure){
    const actual=response.plan.reengagement?.disclosure;
    step.disclosureReachability=actual===scene.disclosure?'PASS':'NOT_REACHED';
    if(actual!==scene.disclosure)result.unreached.push({caseId:scene.id,expected:scene.disclosure,actual:actual??null,frustration:step.after.affect.frustration.value});
    if(scene.disclosure==='deflect')result.claims[live?'naturalConcealment':'fixtureConcealmentReachability']=step.disclosureReachability;
   }
  }
  if(scene.id==='L1-1'){expect(step.after.affect.joy.value).toBeGreaterThan(0);if(!live)expect(step.transition.effects.affectEvidence).toMatchObject({basis:'confirmed_event_baseline'});}
  else if(!scene.acts.direct_attack&&!scene.acts.apology){
   const expected=decay(step.before,step.after.mood.asOf).affect;
   // PostgreSQL JSON numbers can round-trip one ULP differently from JS.
   for(const key of ['joy','frustration','surprise','embarrassment'] as const){const {value,...rest}=step.after.affect[key],{value:expectedValue,...expectedRest}=expected[key];expect(value).toBeCloseTo(expectedValue,12);expect(rest).toEqual(expectedRest);}
  }
  if(['L2-3','L2-5'].includes(scene.id))expect(response.plan.reengagement.silenceEventId).toBe(result.steps.find((s:any)=>s.id==='L2-2').eventId);
  if(scene.id==='L3-2')expect(response.plan.reengagement).toMatchObject({silenceEventId:result.steps.find((s:any)=>s.id==='L3-1').eventId,disclosure:'explain'});
  if(scene.id==='L2-4')expect(step.after.affect.frustration.value).toBeGreaterThan(0);
  if(scene.id==='L4-3'){
   expect(response.plan.purpose).toBe('acknowledge_repair');expect(step.transition.effects.repairUsed?.candidateEventId).toBe(result.steps.find((s:any)=>s.id==='L4-2').eventId);
   const beforeRepair=decay(step.before,step.after.mood.asOf).affect.frustration.value,amount=beforeRepair-step.after.affect.frustration.value;step.repairAmount=amount;expect(amount).toBeGreaterThan(0);expect(amount).toBeLessThanOrEqual(.030000000001);expect(step.after.affect.frustration.value).toBeGreaterThan(0);
  }
  step.contractStatus='PASS';step.status=step.disclosureReachability==='NOT_REACHED'?'NOT_REACHED':'PASS';step.completedAt=Date.now();persist();console.log(JSON.stringify({case:scene.id,status:step.status,speech:!!response,joy:step.after.affect.joy.value,frustration:step.after.affect.frustration.value,disclosure:response?.plan.reengagement?.disclosure??null}));
 }
 expect(new Set(result.steps.map((s:any)=>s.identityId)).size).toBe(1);expect(result.steps.filter((s:any)=>s.response)).toHaveLength(11);expect(result.steps.filter((s:any)=>s.silence)).toHaveLength(5);expect(result.browserErrors).toEqual([]);
 const segments=result.steps.flatMap((s:any)=>s.segments??[]);expect(result.packets.filter((p:any)=>p.type==='speech.segment').map((p:any)=>p.payload.segmentId).sort()).toEqual(segments.map((s:any)=>s.id).sort());
 result.repairMarkers=(await db.pool.query("SELECT effects->'repairUsed' AS marker FROM transitions WHERE effects ? 'repairUsed'")).rows;expect(result.repairMarkers).toHaveLength(1);
 await page.getByRole('button',{name:'만남 종료'}).click();await expect(page.getByRole('button',{name:'새 만남 시작'})).toBeVisible();result.sessionStatus=(await db.pool.query('SELECT status FROM sessions WHERE id=$1',[sessionId])).rows[0].status;expect(result.sessionStatus).toBe('ended');result.contractStatus='PASS';result.status=result.unreached.length?'NOT_REACHED':'PASS';if(result.unreached.length)process.exitCode=1;
}catch(error){result.status='FAIL';result.failure=error instanceof Error?error.message:String(error);process.exitCode=1;}
finally{
 if(page&&sessionId)await page.getByRole('button',{name:'만남 종료'}).click({timeout:1000}).catch(()=>{});
 // Cancellation can release the response before the physical API call ends.
 // Allow the adapter's 120s physical deadline to settle the existing request;
 // no new input, retry, ledger rewrite or reservation acknowledgement occurs.
 if(child&&child.exitCode===null&&child.signalCode===null){
  try{await expect.poll(()=>{
   const path=env.DIALOGUE_BUDGET_PATH!;if(!existsSync(path))return 0;
   const entries=JSON.parse(readFileSync(path,'utf8')).entries.slice(live?beforeLedger.entries.length:0);
   return entries.filter((e:any)=>e.status==='reserved').length;
  },{timeout:130000,intervals:[250,500,1000]}).toBe(0);result.accountingSettledBeforeExit=true;}
  catch{result.accountingSettledBeforeExit=false;result.status='FAIL';process.exitCode=1;}
 }
 await browser?.close().catch(()=>{});
 if(child&&child.exitCode===null&&child.signalCode===null){const running=child,ended=new Promise<void>(r=>running.once('exit',()=>r()));running.kill();await ended;}
 result.childExited=!child||child.exitCode!==null||child.signalCode!==null;await db.close();result.paidLedgerUnchanged=hash(paidLedger)===paidBefore;
 result.fixtureCalls=existsSync(resolve(root,'fixture-calls.jsonl'))?readFileSync(resolve(root,'fixture-calls.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(x=>JSON.parse(x)):[];
 if(live){const after=JSON.parse(readFileSync(paidLedger,'utf8'));result.newEntries=after.entries.slice(beforeLedger.entries.length);result.ledgerPreserved=after.limitUsd===3&&JSON.stringify(after.entries.slice(0,beforeLedger.entries.length))===JSON.stringify(beforeLedger.entries);result.costSummary={guardTotalUsd:after.entries.reduce((s:number,e:any)=>s+e.usd,0),modelUsageEstimateUsd:after.entries.filter((e:any)=>e.usage).reduce((s:number,e:any)=>s+e.usd,0),billingVerified:false};if(!result.ledgerPreserved||result.newEntries.some((e:any)=>e.status!=='completed')||result.newEntries.filter((e:any)=>e.kind==='decision').length>16||result.newEntries.filter((e:any)=>e.kind==='dialogue').length>11){result.status='FAIL';result.finalCheckFailed=true;process.exitCode=1;}}
 else if(!result.paidLedgerUnchanged||result.fixtureCalls.some((c:any)=>c.kind==='forbidden')){result.status='FAIL';result.finalCheckFailed=true;process.exitCode=1;}
 for(const p of sources){const dest=resolve(root,'source',p);mkdirSync(dirname(dest),{recursive:true});copyFileSync(p,dest);if(hash(p)!==result.sourceHashes[p]){result.status='FAIL';result.sourceChanged=p;process.exitCode=1;}}
 persist();console.log(JSON.stringify({status:result.status,failure:result.failure,root,paidLedgerUnchanged:result.paidLedgerUnchanged,steps:result.steps.length,childExited:result.childExited}));
}
