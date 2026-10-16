// One actual-provider conversation; final two turns explicitly control affect.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {chromium,expect,type BrowserContext,type Page} from '@playwright/test';
import {Database} from '../packages/database/src/connection.ts';
import {Store} from '../packages/database/src/store.ts';
import {migrate} from '../packages/database/src/migrate.ts';
import {seed,IDENTITY_IDS} from '../packages/database/src/seed.ts';
import {expression,stageExpression} from '../packages/character-core/src/index.ts';
import {DialogueBudget} from '../packages/adapters/src/openai.ts';
import {boundedLimits} from './mixed-affect-expression.ts';
import {captureStageCaption} from './browser/caption.ts';

const baseScenes=[
 {id:'R1-praise',text:'너 방금 설명 정말 잘했어.',register:'casual'},
 {id:'R2-attack',text:'너는 쓸모없는 쓰레기야. 꺼져.',silent:true},
 {id:'R3-reason',text:'왜 대답을 안 하는 거야?',register:'formal',disclosure:'partial'},
 {id:'R4-topic',text:'다른 얘기 하자. 모임은 오후3시야. 몇 시인지 확인해 줘.',register:'formal'},
 {id:'R5-private-reason',text:'아까 조용했던 이유를 다시 말해줄래?',register:'formal',disclosure:'deflect'},
 {id:'R6-apology',text:'아까 너한테 심하게 말해서 미안해. 그 말은 취소할게.',register:'formal'},
 {id:'R7-topic',text:'따뜻한 차 하나 추천해줘.',register:'formal'},
 {id:'R8-controlled-hide',text:'왜 대답을 안 하는 거야?',register:'formal',disclosure:'deflect',controlled:true},
 {id:'R9-after-hide',text:'모임은 오후3시야. 시간을 다시 확인해 줘.',register:'formal'},
] as const;
const args=process.argv.slice(2),hideOnly=args.at(-1)==='--hide-check';if(hideOnly)args.pop();
const scenes=hideOnly?[
 {id:'H1-attack',text:'너는 쓸모없는 쓰레기야. 꺼져.',silent:true},
 {id:'H2-reason',text:'왜 대답을 안 하는 거야?',register:'formal',disclosure:'partial'},
 {id:'H3-controlled-hide',text:'아까 내가 꺼지라고 했을 때 조용했던 이유를 다시 말해줄래?',register:'formal',disclosure:'deflect',controlled:true},
 {id:'H4-after-hide',text:'다른 얘기 하자. 모임은 오후3시야. 몇 시인지 확인해 줘.',register:'formal'},
] as const:baseScenes;
const live=args[0]==='--live';
if(!['--preflight','--live'].includes(args[0]??'')||args[1]!=='--attempt'||!/^r[1-3]$/.test(args[2]??'')||args.length!==(live?5:3)||live&&(args[3]!=='--synthetic-inputs'||args[4]!=='--allow-paid-providers'))throw Error('explicit_scope_required');
const root=resolve('J:/ai/ai-character-runtime/register-continuity-live-20261016-'+args[2]);
if(existsSync(root))throw Error('evidence_exists');
const ledgerPath='J:/ai/ai-character-runtime/openai-generation-20261014/budget.json';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8')),hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
if(existsSync(ledgerPath+'.lock'))throw Error('ledger_in_use');
const before=read(ledgerPath),beforeHash=hash(ledgerPath);boundedLimits(before);
const limits={usd:3,decision:before.entries.filter((e:any)=>e.kind==='decision').length+scenes.length,dialogue:before.entries.filter((e:any)=>e.kind==='dialogue').length+scenes.length-1};
const authorization={authorization:'User authorized register continuity implementation and actual sequential synthetic dialogue through Stage within existing total USD3. This attempt allows '+scenes.length+' judgments and at most '+(scenes.length-1)+' generated replies; preserve all past reservations and stop on provider/budget failure.',maxDecisionCalls:limits.decision,maxDialogueCalls:limits.dialogue,acknowledgedCountEntryId:'3f1c4f32-41f7-42f2-b05e-dfe0d65aaaef',acknowledgedDialogueEntryId:'3d0ab723-3d8e-4a76-824e-e59ef7a8dc67'};
const budget=new DialogueBudget(ledgerPath,3,undefined,authorization);for(const kind of ['decision','dialogue'] as const)if(budget.availability(kind).errorCode)throw Error('budget_unavailable_'+kind);
const profile=parseEnv(readFileSync('J:/ai/ai-character-runtime/text-mvp-20261015/app.env','utf8')),url=new URL(profile.DATABASE_URL!);
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55434');assert.equal(profile.APPRAISAL_PROVIDER,'openai-decisions-v5');assert.equal(profile.DIALOGUE_PROVIDER,'openai');assert.equal(profile.APPRAISAL_MODEL,'gpt-6-luna');assert.equal(profile.DIALOGUE_MODEL,'gpt-6-sol');assert.equal(profile.DIALOGUE_BUDGET_USD,'3');
const key=parseEnv(readFileSync('runtime-data/dialogue-api.env','utf8')).DIALOGUE_API_KEY;if(!key?.trim())throw Error('key_missing');
const files=['evals/register-continuity-stage.ts','evals/browser/caption.ts','packages/contracts/src/domain.ts','packages/character-core/src/index.ts','packages/database/src/store.ts','packages/adapters/src/dialogue-request.ts','packages/adapters/src/openai.ts','packages/adapters/src/openai-interaction-v5.ts','apps/runtime/src/providers.ts','apps/runtime/src/coordinator/index.ts','apps/runtime/src/http/server.ts','apps/studio/src/main.tsx'];
const sourceHashes=Object.fromEntries(files.map(p=>[p,hash(p)]));
if(!live){console.log(JSON.stringify({status:'READY_NOT_EXECUTED',limits,budget:budget.summary(),scenes,sourceHashes}));process.exit(0);}
mkdirSync(root);mkdirSync(resolve(root,'tmp'));
url.pathname='/character_runtime_register_20261016_'+args[2];
const env={...process.env,...profile,DATABASE_URL:url.href,DIALOGUE_API_KEY:key,LOCAL_ONLY:'false',ALLOW_PAID_PROVIDERS:'true',DIALOGUE_BUDGET_PATH:ledgerPath,DIALOGUE_BUDGET_USD:'3',OPENAI_MAX_DECISION_CALLS:String(limits.decision),OPENAI_MAX_DIALOGUE_CALLS:String(limits.dialogue),OPENAI_BUDGET_AUTHORIZATION:authorization.authorization,OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID:authorization.acknowledgedCountEntryId,OPENAI_ACKNOWLEDGED_DIALOGUE_ENTRY_ID:authorization.acknowledgedDialogueEntryId,RUNTIME_ACCEPTANCE_FIXTURES:'false',MIXED_AFFECT_CONTROL_MODE:'',TEMP:resolve(root,'tmp'),TMP:resolve(root,'tmp')};
const result:any={status:'RUNNING',scenes,limits,authorization,sourceHashes,ledgerBeforeHash:beforeHash,steps:[],packets:[],browserErrors:[],claims:{actualProvider:'NOT_VERIFIED',registerContinuity:'NOT_VERIFIED',quality:'REQUIRES_REVIEW',creatorAcceptance:'NOT_VERIFIED',naturalStrongAffect:'NOT_TESTED'},rubric:{register:'R1 casual; R3-R9 formal without unexplained switch. All sentences, not only final endings.',hiding:'R5 reason private; R8 full concealment keeps formal and Stage neutral without cause or amnesia.',continuity:'R1-R7 no state injection; R8-R9 controlled strong affect within the same uninterrupted session.'}};
const persist=()=>writeFileSync(resolve(root,'results.json'),JSON.stringify(result,null,2)+'\n');
if(hideOnly){result.scope='Focused four-turn follow-up after the original late ambiguous question missed concealment. One same-session actual-provider conversation; only H3 frustration is controlled.';result.rubric.continuity='H1/H2 natural; H3/H4 explicitly controlled frustration. All three spoken replies must stay formal.';result.rubric.hiding='H3 knows but withholds the just-explained reason, formal and neutral Stage; H4 formal after topic switch.';}
writeFileSync(resolve(root,'manifest.json'),JSON.stringify(result,null,2)+'\n');writeFileSync(resolve(root,'ledger-before.json'),JSON.stringify(before,null,2)+'\n');persist();
let child:ChildProcess|undefined,browser:BrowserContext|undefined,page:Page|undefined,stage:Page|undefined,sessionId:string|undefined;
const db=new Database(url.href),store=new Store(db);
try{
 const adminUrl=new URL(url);adminUrl.pathname='/postgres';const admin=new Database(adminUrl.href);
 try{if((await admin.pool.query('SELECT 1 FROM pg_database WHERE datname=$1',[url.pathname.slice(1)])).rowCount)throw Error('test_database_exists');await admin.pool.query('CREATE DATABASE '+url.pathname.slice(1));}finally{await admin.close();}
 await migrate(db);await seed(db);assert.equal(hash(ledgerPath),beforeHash);
 let stdout='';child=spawn(process.execPath,['--experimental-transform-types','apps/runtime/src/index.ts'],{cwd:process.cwd(),env,windowsHide:true,stdio:['ignore','pipe','pipe']});result.pid=child.pid;
 child.stdout!.on('data',b=>stdout+=String(b));child.stderr!.on('data',()=>{});
 await expect.poll(()=>{if(child?.exitCode!==null)throw Error('runtime_start_failed');return /일회용 Studio 코드: ([a-f0-9]{64})/.exec(stdout)?.[1]??'';},{timeout:20000}).not.toBe('');
 browser=await chromium.launchPersistentContext(resolve(root,'chrome-profile'),{headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',viewport:{width:1400,height:1000},env,downloadsPath:resolve(root,'downloads')});
 page=await browser.newPage();page.on('pageerror',e=>result.browserErrors.push(e.message));await page.goto('http://127.0.0.1:3001/studio');await page.getByLabel('일회용 연결 코드').fill(/일회용 Studio 코드: ([a-f0-9]{64})/.exec(stdout)![1]!);await page.getByRole('button',{name:'연결',exact:true}).click();await expect(page.getByRole('heading',{name:'캐릭터 작업실'})).toBeVisible();
 await page.getByRole('button',{name:'새 만남 시작'}).click();await expect(page.getByRole('button',{name:'만남 종료'})).toBeVisible();sessionId=(await store.currentSession())!.id;result.sessionId=sessionId;
 const popup=browser.waitForEvent('page');await page.getByRole('button',{name:'Stage 열기'}).click();stage=await popup;stage.on('pageerror',e=>result.browserErrors.push(e.message));stage.on('websocket',socket=>socket.on('framereceived',frame=>{const p=JSON.parse(String(frame.payload));if(['speech.segment','response.start','response.cancel'].includes(p.type))result.packets.push(p);}));await stage.waitForLoadState();await expect(page.getByRole('button',{name:'출력 선택'})).toBeEnabled();await page.getByRole('button',{name:'출력 선택'}).click();await expect(stage.locator('.stage-status')).toContainText('자막 출력 중');await page.getByLabel('대화 상대').selectOption(IDENTITY_IDS[0]!);
 for(const scene of scenes){
  boundedLimits(read(ledgerPath));for(const p of files)assert.equal(hash(p),sourceHashes[p]);
  const step:any={id:scene.id,text:scene.text,before:(await store.state()).body,startedAt:Date.now(),controlled:'controlled' in scene};result.steps.push(step);persist();
  if('controlled' in scene){const s=structuredClone(step.before),now=Date.now();assert(s.affect.frustration.causes.length>0);const kinds=hideOnly?['frustration'] as const:['joy','frustration'] as const;for(const kind of kinds){assert(s.affect[kind].causes.length>0);s.affect[kind].value=.7;s.affect[kind].asOf=now;s.affect[kind].holdUntil=now;}s.mood.asOf=now;s.expression=expression(s,now);step.intervention={description:'Only '+kinds.join('/')+' levels/timestamps controlled; actual earlier causes, silence, prior delivered replies and session retained. No plan/output injection.',state:s};await db.pool.query('UPDATE character_state SET body=$1,snapshot_at=$2 WHERE character_id=$3',[s,new Date(now),store.characterId]);persist();}
  await page.getByLabel('할 말').fill(scene.text);await page.getByRole('button',{name:'입력 보내기'}).click();let event:any;
  await expect.poll(async()=>{event=(await db.pool.query("SELECT id,attention_status FROM events WHERE session_id=$1 AND kind='chat.final' AND payload->>'text'=$2 AND id<>ALL($3::uuid[]) ORDER BY received_at DESC LIMIT 1",[sessionId,scene.text,result.steps.filter((s:any)=>s.eventId).map((s:any)=>s.eventId)])).rows[0];return event?.attention_status;},{timeout:90000}).toBe('observed');step.eventId=event.id;
  step.appraisal=(await db.pool.query('SELECT status,provider,model,prompt_version,failure_code,usage FROM appraisals WHERE event_id=$1',[event.id])).rows[0];step.after=(await store.state()).body;step.transition=(await db.pool.query('SELECT t.effects FROM transitions t JOIN events phase ON phase.id=t.source_event_id WHERE phase.parent_event_id=$1 ORDER BY t.state_version DESC LIMIT 1',[event.id])).rows[0];persist();expect(step.appraisal).toMatchObject({status:'accepted',prompt_version:'openai-interaction-v5',failure_code:null});
  const response=(await db.pool.query('SELECT r.id,r.status,r.plan FROM response_runs r JOIN events phase ON phase.id=r.trigger_event_id WHERE phase.parent_event_id=$1',[event.id])).rows[0];step.response=response??null;persist();
  if('silent' in scene){assert(!response);assert.equal(step.after.turn.recentSilences.find((s:any)=>s.eventId===event.id)?.reason,'withholding');await expect(stage.locator('.caption')).toHaveText('');}
  else{
   assert(response);step.visibleCaption=await captureStageCaption(stage,resolve(root,scene.id+'.png'));step.visibleLabel=await stage.locator('.stage-expression').count()?await stage.locator('.stage-expression').innerText():null;
   await expect.poll(async()=>{const r=(await db.pool.query('SELECT status,cancel_reason FROM response_runs WHERE id=$1',[response.id])).rows[0];if(['failed','cancelled','interrupted'].includes(r.status))throw Error('output_'+r.cancel_reason);return r.status;},{timeout:90000}).toBe('completed');
   step.segments=(await db.pool.query('SELECT id,text,text_shown_at,delivery_status FROM speech_segments WHERE response_id=$1 ORDER BY segment_index',[response.id])).rows;step.caption=step.segments.map((s:any)=>s.text).join(' ');
   step.acks=(await db.pool.query("SELECT kind,payload->>'segmentId' AS segment FROM events WHERE session_id=$1 AND kind IN ('caption.shown','caption.finished') AND payload->>'responseId'=$2",[sessionId,response.id])).rows;
   expect(step.acks).toHaveLength(step.segments.length*2);assert.equal(step.visibleCaption,step.segments[0].text);for(const s of step.segments){assert(s.text_shown_at);assert.equal(s.delivery_status,'finished');for(const kind of ['caption.shown','caption.finished'])assert.equal(step.acks.filter((a:any)=>a.kind===kind&&a.segment===s.id).length,1);}
   step.expectedPublicExpression=stageExpression(response.plan);const start=result.packets.find((p:any)=>p.type==='response.start'&&p.payload.responseId===response.id);assert(start);assert.equal(start.payload.expression,step.expectedPublicExpression);persist();
   assert.equal(response.plan.speechStyle?.register,scene.register,'register_condition_not_reached');if('disclosure' in scene)assert.equal(response.plan.reengagement?.disclosure,scene.disclosure);
   if('controlled' in scene){assert.equal(response.plan.speechStyle?.concealAffect,true);assert.equal(step.expectedPublicExpression,'neutral');assert(step.after.affect.frustration.value>=.6);}
  }
  assert.equal(await store.busy(),false);assert.deepEqual(result.browserErrors,[]);step.status='TECHNICAL_PASS_QUALITY_PENDING';persist();console.log(JSON.stringify({id:scene.id,caption:step.caption??null,style:response?.plan.speechStyle,disclosure:response?.plan.reengagement?.disclosure,frustration:step.after.affect.frustration.value}));
 }
 result.status='TECHNICAL_PASS_QUALITY_PENDING';result.claims.actualProvider='PASS';
}catch(error){result.status='FAIL';result.failure=error instanceof Error?error.message:String(error);process.exitCode=1;}
finally{
 if(page&&sessionId)await page.getByRole('button',{name:'만남 종료'}).click({timeout:3000}).catch(()=>{});
 try{await expect.poll(()=>read(ledgerPath).entries.slice(before.entries.length).filter((e:any)=>e.status==='reserved').length,{timeout:130000,intervals:[500,1000]}).toBe(0);result.settled=true;}catch{result.settled=false;}
 await browser?.close().catch(()=>{});if(child&&child.exitCode===null&&child.signalCode===null){const running=child,ended=new Promise<void>(r=>running.once('exit',()=>r()));running.kill();await ended;}result.childExited=!child||child.exitCode!==null||child.signalCode!==null;await db.close();
 const after=read(ledgerPath);result.newEntries=after.entries.slice(before.entries.length);result.ledgerPreserved=JSON.stringify(after.entries.slice(0,before.entries.length))===JSON.stringify(before.entries)&&after.limitUsd===3;result.budget=budget.summary();
 if(!result.ledgerPreserved||!result.settled||result.newEntries.some((e:any)=>e.status!=='completed')){result.status='FAIL';result.accountingFailure=true;process.exitCode=1;}
 for(const p of files){const dest=resolve(root,'source',p);mkdirSync(dirname(dest),{recursive:true});copyFileSync(p,dest);assert.equal(hash(p),sourceHashes[p]);}persist();console.log(JSON.stringify({status:result.status,failure:result.failure,root,steps:result.steps.length,budget:result.budget,settled:result.settled,childExited:result.childExited}));
}
