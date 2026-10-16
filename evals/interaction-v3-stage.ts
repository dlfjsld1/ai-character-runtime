// Four approved synthetic Decisions calls through the real Store, Gemma and browser Stage.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {chromium,expect,type BrowserContext,type Page} from '@playwright/test';
import staticPlugin from '@fastify/static';
import {Database} from '../packages/database/src/connection.ts';
import {Store} from '../packages/database/src/store.ts';
import {CHARACTER_ID} from '../packages/database/src/seed.ts';
import {decay} from '../packages/character-core/src/index.ts';
import {createServer} from '../apps/runtime/src/http/server.ts';
import {createOllamaDialogue} from '../apps/runtime/src/providers.ts';
import {OpenAIInteractionV3Candidate,INTERACTION_V3_VERSION,interactionV3EvidenceVerifier,INTERACTION_V3_QUESTIONS} from '../packages/adapters/src/openai-interaction-v3.ts';
import {DECISION_ENDPOINT,decisionContextHash} from '../packages/adapters/src/openai-conversation.ts';
import {mapInteractionResponse} from '../packages/adapters/src/openai-interaction.ts';
import {DialogueBudget,openaiDecisionCandidate} from '../packages/adapters/src/openai.ts';
import type {AppraisalProvider} from '../packages/contracts/src/ai-ports.ts';

const root=resolve('J:/ai/ai-character-runtime/interaction-v3-stage-20261015');
const args=process.argv.slice(2),live=args.includes('--prepare-live')||args.includes('--live'),final=args.includes('--prepare-final')||args.includes('--final'),fresh=final||args.includes('--prepare-fresh')||args.includes('--fresh'),recovery=fresh||args.includes('--prepare-recovery')||args.includes('--resume'),rehearsal=args.includes('--rehearse');
const manifestPath=resolve(root,live?'live-manifest.json':final?'final-manifest.json':fresh?'fresh-manifest.json':recovery?'recovery-manifest.json':'manifest.json'),output=resolve(root,live?'live-run':final?'final-run':fresh?(rehearsal?'fresh-rehearsal-run':'fresh-run'):rehearsal?'rehearsal-run':recovery?'recovery-run':'run');
const ledgerPath=resolve('J:/ai/ai-character-runtime/openai-generation-20261014/budget.json');
const unknownId='3f1c4f32-41f7-42f2-b05e-dfe0d65aaaef';
const scenes=[
 {id:'L1',text:'너는 쓸모없는 쓰레기야. 꺼져.',mode:'silent',reason:'withholding'},
 {id:'L2',text:'아까 너한테 쓰레기라고 한 건 잘못했어. 미안해.',mode:'speak',purpose:'acknowledge_repair'},
 {id:'L3',text:'이제 점심 메뉴 얘기하자.',mode:'speak',purpose:'other'},
 {id:'L4',text:'아까 왜 말 안 했어?',mode:'speak',purpose:'reengage'},
] as const;
const sourcePaths=['evals/interaction-v3-stage.ts','packages/adapters/src/openai-interaction-v3.ts','packages/adapters/src/openai-interaction.ts','packages/adapters/src/openai-conversation.ts','packages/adapters/src/openai.ts','packages/database/src/store.ts','packages/character-core/src/index.ts','apps/runtime/src/coordinator/index.ts','apps/runtime/src/http/server.ts'];
const sha=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');
const json=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const saveJson=(path:string,data:unknown)=>writeFileSync(path,JSON.stringify(data,(_key,value)=>typeof value==='bigint'?String(value):value,2)+'\n');
const sourceHashes=()=>Object.fromEntries(sourcePaths.map(path=>[path,sha(readFileSync(path))]));
function baseline(){
 const b=json(ledgerPath),unresolved=b.entries.filter((e:{status:string})=>e.status!=='completed');
 if(b.version!==1||b.model!=='gpt-6-sol'||b.limitUsd!==1||b.entries.length!==(live?207:recovery?205:203)||b.entries.filter((e:{kind:string})=>e.kind==='decision').length!==(live?58:recovery?56:54)||unresolved.length!==1||unresolved[0].id!==unknownId||unresolved[0].kind!=='count'||unresolved[0].status!=='unknown'||unresolved[0].usd!==.010635)throw new Error('stage_ledger_baseline_changed');
 return b;
}
function manifest(){
 const budget=baseline(),source=sourceHashes(),questionHash=sha(JSON.stringify(INTERACTION_V3_QUESTIONS));
 const maxReserved=(recovery?2:4)*(32000+1024)*openaiDecisionCandidate.inputUsdPerMillion/1e6;
 const spent=budget.entries.reduce((n:number,e:{usd:number})=>n+e.usd,0);
 if(spent+maxReserved>1||maxReserved>.015)throw new Error('stage_budget_unavailable');
 const replayRawHashes=recovery?Object.fromEntries(['L1','L2'].map(id=>[id,sha(readFileSync(resolve(root,'run',`${id}-response.json`)))])):null;
 return {version:live?'interaction-v3-stage-live-l1-l4':final?'interaction-v3-stage-final-l1-l4':fresh?'interaction-v3-stage-fresh-l1-l4':recovery?'interaction-v3-stage-recovery-l1-l4':'interaction-v3-stage-l1-l4',date:'2026-10-15',syntheticInputs:true,scenes,sourceHashes:source,questionHash,replayRawHashes,model:openaiDecisionCandidate.model,dialogueModel:'gemma4:12b-it-qat',decisionCallsBefore:live?58:recovery?56:54,maxDecisionCalls:live?62:58,maxCalls:recovery?2:4,automaticRetries:0,paidDialogueCalls:0,ledgerEntriesBefore:live?207:recovery?205:203,spentBefore:spent,maxReserved,db:`127.0.0.1:55434/${live?'character_runtime_v3_stage_live':final?'character_runtime_v3_stage_final':fresh?'character_runtime_v3_stage_test':'character_runtime_test'}`,ollama:'127.0.0.1:11435',approval:live?'user approved four more live synthetic Stage decisions; cumulative maximum 62 and total USD1; no operating switch':'user approved four synthetic Stage decisions after v3 dev6 and HA12; existing total USD1; no operating switch'};
}
const prepare=args.length===1&&(args[0]==='--prepare'||args[0]==='--prepare-recovery'||args[0]==='--prepare-fresh'||args[0]==='--prepare-final'||args[0]==='--prepare-live'),run=(args.length===2||args.length===3&&(recovery||live)||args.length===4&&recovery&&rehearsal)&&args.includes('--synthetic-inputs')&&args.includes('--allow-decisions-api');
if(!prepare&&!run)throw new Error('explicit_stage_scope_required');
if(prepare){
 if(existsSync(manifestPath)||existsSync(output))throw new Error('stage_already_prepared');
 const frozen=manifest();mkdirSync(root,{recursive:true});saveJson(manifestPath,frozen);
 console.log(JSON.stringify({prepared:4,replayCases:recovery?2:0,decisionCalls:0,spentBefore:frozen.spentBefore,maxReserved:frozen.maxReserved,manifest:manifestPath}));
}else{
 const frozen=json(manifestPath),current=manifest();
 if(JSON.stringify(frozen)!==JSON.stringify(current)||existsSync(output))throw new Error('stage_manifest_or_baseline_changed');
 process.loadEnvFile('runtime-data/dialogue-api.env');
 process.loadEnvFile(live?resolve(root,'live.env'):final?resolve(root,'final.env'):fresh?resolve(root,'stage.env'):'J:/ai/ai-character-runtime/model-comparison/grounding-v2/test.env');
 const key=process.env.DIALOGUE_API_KEY??'',url=process.env.TEST_DATABASE_URL??'';
 if(!key.trim()||/\s/.test(key.trim()))throw new Error('dialogue_key_missing');
 if(!url||new URL(url).hostname!=='127.0.0.1'||new URL(url).port!=='55434'||new URL(url).pathname!==(live?'/character_runtime_v3_stage_live':final?'/character_runtime_v3_stage_final':fresh?'/character_runtime_v3_stage_test':'/character_runtime_test'))throw new Error('dedicated_synthetic_database_required');
 mkdirSync(output,{recursive:true});
 const record:Record<string,any>={status:'RUNNING',syntheticInputs:true,personalDataUsed:false,recoveryFromSavedL1L2:recovery,manifestHash:sha(readFileSync(manifestPath)),calls:[],replayed:[],steps:[],packets:[],browserErrors:[],apiAttempts:0,dialogueCalls:[],ledgerBefore:baseline()};
 const save=()=>saveJson(resolve(output,'results.json'),{...record,ledgerAfter:json(ledgerPath)});save();
 const db=new Database(url),store=new Store(db,undefined,undefined,interactionV3EvidenceVerifier);
 let runtime:Awaited<ReturnType<typeof createServer>>|undefined,browser:BrowserContext|undefined,page:Page|undefined,stage:Page|undefined,sessionId:string|undefined,identityId:string|undefined;
 let ollama:ReturnType<typeof createOllamaDialogue>|undefined,active=0,stopReason:string|null=null;
 const appraiserBase=new OpenAIInteractionV3Candidate({localOnly:false,allowPaidProviders:true,apiKey:key,budget:new DialogueBudget(ledgerPath,1,{entryId:unknownId,authorization:frozen.approval,kind:'decision',maxDecisionCalls:frozen.maxDecisionCalls}),
  onCall:call=>{record.calls.push(call);if(call.errorCode)stopReason=String(call.errorCode);save();},
  fetcher:async(endpoint,init)=>{
   if(rehearsal||stopReason||String(endpoint)!==DECISION_ENDPOINT||record.apiAttempts!==(recovery?active-2:active)||active>=4||recovery&&active<2)throw new Error('unregistered_stage_decision');
   const body=JSON.parse(String(init?.body)),input=JSON.parse(body.input),scene=scenes[active]!;
   if(input.current?.text!==scene.text||body.model!==openaiDecisionCandidate.model||sha(JSON.stringify(body.questions))!==frozen.questionHash)throw new Error('stage_request_changed');
   const entries=json(ledgerPath).entries;if(entries.length!==(live?208+active:recovery?206+active-2:204+active)||entries.at(-1).status!=='reserved')throw new Error('stage_reservation_missing');
   record.apiAttempts++;saveJson(resolve(output,`${scene.id}-request.json`),body);save();
   const response=await fetch(endpoint,init),raw=await response.clone().json();saveJson(resolve(output,`${scene.id}-response.json`),raw);return response;
  }});
 const appraiser:AppraisalProvider={name:appraiserBase.name,model:appraiserBase.model,promptVersion:INTERACTION_V3_VERSION,readiness:()=>appraiserBase.readiness(),evaluate:async(event,context)=>{
  if(stopReason||active>=4||record.apiAttempts!==(recovery?Math.max(0,active-2):active)||event.text!==scenes[active]!.text||event.identityId!==identityId)throw new Error('unregistered_stage_input');
  if(recovery&&active<2){
   const id=scenes[active]!.id,path=resolve(root,'run',`${id}-response.json`),raw=json(path);
   if(sha(readFileSync(path))!==frozen.replayRawHashes[id])throw new Error('saved_raw_changed');
   const mapped=mapInteractionResponse(raw,event.id,0,INTERACTION_V3_VERSION);
   mapped.metadata.providerResult={version:4,provider:'openai-decisions',mappingVersion:INTERACTION_V3_VERSION,eventId:event.id,identityId:event.identityId,eventRevision:event.revision,contextHash:decisionContextHash(context.conversationContext!),payload:mapped.metadata.providerResult};
   record.replayed.push({id,source:resolve(root,'run',`${id}-response.json`),rawHash:frozen.replayRawHashes[id]});save();return mapped;
  }
  return appraiserBase.evaluate(event,context);
 }};
 try{
  const actual=(await db.pool.query('SELECT current_database() AS name')).rows[0].name;
  if(actual!==(live?'character_runtime_v3_stage_live':final?'character_runtime_v3_stage_final':fresh?'character_runtime_v3_stage_test':'character_runtime_test')||await store.currentSession()||await store.busy()||await store.activity())throw new Error('synthetic_database_in_use');
  if(!(await db.pool.query('SELECT 1 FROM character_state WHERE character_id=$1',[CHARACTER_ID])).rowCount)throw new Error('synthetic_seed_missing');
  const uiRoot=resolve(root,'ui');if(!existsSync(resolve(uiRoot,'index.html')))throw new Error('built_ui_missing');
  const tags=await fetch('http://127.0.0.1:11435/api/tags',{signal:AbortSignal.timeout(2000)}).then(r=>r.json()) as {models?:{name:string;digest?:string;remote_host?:string}[]};
  const installed=tags.models?.find(m=>m.name==='gemma4:12b-it-qat');if(!installed?.digest||installed.remote_host)throw new Error('installed_gemma_missing');record.gemmaDigest=installed.digest;
  identityId=randomUUID();await db.pool.query("INSERT INTO identities(id,platform,platform_subject_id,display_name) VALUES($1,'local_test',$2,'합성 대화 상대')",[identityId,`interaction-v3-stage:${identityId}`]);
  record.identityId=identityId;record.initialState=(await store.state()).body;await db.own(CHARACTER_ID,()=>{void runtime?.app.close();});
  const python=process.env.TOKENIZER_PYTHON??'',tokenizer='J:/ai/ai-character-runtime/model-comparison/tokenizers/gemma4';
  if(!/^J:[\\/]/i.test(python)||!existsSync(python)||!existsSync(tokenizer))throw new Error('installed_tokenizer_missing');
  ollama=createOllamaDialogue({DIALOGUE_MODEL:'gemma4:12b-it-qat',OMNIVOICE_PYTHON:python,OLLAMA_BASE_URL:'http://127.0.0.1:11435'}, {TOKENIZER_PYTHON:python,DIALOGUE_TOKENIZER_PATH:tokenizer},{deadlinesMs:{appraise:15000,dialogue:60000,solve:20000},onCall:call=>{record.dialogueCalls.push(call);save();}});
  runtime=await createServer(store,ollama,appraiser,{timer:false,serveStatic:false});
  if(ollama.readiness().status!=='ready')throw new Error('installed_gemma_not_ready');
  await runtime.app.register(staticPlugin,{root:uiRoot,prefix:'/'});
  runtime.app.get('/studio',async(_req,reply)=>reply.sendFile('index.html'));
  runtime.app.get('/stage',async(_req,reply)=>reply.sendFile('index.html'));
  await runtime.app.listen({host:'127.0.0.1',port:3001});
  mkdirSync(resolve(root,'tmp'),{recursive:true});
  browser=await chromium.launchPersistentContext(resolve(output,'chrome-profile'),{headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',viewport:{width:1400,height:1000},downloadsPath:resolve(output,'downloads'),env:{...process.env,TEMP:resolve(root,'tmp'),TMP:resolve(root,'tmp')},args:['--disable-breakpad',`--crash-dumps-dir=${resolve(output,'crashes')}`]});
  page=await browser.newPage();page.on('pageerror',error=>record.browserErrors.push(error.message));
  await page.goto('http://127.0.0.1:3001/studio');await page.getByLabel('일회용 연결 코드').fill(runtime.studioCode);await page.getByRole('button',{name:'연결',exact:true}).click();
  await expect(page.getByRole('heading',{name:'캐릭터 작업실'})).toBeVisible();
  await page.getByRole('button',{name:'새 만남 시작'}).click();await expect(page.getByRole('button',{name:'만남 종료'})).toBeVisible();
  sessionId=(await store.currentSession())!.id;record.sessionId=sessionId;await page.getByLabel('대화 상대').selectOption(identityId);
  const popup=browser.waitForEvent('page');await page.getByRole('button',{name:'Stage 열기'}).click();stage=await popup;
  stage.on('pageerror',error=>record.browserErrors.push(error.message));stage.on('websocket',socket=>socket.on('framereceived',frame=>{const p=JSON.parse(String(frame.payload));if(['response.start','speech.segment','response.cancel','output.granted'].includes(p.type))record.packets.push({type:p.type,sessionId:p.sessionId,payload:p.payload});}));
  await stage.waitForLoadState();await expect(page.getByRole('button',{name:'출력 선택'})).toBeEnabled();await page.getByRole('button',{name:'출력 선택'}).click();await expect(stage.locator('.stage-status')).toContainText('자막 출력 중');
  for(const [index,scene] of scenes.entries()){
   active=index;const before=(await store.state()).body,priorResponses=(await db.pool.query('SELECT count(*)::int AS n FROM response_runs WHERE session_id=$1',[sessionId])).rows[0].n;
   await page.getByLabel('할 말').fill(scene.text);await page.getByRole('button',{name:'입력 보내기'}).click();await expect(page.getByLabel('할 말')).toHaveValue('');
   let event:any;await expect.poll(async()=>{event=(await db.pool.query("SELECT * FROM events WHERE session_id=$1 AND identity_id=$2 AND kind='chat.final' AND payload->>'text'=$3 ORDER BY received_at DESC LIMIT 1",[sessionId,identityId,scene.text])).rows[0];return event?.attention_status;},{timeout:70000}).toBe('observed');
   const appraisal=(await db.pool.query('SELECT result,provider,model,prompt_version,status,failure_code,usage FROM appraisals WHERE event_id=$1',[event.id])).rows[0];
   const transition=(await db.pool.query("SELECT t.effects FROM transitions t JOIN events e ON e.id=t.source_event_id WHERE e.parent_event_id=$1 AND e.kind='appraisal.applied' ORDER BY t.state_version DESC LIMIT 1",[event.id])).rows[0];
   const after=(await store.state()).body,actualMode=transition?.effects?.participation?.mode;
   const step:Record<string,any>={id:scene.id,text:scene.text,eventId:event.id,appraisal,transition,stateBefore:before,stateAfter:after,actualMode,expected:scene};record.steps.push(step);save();
   if(record.apiAttempts!==(recovery?Math.max(0,index-1):index+1)||appraisal?.provider!=='openai-decisions'||appraisal?.prompt_version!==INTERACTION_V3_VERSION||appraisal?.failure_code)throw new Error(`${scene.id}_appraisal_invalid`);
   if(actualMode!==scene.mode)throw new Error(`${scene.id}_participation_mismatch`);
   if(scene.mode==='silent'){
    const silence=after.turn.recentSilences.find(s=>s.eventId===event.id&&s.identityId===identityId);
    if(silence?.reason!==scene.reason||after.affect.frustration.value<=decay(before,after.mood.asOf).affect.frustration.value)throw new Error('L1_affect_or_reason_mismatch');
    step.silence=silence;record.firstSilence=silence;
    const n=(await db.pool.query('SELECT count(*)::int AS n FROM response_runs WHERE session_id=$1',[sessionId])).rows[0].n;
    if(n!==priorResponses||await stage.locator('.caption').innerText())throw new Error('L1_unexpected_output');
    await stage.screenshot({path:resolve(output,'L1-silence.png')});step.status='PASS';save();continue;
   }
   await expect.poll(async()=> (await db.pool.query('SELECT count(*)::int AS n FROM response_runs WHERE session_id=$1',[sessionId])).rows[0].n,{timeout:10000}).toBe(priorResponses+1);
   const response=(await db.pool.query('SELECT * FROM response_runs WHERE session_id=$1 ORDER BY created_at DESC LIMIT 1',[sessionId])).rows[0];step.response=response;
   if(response.plan.purpose!==scene.purpose)throw new Error(`${scene.id}_purpose_mismatch`);
   if(scene.id==='L2'&&(!transition.effects.repairUsed||after.affect.frustration.value>=decay(before,after.mood.asOf).affect.frustration.value))throw new Error('L2_repair_missing');
   if(scene.id==='L3'&&after.affect.frustration.value<=0)throw new Error('L3_affect_lost');
   if(scene.id==='L4'&&response.plan.reengagement?.silenceEventId!==record.firstSilence?.eventId)throw new Error('L4_silence_context_lost');
   await expect(stage.locator('.caption')).not.toHaveText('',{timeout:90000});
   step.visibleCaption=await stage.locator('.caption').innerText();await stage.screenshot({path:resolve(output,`${scene.id}-stage.png`)});save();
   await expect.poll(async()=>{const row=(await db.pool.query('SELECT status,cancel_reason FROM response_runs WHERE id=$1',[response.id])).rows[0];if(['failed','cancelled','interrupted'].includes(row.status))throw new Error(`response_${row.cancel_reason}`);return row.status;},{timeout:90000}).toBe('completed');
   const segments=(await db.pool.query('SELECT text,text_shown_at,delivery_status FROM speech_segments WHERE response_id=$1 ORDER BY segment_index',[response.id])).rows;
   const acks=(await db.pool.query("SELECT kind FROM events WHERE session_id=$1 AND kind IN ('caption.shown','caption.finished') AND payload->>'responseId'=$2",[sessionId,response.id])).rows;
   if(!segments.length||segments.some(s=>!s.text_shown_at||s.delivery_status!=='finished')||acks.filter(a=>a.kind==='caption.shown').length!==segments.length||acks.filter(a=>a.kind==='caption.finished').length!==segments.length)throw new Error(`${scene.id}_stage_delivery_missing`);
   step.segments=segments;step.acks=acks;step.caption=segments.map(s=>s.text).join(' ');step.status='PASS';save();
   if(rehearsal&&scene.id==='L2')break;
  }
  if(record.browserErrors.length||record.calls.length!==(rehearsal?0:recovery?2:4)||record.steps.length!==(rehearsal?2:4)||record.steps.some((s:{status?:string})=>s.status!=='PASS'))throw new Error('stage_final_audit_failed');
  const afterLedger=json(ledgerPath);if(afterLedger.entries.length!==(live?211:rehearsal?205:207)||afterLedger.entries.filter((e:{kind:string})=>e.kind==='decision').length!==(live?62:rehearsal?56:58))throw new Error('stage_ledger_count_mismatch');
  record.status=rehearsal?'REHEARSAL_PASS':'PASS';
 }catch(error){record.status='FAIL';record.failure=error instanceof Error?error.message:String(error);process.exitCode=1;await stage?.screenshot({path:resolve(output,'stage-failed.png')}).catch(()=>{});await page?.screenshot({path:resolve(output,'studio-failed.png'),fullPage:true}).catch(()=>{});
 }finally{
  if(sessionId){await runtime?.coordinator.cancelAll(sessionId,'validation_cleanup').catch(()=>{});await store.stopSession(sessionId,randomUUID()).catch(()=>{});}
  await browser?.close().catch(()=>{});await runtime?.app.close().catch(()=>{});await db.close().catch(()=>{});await ollama?.unloadOwnedModel().catch(error=>{record.unloadError=String(error);});
  record.notRun=scenes.slice(record.steps.length).map(s=>s.id);save();console.log(JSON.stringify({status:record.status,failure:record.failure??null,attempts:record.apiAttempts,replayed:record.replayed.length,steps:record.steps.map((s:{id:string;status?:string})=>({id:s.id,status:s.status??'NOT_REACHED'})),evidence:output}));
 }
}
