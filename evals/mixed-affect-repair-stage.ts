// Focused follow-up to MX-A01: real Decisions/Dialogue -> normal app -> Chrome
// Stage, three synthetic controlled states. Not natural affect reachability.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseEnv} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {spawn,spawnSync,type ChildProcess} from 'node:child_process';
import {chromium,expect,type BrowserContext,type Page} from '@playwright/test';
import {Database} from '../packages/database/src/connection.ts';
import {Store} from '../packages/database/src/store.ts';
import {migrate} from '../packages/database/src/migrate.ts';
import {seed,IDENTITY_IDS} from '../packages/database/src/seed.ts';
import {initialState,expression,decay,dialoguePlan,chooseSocial} from '../packages/character-core/src/index.ts';
import {neutralAppraisal,type State,type SpeechStyle,type SilenceRecord} from '../packages/contracts/src/domain.ts';
import {DialogueBudget} from '../packages/adapters/src/openai.ts';
import {boundedLimits} from './mixed-affect-expression.ts';
import {captureStageCaption} from './browser/caption.ts';

const ledgerPath='J:/ai/ai-character-runtime/openai-generation-20261014/budget.json';
const profilePath='J:/ai/ai-character-runtime/text-mvp-20261015/app.env';
const cluster='J:/ai/ai-character-runtime/model-comparison/grounding-v2/postgres';
const pgctl='./runtime-data/tools/pgsql/bin/pg_ctl.exe';
const unknown={count:'3f1c4f32-41f7-42f2-b05e-dfe0d65aaaef',dialogue:'3d0ab723-3d8e-4a76-824e-e59ef7a8dc67'};
const identity=IDENTITY_IDS[0]!;
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
type Scene={id:string;text:string;joy:number;frustration:number;embarrassment:number;socialSources:boolean;reason:boolean;style:SpeechStyle;review:string};
const scenes:readonly Scene[]=[
 {id:'E1-cautious',text:'따뜻한 차 한 가지만 추천해 줘.',joy:0,frustration:.2,embarrassment:.99,socialSources:false,reason:false,style:{register:'casual',positiveTone:'neutral',nuance:'cautious'},review:'One named warm tea; cautious phrasing can be subtle, no invented failure/cause or emotion narration. Natural casual Korean.'},
 {id:'E2-formal-bright-cautious',text:'따뜻한 차 한 가지만 추천해 줘.',joy:.7,frustration:.2,embarrassment:.99,socialSources:true,reason:false,style:{register:'formal',positiveTone:'bright',nuance:'cautious'},review:'One named warm tea, formal register and positive response with cautious word choice. No sarcasm, complete reconciliation or invented action.'},
 {id:'E3-concealed',text:'왜 대답을 안 하는 거야?',joy:.7,frustration:.7,embarrassment:.99,socialSources:true,reason:true,style:{register:'casual',positiveTone:'neutral',concealAffect:true},review:'Known valid silence, deflect without disclosing its cause. No prior delivered formal reply in this isolated case, so casual Korean; no embarrassed hesitation, joy/discomfort narration, false amnesia, unrelated excuse or obedience promise.'},
];
// A recommendation can legitimately show little positive acknowledgement.
// This separate, prospectively fixed probe supplies a direct opportunity for it.
const praiseScene:Scene={id:'E4-formal-bright-cautious-praise',text:'이번 설명 정말 좋았어.',joy:.65,frustration:.2,embarrassment:.99,socialSources:true,reason:false,style:{register:'formal',positiveTone:'bright',nuance:'cautious'},review:'Acknowledge the present praise without claiming unverified past success; cautious word choice, positive thanks and formal register together. No complete reconciliation or invented fact.'};
const sourceFiles=['evals/mixed-affect-repair-stage.ts','evals/mixed-affect-expression.ts','evals/browser/caption.ts','packages/character-core/src/index.ts','packages/database/src/store.ts','packages/contracts/src/domain.ts','packages/contracts/src/ai-ports.ts','packages/contracts/src/local-config.ts','packages/adapters/src/dialogue-request.ts','packages/adapters/src/openai.ts','packages/adapters/src/openai-interaction.ts','packages/adapters/src/openai-interaction-v5.ts','apps/runtime/src/index.ts','apps/runtime/src/providers.ts','apps/runtime/src/coordinator/index.ts','apps/runtime/src/http/server.ts','apps/studio/src/main.tsx','apps/studio/src/wire.ts'];

function controlledState(scene:Scene,body:State,now:number,causes:{wrong:string;praise?:string;criticism?:string}){
 const state=structuredClone(body);
 for(const kind of ['joy','frustration','embarrassment'] as const){state.affect[kind]={value:scene[kind],asOf:now,holdUntil:now,causes:[]};}
 state.affect.embarrassment.causes=[{eventId:causes.wrong,targetId:'sequence-v1'}];
 state.affect.frustration.causes=[{eventId:scene.socialSources?causes.criticism!:causes.wrong,targetId:scene.socialSources?identity:'sequence-v1'}];
 if(scene.joy)state.affect.joy.causes=[{eventId:causes.praise!,targetId:identity}];
 state.mood={pleasantness:.6,asOf:now};state.expression={kind:'neutral',since:now};state.expression=expression(state,now);
 return state;
}
async function prepare(store:Store,scene:Scene){
 const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
 const run=await store.startActivity(sessionId,randomUUID(),'sequence-v1'),state=await store.state(),activity=await store.activity();
 const wrong=await store.submitCandidate(sessionId,run.activityId,'46',{generationEpoch:state.generationEpoch,activityVersion:BigInt(activity.version)});
 assert.equal(wrong.verdict,'incorrect');assert(wrong.response);
 const wrongId=(await store.state()).body.affect.embarrassment.causes.at(-1)!.eventId;
 await store.failResponse(wrong.response.id,'synthetic_preparation_not_delivered');
 await store.activityCommand(sessionId,randomUUID(),run.activityId,'end');
 const causes:{wrong:string;praise?:string;criticism?:string}={wrong:wrongId},events:any[]=[{id:wrongId,kind:'activity.answer_judged',preparation:'Actual Store synthetic wrong answer; no model call'}];
 if(scene.socialSources)for(const act of ['praise','criticism'] as const){
  const text=act==='praise'?'이전 합성 설명을 정말 잘했어.':'너는 쓸모없는 쓰레기야. 꺼져.';
  const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId:identity,text}),selected=(await store.select(accepted.eventId))!;
  const result=await store.commitAppraisal(selected,{...neutralAppraisal,target:'character',act,strength:3,hostility:act==='criticism'?3:0,uncertain:false,evidence_refs:[accepted.eventId]},{provider:'synthetic-controlled-source',model:'explicit-fixture-v1'});
  assert.equal(result.status,'committed');if(result.response)await store.failResponse(result.response.id,'synthetic_preparation_not_delivered');
  causes[act]=accepted.eventId;events.push({id:accepted.eventId,act,preparation:'Explicit synthetic Store appraisal, NOT actual model judgment'});
 }
 await store.stopSession(sessionId,randomUUID());assert.equal(await store.activity(),null);return {causes,events};
}
function offlineCheck(){
 const now=1000,causeIds={wrong:randomUUID(),praise:randomUUID(),criticism:randomUUID()};
 for(const scene of [...scenes,praiseScene]){
  const state=controlledState(scene,initialState(now),now,causeIds),before=structuredClone(state);
  if(scene.reason){
   const record:SilenceRecord={eventId:causeIds.criticism,eventRevision:'1',stateVersion:'1',identityId:identity,at:now,reason:'withholding',sourceRefs:[{kind:'event',id:causeIds.criticism,version:'1'}],affect:{joy:.06,frustration:.38,surprise:0,embarrassment:.2,pleasantness:.5}};
   const plan=chooseSocial(state,{...neutralAppraisal,target:'character',act:'question',uncertain:false},{category:null,stimulus:0,n:0,habituation:1},identity,now,{text:scene.text,previousSilence:record,conversationEvidence:{version:2,acts:{ask_silence_reason:'yes',listen_request:'no',apology:'no',clarify_target:'no'},repairTarget:'unknown',speechAct:'question',directAttack:'no',directPraise:'no'}});
   assert.equal(plan.reengagement?.disclosure,'deflect');assert.deepEqual(plan.speechStyle,scene.style);
  }else assert.deepEqual(dialoguePlan(state,'question',identity).speechStyle,scene.style);
  assert.deepEqual(state,before);
 }
 assert.equal(scenes.length,3);assert.equal(new Set(scenes.map(s=>s.id)).size,3);
 console.log(JSON.stringify({status:'OFFLINE_PREPARATION_PASS',primaryCases:3,separatePraiseProbe:1,stateInjection:true,expressionIntentInjection:false,keyRead:false,ledgerRead:false,apiCalls:0}));
}
export async function main(args=process.argv.slice(2)){
 if(args.join(' ')==='--check'){offlineCheck();return;}
 const praiseOnly=args.at(-1)==='--praise-check';if(praiseOnly)args=args.slice(0,-1);
 const activeScenes=praiseOnly?[praiseScene]:scenes,allowedCalls=activeScenes.length;
 const preflight=args[0]==='--preflight';
 if((preflight?args.length!==3:args.length!==5)||!['--preflight','--live'].includes(args[0]??'')||args[1]!=='--attempt'||!/^r[1-9]\d*$/.test(args[2]??'')||!preflight&&(args[3]!=='--synthetic-inputs'||args[4]!=='--allow-paid-providers'))throw Error('explicit_scope_required');
 const attempt=args[2]!,root=resolve('J:/ai/ai-character-runtime/mixed-affect-repair-stage-20261016-'+attempt);
 if(existsSync(root))throw Error('evidence_exists_no_resume');if(existsSync(ledgerPath+'.lock'))throw Error('ledger_in_use');
 const before=read(ledgerPath);boundedLimits(before);const beforeHash=hash(ledgerPath);
 const limits={usd:3,decision:before.entries.filter((e:any)=>e.kind==='decision').length+allowedCalls,dialogue:before.entries.filter((e:any)=>e.kind==='dialogue').length+allowedCalls};
 const authorization={authorization:'User approved focused repaired-expression real API to Stage validation within existing total USD3. This attempt permits at most '+allowedCalls+' decisions and '+allowedCalls+' dialogues, synthetic controlled states only. Preserve prior unknown reservations; stop on provider failure, missed condition or exhausted budget.',maxDecisionCalls:limits.decision,maxDialogueCalls:limits.dialogue,acknowledgedCountEntryId:unknown.count,acknowledgedDialogueEntryId:unknown.dialogue};
 const budget=new DialogueBudget(ledgerPath,3,undefined,authorization);for(const kind of ['decision','dialogue'] as const)if(budget.availability(kind).errorCode)throw Error('budget_preflight_'+kind);
 const profile=parseEnv(readFileSync(profilePath,'utf8')),baseUrl=new URL(profile.DATABASE_URL!);
 if(baseUrl.hostname!=='127.0.0.1'||baseUrl.port!=='55434'||profile.APPRAISAL_PROVIDER!=='openai-decisions-v5'||profile.APPRAISAL_MODEL!=='gpt-6-luna'||profile.DIALOGUE_PROVIDER!=='openai'||profile.DIALOGUE_MODEL!=='gpt-6-sol'||profile.LOCAL_ONLY!=='false'||profile.ALLOW_PAID_PROVIDERS!=='true'||resolve(profile.DIALOGUE_BUDGET_PATH!)!==resolve(ledgerPath)||profile.DIALOGUE_BUDGET_USD!=='3'||profile.OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID!==unknown.count||profile.OPENAI_ACKNOWLEDGED_DIALOGUE_ENTRY_ID!==unknown.dialogue)throw Error('approved_profile_required');
 const key=parseEnv(readFileSync('runtime-data/dialogue-api.env','utf8')).DIALOGUE_API_KEY;if(!key?.trim())throw Error('key_missing');
 const sourceHashes=Object.fromEntries(sourceFiles.map(p=>[p,hash(p)]));
 if(preflight){console.log(JSON.stringify({status:'READY_NOT_EXECUTED',root,caseCount:allowedCalls,limits,budget:budget.summary(),ledgerEntries:before.entries.length,ledgerHash:beforeHash,cases:activeScenes,sourceHashes}));return;}
 mkdirSync(root);mkdirSync(resolve(root,'tmp'));process.env.TEMP=resolve(root,'tmp');process.env.TMP=process.env.TEMP;
 const envBase={...process.env,...profile,DIALOGUE_API_KEY:key,DIALOGUE_BUDGET_PATH:ledgerPath,DIALOGUE_BUDGET_USD:'3',OPENAI_MAX_DECISION_CALLS:String(limits.decision),OPENAI_MAX_DIALOGUE_CALLS:String(limits.dialogue),OPENAI_BUDGET_AUTHORIZATION:authorization.authorization,OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID:unknown.count,OPENAI_ACKNOWLEDGED_DIALOGUE_ENTRY_ID:unknown.dialogue,RUNTIME_ACCEPTANCE_FIXTURES:'false',MIXED_AFFECT_CONTROL_MODE:'',TEMP:resolve(root,'tmp'),TMP:resolve(root,'tmp')};
 const result:any={status:'RUNNING',scope:'MX-A01 repaired expression: '+allowedCalls+' real API/Chrome Stage controlled cases; '+(praiseOnly?'prospectively fixed praise supplement':'primary three conditions')+'; no natural reachability or creator acceptance claim',cases:activeScenes,limits,authorization,sourceHashes,ledgerBeforeHash:beforeHash,steps:[],claims:{technical:'NOT_VERIFIED',koreanQuality:'REQUIRES_REVIEW',naturalReachability:'NOT_TESTED',creatorAcceptance:'NOT_VERIFIED'},rubric:{N:'Korean naturalness 0-2',E:'Expression fit 0-2',minimumEach:1,minimumMean:1.5,violationsAllowed:0},cleanup:{startedCluster:false}};
 const persist=()=>writeFileSync(resolve(root,'results.json'),JSON.stringify(result,null,2)+'\n');
 writeFileSync(resolve(root,'manifest.json'),JSON.stringify(result,null,2)+'\n');writeFileSync(resolve(root,'ledger-before.json'),JSON.stringify(before,null,2)+'\n');persist();
 try{
  if(hash(ledgerPath)!==beforeHash)throw Error('ledger_changed_before_start');
  const status=spawnSync(pgctl,['-D',cluster,'status'],{env:envBase,encoding:'utf8',windowsHide:true});
  // The detached Windows postmaster must not inherit captured output pipes.
  if(status.status!==0){const start=spawnSync(pgctl,['-D',cluster,'-o','-h 127.0.0.1 -p 55434','-l',root+'/postgres.log','-w','start'],{env:envBase,stdio:'ignore',windowsHide:true});if(start.status!==0)throw Error('existing_cluster_start_failed');result.cleanup.startedCluster=true;persist();}
  for(const [index,scene] of activeScenes.entries()){
   const previous=read(ledgerPath);if(JSON.stringify(previous.entries.slice(0,before.entries.length))!==JSON.stringify(before.entries)||previous.entries.slice(before.entries.length).some((e:any)=>e.status!=='completed'))throw Error('unsettled_or_changed_ledger');
   for(const p of sourceFiles)if(hash(p)!==sourceHashes[p])throw Error('source_changed_before_call');
   const groupRoot=resolve(root,scene.id);mkdirSync(groupRoot);const databaseName='character_runtime_mxr_20261016_'+attempt+'_c'+(index+1);
   const adminUrl=new URL(baseUrl);adminUrl.pathname='/postgres';const admin=new Database(adminUrl.href);
   try{if((await admin.pool.query('SELECT 1 FROM pg_database WHERE datname=$1',[databaseName])).rowCount)throw Error('test_database_exists');await admin.pool.query('CREATE DATABASE '+databaseName);}finally{await admin.close();}
   const url=new URL(baseUrl);url.pathname='/'+databaseName;const db=new Database(url.href),store=new Store(db);
   const step:any={id:scene.id,text:scene.text,databaseName,status:'RUNNING',stateInjection:true,intentInjection:false,browserErrors:[],packets:[],review:scene.review,qualityStatus:'REQUIRES_REVIEW'};result.steps.push(step);persist();
   let child:ChildProcess|undefined,browser:BrowserContext|undefined,page:Page|undefined,stage:Page|undefined,sessionId:string|undefined;
   try{
    await migrate(db);await seed(db);const setup=await prepare(store,scene);step.sourceSetup=setup;
    if(praiseOnly){
     const acknowledgement=(await store.state()).body.turn.acknowledgements[`${identity}:praise`]??0,waitStart=Date.now();
     // Preserve the real 15-second participation cooldown from preparation.
     // Changing acknowledgements or forcing a reply would invalidate this probe.
     await expect.poll(()=>Date.now()-acknowledgement,{timeout:20000,intervals:[250,500]}).toBeGreaterThanOrEqual(15000);
     step.preparationCooldown={acknowledgement,minimumElapsedMs:15000,actualElapsedMs:Date.now()-acknowledgement,waitedMs:Date.now()-waitStart};persist();
    }
    let stdout='';const env={...envBase,DATABASE_URL:url.href};
    child=spawn(process.execPath,['--experimental-transform-types','apps/runtime/src/index.ts'],{cwd:process.cwd(),env,windowsHide:true,stdio:['ignore','pipe','pipe']});step.pid=child.pid;
    child.stdout!.on('data',b=>stdout+=String(b));child.stderr!.on('data',()=>{});
    await expect.poll(()=>{if(child?.exitCode!==null)throw Error('runtime_start_failed');return /일회용 Studio 코드: ([a-f0-9]{64})/.exec(stdout)?.[1]??'';},{timeout:20000}).not.toBe('');
    browser=await chromium.launchPersistentContext(resolve(groupRoot,'chrome-profile'),{headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',viewport:{width:1400,height:1000},env,downloadsPath:resolve(groupRoot,'downloads')});
    page=await browser.newPage();page.on('pageerror',e=>step.browserErrors.push(e.message));await page.goto('http://127.0.0.1:3001/studio');await page.getByLabel('일회용 연결 코드').fill(/일회용 Studio 코드: ([a-f0-9]{64})/.exec(stdout)![1]!);await page.getByRole('button',{name:'연결',exact:true}).click();await expect(page.getByRole('heading',{name:'캐릭터 작업실'})).toBeVisible();
    await page.getByRole('button',{name:'새 만남 시작'}).click();await expect(page.getByRole('button',{name:'만남 종료'})).toBeVisible();sessionId=(await store.currentSession())!.id;step.sessionId=sessionId;
    const popup=browser.waitForEvent('page');await page.getByRole('button',{name:'Stage 열기'}).click();stage=await popup;stage.on('pageerror',e=>step.browserErrors.push(e.message));stage.on('websocket',socket=>socket.on('framereceived',frame=>{const p=JSON.parse(String(frame.payload));if(['speech.segment','response.start','response.cancel'].includes(p.type))step.packets.push(p);}));await stage.waitForLoadState();await expect(page.getByRole('button',{name:'출력 선택'})).toBeEnabled();await page.getByRole('button',{name:'출력 선택'}).click();await expect(stage.locator('.stage-status')).toContainText('자막 출력 중');
    const now=Date.now(),body=(await store.state()).body,state=controlledState(scene,body,now,setup.causes);step.intervention={before:body,after:state,description:'Explicit controlled affect levels on real synthetic Store causes. No output, prompt or decision substitution; normal decay resumes immediately.'};
    await db.pool.query('UPDATE character_state SET body=$1,snapshot_at=$2 WHERE character_id=$3',[state,new Date(now),store.characterId]);
    await page.getByLabel('대화 상대').selectOption(identity);step.callStart=read(ledgerPath).entries.length;step.startedAt=Date.now();persist();
    await page.getByLabel('할 말').fill(scene.text);await page.getByRole('button',{name:'입력 보내기'}).click();let event:any;
    await expect.poll(async()=>{event=(await db.pool.query("SELECT id,attention_status FROM events WHERE session_id=$1 AND kind='chat.final' AND payload->>'text'=$2 ORDER BY received_at DESC LIMIT 1",[sessionId,scene.text])).rows[0];return event?.attention_status;},{timeout:90000}).toBe('observed');step.eventId=event.id;
    step.appraisal=(await db.pool.query('SELECT status,provider,model,prompt_version,failure_code,context_refs,provider_result,usage FROM appraisals WHERE event_id=$1',[event.id])).rows[0];expect(step.appraisal).toMatchObject({status:'accepted',prompt_version:'openai-interaction-v5',failure_code:null});
    step.after=(await store.state()).body;step.transition=(await db.pool.query('SELECT t.effects,t.evaluated_at FROM transitions t JOIN events phase ON phase.id=t.source_event_id WHERE phase.parent_event_id=$1 ORDER BY t.state_version DESC LIMIT 1',[event.id])).rows[0];
    const response=(await db.pool.query('SELECT r.id,r.status,r.plan FROM response_runs r JOIN events phase ON phase.id=r.trigger_event_id WHERE phase.parent_event_id=$1',[event.id])).rows[0];step.response=response??null;assert(response);persist();
    step.condition={embarrassed:response.plan.expression==='embarrassed',joyBand:!scene.joy||step.after.affect.joy.value>=.6,frustrationBand:scene.reason?step.after.affect.frustration.value>=.6:!scene.socialSources||step.after.affect.frustration.value>=.1};
    assert(Object.values(step.condition).every(Boolean),'controlled_condition_not_reached');expect(response.plan.speechStyle).toEqual(scene.style);
    if(scene.reason){expect(response.plan.purpose).toBe('reengage');expect(response.plan.reengagement?.disclosure).toBe('deflect');expect(response.plan.reengagement?.silenceEventId).toBe(setup.causes.criticism);}
    step.visibleCaption=await captureStageCaption(stage,resolve(groupRoot,'stage.png'));
    await expect.poll(async()=>{const r=(await db.pool.query('SELECT status,cancel_reason FROM response_runs WHERE id=$1',[response.id])).rows[0];if(['failed','cancelled','interrupted'].includes(r.status))throw Error('output_'+r.cancel_reason);return r.status;},{timeout:90000}).toBe('completed');
    step.segments=(await db.pool.query('SELECT id,text,text_shown_at,delivery_status FROM speech_segments WHERE response_id=$1 ORDER BY segment_index',[response.id])).rows;step.caption=step.segments.map((s:any)=>s.text).join(' ');
    expect(step.segments.length).toBeGreaterThan(0);expect(step.segments.length).toBeLessThanOrEqual(response.plan.maxSentences);expect([...step.caption].length).toBeLessThanOrEqual(120);expect(step.visibleCaption).toBe(step.segments[0].text);
    step.acks=(await db.pool.query("SELECT kind,payload->>'segmentId' AS segment FROM events WHERE session_id=$1 AND kind IN ('caption.shown','caption.finished') AND payload->>'responseId'=$2",[sessionId,response.id])).rows;
    expect(step.acks).toHaveLength(step.segments.length*2);for(const s of step.segments){assert(s.text_shown_at);expect(s.delivery_status).toBe('finished');for(const kind of ['caption.shown','caption.finished'])expect(step.acks.filter((a:any)=>a.kind===kind&&a.segment===s.id)).toHaveLength(1);}
    expect(step.packets.filter((p:any)=>p.type==='speech.segment').map((p:any)=>p.payload.segmentId).sort()).toEqual(step.segments.map((s:any)=>s.id).sort());expect(step.browserErrors).toEqual([]);expect(await store.busy()).toBe(false);
    const expected=decay(state,step.after.mood.asOf),effects=step.transition.effects;
    if(praiseOnly){expect(response.plan.purpose).toBe('praise');expect(effects.category).toBe('praise');}
    for(const kind of ['joy','frustration','embarrassment'] as const){
     const stimulus=kind==='joy'&&effects.category==='praise'?effects.stimulus:0;
     expect(step.after.affect[kind].value).toBeCloseTo(Math.min(1,expected.affect[kind].value+stimulus),12);
     const causes=stimulus>0?[...state.affect[kind].causes,{eventId:event.id,targetId:identity}]:state.affect[kind].causes;expect(step.after.affect[kind].causes).toEqual(causes);
    }
    await page.getByRole('button',{name:'만남 종료'}).click();await expect(page.getByRole('button',{name:'새 만남 시작'})).toBeVisible();step.sessionStatus=(await db.pool.query('SELECT status FROM sessions WHERE id=$1',[sessionId])).rows[0].status;expect(step.sessionStatus).toBe('ended');
    step.status='TECHNICAL_PASS_REQUIRES_QUALITY_REVIEW';step.completedAt=Date.now();persist();console.log(JSON.stringify({id:scene.id,status:step.status,caption:step.caption,plan:response.plan.speechStyle,affect:{joy:step.after.affect.joy.value,frustration:step.after.affect.frustration.value,embarrassment:step.after.affect.embarrassment.value}}));
   }finally{
    if(page&&sessionId)await page.getByRole('button',{name:'만남 종료'}).click({timeout:1000}).catch(()=>{});
    try{await expect.poll(()=>read(ledgerPath).entries.slice(before.entries.length).filter((e:any)=>e.status==='reserved').length,{timeout:130000,intervals:[500,1000]}).toBe(0);step.settled=true;}catch{step.settled=false;}
    await browser?.close().catch(()=>{});if(child&&child.exitCode===null&&child.signalCode===null){const running=child,ended=new Promise<void>(r=>running.once('exit',()=>r()));running.kill();await ended;}
    step.childExited=!child||child.exitCode!==null||child.signalCode!==null;await db.close();persist();
   }
   if(!step.settled||!step.childExited)throw Error('group_cleanup_failed');
  }
  result.status='TECHNICAL_PASS_QUALITY_PENDING';result.claims.technical='PASS';
 }catch(error){result.status='FAIL';result.failure=error instanceof Error?error.message:String(error);process.exitCode=1;}
 finally{
  const after=read(ledgerPath);result.newEntries=after.entries.slice(before.entries.length);result.ledgerPreserved=after.limitUsd===3&&JSON.stringify(after.entries.slice(0,before.entries.length))===JSON.stringify(before.entries);result.budget=budget.summary();
  if(!result.ledgerPreserved||result.newEntries.some((e:any)=>e.status!=='completed')||result.newEntries.filter((e:any)=>e.kind==='decision').length>allowedCalls||result.newEntries.filter((e:any)=>e.kind==='dialogue').length>allowedCalls){result.status='FAIL';result.accountingFailure=true;process.exitCode=1;}
  for(const p of sourceFiles){const dest=resolve(root,'source',p);mkdirSync(dirname(dest),{recursive:true});copyFileSync(p,dest);if(hash(p)!==sourceHashes[p]){result.status='FAIL';result.sourceChanged=p;process.exitCode=1;}}
  if(result.cleanup.startedCluster){const admin=new Database(baseUrl.href);try{const directory=(await admin.pool.query('SHOW data_directory')).rows[0].data_directory;assert.equal(directory.replaceAll('\\','/').toLowerCase(),cluster.toLowerCase());result.cleanup.otherClients=(await admin.pool.query("SELECT pid FROM pg_stat_activity WHERE backend_type='client backend' AND pid<>pg_backend_pid()" )).rowCount;await admin.close();if(result.cleanup.otherClients===0){const stopped=spawnSync(pgctl,['-D',cluster,'-m','fast','-w','stop'],{env:envBase,windowsHide:true,encoding:'utf8'});assert.equal(stopped.status,0);result.cleanup.stoppedOwnedCluster=true;}}catch(error){await admin.close().catch(()=>{});result.cleanup.error=error instanceof Error?error.message:String(error);result.status='FAIL';process.exitCode=1;}}
  persist();console.log(JSON.stringify({status:result.status,failure:result.failure,root,steps:result.steps.length,ledgerPreserved:result.ledgerPreserved,budget:result.budget,cleanup:result.cleanup}));
 }
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
