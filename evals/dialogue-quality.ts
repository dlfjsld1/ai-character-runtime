// Local dialogue comparison. Human rubric review is required; no model self-grading.
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {z} from 'zod';
import {expressionSchema,RuntimeError,type Plan} from '../packages/contracts/src/domain.ts';
import {OllamaProvider,PythonTokenCounter} from '../packages/adapters/src/ollama.ts';
import {loadLocalEnv} from '../scripts/env.ts';
import {testDatabase,reset,CHARACTER_ID} from './helpers.ts';
import {Store} from '../packages/database/src/store.ts';
import {jevEvidenceVerifier} from '../packages/adapters/src/appraisal-evidence.ts';
import {dialogueContext,CONTEXT_VERSION,scenarioConfigSchema} from './dialogue-context.ts';
import {dialogueModel,tokenizerHashes,evaluationOutputRoot} from './dialogue-models.ts';
import {DialogueRecording} from './dialogue-recording.ts';

const fixturePlan:z.ZodType<Plan>=z.object({action:z.enum(['listen','acknowledge','answer','ask','continue_activity','pause','ignore']),purpose:z.string(),targetIdentityId:z.uuid().nullable(),expression:expressionSchema,maxSentences:z.union([z.literal(1),z.literal(2)]),delivery:z.enum(['calm','normal','lively']),memoryIds:z.array(z.uuid()),activityId:z.uuid().optional()}).strict();
const fixtureSchema=z.object({syntheticInputs:z.literal(true),version:z.enum(['dialogue-quality-v1','dialogue-final-v1','dialogue-store-dev-v2','dialogue-store-final-v2','dialogue-store-dev-v3','dialogue-store-final-v3','dialogue-store-final-v4']),contextMode:z.enum(['fixture','store']).default('fixture'),cases:z.array(z.object({id:z.string(),scenario:z.enum(['edited_memory','deleted_memory']).optional(),scenarioConfig:scenarioConfigSchema.optional(),plan:fixturePlan,context:z.record(z.string(),z.unknown()),rubric:z.string()}).strict()).length(12)}).strict();
const splitIndex=process.argv.indexOf('--split'),split=splitIndex<0?'dev':process.argv[splitIndex+1];
if(split!=='dev'&&split!=='final')throw new Error('invalid_split');
const fixtureIndex=process.argv.indexOf('--fixture');if(fixtureIndex>=0&&!process.argv[fixtureIndex+1])throw new Error('fixture_path_required');
const source=await readFile(fixtureIndex>=0?process.argv[fixtureIndex+1]!:split==='dev'?'evals/fixtures/dialogue-quality.json':'evals/fixtures/dialogue-final.json','utf8'),fixture=fixtureSchema.parse(JSON.parse(source));
if((fixture.version.includes('final')?'final':'dev')!==split)throw new Error('fixture_split_mismatch');
if(new Set(fixture.cases.map(x=>x.id)).size!==12)throw new Error('duplicate_case_id');
const contextsIndex=process.argv.indexOf('--contexts'),diagnostics=process.argv.includes('--diagnostics');
if(diagnostics&&split!=='dev')throw new Error('diagnostics_dev_only');
let frozen:any[]|undefined;
if(contextsIndex>=0){
 const path=process.argv[contextsIndex+1];if(!path)throw new Error('contexts_path_required');
 const manifest=JSON.parse(await readFile(resolve(path,'../manifest.json'),'utf8'));
 if(manifest.fixtureHash!==createHash('sha256').update(source).digest('hex')||manifest.split!==split)throw new Error('contexts_fixture_mismatch');
 frozen=JSON.parse(await readFile(path,'utf8')).rows;
 for(const item of fixture.cases){const row=frozen?.find(r=>r.id===item.id&&r.repeat===1&&!r.diagnostic);if(!row||row.contextOrigin!=='store')throw new Error('contexts_incomplete');fixturePlan.parse(row.plan);}
}
if(process.argv.includes('--validate-fixtures')){console.log(JSON.stringify({status:'PASS',cases:12,outputs:24,modelCalls:0}));}
else{
 if(!process.argv.includes('--synthetic-inputs'))throw new Error('explicit_synthetic_inputs_required');
 const index=process.argv.indexOf('--validation-env');if(index>=0)process.loadEnvFile(process.argv[index+1]);loadLocalEnv();
 const modelIndex=process.argv.indexOf('--model'),model=modelIndex<0?'qwen2.5:7b':process.argv[modelIndex+1];if(!model)throw new Error('model_required');
 const profile=modelIndex<0?undefined:dialogueModel(model);
 const evidencePrompt=process.argv.includes('--evidence-prompt');if(evidencePrompt&&!profile)throw new Error('evaluation_model_required_for_prompt');if(evidencePrompt)profile!.evaluation.evidenceBound=true;
 const variantIndex=process.argv.indexOf('--prompt-variant'),promptVariant=variantIndex<0?undefined:process.argv[variantIndex+1];
 if(variantIndex>=0){if(!profile)throw new Error('evaluation_model_required_for_prompt');if(promptVariant!=='grounded-v2')throw new Error('unsupported_prompt_variant');if(evidencePrompt)throw new Error('conflicting_prompt_options');profile.evaluation.promptVariant=promptVariant;}
 const tokenizerIndex=process.argv.indexOf('--tokenizer-path'),tokenizerPath=tokenizerIndex<0?process.env.QWEN_TOKENIZER_PATH:process.argv[tokenizerIndex+1];
 if(!tokenizerPath)throw new Error('tokenizer_path_required');
 const outputIndex=process.argv.indexOf('--output-root'),outputRoot=evaluationOutputRoot(outputIndex<0?undefined:process.argv[outputIndex+1],!!profile);
 const directory=resolve(outputRoot,`dialogue-${new Date().toISOString().replace(/[:.]/g,'-')}`);await mkdir(directory,{recursive:true});
 const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
 const adapterSource=await readFile('packages/adapters/src/ollama.ts','utf8');
 const paths=['packages/adapters/src/ollama.ts','scripts/token-count.py','packages/database/src/store.ts','apps/runtime/src/coordinator/index.ts','evals/dialogue-context.ts','evals/dialogue-quality.ts','evals/dialogue-models.ts','evals/dialogue-recording.ts'];
 const sourceHashes=Object.fromEntries(await Promise.all(paths.map(async path=>[path,hash(await readFile(path,'utf8'))])));
 const initialTokenizerHashes=await tokenizerHashes(tokenizerPath);
 const manifest:Record<string,any>={syntheticInputs:true,split,model,promptVersion:promptVariant??(evidencePrompt?'evidence-bound-v1':'current'),tokenizerPath,tokenizerHashes:initialTokenizerHashes,templateOptions:profile?.templateOptions??{},seeds:profile?[17,29]:null,thinking:profile?.evaluation.think??'not_requested',fixtureHash:hash(source),adapterHash:hash(adapterSource),sourceHashes,contextMode:fixture.contextMode,scenarioVersion:CONTEXT_VERSION,contextsFrom:contextsIndex>=0?process.argv[contextsIndex+1]:null,plannedDialogueCalls:24+(diagnostics?4:0),qualityPassMinimum:22,forbiddenFactErrorsMaximum:0,humanReviewRequired:true,config:{temperature:.2,numCtx:4096,maxInputTokens:3328,memoryTokens:600,maxMemories:5}};
 await writeFile(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2));
 await writeFile(resolve(directory,'ollama-source.ts'),adapterSource);
 await writeFile(resolve(directory,'fixtures.json'),source);
 let rawText:string|null=null;
 const requests:unknown[]=[];
 const fetcher:typeof fetch=async(input,init)=>{
  if(new URL(String(input)).pathname==='/api/chat'){rawText=null;const request=JSON.parse(String(init?.body));manifest.requestOptions=request.options;requests.push(request);await writeFile(resolve(directory,'requests.json'),JSON.stringify(requests,null,2));}
  const response=await fetch(input,init);
  if(new URL(String(input)).pathname==='/api/tags'&&response.ok){const data=await response.clone().json() as any;manifest.modelDigest=data.models?.find((m:any)=>m.name===model)?.digest??null;}
  if(new URL(String(input)).pathname==='/api/show'&&response.ok){const data=await response.clone().json() as any;manifest.installedModel={template:data.template,parameters:data.parameters,modelInfo:data.model_info};await writeFile(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2));}
  return response;
 };
 const calls:Record<string,unknown>[]=[];
 const provider=new OllamaProvider(model,new PythonTokenCounter(process.env.TOKENIZER_PYTHON??'',tokenizerPath,profile?.templateOptions),undefined,fetcher,{onCall:call=>{calls.push({...call,rawText});void save().catch(()=>{report.recordingFailure='evaluation_recording_failed';process.exitCode=1;});},onContent:content=>{rawText=(rawText??'')+content;},...(profile?{evaluation:profile.evaluation}:{})});
 const report:{status:string;rows:any[];calls:Record<string,unknown>[];requestCount?:number;physicalCompletionPending?:boolean;failure?:string;unloadError?:string;recordingFailure?:string}={status:'INCOMPLETE',rows:[],calls};
 let db:Awaited<ReturnType<typeof testDatabase>>|undefined;
 const recording=new DialogueRecording(async snapshot=>{await writeFile(resolve(directory,'results.tmp'),snapshot);await rename(resolve(directory,'results.tmp'),resolve(directory,'results.json'));});
 const save=()=>{report.requestCount=requests.length;report.physicalCompletionPending=provider.readiness().status==='busy';return recording.save(report);};
 try{
  const versionResponse=await fetch('http://127.0.0.1:11434/api/version',{signal:AbortSignal.timeout(2000),redirect:'error'});if(versionResponse.ok)manifest.ollamaVersion=(await versionResponse.json() as any).version??null;
  await provider.ready();
  const placement=await fetch('http://127.0.0.1:11434/api/ps',{signal:AbortSignal.timeout(2000),redirect:'error'});if(placement.ok)manifest.loadedModel=(await placement.json() as any).models?.find((item:any)=>item.name===model)??null;
  if(fixture.contextMode==='store'&&!frozen)db=await testDatabase();
  for(const item of fixture.cases){
   let scenario:any={plan:item.plan,context:item.context,contextOrigin:'fixture',planOrigin:'fixture'};
   if(frozen){const row=frozen.find(r=>r.id===item.id&&r.repeat===1&&!r.diagnostic);scenario={plan:row.plan,context:row.context,planOrigin:row.planOrigin,contextOrigin:row.contextOrigin,preparationAppraisal:row.preparationAppraisal,scenarioVersion:row.scenarioVersion,frozenContext:true};}
   if(db){const now=Date.now();await reset(db,now);scenario=await dialogueContext(new Store(db,CHARACTER_ID,()=>now,jevEvidenceVerifier),{...item,id:item.scenario??item.id},provider.counter);}
   for(const repeat of [1,2]){
   if(profile)provider.setEvaluationSeed(repeat===1?17:29);
   rawText=null;const start=performance.now();
   try{const sentences=await provider.dialogue(scenario.plan,scenario.context);report.rows.push({id:item.id,repeat,...scenario,formatStatus:'PASS',qualityStatus:'NOT_REVIEWED',sentences,rawText,rubric:item.rubric,elapsedMs:Math.round(performance.now()-start)});}
   catch(error){const code=error instanceof RuntimeError?error.code:'evaluation_failed';report.rows.push({id:item.id,repeat,...scenario,formatStatus:'FAIL',qualityStatus:'FAIL',code,rawText,rubric:item.rubric});if(code!=='invalid_output')throw error;}
   await save();console.log(JSON.stringify({id:item.id,repeat,formatStatus:report.rows.at(-1).formatStatus}));
  }
  }
  if(diagnostics){const row=report.rows.find(r=>r.id==='answer');if(!row)throw new Error('diagnostic_context_required');
   for(const purpose of ['question','clarify'])for(const repeat of [1,2]){const plan={...row.plan,purpose,action:purpose==='question'?'answer':'ask'};rawText=null;
    if(profile)provider.setEvaluationSeed(repeat===1?17:29);
    try{const sentences=await provider.dialogue(plan,row.context);report.rows.push({id:`paired_${purpose}`,repeat,diagnostic:true,plan,context:row.context,contextOrigin:row.contextOrigin,planOrigin:'fixture',formatStatus:'PASS',qualityStatus:'NOT_REVIEWED',sentences,rawText,rubric:purpose==='question'?'현재 질문의 계산 답을 말한다.':'현재 질문의 대상/뜻을 확인하며 과거 기억 부재로 대체하지 않는다.'});}
    catch(error){const code=error instanceof RuntimeError?error.code:'evaluation_failed';report.rows.push({id:`paired_${purpose}`,repeat,diagnostic:true,plan,context:row.context,formatStatus:'FAIL',qualityStatus:'FAIL',code,rawText});if(code!=='invalid_output')throw error;}await save();
   }
  }
  for(const path of paths)if(hash(await readFile(path,'utf8'))!==sourceHashes[path])throw new Error('source_changed_during_evaluation');
  if(JSON.stringify(await tokenizerHashes(tokenizerPath))!==JSON.stringify(initialTokenizerHashes))throw new Error('tokenizer_changed_during_evaluation');
  report.status='NEEDS_HUMAN_REVIEW';
 }catch(error){report.status='FAIL';report.failure=error instanceof RuntimeError?error.code:'local_evaluation_failed';process.exitCode=1;}
 finally{await db?.close();await provider.unloadOwnedModel().catch(()=>{report.unloadError='model_unload_not_confirmed';});await writeFile(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2));await save();await recording.flush();console.log(JSON.stringify({status:report.status,count:report.rows.length,evidence:directory}));}
}
