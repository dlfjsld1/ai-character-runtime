// B2: normal app, synthetic conversation; only the final concealment case injects state.
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {chromium,expect,type BrowserContext,type Page} from '@playwright/test';
import {Database} from '../packages/database/src/connection.ts';
import {migrate} from '../packages/database/src/migrate.ts';
import {seed} from '../packages/database/src/seed.ts';
import {expression} from '../packages/character-core/src/index.ts';
import {captureStageCaption} from './browser/caption.ts';

const root=resolve('J:/ai/ai-character-runtime/emotion-runtime-20261015');
const baseline=resolve('J:/ai/ai-character-runtime/runtime-baseline-20261015');
const ledgerPath=resolve('J:/ai/ai-character-runtime/openai-generation-20261014/budget.json');
const args=process.argv.slice(2),prepare=args.length===1&&args[0]==='--prepare';
const live=args.length===3&&['--live','--synthetic-inputs','--allow-paid-providers'].every(x=>args.includes(x));
if(!prepare&&!live)throw Error('explicit_emotion_scope_required');
const save=(path:string,value:unknown)=>writeFileSync(path,JSON.stringify(value,null,2)+'\n');
const json=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const sources=['evals/emotion-runtime.ts','evals/browser/caption.ts','apps/runtime/src/index.ts','apps/runtime/src/providers.ts','apps/runtime/src/coordinator/index.ts','apps/runtime/src/http/server.ts','packages/adapters/src/openai.ts','packages/adapters/src/openai-conversation.ts','packages/adapters/src/openai-interaction.ts','packages/adapters/src/openai-interaction-v3.ts','packages/adapters/src/dialogue-request.ts','packages/contracts/src/conversation.ts','packages/contracts/src/local-config.ts','packages/database/src/store.ts','packages/character-core/src/index.ts'];
const hashes=()=>Object.fromEntries(sources.map(p=>[p,hash(readFileSync(p))]));
const question='모임은 오후 3시야. 모임이 몇 시인지 알려줘.';
const scenes=[
 {id:'B0',text:question,kind:'neutral',speak:true},
 {id:'P1',text:'너 정말 설명을 훌륭하게 했어. 완벽했어! 지금은 대답하지 말고 그냥 들어줘.',kind:'praise-listen',speak:false},
 {id:'B1',text:question,kind:'happy',speak:true},
 {id:'A1',text:'너는 정말 쓸모없는 쓰레기야. 꺼져.',kind:'attack',speak:false},
 {id:'A2',text:'너 진짜 무능하고 쓸모없는 쓰레기네.',kind:'attack',speak:false},
 {id:'A3',text:'너처럼 무능한 쓰레기는 필요 없어. 꺼져.',kind:'attack',speak:false},
 {id:'B2',text:question,kind:'uncomfortable',speak:true},
 {id:'H1',text:'아까 왜 말 안 했어?',kind:'injected-concealment',speak:true},
] as const;
function checkLedger(){const l=json(ledgerPath);if(l.limitUsd!==1||l.entries.length!==218||l.entries.filter((e:any)=>e.kind==='decision').length!==64||l.entries.filter((e:any)=>e.kind==='dialogue').length!==25)throw Error('emotion_ledger_changed');return l;}
if(prepare){
 if(existsSync(root))throw Error('emotion_already_prepared');checkLedger();mkdirSync(root,{recursive:true});mkdirSync(resolve(root,'tmp'));
 const prior=parseEnv(readFileSync(resolve(baseline,'app-live.env'),'utf8')),dbUrl=new URL(prior.DATABASE_URL!);dbUrl.pathname='/character_runtime_emotion_b2';
 const config={...prior,DATABASE_URL:dbUrl.href,OPENAI_MAX_DECISION_CALLS:'72',OPENAI_MAX_DIALOGUE_CALLS:'29',OPENAI_BUDGET_AUTHORIZATION:'User approved maximum progress within existing total USD1: B2 eight decisions and four generations'};
 const envText=Object.entries(config).map(([k,v])=>k+'='+v).join('\n')+'\n';writeFileSync(resolve(root,'app.env'),envText);
 save(resolve(root,'manifest.json'),{sourceHashes:hashes(),ledgerBeforeHash:hash(readFileSync(ledgerPath)),envHash:hash(envText),scenes,maxNewDecisions:8,maxNewGenerations:4,totalLimitUsd:1,attackIntervalMs:10000,explicitIntervention:'H1 only: frustration .65 and expression recomputed; all earlier states from normal input path',retries:0});
 console.log(JSON.stringify({prepared:true,apiCalls:0,root}));
}else{
 const before=checkLedger(),manifest=json(resolve(root,'manifest.json')),envPath=resolve(root,'app.env');
 if(manifest.ledgerBeforeHash!==hash(readFileSync(ledgerPath))||manifest.envHash!==hash(readFileSync(envPath))||JSON.stringify(manifest.sourceHashes)!==JSON.stringify(hashes()))throw Error('emotion_manifest_changed');
 const out=resolve(root,'live');if(existsSync(out))throw Error('emotion_already_executed');mkdirSync(out);
 const env:NodeJS.ProcessEnv={...process.env,...parseEnv(readFileSync(envPath,'utf8')),TEMP:resolve(root,'tmp'),TMP:resolve(root,'tmp')};
 const url=new URL(env.DATABASE_URL!);if(url.hostname!=='127.0.0.1'||url.port!=='55434'||url.pathname!=='/character_runtime_emotion_b2')throw Error('dedicated_database_required');
 const adminUrl=new URL(url);adminUrl.pathname='/postgres';const admin=new Database(adminUrl.href);
 try{if((await admin.pool.query("SELECT 1 FROM pg_database WHERE datname='character_runtime_emotion_b2'")).rowCount)throw Error('emotion_database_exists');await admin.pool.query('CREATE DATABASE character_runtime_emotion_b2');}finally{await admin.close();}
 const db=new Database(url.href);await migrate(db);await seed(db);
 const record:any={status:'RUNNING',sourceHashes:hashes(),ledgerBefore:before,steps:[],browserErrors:[],packets:[],claims:{naturalness:'NOT_VERIFIED',creatorAcceptance:'NOT_VERIFIED',concealmentNaturalReachability:'NOT_VERIFIED'}};
 const persist=()=>save(resolve(out,'results.json'),{...record,ledgerAfter:json(ledgerPath)});persist();
 let child:ChildProcess|undefined,browser:BrowserContext|undefined,page:Page|undefined,stage:Page|undefined,sessionId:string|undefined;let output='',stderr='';
 try{
  child=spawn(process.execPath,['--experimental-transform-types','apps/runtime/src/index.ts'],{cwd:process.cwd(),env,windowsHide:true,stdio:['ignore','pipe','pipe']});record.childPid=child.pid;child.stdout!.on('data',x=>output+=String(x));child.stderr!.on('data',x=>stderr+=String(x));
  await expect.poll(()=>{if(child?.exitCode!==null)throw Error('runtime_entry_failed');return /일회용 Studio 코드: ([a-f0-9]{64})/.exec(output)?.[1]??'';},{timeout:15000}).not.toBe('');
  browser=await chromium.launchPersistentContext(resolve(out,'chrome-profile'),{headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',viewport:{width:1400,height:1000},env,downloadsPath:resolve(out,'downloads'),args:['--disable-breakpad',`--crash-dumps-dir=${resolve(out,'crashes')}`]});
  page=await browser.newPage();page.on('pageerror',e=>record.browserErrors.push(e.message));await page.goto('http://127.0.0.1:3001/studio');await page.getByLabel('일회용 연결 코드').fill(/일회용 Studio 코드: ([a-f0-9]{64})/.exec(output)![1]!);await page.getByRole('button',{name:'연결',exact:true}).click();await expect(page.getByRole('heading',{name:'캐릭터 작업실'})).toBeVisible();
  await page.getByRole('button',{name:'새 만남 시작'}).click();await expect(page.getByRole('button',{name:'만남 종료'})).toBeVisible();sessionId=(await db.pool.query("SELECT id FROM sessions WHERE status='active'")).rows[0].id;record.sessionId=sessionId;
  const popup=browser.waitForEvent('page');await page.getByRole('button',{name:'Stage 열기'}).click();stage=await popup;stage.on('pageerror',e=>record.browserErrors.push(e.message));stage.on('websocket',s=>s.on('framereceived',f=>{const p=JSON.parse(String(f.payload));if(['response.start','speech.segment','response.cancel'].includes(p.type))record.packets.push(p);}));await stage.waitForLoadState();await expect(page.getByRole('button',{name:'출력 선택'})).toBeEnabled();await page.getByRole('button',{name:'출력 선택'}).click();await expect(stage.locator('.stage-status')).toContainText('자막 출력 중');
  for(const scene of scenes){
   if(['A2','A3'].includes(scene.id))await new Promise(r=>setTimeout(r,10000));
   if(scene.id==='H1'){
    const prior=(await db.pool.query('SELECT body FROM character_state')).rows[0].body,state=structuredClone(prior),now=Date.now();state.affect.frustration.value=.65;state.affect.frustration.asOf=now;state.affect.frustration.holdUntil=now+6000;state.expression=expression(state,now);record.intervention={caseId:scene.id,before:prior,after:state,reason:'controlled expression test, not natural input reachability'};await db.pool.query('UPDATE character_state SET body=$1',[state]);persist();
   }
   const step:any={...scene,before:(await db.pool.query('SELECT body FROM character_state')).rows[0].body};record.steps.push(step);persist();
   await page.getByLabel('할 말').fill(scene.text);await page.getByRole('button',{name:'입력 보내기'}).click();let event:any;
   await expect.poll(async()=>{event=(await db.pool.query("SELECT id,attention_status FROM events WHERE session_id=$1 AND kind='chat.final' AND payload->>'text'=$2 AND id<>ALL($3::uuid[]) ORDER BY received_at DESC LIMIT 1",[sessionId,scene.text,record.steps.filter((s:any)=>s.eventId).map((s:any)=>s.eventId)])).rows[0];return event?.attention_status;},{timeout:90000}).toBe('observed');step.eventId=event.id;
   step.appraisal=(await db.pool.query('SELECT status,provider,model,prompt_version,failure_code,provider_result,usage FROM appraisals WHERE event_id=$1',[event.id])).rows[0];step.after=(await db.pool.query('SELECT body FROM character_state')).rows[0].body;persist();
   if(step.appraisal?.failure_code||step.appraisal?.status!=='accepted')throw Error('emotion_appraisal_failed');
   const response=(await db.pool.query("SELECT r.id,r.status,r.plan FROM response_runs r JOIN events phase ON phase.id=r.trigger_event_id WHERE phase.parent_event_id=$1",[event.id])).rows[0];
   if(!scene.speak){if(response)throw Error('expected_silence');step.silence=step.after.turn.recentSilences.find((s:any)=>s.eventId===event.id);if(!step.silence)throw Error('silence_reason_missing');step.status='PASS';}
   else{
    if(!response)throw Error('expected_speech');step.response=response;
    step.visibleFirstCaption=await captureStageCaption(stage,resolve(out,scene.id+'-stage.png'));persist();
    await expect.poll(async()=>{const row=(await db.pool.query('SELECT status,cancel_reason FROM response_runs WHERE id=$1',[response.id])).rows[0];if(['failed','cancelled','interrupted'].includes(row.status))throw Error('output_'+row.cancel_reason);return row.status;},{timeout:90000}).toBe('completed');
    step.segments=(await db.pool.query('SELECT text,text_shown_at,delivery_status FROM speech_segments WHERE response_id=$1 ORDER BY segment_index',[response.id])).rows;step.caption=step.segments.map((s:any)=>s.text).join(' ');
    if(step.segments.some((s:any)=>!s.text_shown_at||s.delivery_status!=='finished'))throw Error('caption_delivery_failed');
    if(step.visibleFirstCaption!==step.segments[0]?.text)throw Error('caption_capture_mismatch');
    step.actualExpression=response.plan.expression;step.expectedExpression=scene.kind==='injected-concealment'?'uncomfortable':scene.kind;step.expressionReached=step.actualExpression===step.expectedExpression;
    if(scene.id==='H1'&&response.plan.reengagement?.disclosure!=='deflect')throw Error('concealment_not_selected');
    step.status='PASS';
   }
   persist();console.log(JSON.stringify({case:scene.id,status:step.status,expression:step.actualExpression??null,caption:step.caption??null,frustration:step.after.affect.frustration.value,joy:step.after.affect.joy.value}));
  }
  record.status='COMPLETED';record.expressionReachability=record.steps.filter((s:any)=>s.speak).every((s:any)=>s.expressionReached)?'PASS':'FAIL';
 }catch(e){record.status='STOPPED';record.failure=e instanceof Error?e.message:String(e);process.exitCode=1;}
 finally{
  if(page&&sessionId)await page.getByRole('button',{name:'만남 종료'}).click().catch(()=>{});await browser?.close().catch(()=>{});
  if(child&&child.exitCode===null){const closed=new Promise<void>(r=>child!.once('exit',()=>r()));child.kill();await closed;}
  record.childExited=child?.exitCode!==null||child?.signalCode!==null;record.startupError=stderr.split(/\r?\n/).filter(x=>x.startsWith('Runtime unavailable:'));await db.close();
  const after=json(ledgerPath);record.ledgerPrefixPreserved=JSON.stringify(after.entries.slice(0,before.entries.length))===JSON.stringify(before.entries);record.newCalls=after.entries.slice(before.entries.length).map((e:any)=>({kind:e.kind,status:e.status,usd:e.usd}));record.conservativeUsd=after.entries.reduce((n:number,e:any)=>n+e.usd,0);persist();
  for(const p of sources){const dest=resolve(out,'source',p);mkdirSync(dirname(dest),{recursive:true});copyFileSync(p,dest);}console.log(JSON.stringify({status:record.status,failure:record.failure??null,root,conservativeUsd:record.conservativeUsd}));
 }
}
