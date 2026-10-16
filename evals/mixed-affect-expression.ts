// Live opt-in evaluation through the normal provider factory, application and
// Chrome Stage. No recorded responses are substituted for provider results.
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseEnv} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {chromium,expect,type BrowserContext,type Page} from '@playwright/test';
import {Database} from '../packages/database/src/connection.ts';
import {Store} from '../packages/database/src/store.ts';
import {migrate} from '../packages/database/src/migrate.ts';
import {seed,IDENTITY_IDS} from '../packages/database/src/seed.ts';
import {initialState,expression,decay} from '../packages/character-core/src/index.ts';
import {neutralAppraisal,type State} from '../packages/contracts/src/domain.ts';
import {DialogueBudget} from '../packages/adapters/src/openai.ts';
import {captureStageCaption} from './browser/caption.ts';

const fixturePath='evals/fixtures/mixed-affect-expression-v1.json';
const ledgerPath='J:/ai/ai-character-runtime/openai-generation-20261014/budget.json';
const profilePath='J:/ai/ai-character-runtime/text-mvp-20261015/app.env';
const historicalUnknown={count:'3f1c4f32-41f7-42f2-b05e-dfe0d65aaaef',dialogue:'3d0ab723-3d8e-4a76-824e-e59ef7a8dc67'};
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
type Style={register:'casual'|'formal';positiveTone:'neutral'|'warm'|'bright'};
type Control={id:string;text:string;identity:'A'|'B';joy:number;frustration:number;pleasantness:number;joySource:'A'|'B'|null;frustrationSource:'A'|'B'|null;expressionIntent?:{joy:'show';discomfort:'mask'};expectedStyle:Style;review:string};
type Input={id:string;text:string;speak:boolean;silence?:'withholding';disclosure?:'partial';review:string};
type Fixtures={version:string;scope:string;controls:Control[];sequence:Input[];qualityRubric:unknown};
type Entry={id:string;kind:'count'|'decision'|'dialogue';status:'reserved'|'completed'|'unknown';usd:number;usage?:unknown};
type Ledger={version:number;model:string;limitUsd:number;entries:Entry[]};

export function validateFixtures(value:unknown):Fixtures{
 const f=value as Fixtures;
 if(f?.version!=='mixed-affect-expression-v1'||!Array.isArray(f.controls)||!Array.isArray(f.sequence)||f.controls.length!==6||f.sequence.length!==6)throw Error('fixed_6_plus_6_required');
 const all=[...f.controls,...f.sequence];
 if(new Set(all.map(c=>c.id)).size!==12||all.some(c=>typeof c.text!=='string'||!c.text.trim()||typeof c.review!=='string'))throw Error('invalid_case');
 for(const c of f.controls){
  if(!['A','B'].includes(c.identity)||![c.joy,c.frustration,c.pleasantness].every(n=>Number.isFinite(n)&&n>=0&&n<=1)||![c.joySource,c.frustrationSource].every(id=>id===null||id==='A'||id==='B'))throw Error('invalid_control');
  if(!['casual','formal'].includes(c.expectedStyle?.register)||!['neutral','warm','bright'].includes(c.expectedStyle?.positiveTone))throw Error('invalid_style');
  if((c.joy>0)!==!!c.joySource||(c.frustration>0)!==!!c.frustrationSource)throw Error('control_source_required');
  if(c.expressionIntent&&(c.id!=='C6-mask-discomfort'||JSON.stringify(c.expressionIntent)!==JSON.stringify({joy:'show',discomfort:'mask'})))throw Error('unsupported_control_intent');
 }
 if(!f.controls.find(c=>c.id==='C6-mask-discomfort')?.expressionIntent)throw Error('mask_control_required');
 if(f.sequence.some(c=>typeof c.speak!=='boolean'||Object.keys(c).some(k=>!['id','text','speak','silence','disclosure','review'].includes(k))))throw Error('sequence_must_not_inject_state_or_intent');
 return f;
}

export function boundedLimits(ledger:Ledger){
 if(ledger.version!==1||ledger.model!=='gpt-6-sol'||ledger.limitUsd!==3||!Array.isArray(ledger.entries)||ledger.entries.some(e=>!e.id||!['count','decision','dialogue'].includes(e.kind)||!['reserved','completed','unknown'].includes(e.status)||!Number.isFinite(e.usd)||e.usd<0)||new Set(ledger.entries.map(e=>e.id)).size!==ledger.entries.length)throw Error('invalid_existing_ledger');
 const unresolved=ledger.entries.filter(e=>e.status!=='completed');
 if(unresolved.length!==2||unresolved.some(e=>e.status!=='unknown'||e.kind==='decision'||historicalUnknown[e.kind]!==e.id))throw Error('new_or_missing_unresolved_usage');
 const guardTotalUsd=ledger.entries.reduce((s,e)=>s+e.usd,0);
 if(guardTotalUsd>=3)throw Error('budget_exhausted');
 return {usd:3,decision:ledger.entries.filter(e=>e.kind==='decision').length+12,dialogue:ledger.entries.filter(e=>e.kind==='dialogue').length+12,guardTotalUsd,remainingGuardUsd:3-guardTotalUsd};
}

// Evaluate the state at planning time, not the earlier injected values. A slow
// real provider can let .7 naturally decay out of the intended high band; that
// misses the controlled condition without proving a model or transport fault.
export function controlCondition(control:Pick<Control,'joy'|'frustration'>,actual:Pick<State,'affect'>){
 const missed=(['joy','frustration'] as const).filter(kind=>control[kind]>=.6&&actual.affect[kind].value<.6);
 return {status:missed.length?'CONDITION_NOT_REACHED' as const:'REACHED' as const,missed:missed.map(kind=>({emotion:kind,minimum:.6,actual:actual.affect[kind].value})),actual:{joy:actual.affect.joy.value,frustration:actual.affect.frustration.value}};
}

const sources=['evals/mixed-affect-expression.ts','evals/mixed-affect-expression-control.ts',fixturePath,'evals/browser/caption.ts','packages/character-core/src/index.ts','packages/database/src/store.ts','packages/contracts/src/domain.ts','packages/contracts/src/ai-ports.ts','packages/adapters/src/dialogue-request.ts','packages/adapters/src/openai.ts','packages/adapters/src/openai-interaction.ts','packages/adapters/src/openai-interaction-v5.ts','apps/runtime/src/index.ts','apps/runtime/src/providers.ts','apps/runtime/src/coordinator/index.ts','apps/runtime/src/http/server.ts','apps/studio/src/main.tsx','apps/studio/src/wire.ts'];
const identity=(id:'A'|'B')=>IDENTITY_IDS[id==='A'?0:1]!;

async function setupControlSources(store:Store,control:Control){
 const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
 const causeIds:Partial<Record<'joy'|'frustration',string>>={};
 const setup:any[]=[];
 for(const emotion of ['joy','frustration'] as const){
  const source=control[emotion==='joy'?'joySource':'frustrationSource'];if(!source)continue;
  const text=emotion==='joy'?'이전 합성 설명을 정말 잘했어.':'너는 쓸모없는 쓰레기야. 꺼져.';
  const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId:identity(source),text});
  const selected=(await store.select(accepted.eventId))!;
  const result=await store.commitAppraisal(selected,{...neutralAppraisal,target:'character',act:emotion==='joy'?'praise':'criticism',strength:3,hostility:emotion==='joy'?0:3,uncertain:false,evidence_refs:[accepted.eventId]},{provider:'synthetic-controlled-source',model:'explicit-fixture-v1'});
  expect(result.status).toBe('committed');
  if(result.response)await store.failResponse(result.response.id,'controlled_source_not_delivered');
  causeIds[emotion]=accepted.eventId;setup.push({emotion,eventId:accepted.eventId,identityId:identity(source),source:'explicit synthetic Store appraisal; NOT actual model judgment'});
 }
 await store.stopSession(sessionId,randomUUID());return {causeIds,setup};
}

async function settleNewEntries(beforeLength:number){
 await expect.poll(()=>read(ledgerPath).entries.slice(beforeLength).filter((e:Entry)=>e.status==='reserved').length,{timeout:130000,intervals:[500,1000]}).toBe(0);
}

export async function main(args=process.argv.slice(2)){
 const preflight=args[0]==='--preflight';
 if((preflight?args.length!==3:args.length!==5)||!['--preflight','--live'].includes(args[0]??'')||args[1]!=='--attempt'||!/^r[1-9]\d*$/.test(args[2]??'')||!preflight&&(args[3]!=='--synthetic-inputs'||args[4]!=='--allow-paid-providers'))throw Error('usage: --preflight --attempt r1 OR --live --attempt r1 --synthetic-inputs --allow-paid-providers');
 const attempt=args[2]!,root=resolve('J:/ai/ai-character-runtime/mixed-affect-expression-20261016-'+attempt);
 if(existsSync(root))throw Error('evidence_exists_use_new_attempt_no_resume');
 const fixtures=validateFixtures(read(fixturePath)),before=read(ledgerPath) as Ledger,limits=boundedLimits(before),beforeHash=hash(ledgerPath);
 const profile=parseEnv(readFileSync(profilePath,'utf8'));
 if(profile.APPRAISAL_PROVIDER!=='openai-decisions-v5'||profile.APPRAISAL_MODEL!=='gpt-6-luna'||profile.DIALOGUE_PROVIDER!=='openai'||profile.DIALOGUE_MODEL!=='gpt-6-sol'||profile.LOCAL_ONLY!=='false'||profile.ALLOW_PAID_PROVIDERS!=='true')throw Error('approved_provider_profile_required');
 const baseUrl=new URL(profile.DATABASE_URL!);if(baseUrl.hostname!=='127.0.0.1'||baseUrl.port!=='55434')throw Error('isolated_local_pg_required');
 if(resolve(profile.DIALOGUE_BUDGET_PATH!)!==resolve(ledgerPath)||profile.DIALOGUE_BUDGET_USD!=='3'||profile.OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID!==historicalUnknown.count||profile.OPENAI_ACKNOWLEDGED_DIALOGUE_ENTRY_ID!==historicalUnknown.dialogue)throw Error('existing_ledger_authorization_required');
 const authorization={authorization:'User approved mixed affect implementation and bounded validation within existing USD3. This attempt permits at most twelve decisions and twelve generations, preserves historical unknown reservations, and uses only synthetic inputs.',maxDecisionCalls:limits.decision,maxDialogueCalls:limits.dialogue,acknowledgedCountEntryId:historicalUnknown.count,acknowledgedDialogueEntryId:historicalUnknown.dialogue};
 const budget=new DialogueBudget(ledgerPath,3,undefined,authorization);
 for(const kind of ['decision','dialogue'] as const)if(budget.availability(kind).errorCode)throw Error('budget_preflight_'+budget.availability(kind).errorCode);
 const key=parseEnv(readFileSync('runtime-data/dialogue-api.env','utf8')).DIALOGUE_API_KEY;if(!key?.trim())throw Error('key_missing');
 const sourceHashes=Object.fromEntries(sources.map(p=>[p,hash(p)]));
 if(preflight){console.log(JSON.stringify({status:'READY_NOT_EXECUTED',root,fixtures:fixtures.version,caseCount:12,limits,ledgerEntries:before.entries.length,ledgerHash:beforeHash,sourceHashes}));return;}
 mkdirSync(root);mkdirSync(resolve(root,'tmp'));process.env.TEMP=resolve(root,'tmp');process.env.TMP=process.env.TEMP;writeFileSync(resolve(root,'ledger-before.json'),JSON.stringify(before,null,2));
 const result:any={status:'RUNNING',scope:fixtures.scope,sourceHashes,ledgerBeforeHash:beforeHash,limits,authorization,fixtures,steps:[],groups:[],conditionMisses:[],claims:{controlledStateExpression:'NOT_VERIFIED',naturalStrongMixedAffect:'NOT_REACHED',koreanQuality:'REQUIRES_REVIEW',creatorAcceptance:'NOT_VERIFIED'},notes:['C6 alone uses an evaluation-only trusted pre-persistence expression intent; natural sequence never loads that preload.','Controls have explicit synthetic accepted source appraisals and state injection; their numeric levels do not establish natural reachability.','The high control band requires joy/frustration >=.6 at planning time. Ordinary decay below that band is CONDITION_NOT_REACHED, not transport or model-quality failure and not a successful control.']};
 const persist=()=>writeFileSync(resolve(root,'results.json'),JSON.stringify(result,null,2)+'\n');
 writeFileSync(resolve(root,'manifest.json'),JSON.stringify({scope:result.scope,fixtures,sourceHashes,ledgerBeforeHash:beforeHash,limits,authorization,models:{decision:profile.APPRAISAL_MODEL,dialogue:profile.DIALOGUE_MODEL}},null,2));persist();
 const baseEnv:NodeJS.ProcessEnv={...process.env,...profile,DIALOGUE_API_KEY:key,DIALOGUE_BUDGET_PATH:ledgerPath,DIALOGUE_BUDGET_USD:'3',OPENAI_MAX_DECISION_CALLS:String(limits.decision),OPENAI_MAX_DIALOGUE_CALLS:String(limits.dialogue),OPENAI_BUDGET_AUTHORIZATION:authorization.authorization,OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID:historicalUnknown.count,OPENAI_ACKNOWLEDGED_DIALOGUE_ENTRY_ID:historicalUnknown.dialogue,RUNTIME_ACCEPTANCE_FIXTURES:'false',MIXED_AFFECT_CONTROL_MODE:'',TEMP:resolve(root,'tmp'),TMP:resolve(root,'tmp')};
 try{
  // One fresh database per controlled condition, plus an entirely fresh DB for
  // the sequence. The sequence never inherits or resets a controlled state.
  for(const [groupIndex,control] of [...fixtures.controls,null].entries()){
   const groupId=control?control.id:'natural-sequence',groupRoot=resolve(root,groupId);mkdirSync(groupRoot);
   const databaseName='character_runtime_mx_20261016_'+attempt+'_'+(control?'c'+(groupIndex+1):'natural');
   const url=new URL(baseUrl);url.pathname='/'+databaseName;
   const group:any={id:groupId,databaseName,stateInjection:!!control,intentInjection:!!control?.expressionIntent,status:'RUNNING',browserErrors:[],packets:[]};result.groups.push(group);persist();
   const adminUrl=new URL(baseUrl);adminUrl.pathname='/postgres';const admin=new Database(adminUrl.href);
   try{if((await admin.pool.query('SELECT 1 FROM pg_database WHERE datname=$1',[databaseName])).rowCount)throw Error('test_database_exists');await admin.pool.query('CREATE DATABASE '+databaseName);}finally{await admin.close();}
   const db=new Database(url.href),store=new Store(db);let child:ChildProcess|undefined,browser:BrowserContext|undefined,page:Page|undefined,stage:Page|undefined,sessionId:string|undefined;
   try{
    await migrate(db);await seed(db);
    const setup=control?await setupControlSources(store,control):null;group.sourceSetup=setup?.setup??[];
    const env={...baseEnv,DATABASE_URL:url.href,MIXED_AFFECT_CONTROL_MODE:control?.expressionIntent?'C6-mask-discomfort':''};
    let stdout='';child=spawn(process.execPath,['--experimental-transform-types',...(control?.expressionIntent?['--import','./evals/mixed-affect-expression-control.ts']:[]),'apps/runtime/src/index.ts'],{cwd:process.cwd(),env,windowsHide:true,stdio:['ignore','pipe','pipe']});group.pid=child.pid;
    child.stdout!.on('data',b=>stdout+=String(b));child.stderr!.on('data',()=>{});
    await expect.poll(()=>{if(child?.exitCode!==null)throw Error('runtime_start_failed');return /일회용 Studio 코드: ([a-f0-9]{64})/.exec(stdout)?.[1]??'';},{timeout:20000}).not.toBe('');
    browser=await chromium.launchPersistentContext(resolve(groupRoot,'chrome-profile'),{headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',viewport:{width:1400,height:1000},env,downloadsPath:resolve(groupRoot,'downloads')});
    page=await browser.newPage();page.on('pageerror',e=>group.browserErrors.push(e.message));await page.goto('http://127.0.0.1:3001/studio');await page.getByLabel('일회용 연결 코드').fill(/일회용 Studio 코드: ([a-f0-9]{64})/.exec(stdout)![1]!);await page.getByRole('button',{name:'연결',exact:true}).click();await expect(page.getByRole('heading',{name:'캐릭터 작업실'})).toBeVisible();
    await page.getByRole('button',{name:'새 만남 시작'}).click();await expect(page.getByRole('button',{name:'만남 종료'})).toBeVisible();sessionId=(await store.currentSession())!.id;group.sessionId=sessionId;
    const popup=browser.waitForEvent('page');await page.getByRole('button',{name:'Stage 열기'}).click();stage=await popup;stage.on('pageerror',e=>group.browserErrors.push(e.message));stage.on('websocket',socket=>socket.on('framereceived',frame=>{const p=JSON.parse(String(frame.payload));if(['speech.segment','response.start','response.cancel'].includes(p.type))group.packets.push(p);}));await stage.waitForLoadState();await expect(page.getByRole('button',{name:'출력 선택'})).toBeEnabled();await page.getByRole('button',{name:'출력 선택'}).click();await expect(stage.locator('.stage-status')).toContainText('자막 출력 중');
    if(control){
     const now=Date.now(),state=initialState(now);state.affect.joy.value=control.joy;state.affect.frustration.value=control.frustration;state.mood.pleasantness=control.pleasantness;
     for(const emotion of ['joy','frustration'] as const){const source=control[emotion==='joy'?'joySource':'frustrationSource'];if(source)state.affect[emotion].causes=[{eventId:setup!.causeIds[emotion]!,targetId:identity(source)}];}
     state.expression=expression(state,now);group.intervention={before:(await store.state()).body,after:state,expressionIntent:control.expressionIntent??null,description:'Explicit control only; normal decay resumes immediately.'};
     await db.pool.query('UPDATE character_state SET body=$1,snapshot_at=$2 WHERE character_id=$3',[state,new Date(now),store.characterId]);
     if(control.expressionIntent)await db.pool.query("INSERT INTO events(id,character_id,session_id,identity_id,source_namespace,source_key,kind,occurred_at,received_at,observed_at,applied_at,attention_status,data_status,revision,schema_version,payload) VALUES($1,$2,$3,$4,'eval:mixed-affect-expression-v1','C6:mask-discomfort','eval.expression-intent',$5,$5,$5,$5,'observed','active',1,1,'{}')",[randomUUID(),store.characterId,sessionId,identity(control.identity),new Date(now)]);
    }
    const scenes:Input[]=control?[{id:control.id,text:control.text,speak:true,review:control.review}]:fixtures.sequence;
    await page.getByLabel('대화 상대').selectOption(identity(control?.identity??'A'));
    for(const scene of scenes){
     const callStart=read(ledgerPath).entries.length,step:any={id:scene.id,text:scene.text,groupId,sessionId,startedAt:Date.now(),before:(await store.state()).body,review:scene.review,qualityStatus:'REQUIRES_REVIEW'};result.steps.push(step);persist();
     await page.getByLabel('할 말').fill(scene.text);await page.getByRole('button',{name:'입력 보내기'}).click();let event:any;
     await expect.poll(async()=>{event=(await db.pool.query("SELECT id,attention_status,identity_id FROM events WHERE session_id=$1 AND kind='chat.final' AND payload->>'text'=$2 ORDER BY received_at DESC LIMIT 1",[sessionId,scene.text])).rows[0];return event?.attention_status;},{timeout:90000}).toBe('observed');step.eventId=event.id;step.identityId=event.identity_id;
     step.appraisal=(await db.pool.query('SELECT status,provider,model,prompt_version,failure_code,context_refs,provider_result,usage FROM appraisals WHERE event_id=$1',[event.id])).rows[0];expect(step.appraisal).toMatchObject({status:'accepted',prompt_version:'openai-interaction-v5',failure_code:null});
     step.after=(await store.state()).body;step.transition=(await db.pool.query('SELECT t.effects FROM transitions t JOIN events phase ON phase.id=t.source_event_id WHERE phase.parent_event_id=$1 ORDER BY state_version DESC LIMIT 1',[event.id])).rows[0];
     const response=(await db.pool.query('SELECT r.id,r.status,r.plan FROM response_runs r JOIN events phase ON phase.id=r.trigger_event_id WHERE phase.parent_event_id=$1',[event.id])).rows[0];step.response=response??null;
     if(!scene.speak){
      expect(response).toBeUndefined();step.silence=step.after.turn.recentSilences.find((s:any)=>s.eventId===event.id);expect(step.silence?.reason).toBe(scene.silence);expect(await store.busy()).toBe(false);await expect(stage.locator('.caption')).toHaveText('');expect(read(ledgerPath).entries.slice(callStart).filter((e:Entry)=>e.kind==='dialogue')).toHaveLength(0);
     }else{
      expect(response).toBeTruthy();persist();step.visibleCaption=await captureStageCaption(stage,resolve(groupRoot,scene.id+'-stage.png'));
      await expect.poll(async()=>{const r=(await db.pool.query('SELECT status,cancel_reason FROM response_runs WHERE id=$1',[response.id])).rows[0];if(['failed','cancelled','interrupted'].includes(r.status))throw Error('output_'+r.cancel_reason);return r.status;},{timeout:90000}).toBe('completed');
      step.segments=(await db.pool.query('SELECT id,text,text_shown_at,delivery_status FROM speech_segments WHERE response_id=$1 ORDER BY segment_index',[response.id])).rows;step.caption=step.segments.map((s:any)=>s.text).join(' ');expect(step.segments.length).toBeGreaterThan(0);expect(step.segments.length).toBeLessThanOrEqual(response.plan.maxSentences);expect([...step.caption].length).toBeLessThanOrEqual(120);expect(step.visibleCaption).toBe(step.segments[0].text);
      step.acks=(await db.pool.query("SELECT kind,payload->>'segmentId' AS segment FROM events WHERE session_id=$1 AND kind IN ('caption.shown','caption.finished') AND payload->>'responseId'=$2",[sessionId,response.id])).rows;
      expect(step.acks).toHaveLength(step.segments.length*2);for(const s of step.segments){expect(s.text_shown_at).toBeTruthy();expect(s.delivery_status).toBe('finished');for(const k of ['caption.shown','caption.finished'])expect(step.acks.filter((a:any)=>a.kind===k&&a.segment===s.id)).toHaveLength(1);}
      expect(await store.busy()).toBe(false);if(scene.text.includes('오후3시'))expect(step.caption).toMatch(/오후\s*3시/);
      if(control){step.controlCondition=controlCondition(control,step.after);if(step.controlCondition.status==='REACHED')expect(response.plan.speechStyle).toEqual(control.expectedStyle);else result.conditionMisses.push({caseId:scene.id,...step.controlCondition});}
      if(scene.disclosure)expect(response.plan.reengagement?.disclosure).toBe(scene.disclosure);
     }
     const expected=decay(step.before as State,step.after.mood.asOf),effects=step.transition.effects;
     for(const emotion of ['joy','frustration'] as const){
      if(!((emotion==='joy'&&effects.category==='praise'||emotion==='frustration'&&effects.category==='direct_insult')&&effects.stimulus>0)&&!(emotion==='frustration'&&effects.repairUsed))expect(step.after.affect[emotion].value).toBeCloseTo(expected.affect[emotion].value,12);
      for(const cause of step.before.affect[emotion].causes)expect(step.after.affect[emotion].causes).toContainEqual(cause);
     }
     if(scene.id==='N5-apology'){expect(response.plan.purpose).toBe('acknowledge_repair');expect(effects.repairUsed?.candidateEventId).toBe(result.steps.find((s:any)=>s.id==='N2-attack').eventId);const amount=expected.affect.frustration.value-step.after.affect.frustration.value;expect(amount).toBeGreaterThan(0);expect(amount).toBeLessThanOrEqual(.030000000001);expect(step.after.affect.frustration.value).toBeGreaterThan(0);step.repairAmount=amount;}
     step.transportStatus='PASS';step.status=step.controlCondition?.status==='CONDITION_NOT_REACHED'?'CONDITION_NOT_REACHED':'PASS';step.completedAt=Date.now();persist();console.log(JSON.stringify({id:step.id,status:step.status,caption:step.caption??null,style:response?.plan.speechStyle??null,joy:step.after.affect.joy.value,frustration:step.after.affect.frustration.value}));
    }
    const delivered=result.steps.filter((s:any)=>s.groupId===groupId).flatMap((s:any)=>s.segments??[]);expect(group.packets.filter((p:any)=>p.type==='speech.segment').map((p:any)=>p.payload.segmentId).sort()).toEqual(delivered.map((s:any)=>s.id).sort());expect(group.browserErrors).toEqual([]);
    await page.getByRole('button',{name:'만남 종료'}).click();await expect(page.getByRole('button',{name:'새 만남 시작'})).toBeVisible();group.sessionStatus=(await db.pool.query('SELECT status FROM sessions WHERE id=$1',[sessionId])).rows[0].status;expect(group.sessionStatus).toBe('ended');group.status='PASS';
   }finally{
    if(page&&sessionId)await page.getByRole('button',{name:'만남 종료'}).click({timeout:1000}).catch(()=>{});
    try{await settleNewEntries(before.entries.length);group.settled=true;}catch{group.settled=false;result.status='FAIL';}
    await browser?.close().catch(()=>{});
    if(child&&child.exitCode===null&&child.signalCode===null){const running=child,ended=new Promise<void>(r=>running.once('exit',()=>r()));running.kill();await ended;}
    group.childExited=!child||child.exitCode!==null||child.signalCode!==null;await db.close();persist();
   }
   if(!group.settled||!group.childExited)throw Error('group_cleanup_failed');
   if(read(ledgerPath).entries.slice(before.entries.length).some((e:Entry)=>e.status!=='completed'))throw Error('unsettled_provider_usage_stop');
  }
  result.transportStatus='PASS';result.contractStatus=result.conditionMisses.length?'CONDITION_NOT_REACHED':'PASS';result.claims.controlledStateExpression=result.conditionMisses.length?'CONDITION_NOT_REACHED':'PLAN_AND_TRANSPORT_PASS_QUALITY_REQUIRES_REVIEW';
  result.claims.naturalStrongMixedAffect=result.steps.filter((s:any)=>s.groupId==='natural-sequence').some((s:any)=>s.after.affect.joy.value>=.6&&s.after.affect.frustration.value>=.6)?'REACHED':'NOT_REACHED';result.status=result.conditionMisses.length?'CONDITION_NOT_REACHED':'TECHNICAL_PASS_QUALITY_PENDING';if(result.conditionMisses.length)process.exitCode=1;
 }catch(e){result.status='FAIL';result.failure=e instanceof Error?e.message:String(e);process.exitCode=1;}
 finally{
  const after=read(ledgerPath) as Ledger;result.newEntries=after.entries.slice(before.entries.length);result.ledgerPreserved=after.limitUsd===3&&JSON.stringify(after.entries.slice(0,before.entries.length))===JSON.stringify(before.entries);result.cost={guardTotalUsd:after.entries.reduce((s,e)=>s+e.usd,0),modelUsageEstimateUsd:after.entries.filter(e=>e.usage).reduce((s,e)=>s+e.usd,0),billingVerified:false};
  if(!result.ledgerPreserved||result.newEntries.some((e:Entry)=>e.status!=='completed')||result.newEntries.filter((e:Entry)=>e.kind==='decision').length>12||result.newEntries.filter((e:Entry)=>e.kind==='dialogue').length>12){result.status='FAIL';result.finalAccountingCheckFailed=true;process.exitCode=1;}
  for(const p of sources){const dest=resolve(root,'source',p);mkdirSync(dirname(dest),{recursive:true});copyFileSync(p,dest);if(hash(p)!==sourceHashes[p]){result.status='FAIL';result.sourceChanged=p;process.exitCode=1;}}
  persist();console.log(JSON.stringify({status:result.status,failure:result.failure,root,steps:result.steps.length,cost:result.cost,ledgerPreserved:result.ledgerPreserved,claims:result.claims}));
 }
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
