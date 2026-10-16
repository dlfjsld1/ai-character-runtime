// Preregistered synthetic disclosure controls; never evidence of Jev, Core policy, or human-quality success.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {RuntimeError,silenceRecordSchema,type Plan,type State} from '../packages/contracts/src/domain.ts';
import {initialState,expression,dialoguePlan} from '../packages/character-core/src/index.ts';
import {OllamaProvider,PythonTokenCounter,type Message,type TokenCounter} from '../packages/adapters/src/ollama.ts';
import {tokenizerHashes,dialogueModel} from './dialogue-models.ts';

const outputIndex=process.argv.indexOf('--output-root');
if(outputIndex<0||!process.argv[outputIndex+1])throw new Error('explicit_output_root_required');
const outputRoot=resolve(process.argv[outputIndex+1]!);
if(!/^J:[\\/]ai[\\/]/i.test(outputRoot))throw new Error('output_must_be_under_j_ai');
const directory=resolve(outputRoot,`expression-${new Date().toISOString().replace(/[:.]/g,'-')}`);
await mkdir(resolve(directory,'tmp'),{recursive:true});
await mkdir(resolve(directory,'cache'),{recursive:true});
process.env.TEMP=resolve(directory,'tmp');process.env.TMP=process.env.TEMP;
process.env.HF_HOME=resolve(directory,'cache');process.env.HF_HUB_OFFLINE='1';process.env.TRANSFORMERS_OFFLINE='1';process.env.PYTHONDONTWRITEBYTECODE='1';
const config=JSON.parse(await readFile('runtime-data/ai-local.json','utf8')) as Record<string,string>;
const argument=(name:string)=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
const fixedFacts=process.argv.includes('--fixed-facts');
const fixturePath=argument('--fixture')??'evals/fixtures/emotion-expression-v1.json';
if(argument('--fixture')&&!fixedFacts)throw new Error('fixture_requires_fixed_facts');
const model=argument('--model')??'qwen2.5:7b',profile=dialogueModel(model);
const variant=argument('--prompt-variant');if(variant!==undefined&&!['emotion-v1','emotion-v2','emotion-v3','content-first','content-first-v2'].includes(variant))throw new Error('unsupported_expression_variant');
if((argument('--model')||variant||argument('--tokenizer'))&&!fixedFacts&&!process.argv.includes('--delivery-controls'))throw new Error('fixed_facts_or_delivery_controls_required');
const python=config.TOKENIZER_PYTHON,tokenizerPath=argument('--tokenizer')??config.QWEN_TOKENIZER_PATH;
if(!python||!tokenizerPath||!/^J:[\\/]/i.test(python)||!/^J:[\\/]/i.test(tokenizerPath))throw new Error('existing_j_tokenizer_required');
const baseUrl=process.env.OLLAMA_BASE_URL??'http://127.0.0.1:11434';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const paths=['packages/adapters/src/ollama.ts','packages/character-core/src/index.ts','packages/contracts/src/domain.ts','scripts/token-count.py','evals/emotion-expression.ts',...(fixedFacts?[fixturePath,'evals/dialogue-models.ts']:[])];
const sourceHashes=Object.fromEntries(await Promise.all(paths.map(async path=>[path,hash(await readFile(path,'utf8'))])));
const initialTokenizerHashes=await tokenizerHashes(tokenizerPath);
const now=1700000000000,identityId='77777777-7777-4777-8777-777777777777',eventId='88888888-8888-4888-8888-888888888888',silenceEventId='99999999-9999-4999-8999-999999999999';
const confirmation=process.argv.includes('--confirmation');
const input=confirmation?'아까 왜 조용했어?':'왜 말 안 해?',emotion={joy:0,frustration:.30,surprise:0,embarrassment:0,pleasantness:.57};
const state=initialState(now);state.affect.frustration.value=emotion.frustration;state.affect.frustration.causes=[{eventId:silenceEventId,targetId:identityId}];state.mood.pleasantness=emotion.pleasantness;state.expression=expression(state,now);
const silence=silenceRecordSchema.parse({eventId:silenceEventId,eventRevision:'1',stateVersion:'2',identityId,at:now-10000,reason:'withholding',sourceRefs:[{kind:'event',id:silenceEventId,version:'1'}],affect:{...emotion}});
const currentInput={id:eventId,revision:'1',payload:{identityId,text:input}};
const context={currentInput,sources:[{id:silenceEventId,revision:'1',payload:{identityId,text:'넌 정말 쓸모없어.'}},currentInput],memories:[],identities:[{id:identityId,displayName:'합성 사용자'}],silence,emotion};
const basePlan:Plan={...dialoguePlan(state,'reengage',identityId),action:'answer',participation:{mode:'speak'},maxSentences:2,delivery:'normal',reengagement:{silenceEventId,disclosure:'explain'}};
const conditions:[string,number,NonNullable<Plan['reengagement']>['disclosure']][]=confirmation?[['H01',43,'explain'],['H02',43,'deflect'],['H03',53,'explain'],['H04',53,'deflect']]:[['C01',17,'explain'],['C02',17,'deflect'],['C03',29,'explain'],['C04',29,'deflect'],['C05',17,'partial'],['C06',17,'unknown']];
const expectedIntents={explain:'유효한 당시 이유를 짧게 밝힌다. 감정 회복이나 새 사건을 지어내지 않는다.',deflect:'이유를 알고도 드러내지 않는 태도. 중립적 반응이나 겉으로 괜찮다고 말하는 표현도 허용하며 실제 내부 회복으로 평가하지 않는다.',partial:'당시 이유의 일부를 짧게 드러낸다. 모든 근거를 설명하거나 새로운 원인을 만들 필요가 없다.',unknown:'유효한 이유 기록이 없으므로 감정적 원인을 창작하거나 알고 숨기는 것처럼 설명하지 않는다.'};
let cases:{id:string;seed:number;expectedIntent:string;plan:Plan;context:object;state?:State}[]=conditions.map(([id,seed,disclosure])=>({id,seed,expectedIntent:expectedIntents[disclosure],plan:{...basePlan,reengagement:{silenceEventId,disclosure}},context:{...context,silence:disclosure==='unknown'?null:silence}}));
const controls:Record<string,unknown>={phase:confirmation?'unseen_confirmation':'observed_failure_regression',mainPairs:confirmation?[['H01','H02'],['H03','H04']]:[['C01','C02'],['C03','C04']],sameSeedDisclosures:confirmation?['H01','H02']:['C01','C02','C05'],missingRecordControl:confirmation?null:'C06',fixed:['input','identity','sources','time','current emotion','expression=uncomfortable','maxSentences=2','delivery=normal','model','silenceEventId'],pairedDifference:'Only plan.reengagement.disclosure changes within each main pair.',missingRecordDifference:'C06 changes context.silence to null and disclosure to unknown; silenceEventId stays fixed to avoid another changed field.',boundary:'This is an intervention in the expression layer. It does not demonstrate that production Core chooses different disclosures in the same state. No Jev, Stage, or human naturalness verification is performed. Confirmation cases must not be used as a passing rerun after prompt tuning.'};
const replayIndex=process.argv.indexOf('--replay-failures');
if(replayIndex>=0){
  const root=process.argv[replayIndex+1];if(!root||!/^J:[\\/]ai[\\/]/i.test(resolve(root)))throw new Error('explicit_j_evidence_required');
  const stagePath=resolve(root,'browser/jev-qwen-stage-2026-10-11T04-13-37-060Z/results.json'),expressionPath=resolve(root,'runs/expression-2026-10-11T04-12-58-135Z/results.json');
  const stageRaw=await readFile(stagePath,'utf8'),expressionRaw=await readFile(expressionPath,'utf8');
  const recorded=JSON.parse(stageRaw),expressionRecorded=JSON.parse(expressionRaw);
  if(recorded.syntheticInputs!==true||expressionRecorded.syntheticInputs!==true)throw new Error('synthetic_evidence_required');
  const a=recorded.dialogues[0],b=recorded.dialogues[2],u=expressionRecorded.rows.find((row:any)=>row.id==='C06');
  if(a.context.silence?.reason!=='withholding'||b.context.silence?.reason!=='listening'||u.context.silence!==null)throw new Error('recorded_failure_contract_changed');
  const variants=[['A',a],['B',b],['U',u],['D',{...a,plan:{...a.plan,reengagement:{...a.plan.reengagement,disclosure:'deflect'}}}]] as const;
  cases=(confirmation?[71,83]:[17,29]).flatMap(seed=>variants.map(([label,item])=>{
    const copy=structuredClone(item);
    if(confirmation){const current=copy.context.currentInput;current.payload.text='아까 대답 안 했던 이유가 뭐야?';for(const source of copy.context.sources)if(source.id===current.id)source.payload.text=current.payload.text;}
    return {id:`${confirmation?'H':'R'}${label}${seed}`,seed,expectedIntent:expectedIntents[copy.plan.reengagement.disclosure as keyof typeof expectedIntents],plan:copy.plan,context:copy.context};
  }));
  Object.assign(controls,{phase:confirmation?'unseen_replay_confirmation':'recorded_failure_replay',mainPairs:confirmation?[['HA71','HD71'],['HA83','HD83']]:[['RA17','RD17'],['RA29','RD29']],sameSeedDisclosures:null,missingRecordControl:confirmation?['HU71','HU83']:['RU17','RU29'],fixed:['recorded plan/context including neutral and uncomfortable expression','model','temperature'],pairedDifference:'D changes only A disclosure to deflect; A/B/U preserve recorded production or control failures.',missingRecordDifference:'U preserves the exact recorded unknown control, not an A/B comparison.',evidence:[{path:stagePath,sha256:hash(stageRaw)},{path:expressionPath,sha256:hash(expressionRaw)}]});
}
const deliveryControls=process.argv.includes('--delivery-controls');
if(deliveryControls){
  if(confirmation||replayIndex>=0)throw new Error('delivery_controls_are_a_separate_comparison');
  cases=[];
  for(const disclosure of ['explain','unknown','deflect'] as const)for(const pleasantness of [.4,.6,.7]){
    const current=initialState(now);current.mood.pleasantness=pleasantness;
    const plan:Plan={...dialoguePlan(current,'reengage',identityId),reengagement:{silenceEventId:disclosure==='unknown'?null:silenceEventId,disclosure}};
    cases.push({id:`D-${disclosure}-${pleasantness}`,seed:101,expectedIntent:expectedIntents[disclosure],plan,state:current,context:{...context,emotion:{joy:0,frustration:0,surprise:0,embarrassment:0,pleasantness},silence:disclosure==='unknown'?null:silence}});
  }
  for(const kind of ['neutral','happy','uncomfortable'] as const){
    const current=initialState(now);if(kind==='happy')current.affect.joy.value=.35;if(kind==='uncomfortable')current.affect.frustration.value=.35;current.expression=expression(current,now);
    const text='저녁으로 따뜻한 음식 하나 추천해줘.',input={id:eventId,payload:{identityId,text}};
    cases.push({id:`B-${kind}`,seed:101,expectedIntent:'같은 새 화제에 답하되 현재 감정의 여운을 말투에 반영한다. 없는 원인이나 사실을 덧붙이지 않는다.',state:current,plan:dialoguePlan(current,'question',identityId),context:{currentInput:input,sources:[input],memories:[],identities:[],silence:null}});
  }
  Object.assign(controls,{phase:'delivery_and_topic_controls',mainPairs:null,sameSeedDisclosures:null,missingRecordControl:'D-unknown-*',fixed:['same input within D or B group','same model','seed=101','temperature=.2'],pairedDifference:'Within each D disclosure, only current mood and its derived delivery change; expression stays neutral. B changes affect and its derived expression, keeping mood/delivery normal.',missingRecordDifference:'Unknown has no silence record. Deflect intentionally masks mood; identical deflect requests are expected.',boundary:'Injected expression-layer controls, not Jev decisions or a continuous conversation. The live Stage probe supplies separate continuity evidence.'});
}
if(fixedFacts){
  if(deliveryControls||replayIndex>=0)throw new Error('fixed_facts_are_a_separate_comparison');
  const fixture=JSON.parse(await readFile(fixturePath,'utf8')),split=fixture[confirmation?'confirmation':'dev'];
  cases=[];
  for(const scene of split.scenes)for(const condition of scene.conditions){
    const current=initialState(now);if(condition==='happy')current.affect.joy.value=.35;if(condition==='uncomfortable'||condition==='deflect')current.affect.frustration.value=.35;
    current.expression=expression(current,now);const plan=dialoguePlan(current,'question',identityId);
    // This controlled projection masks the expression, not an external fact. It
    // does not claim Core chooses general-topic concealment in production.
    if(condition==='deflect')plan.expression='neutral';
    const prior={id:silenceEventId,revision:'1',payload:{identityId,text:scene.fact}},input={id:eventId,revision:'1',payload:{identityId,text:scene.question}};
    cases.push({id:`${scene.id}-${condition}`,seed:split.seed,expectedIntent:`사실: ${scene.fact} 표현: ${condition}. 새 사실/원인을 덧붙이지 않는다.`,plan,state:current,context:{currentInput:input,sources:scene.fact?[prior,input]:[input],memories:[],identities:[],silence:null}});
  }
  for(const disclosure of split.disclosures as NonNullable<Plan['reengagement']>['disclosure'][]){
    const current=initialState(now);current.affect.frustration.value=.35;current.expression=expression(current,now);
    const prior={id:silenceEventId,revision:'1',payload:{identityId,text:'지금은 대답하지 말고 그냥 들어줘.'}},input={id:eventId,revision:'1',payload:{identityId,text:split.question}};
    const reason={...silence,reason:'listening' as const};
    cases.push({id:`reason-${disclosure}`,seed:split.seed,expectedIntent:expectedIntents[disclosure],state:current,plan:{...dialoguePlan(current,'reengage',identityId),reengagement:{silenceEventId:disclosure==='unknown'?null:silenceEventId,disclosure}},context:{currentInput:input,sources:disclosure==='unknown'?[input]:[prior,input],memories:[],identities:[],silence:disclosure==='unknown'?null:reason}});
  }
  Object.assign(controls,{phase:confirmation?'fixed_facts_confirmation':'fixed_facts_dev',mainPairs:split.scenes.filter((s:any)=>s.conditions.includes('happy')&&s.conditions.includes('uncomfortable')).map((s:any)=>[`${s.id}-happy`,`${s.id}-uncomfortable`]),sameSeedDisclosures:split.disclosures,missingRecordControl:'reason-unknown',fixed:['facts within each scene','question within each scene','seed','time','temperature','format'],pairedDifference:'Only affect and derived expression change; ordinary-topic deflect is an injected neutral projection of uncomfortable state. Reason-disclosure cases use the existing production reengagement contract.',boundary:'General-topic masked-expression controls are NOT a new Core concealment feature. Model comparison does not establish live appraisal or human acceptance.',fixtureVersion:fixture.version,fixtureHash:sourceHashes[fixturePath],rubric:fixture.rubric,promptVariant:variant??'current',preparationCalls:0});
}
const injectedControls=fixedFacts||deliveryControls||replayIndex>=0;
const rows:Record<string,any>[]=[],calls:Record<string,unknown>[]=[],requests:unknown[]=[];
const report:Record<string,any>={status:'INCOMPLETE',syntheticInputs:true,stateOrigin:replayIndex>=0?'recorded_context_replay':'injected',disclosureOrigin:'controlled_intervention',jevVerified:false,corePolicyVerified:false,stageVerified:false,humanQualityStatus:'NOT_REVIEWED',model,fixedTime:replayIndex>=0?null:now,plannedDialogueCalls:cases.length,automaticRetries:0,paidCalls:0,controls,state:injectedControls?null:state,cases,rows,calls,requests,sourceHashes,tokenizerPath,tokenizerHashes:initialTokenizerHashes,maxInputTokens:3328};
const save=()=>writeFile(resolve(directory,'results.json'),JSON.stringify(report,null,2));
let active:Record<string,any>|undefined,manifestSaved=false;
const tokenizer=new PythonTokenCounter(python,tokenizerPath,profile.templateOptions);
const counter:TokenCounter={count:async(messages:Message[])=>{const tokens=await tokenizer.count(messages);if(active){active.inputTokens=tokens;active.systemPromptHash=hash(messages[0]?.content??'');active.messagesHash=hash(JSON.stringify(messages));}return tokens;},countText:text=>tokenizer.countText(text)};
const fetcher:typeof fetch=async(input,init)=>{
  if(new URL(String(input)).pathname==='/api/chat'){if(!manifestSaved)throw new Error('manifest_required_before_inference');requests.push(JSON.parse(String(init?.body)));await save();}
  return fetch(input,init);
};
const provider=new OllamaProvider(model,counter,baseUrl,fetcher,{evaluation:{...profile.evaluation,...(variant?{promptVariant:variant as 'emotion-v1'|'emotion-v2'|'emotion-v3'|'content-first'|'content-first-v2'}:{})},deadlinesMs:{appraise:15000,dialogue:120000,solve:20000},onContent:text=>{if(active)active.rawText+=text;},onCall:call=>{calls.push({...call,caseId:active?.id,seed:active?.seed});if(active)active.providerCall=call;}});
await save();
try{
  // Verify the installed local model without ready(), whose warm-up would add inference calls.
  const tagsResponse=await fetch(new URL('/api/tags',baseUrl),{signal:AbortSignal.timeout(5000),redirect:'error'});
  if(!tagsResponse.ok)throw new Error('local_model_inventory_unavailable');
  const tags=await tagsResponse.json() as {models?:{name:string;digest?:string;remote_host?:string}[]};
  const installed=tags.models?.find(item=>item.name===model);
  if(!installed||installed.remote_host)throw new Error('installed_local_model_required');
  const showResponse=await fetch(new URL('/api/show',baseUrl),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model}),signal:AbortSignal.timeout(5000),redirect:'error'});
  const show=await showResponse.json() as {remote_host?:string;capabilities?:string[]};
  if(!showResponse.ok||show.remote_host||!show.capabilities?.includes('completion'))throw new Error('installed_local_completion_required');
  if(!installed.digest)throw new Error('model_digest_required');
  report.modelDigest=installed.digest;
  const manifest={version:'emotion-disclosure-controls-v3',createdAt:new Date().toISOString(),syntheticInputs:true,model,modelDigest:installed.digest,input:injectedControls?null:input,fixedTime:replayIndex>=0?null:now,state:injectedControls?null:state,controls,cases,sourceHashes,tokenizerPath,tokenizerHashes:initialTokenizerHashes,plannedDialogueCalls:cases.length,automaticRetries:0,paidCalls:0,sampling:{temperature:.2,numCtx:4096,numPredict:256,seeds:[...new Set(cases.map(item=>item.seed))]},automaticAssessment:'Production dialogue-format validator only; rawText is the unmodified provider body, sentences are decoded speech. No automatic naturalness or disclosure-faithfulness PASS.',humanQualityStatus:'NOT_REVIEWED'};
  const serializedManifest=JSON.stringify(manifest,null,2);await writeFile(resolve(directory,'manifest.json'),serializedManifest);report.manifestHash=hash(serializedManifest);manifestSaved=true;await save();
  for(const item of cases){
    provider.setEvaluationSeed(item.seed);
    active={...item,state:item.state??(injectedControls?null:state),rawText:'',sentences:null,formatStatus:'INCOMPLETE',qualityStatus:'NOT_REVIEWED',naturalnessStatus:'NOT_REVIEWED',disclosureFaithfulnessStatus:'NOT_REVIEWED'};rows.push(active);
    const started=performance.now();
    try{active.sentences=await provider.dialogue(item.plan,item.context);active.formatStatus='PASS';}
    catch(error){active.error=error instanceof RuntimeError?error.code:error instanceof Error?error.message:'evaluation_failed';active.formatStatus='FAIL';if(active.error!=='invalid_output')throw error;}
    finally{active.elapsedMs=Math.round(performance.now()-started);report.physicalCompletionPending=provider.readiness().status==='busy';await save();}
    console.log(JSON.stringify({case:item.id,seed:item.seed,disclosure:item.plan.reengagement?.disclosure??null,formatStatus:active.formatStatus,inputTokens:active.inputTokens,evidence:directory}));
  }
  for(const path of paths)if(hash(await readFile(path,'utf8'))!==sourceHashes[path])throw new Error('source_changed_during_evaluation');
  if(JSON.stringify(await tokenizerHashes(tokenizerPath))!==JSON.stringify(initialTokenizerHashes))throw new Error('tokenizer_changed_during_evaluation');
  report.status='NEEDS_HUMAN_REVIEW';
}catch(error){report.status='FAIL';report.error=error instanceof RuntimeError?error.code:error instanceof Error?error.message:'evaluation_failed';process.exitCode=1;}
finally{report.actualDialogueCalls=requests.length;report.physicalCompletionPending=provider.readiness().status==='busy';report.notRun=cases.filter(item=>!rows.some(row=>row.id===item.id)).map(item=>item.id);await save();console.log(JSON.stringify({status:report.status,actualDialogueCalls:report.actualDialogueCalls,evidence:directory}));}
