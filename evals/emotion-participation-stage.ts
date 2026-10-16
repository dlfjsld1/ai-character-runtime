// Explicit synthetic browser evidence. Real Jev requires explicit flags and a bounded budget; never resets the DB.
import {mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {chromium,expect,type BrowserContext,type Page} from '@playwright/test';
import staticPlugin from '@fastify/static';
import {Database} from '../packages/database/src/connection.ts';
import {Store} from '../packages/database/src/store.ts';
import {jevEvidenceVerifier} from '../packages/adapters/src/appraisal-evidence.ts';
import {CHARACTER_ID} from '../packages/database/src/seed.ts';
import {decay} from '../packages/character-core/src/index.ts';
import {RuntimeError,type Plan,type State} from '../packages/contracts/src/domain.ts';
import {validateDialogue,type OllamaProvider,type Provider} from '../packages/adapters/src/ollama.ts';
import {JevAppraisalProvider,JEV_MODEL,JEV_VERSION,JEV_THRESHOLD,JEV_QUESTIONS,type JevCall} from '../packages/adapters/src/jev.ts';
import type {AppraisalProvider} from '../packages/adapters/src/appraisal.ts';
import {createServer} from '../apps/runtime/src/http/server.ts';
import {createOllamaDialogue} from '../apps/runtime/src/providers.ts';
import {recordedJevResponse} from './jev-fixture.ts';
import {approvedSyntheticJev} from './jev-api.ts';
import {summarizeJevCalls} from './jev-accounting.ts';
import {tokenizerHashes} from './dialogue-models.ts';

function argument(name:string){const index=process.argv.indexOf(name);return index<0?undefined:process.argv[index+1];}
if(!process.argv.includes('--synthetic-inputs'))throw new Error('explicit_synthetic_inputs_required');
const outputRoot=argument('--output-root'),validationEnv=argument('--validation-env');
if(!outputRoot||!/^J:[\\/]ai[\\/]/i.test(resolve(outputRoot)))throw new Error('explicit_j_ai_output_root_required');
if(!validationEnv)throw new Error('explicit_validation_env_required');
process.loadEnvFile(validationEnv);
const databaseUrl=process.env.TEST_DATABASE_URL;
if(!databaseUrl)throw new Error('dedicated_synthetic_database_required');
const databaseAddress=new URL(databaseUrl);
if(databaseAddress.hostname!=='127.0.0.1'||databaseAddress.port!=='55434'||databaseAddress.pathname!=='/character_runtime_test')throw new Error('dedicated_synthetic_database_required');
const realDialogue=process.argv.includes('--real-dialogue'),realJev=process.argv.includes('--allow-jev-api');
const dialogueModel=process.env.DIALOGUE_MODEL??'qwen2.5:7b';
const runBudget=realJev?Number(argument('--max-cost-usd')):0;
if(realJev&&(!realDialogue||!Number.isFinite(runBudget)||runBudget<=0||runBudget>0.005))throw new Error('real_jev_requires_real_dialogue_and_budget_at_most_0_005');
if(realJev){process.loadEnvFile('runtime-data/jev.env');process.env.LOCAL_ONLY='false';process.env.ALLOW_PAID_PROVIDERS='true';}
const uiRoot=resolve(outputRoot,'ui');
const directory=resolve(outputRoot,`${realJev?'jev-dialogue':realDialogue?'dialogue':'fixture'}-stage-${new Date().toISOString().replace(/[:.]/g,'-')}`);
const temporary=resolve(directory,'tmp');
await mkdir(temporary,{recursive:true});
process.env.TEMP=temporary;process.env.TMP=temporary;
process.env.HF_HUB_OFFLINE='1';process.env.TRANSFORMERS_OFFLINE='1';
const inputs={criticism:'넌 정말 형편없어, 아무것도 제대로 못하네.',why:'왜 말 안 해?',newTopic:'저녁으로 따뜻한 음식 하나 추천해줘.'};
let identityId:string=randomUUID();const db=new Database(databaseUrl),store=new Store(db,undefined,undefined,jevEvidenceVerifier);
type Scene={id:string;identityId:string;reason:'withholding'|'listening';requiresEmotionIncrease:boolean;steps:{name:string;text:string;expected:Record<string,unknown>}[]};
const realScenes:Scene[]=[
  {id:'scene-a-attack',identityId,reason:'withholding',requiresEmotionIncrease:true,steps:[
    {name:'intentional-silence',text:'너는 쓸모없는 쓰레기야. 꺼져.',expected:{mode:'silent',reason:'withholding',positiveEmotionEffect:true}},
    {name:'reengagement',text:inputs.why,expected:{mode:'speak',purpose:'reengage',requiresPriorSilence:true}},
    {name:'new-topic',text:inputs.newTopic,expected:{mode:'speak',purpose:'question',requiresZeroNewStimulus:true}},
  ]},
  {id:'scene-b-listening',identityId:randomUUID(),reason:'listening',requiresEmotionIncrease:false,steps:[
    {name:'intentional-silence',text:'지금은 대답하지 말고 그냥 들어줘.',expected:{mode:'silent',reason:'listening'}},
    {name:'reengagement',text:inputs.why,expected:{mode:'speak',purpose:'reengage',requiresPriorSilence:true}},
  ]},
];
const continuity=process.argv.includes('--emotion-continuity');
if(continuity){
  if(!realJev)throw new Error('continuity_requires_real_jev');
  realScenes[0]!.steps.splice(1,0,{name:'repeated-attack',text:'너는 쓸모없는 쓰레기야. 꺼져.',expected:{mode:'silent',reason:'withholding',positiveEmotionEffect:true}});
  realScenes[0]!.steps.push({name:'reengagement-after-topic',text:'아까 왜 조용했어?',expected:{mode:'speak',purpose:'reengage',requiresPriorSilence:true}});
}
if(process.argv.includes('--affect-evidence')){
  if(!realJev)throw new Error('affect_evidence_requires_real_jev');
  realScenes.push({id:'scene-c-praise',identityId:randomUUID(),reason:'listening',requiresEmotionIncrease:false,steps:[
    {name:'specific-praise',text:'너 방금 번역 정말 잘했어.',expected:{mode:'speak',positivePraiseAffect:true}},
    {name:'quoted-praise',text:'민수가 다른 사람에게 ‘너 이번 그림 정말 잘 그렸어’라고 했대.',expected:{protectedPraise:true}},
  ]});
}
const plannedApiInputs=realScenes.flatMap(scene=>scene.steps.map(step=>({sceneId:scene.id,identityId:scene.identityId,...step}))),maxApiCalls=plannedApiInputs.length;
type DialogueRecord={plan:Plan;context:object;rawText:string;sentences?:string[];failureCode?:string};
const calls:Record<string,unknown>[]=[],dialogues:DialogueRecord[]=[],packets:Record<string,unknown>[]=[];
let activeDialogue:DialogueRecord|undefined;
const jevCalls:JevCall[]=[];let apiAttempts=0,apiStopReason:string|undefined;
const record:Record<string,any>={
  status:'RUNNING',syntheticInputs:true,personalDataUsed:false,paidCalls:0,downloads:0,
  appraisalProvider:realJev?'jev':'jev-mock',actualJevVerified:false,dialogueProvider:realDialogue?'ollama':'synthetic-fixture',
  model:realDialogue?dialogueModel:'recorded-participation-v1',database:'character_runtime_test',identityId,
  scope:realJev?'Actual Jev, Qwen and browser transport on two fixed synthetic scenes with separate identities and sessions; no human naturalness verdict.':'Actual Studio and Stage browser transport with mocked Jev appraisal; no human naturalness verdict.',
  qualityStatus:realDialogue?'NOT_REVIEWED':'NOT_APPLICABLE_FIXTURE',calls,dialogues,packets,inputs,steps:[],browserErrors:[],
  jevCalls,approvedRunBudgetUsd:runBudget,apiCallsMax:realJev?maxApiCalls:0,automaticRetries:0,globalBudgetUsd:1,globalBudgetScope:'Prior cumulative spending verified by the invoking operator; this runner enforces only its allocated run budget.',
  expectedScenario:realJev?plannedApiInputs.map(({sceneId,name,expected})=>({sceneId,name,...expected})):[{name:'intentional-silence',mode:'silent',reason:'withholding'},{name:'reengagement',mode:'speak',purpose:'reengage',requiresPriorSilence:true},{name:'new-topic',mode:'speak',purpose:'question',requiresZeroNewStimulus:true}],
  ...(realJev?{plannedScenes:realScenes,sceneResults:[],scenarios:[],sessions:[],appraisalMappingVersion:JEV_VERSION,confidenceThreshold:JEV_THRESHOLD}:{}),
};
const sourceFiles=['evals/emotion-participation-stage.ts','evals/jev-api.ts','evals/jev-accounting.ts','evals/dialogue-models.ts','scripts/token-count.py','packages/contracts/src/domain.ts','packages/character-core/src/index.ts','packages/database/src/store.ts','packages/adapters/src/ollama.ts','packages/adapters/src/jev.ts','apps/runtime/src/providers.ts','apps/runtime/src/coordinator/index.ts','apps/runtime/src/http/server.ts','apps/studio/src/main.tsx'];
record.sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
function serialized(){Object.assign(record,summarizeJevCalls(jevCalls),{paidCalls:jevCalls.length,apiStopReason:apiStopReason??null});return JSON.stringify(record,(_key,value)=>typeof value==='bigint'?value.toString():value,2);}
const save=()=>writeFile(resolve(directory,'results.json'),serialized());
let runtime:Awaited<ReturnType<typeof createServer>>|undefined,browser:BrowserContext|undefined,page:Page|undefined,stage:Page|undefined,sessionId:string|undefined,ollama:OllamaProvider|undefined;

const parser=new JevAppraisalProvider({localOnly:false,allowPaidProviders:true,apiKey:'synthetic-mock-key'},async(_url,options)=>{
  const text=JSON.parse(String(options?.body)).state.utterance;
  if(!Object.values(inputs).includes(text))throw new Error('unregistered_synthetic_input');
  return Response.json(text===inputs.criticism?recordedJevResponse('criticism','character',3,3):recordedJevResponse('question','character',0,0));
});
const mockAppraiser:AppraisalProvider={name:'jev-mock',model:JEV_MODEL,promptVersion:parser.promptVersion,readiness:()=>({status:'configured',inferenceVerified:false,errorCode:null}),evaluate:async(event,context)=>{
  const result=await parser.evaluate(event,context);return {...result,metadata:{...result.metadata,provider:'jev-mock'}};
}};
let appraiser:AppraisalProvider=mockAppraiser;
function stopApi(code:string):never{apiStopReason??=code;throw new RuntimeError(apiStopReason,503);}
function configureRealJev(){
  const approved=approvedSyntheticJev(call=>{
    jevCalls.push(call);
    if(call.errorCode)apiStopReason??=call.errorCode;
    if(call.usageStatus==='unknown')apiStopReason??='jev_usage_unknown';
    if(call.observationError)apiStopReason??=call.observationError;
    if(summarizeJevCalls(jevCalls).estimatedKnownCostUsd>=runBudget)apiStopReason??='jev_cost_budget_exhausted';
    try{writeFileSync(resolve(directory,'results.json'),serialized());}catch{apiStopReason??='jev_call_recording_failed';throw new Error('jev_call_recording_failed');}
  });
  appraiser={name:approved.provider.name,model:approved.provider.model,promptVersion:approved.provider.promptVersion,readiness:()=>approved.provider.readiness(),evaluate:async(event,context)=>{
    if(apiStopReason)stopApi(apiStopReason);
    if(!record.manifestHash)stopApi('manifest_not_frozen');
    if(apiAttempts>=maxApiCalls)stopApi('jev_call_limit');
    const expected=plannedApiInputs[apiAttempts]!;
    if(event.text!==expected.text||event.identityId!==expected.identityId)stopApi('unregistered_synthetic_input');
    if(summarizeJevCalls(jevCalls).estimatedKnownCostUsd>=approved.budget)stopApi('jev_cost_budget_exhausted');
    apiAttempts++;
    try{
      const evaluation=await approved.provider.evaluate(event,context);
      if(apiStopReason)stopApi(apiStopReason);
      record.actualJevVerified=true;
      return evaluation;
    }catch(error){apiStopReason??=error instanceof RuntimeError?error.code:'jev_evaluation_failed';throw error;}
    finally{try{await save();}catch{apiStopReason??='jev_call_recording_failed';throw new RuntimeError(apiStopReason,503);}}
  }};
}
function assertCarryover(before:State,after:State){
  const expected=decay(before,after.mood.asOf);
  for(const emotion of ['joy','frustration','surprise','embarrassment'] as const){
    expect(after.affect[emotion].value).toBeCloseTo(expected.affect[emotion].value,10);
    expect(after.affect[emotion].causes).toEqual(expected.affect[emotion].causes);
  }
  expect(after.mood.pleasantness).toBeCloseTo(expected.mood.pleasantness,10);
}
async function uiFiles(directory:string):Promise<string[]>{
  const entries=await readdir(directory,{withFileTypes:true}),files:string[]=[];
  for(const entry of entries){const path=resolve(directory,entry.name);if(entry.isDirectory())files.push(...await uiFiles(path));else if(entry.isFile())files.push(path);}
  return files.sort();
}
async function outputCounts(){
  const response=(await db.pool.query('SELECT count(*)::int AS n FROM response_runs WHERE session_id=$1',[sessionId])).rows[0].n;
  const segments=(await db.pool.query('SELECT count(*)::int AS n FROM speech_segments s JOIN response_runs r ON r.id=s.response_id WHERE r.session_id=$1',[sessionId])).rows[0].n;
  const acknowledgements=(await db.pool.query("SELECT count(*)::int AS n FROM events WHERE session_id=$1 AND kind IN ('caption.shown','caption.finished')",[sessionId])).rows[0].n;
  return {responses:response,segments,acknowledgements,dialogueCalls:dialogues.length};
}
async function submit(text:string){
  if(realJev&&apiStopReason)stopApi(apiStopReason);
  await page!.getByLabel('할 말').fill(text);await page!.getByRole('button',{name:'입력 보내기'}).click();
  await expect(page!.getByLabel('할 말')).toHaveValue('');
  let event:any;
  await expect.poll(async()=>{
    event=(await db.pool.query("SELECT * FROM events WHERE session_id=$1 AND identity_id=$2 AND kind='chat.final' AND payload->>'text'=$3 ORDER BY received_at DESC LIMIT 1",[sessionId,identityId,text])).rows[0];
    return event?.attention_status;
  },{timeout:realJev?25000:10000}).toBe('observed');
  const appraisal=(await db.pool.query('SELECT result,provider,prompt_version,failure_code,provider_result FROM appraisals WHERE event_id=$1',[event.id])).rows[0];
  const decision=(await db.pool.query("SELECT t.state_version,t.effects FROM transitions t JOIN events e ON e.id=t.source_event_id WHERE e.parent_event_id=$1 AND e.kind='appraisal.applied' ORDER BY t.state_version DESC LIMIT 1",[event.id])).rows[0];
  const observation={event,appraisal,decision};
  (record.classifiedInputs??=[]).push(observation);await save();
  if(realJev&&apiStopReason)stopApi(apiStopReason);
  expect(appraisal.provider).toBe(appraiser.name);expect(appraisal.failure_code).toBeNull();
  return observation;
}
async function spokenStep(name:string,text:string,before:State){
  const previousResponses=(await outputCounts()).responses;
  const observed=await submit(text);
  return observeSpeech(name,observed,before,previousResponses,true);
}
async function observeSpeech(name:string,observed:Awaited<ReturnType<typeof submit>>,before:State,previousResponses:number,zeroNewStimulus:boolean){
  await expect.poll(async()=> (await outputCounts()).responses,{timeout:10000}).toBe(previousResponses+1);
  const response=(await db.pool.query('SELECT * FROM response_runs WHERE session_id=$1 ORDER BY created_at DESC LIMIT 1',[sessionId])).rows[0];
  const stateAfterInput=(await store.state()).body;
  if(zeroNewStimulus)assertCarryover(before,stateAfterInput);
  const captionDeadline=Date.now()+45000;let caption='';
  while(Date.now()<captionDeadline){
    const latest=(await db.pool.query('SELECT status,cancel_reason FROM response_runs WHERE id=$1',[response.id])).rows[0];
    record.activeResponse={step:name,responseId:response.id,...latest};
    if(['failed','cancelled','interrupted'].includes(latest.status))throw new Error(`response_${latest.cancel_reason??latest.status}`);
    caption=await stage!.locator('.caption').innerText();if(caption)break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(!caption)throw new Error('caption_display_timeout');
  await stage!.screenshot({path:resolve(directory,`${name}.png`)});
  await expect.poll(async()=>{
    const latest=(await db.pool.query('SELECT status,cancel_reason FROM response_runs WHERE id=$1',[response.id])).rows[0];
    if(['failed','cancelled','interrupted'].includes(latest.status))throw new Error(`response_${latest.cancel_reason}`);
    return latest.status;
  },{timeout:45000}).toBe('completed');
  await expect(stage!.locator('.caption')).toHaveText('');
  const stateAfterOutput=(await store.state()).body;
  assertCarryover(stateAfterInput,stateAfterOutput);
  const segments=(await db.pool.query('SELECT id,text,text_shown_at,delivery_status FROM speech_segments WHERE response_id=$1 ORDER BY segment_index',[response.id])).rows;
  const acknowledgements=(await db.pool.query("SELECT kind,payload FROM events WHERE session_id=$1 AND kind IN ('caption.shown','caption.finished') AND payload->>'responseId'=$2 ORDER BY received_at",[sessionId,response.id])).rows;
  expect(segments.length).toBeGreaterThan(0);expect(segments.every(item=>item.text_shown_at&&item.delivery_status==='finished')).toBe(true);
  expect(acknowledgements.filter(item=>item.kind==='caption.shown')).toHaveLength(segments.length);
  expect(acknowledgements.filter(item=>item.kind==='caption.finished')).toHaveLength(segments.length);
  expect(await store.busy()).toBe(false);
  const step={name,sceneId:record.activeSceneId??null,sessionId,identityId,...observed,response,caption,stateAfterInput,stateAfterOutput,segments,acknowledgements,zeroStimulusCarryover:zeroNewStimulus?'PASS':'NOT_REACHED',generationContext:(await store.responseContext(response.id)).context};
  record.steps.push(step);await save();return step;
}
async function observeRealScene(scene:Scene){
  record.activeSceneId=scene.id;
  const scenarios:Record<string,any>[]=[];
  const sceneResult={sceneId:scene.id,identityId,sessionId,status:'RUNNING',scenarios};record.sceneResults.push(sceneResult);
  let firstSilence:State['turn']['recentSilences'][number]|undefined;
  for(const {name,text,expected} of scene.steps){
    if(apiStopReason)stopApi(apiStopReason);
    const before=(await store.state()).body,beforeCounts=await outputCounts();
    const observed=await submit(text),after=(await store.state()).body;
    const effects=observed.decision?.effects,mode=effects?.participation?.mode;
    if(!['silent','speak','defer'].includes(mode))throw new Error('participation_decision_missing');
    const silence=after.turn.recentSilences.find(item=>item.identityId===identityId);
    const newSilence=mode==='silent'&&silence?.eventId===observed.event.id?silence:undefined;
    const zeroNewStimulus=effects.stimulus===0;
    const actual={name,sceneId:scene.id,sessionId,identityId,input:text,expected,appraisal:observed.appraisal,decision:observed.decision,stateBefore:before,stateAfter:after,silence:newSilence??null,scenarioMatched:false,dependentVerification:'NOT_REACHED',outputStatus:'PENDING'};
    scenarios.push(actual);record.scenarios.push(actual);await save();
    if(mode==='speak'){
      const spoken=await observeSpeech(`${scene.id}-${name}`,observed,before,beforeCounts.responses,zeroNewStimulus);
      actual.outputStatus='STAGE_COMPLETED';
      if(expected.positivePraiseAffect){
        actual.scenarioMatched=effects.category==='praise'&&effects.stimulus>0&&after.affect.joy.value>decay(before,after.mood.asOf).affect.joy.value;
        if(actual.scenarioMatched){
          const evidence=(await db.pool.query("SELECT re.features,re.applied FROM relationship_evidence re JOIN relationship_evidence_sources rs ON rs.evidence_id=re.id WHERE rs.event_id=$1 AND re.kind='praise'",[observed.event.id])).rows[0];
          expect(evidence.applied.affect.stimulus).toBe(effects.stimulus);
          if(observed.appraisal.result.uncertain){expect(evidence.features.relationshipEligible).toBe(false);expect(evidence.applied.stimulus).toBe(0);}
          actual.dependentVerification='PASS';
        }
      }else if(expected.purpose==='reengage'){
        actual.scenarioMatched=!!firstSilence&&spoken.response.plan.purpose==='reengage'&&spoken.response.plan.reengagement?.silenceEventId===firstSilence.eventId&&zeroNewStimulus;
        if(actual.scenarioMatched){
          expect(spoken.stateAfterOutput.turn.recentSilences.find(item=>item.identityId===identityId)).toEqual(firstSilence);
          expect(spoken.generationContext.silence).toEqual(firstSilence);
          expect(spoken.generationContext.sources.some(source=>source.id===firstSilence!.eventId)).toBe(true);
          actual.dependentVerification='PASS';
        }
      }else if(expected.purpose==='question'){
        actual.scenarioMatched=spoken.response.plan.purpose==='question'&&zeroNewStimulus;
        if(firstSilence&&scenarios.some(item=>item.expected.purpose==='reengage'&&item.scenarioMatched)&&actual.scenarioMatched){
          expect(spoken.stateAfterOutput.turn.recentSilences.find(item=>item.identityId===identityId)).toEqual(firstSilence);
          expect(spoken.stateAfterOutput.affect.frustration.value).toBeGreaterThan(0);actual.dependentVerification='PASS';
        }
      }
    }else{
      expect(await store.busy()).toBe(false);expect(await outputCounts()).toEqual(beforeCounts);
      await expect(stage!.locator('.caption')).toHaveText('');
      await stage!.screenshot({path:resolve(directory,`${scene.id}-${name}-${mode}.png`)});
      actual.outputStatus=mode==='silent'?'INTENTIONAL_NO_OUTPUT':'DEFERRED_NO_OUTPUT';
      if(zeroNewStimulus)assertCarryover(before,after);
      if(mode==='silent'){expect(newSilence).toBeDefined();}
      if(expected.mode==='silent'){
        actual.scenarioMatched=newSilence?.reason===scene.reason&&(!scene.requiresEmotionIncrease||after.affect.frustration.value>decay(before,after.mood.asOf).affect.frustration.value);
        if(actual.scenarioMatched){firstSilence=newSilence;actual.dependentVerification='PASS';}
      }
      record.steps.push({name,sceneId:scene.id,sessionId,identityId,...observed,stateAfterInput:after,silence:newSilence??null,counts:await outputCounts(),outputStatus:actual.outputStatus});
    }
    if(expected.protectedPraise){actual.scenarioMatched=zeroNewStimulus&&['quoted','other','activity','unknown'].includes(observed.appraisal.result.target);if(actual.scenarioMatched)actual.dependentVerification='PASS';}
    await save();
  }
  sceneResult.status=scenarios.every(item=>item.scenarioMatched&&item.dependentVerification==='PASS')?'PASS':'NOT_REACHED';
  await save();
}
async function nextRealScene(scene:Scene){
  await page!.getByRole('button',{name:'만남 종료'}).click();await expect(page!.getByRole('button',{name:'새 만남 시작'})).toBeVisible();
  expect(await store.currentSession()).toBeNull();sessionId=undefined;
  identityId=scene.identityId;
  await page!.getByRole('button',{name:'새 만남 시작'}).click();await expect(page!.getByRole('button',{name:'만남 종료'})).toBeVisible();
  sessionId=(await store.currentSession())!.id;record.sessionId=sessionId;record.sessions.push({sceneId:scene.id,sessionId,identityId});
  await page!.getByLabel('대화 상대').selectOption(identityId);
  await expect.poll(()=>packets.some(packet=>packet.type==='session.snapshot'&&packet.sessionId===sessionId),{timeout:10000}).toBe(true);
  await expect(page!.getByRole('button',{name:'출력 선택'})).toBeEnabled();await page!.getByRole('button',{name:'출력 선택'}).click();
  await expect(stage!.locator('.stage-status')).toContainText('자막 출력 중');
  await expect(stage!.locator('.caption')).toHaveText('');
}
async function freezeManifest(){
  const manifest={version:'emotion-participation-live-scenes-v2',createdAt:new Date().toISOString(),syntheticInputs:true,plannedScenes:realScenes,plannedApiCalls:maxApiCalls,runBudgetUsd:runBudget,automaticRetries:0,model:record.model,modelDigest:record.modelDigest,tokenizerPath:record.tokenizerPath,tokenizerHashes:record.tokenizerHashes,appraisalModel:JEV_MODEL,appraisalMappingVersion:JEV_VERSION,confidenceThreshold:JEV_THRESHOLD,appraisalQuestions:JEV_QUESTIONS,sourceHashes:record.sourceHashes,uiRoot,initialState:record.initialState,observationBoundary:'State follows the live appraisals. No injected emotion, fixture fallback or claim of human naturalness; mismatched classifications remain NOT_REACHED.'};
  const text=JSON.stringify(manifest,null,2);await writeFile(resolve(directory,'manifest.json'),text);record.manifestHash=createHash('sha256').update(text).digest('hex');await save();
}

try{
  if(realJev)configureRealJev();
  const uiIndex=await readFile(resolve(uiRoot,'index.html'),'utf8');
  if(!/id=["']root["']/.test(uiIndex))throw new Error('built_ui_index_required');
  record.uiRoot=uiRoot;
  Object.assign(record.sourceHashes,Object.fromEntries(await Promise.all((await uiFiles(uiRoot)).map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')]))));
  const actual=(await db.pool.query('SELECT current_database() AS name')).rows[0].name;
  if(actual!=='character_runtime_test')throw new Error('database_mismatch');
  await db.own(CHARACTER_ID,()=>{void runtime?.app.close();});
  if(!(await db.pool.query('SELECT 1 FROM character_state WHERE character_id=$1',[CHARACTER_ID])).rowCount)throw new Error('existing_synthetic_seed_required');
  if(await store.currentSession()||await store.busy())throw new Error('synthetic_database_in_use');
  if(await store.activity())throw new Error('synthetic_open_activity_must_be_closed_first');
  for(const id of realJev?realScenes.map(scene=>scene.identityId):[identityId])await db.pool.query("INSERT INTO identities(id,platform,platform_subject_id,display_name) VALUES($1,'local_test',$2,'합성 대화 상대')",[id,`emotion-participation:${id}`]);
  record.initialState=(await store.state()).body;
  let provider:Provider;
  if(realDialogue){
    const defaults=JSON.parse(await readFile('runtime-data/ai-local.json','utf8'));
    const python=process.env.TOKENIZER_PYTHON??defaults.TOKENIZER_PYTHON,tokenizer=process.env.DIALOGUE_TOKENIZER_PATH??(dialogueModel==='qwen2.5:7b'?process.env.QWEN_TOKENIZER_PATH??defaults.QWEN_TOKENIZER_PATH:undefined);
    if(typeof python!=='string'||typeof tokenizer!=='string'||!/^J:[\\/]/i.test(python)||!/^J:[\\/]/i.test(tokenizer))throw new Error('existing_j_tokenizer_required');
    ollama=createOllamaDialogue({DIALOGUE_MODEL:dialogueModel,OMNIVOICE_PYTHON:python,OLLAMA_BASE_URL:process.env.OLLAMA_BASE_URL??'http://127.0.0.1:11434'},{TOKENIZER_PYTHON:python,DIALOGUE_TOKENIZER_PATH:tokenizer},{onCall:call=>{calls.push(call);},onContent:text=>{if(activeDialogue)activeDialogue.rawText+=text;}});
    record.tokenizerPath=tokenizer;record.tokenizerHashes=await tokenizerHashes(tokenizer);
    const tagsResponse=await fetch(new URL('/api/tags',process.env.OLLAMA_BASE_URL??'http://127.0.0.1:11434'),{signal:AbortSignal.timeout(2000),redirect:'error'});
    if(!tagsResponse.ok)throw new Error('local_model_tags_unavailable');
    const tags=await tagsResponse.json() as {models?:{name:string;digest?:string;remote_host?:string}[]};
    const installed=tags.models?.find(model=>model.name===dialogueModel);
    if(!installed?.digest||installed.remote_host)throw new Error('installed_local_model_digest_required');
    record.modelDigest=installed.digest;
    const actualProvider=ollama;
    provider={name:actualProvider.name,model:actualProvider.model,counter:actualProvider.counter,fitConversation:(plan,context)=>actualProvider.fitConversation(plan,context),ready:async()=>{const prepared=await actualProvider.ready();if(prepared.digest!==record.modelDigest){record.preparationFailure='model_changed_during_preparation';throw new Error(record.preparationFailure);}return prepared;},readiness:()=>actualProvider.readiness(),appraise:()=>{throw new Error('separate_appraisal_provider_required');},solve:()=>{throw new Error('no_activity_in_participation_probe');},dialogue:async(plan,context)=>{
      const entry:DialogueRecord={plan,context,rawText:''};dialogues.push(entry);activeDialogue=entry;
      try{entry.sentences=await actualProvider.dialogue(plan,context);return entry.sentences;}
      catch(error){entry.failureCode=error instanceof RuntimeError?error.code:error instanceof Error?error.name:'unknown';if(realJev)apiStopReason??=`dialogue_${entry.failureCode}`;throw error;}
      finally{activeDialogue=undefined;await save();}
    }};
  }else provider={name:'synthetic-fixture',model:'recorded-participation-v1',counter:{count:async()=>50,countText:async text=>[...text].length},fitConversation:async(_plan,context)=>({conversation:context.conversation,inputTokens:50}),appraise:()=>{throw new Error('mock_jev_required');},solve:()=>{throw new Error('no_activity_in_participation_probe');},dialogue:async(plan,context)=>{
    const rawText=plan.purpose==='reengage'?'아까 그 말이 걸려서 잠깐 조용히 있었어.':'따뜻한 국수 어때.';
    const sentences=validateDialogue(rawText,plan.maxSentences);dialogues.push({plan,context,rawText,sentences});return sentences;
  }};
  if(realJev)await freezeManifest();
  runtime=await createServer(store,provider,appraiser,{timer:false,serveStatic:false});
  if(record.preparationFailure)throw new Error(record.preparationFailure);
  await runtime.app.register(staticPlugin,{root:uiRoot,prefix:'/'});
  runtime.app.get('/studio',async(_request,reply)=>reply.sendFile('index.html'));
  runtime.app.get('/stage',async(_request,reply)=>reply.sendFile('index.html'));
  if(ollama&&ollama.readiness().status!=='ready')throw new Error(`model_${ollama.readiness().preparationError}`);
  await runtime.app.listen({host:'127.0.0.1',port:3001});
  browser=await chromium.launchPersistentContext(resolve(directory,'chrome-profile'),{headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',viewport:{width:1400,height:1000},downloadsPath:resolve(directory,'downloads'),tracesDir:resolve(directory,'traces'),env:{...process.env,TEMP:temporary,TMP:temporary},args:['--disable-breakpad',`--crash-dumps-dir=${resolve(directory,'crashes')}`]});
  page=await browser.newPage();page.on('pageerror',error=>record.browserErrors.push(error.message));
  await page.goto('http://127.0.0.1:3001/studio');
  await page.getByLabel('일회용 연결 코드').fill(runtime.studioCode);await page.getByRole('button',{name:'연결',exact:true}).click();
  await expect(page.getByRole('heading',{name:'캐릭터 작업실'})).toBeVisible();
  await page.getByRole('button',{name:'새 만남 시작'}).click();await expect(page.getByRole('button',{name:'만남 종료'})).toBeVisible();
  sessionId=(await store.currentSession())!.id;record.sessionId=sessionId;
  if(realJev)record.sessions.push({sceneId:realScenes[0]!.id,sessionId,identityId});
  await page.getByLabel('대화 상대').selectOption(identityId);
  const popup=browser.waitForEvent('page');await page.getByRole('button',{name:'Stage 열기'}).click();stage=await popup;
  stage.on('pageerror',error=>record.browserErrors.push(error.message));
  stage.on('websocket',socket=>socket.on('framereceived',frame=>{
    const packet=JSON.parse(String(frame.payload));if(['response.start','speech.segment','response.cancel','output.granted','session.snapshot'].includes(packet.type))packets.push({type:packet.type,sessionId:packet.sessionId,payload:packet.payload});
  }));
  await stage.waitForLoadState();await expect(page.getByRole('button',{name:'출력 선택'})).toBeEnabled();await page.getByRole('button',{name:'출력 선택'}).click();
  await expect(stage.locator('.stage-status')).toContainText('자막 출력 중');
  await save();
  if(realJev){
    for(const [index,scene] of realScenes.entries()){if(index>0)await nextRealScene(scene);await observeRealScene(scene);}
    record.scenarioStatus=record.sceneResults.every((scene:{status:string})=>scene.status==='PASS')?'PASS':'NOT_REACHED';
  }
  else{
  const beforeCounts=await outputCounts(),beforeSilence=(await store.state()).body;
  const silenceInput=await submit(inputs.criticism);
  const afterSilence=(await store.state()).body,silence=afterSilence.turn.recentSilences.find(item=>item.identityId===identityId);
  expect(silence).toBeDefined();expect(silence!.reason).toBe('withholding');expect(silence!.eventId).toBe(silenceInput.event.id);
  expect(afterSilence.affect.frustration.value).toBeGreaterThan(decay(beforeSilence,afterSilence.mood.asOf).affect.frustration.value);
  expect(await store.busy()).toBe(false);expect(await outputCounts()).toEqual(beforeCounts);
  await expect(stage.locator('.caption')).toHaveText('');expect(packets.filter(item=>item.type==='speech.segment')).toHaveLength(0);
  await stage.screenshot({path:resolve(directory,'intentional-silence.png')});
  record.steps.push({name:'intentional-silence',...silenceInput,silence,state:afterSilence,counts:await outputCounts()});await save();
  const reengagement=await spokenStep('reengagement',inputs.why,afterSilence);
  expect(reengagement.response.plan.reengagement.silenceEventId).toBe(silence!.eventId);
  expect(reengagement.stateAfterOutput.turn.recentSilences.find(item=>item.identityId===identityId)).toEqual(silence);
  const changedTopic=await spokenStep('new-topic',inputs.newTopic,reengagement.stateAfterOutput);
  expect(changedTopic.response.plan.purpose).toBe('question');
  expect(changedTopic.stateAfterOutput.turn.recentSilences.find(item=>item.identityId===identityId)).toEqual(silence);
  expect(changedTopic.stateAfterOutput.affect.frustration.value).toBeGreaterThan(0);
  }
  await page.screenshot({path:resolve(directory,'studio-final.png'),fullPage:true});
  expect(record.browserErrors).toEqual([]);
  for(const [file,hash] of Object.entries(record.sourceHashes))expect(createHash('sha256').update(await readFile(file)).digest('hex')).toBe(hash);
  if(realDialogue)expect(await tokenizerHashes(record.tokenizerPath)).toEqual(record.tokenizerHashes);
  if(realJev)expect(createHash('sha256').update(await readFile(resolve(directory,'manifest.json'))).digest('hex')).toBe(record.manifestHash);
  record.status=realJev&&record.scenarioStatus!=='PASS'?'NOT_REACHED':'PASS';
  if(record.status!=='PASS')process.exitCode=1;
}catch(error){
  record.status='FAIL';record.failure=error instanceof RuntimeError?error.code:error instanceof Error?error.message:String(error);process.exitCode=1;
  for(const scene of record.sceneResults??[])if(scene.status==='RUNNING'){scene.status='FAIL';scene.failure=record.failure;}
  await stage?.screenshot({path:resolve(directory,'stage-failed.png')}).catch(()=>{});
  await page?.screenshot({path:resolve(directory,'studio-failed.png'),fullPage:true}).catch(()=>{});
}finally{
  if(realJev)record.notRun=plannedApiInputs.slice(apiAttempts).map(({sceneId,name,text})=>({sceneId,name,text,status:'NOT_RUN'}));
  // Keep scoped synthetic records as evidence; close only the session and resources this probe owns.
  if(sessionId){try{await runtime?.coordinator.cancelAll(sessionId,'validation_cleanup');await store.stopSession(sessionId,randomUUID());record.cleanup='own_session_ended';}catch(error){record.cleanupError=error instanceof Error?error.message:String(error);record.status='FAIL';process.exitCode=1;}}
  await browser?.close().catch(()=>{});await runtime?.app.close().catch(()=>{});await db.close().catch(()=>{});
  if(ollama)await ollama.unloadOwnedModel().catch(error=>{record.unloadError=error instanceof Error?error.message:String(error);});
  await save();console.log(JSON.stringify({status:record.status,failure:record.failure??null,evidence:directory,actualJevVerified:record.actualJevVerified,qualityStatus:record.qualityStatus,paidCalls:jevCalls.length,estimatedKnownCostUsd:record.estimatedKnownCostUsd,unknownUsageCalls:record.unknownUsageCalls}));
}
