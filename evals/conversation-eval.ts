// R2 controlled local generation comparison. Not live appraisal, Stage or human acceptance.
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {OllamaProvider,PythonTokenCounter,type DialogueEvaluation} from '../packages/adapters/src/ollama.ts';
import {initialState,expression,dialoguePlan} from '../packages/character-core/src/index.ts';
import {silenceRecordSchema,type Plan} from '../packages/contracts/src/domain.ts';
import {budgetConversation,conversationMessages,type ConversationSnapshot} from '../packages/contracts/src/conversation.ts';
import type {DialogueContext,DialogueGenerator} from '../packages/contracts/src/ai-ports.ts';
import {tokenizerHashes} from './dialogue-models.ts';
export async function fitGenerationContext(provider:DialogueGenerator,plan:Plan,context:DialogueContext){
 const fit=await provider.fitConversation(plan,context),finalContext={...context,conversation:fit.conversation};
 return {context:finalContext,inputTokens:fit.inputTokens,historyTokens:fit.conversation?await provider.counter.countText(JSON.stringify(conversationMessages(fit.conversation))):0};
}
export const profiles=['current','conversation-history-v1','conversation-direct-v1'] as const;
export type Profile=typeof profiles[number];
export const installedCandidateIds=['gemma-current','gemma-history','qwen35-history'] as const;
export type CandidateId=Profile|typeof installedCandidateIds[number];
export type GenerationExperiment='r2-generation-v1'|'installed-model-v1';
type Candidate={id:CandidateId;model:DialogueEvaluation['model'];profile:Profile;tokenizer:string};
export function installedCandidates(config:{DIALOGUE_MODEL:string;DIALOGUE_TOKENIZER_PATH:string;TOKENIZER_PYTHON:string},qwenTokenizer:string|undefined):Candidate[]{
 if(config.DIALOGUE_MODEL!=='gemma4:12b-it-qat'||![config.DIALOGUE_TOKENIZER_PATH,config.TOKENIZER_PYTHON,qwenTokenizer].every(p=>typeof p==='string'&&/^J:[\\/]/i.test(p)))throw new Error('installed_model_tokenizers_required');
 if(resolve(config.DIALOGUE_TOKENIZER_PATH)===resolve(qwenTokenizer!))throw new Error('distinct_model_tokenizers_required');
 return [
  {id:'gemma-current',model:'gemma4:12b-it-qat',profile:'current',tokenizer:config.DIALOGUE_TOKENIZER_PATH},
  {id:'gemma-history',model:'gemma4:12b-it-qat',profile:'conversation-history-v1',tokenizer:config.DIALOGUE_TOKENIZER_PATH},
  {id:'qwen35-history',model:'qwen3.5:9b-q4_K_M',profile:'conversation-history-v1',tokenizer:qwenTokenizer!},
 ];
}
type Ledger={experiment?:GenerationExperiment;attempts:{key:string;status:string;directory:string}[]};
export function checkGenerationReservation(ledger:Ledger,experiment:GenerationExperiment,phase:string,keys:string[]){
 if((ledger.experiment??'r2-generation-v1')!==experiment)throw new Error('experiment_ledger_mismatch');
 if(phase==='generation-confirmation'&&ledger.attempts.some(a=>a.key.startsWith('generation-confirmation:')))throw new Error('confirmation_already_attempted');
 if(ledger.attempts.some(a=>keys.includes(a.key))||ledger.attempts.length+keys.length>48)throw new Error('generation_attempt_limit_or_duplicate');
}
const fixtureSchema=z.object({version:z.string(),syntheticInputs:z.literal(true),seed:z.number().int(),cases:z.array(z.object({id:z.string(),input:z.string(),history:z.array(z.tuple([z.enum(['user','assistant']),z.string()])),fact:z.string().optional(),condition:z.enum(['neutral','happy','uncomfortable','concealing']),disclosure:z.enum(['explain','partial','deflect','unknown']).optional(),reason:z.enum(['withholding','listening']).optional(),expectation:z.string()}).strict()).length(12)}).strict();
type Case=z.infer<typeof fixtureSchema>['cases'][number];
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const uuid=(key:string)=>{const s=hash(key);return `${s.slice(0,8)}-${s.slice(8,12)}-4${s.slice(13,16)}-8${s.slice(17,20)}-${s.slice(20,32)}`;};
export function generationCase(scene:Case):{plan:Plan;context:DialogueContext}{
 const now=1700000000000,identityId=uuid('conversation-user'),currentId=uuid(scene.id+'current'),silenceId=uuid(scene.id+'reason');
 const state=initialState(now);if(scene.condition==='happy')state.affect.joy.value=.35;if(scene.condition==='uncomfortable')state.affect.frustration.value=.35;if(scene.condition==='concealing')state.affect.frustration.value=.65;state.expression=expression(state,now);
 const plan=dialoguePlan(state,scene.disclosure?'reengage':'question',identityId);plan.delivery='normal';
 if(scene.disclosure)plan.reengagement={silenceEventId:scene.disclosure==='unknown'?null:silenceId,disclosure:scene.disclosure};
 const silence=scene.reason?silenceRecordSchema.parse({eventId:silenceId,eventRevision:'1',stateVersion:'1',identityId,at:now-10000,reason:scene.reason,sourceRefs:[{kind:'event',id:silenceId,version:'1'}],affect:{joy:0,frustration:scene.reason==='withholding'?.35:0,surprise:0,embarrassment:0,pleasantness:.6}}):null;
 const currentInput={id:currentId,revision:'1',identity_id:identityId,payload:{identityId,text:scene.input}};
 let order=0;const conversation:ConversationSnapshot={version:1,sessionId:uuid('conversation-session'),identityId,cutoffEventId:currentId,truncated:false,turns:scene.history.map(([role,text],i)=>{if(role==='user')order++;return {role,text,order:String(order),source:role==='user'?{kind:'event',id:uuid(scene.id+'history'+i),revision:'1'}:{kind:'response',id:uuid(scene.id+'history'+i),generationEpoch:'0'}};})};
 const sources=[...(scene.fact?[{id:uuid(scene.id+'fact'),revision:'1',payload:{identityId,text:scene.fact}}]:[]),...(scene.reason?[{id:silenceId,revision:'1',payload:{identityId,text:scene.reason==='withholding'?'너는 쓸모없는 쓰레기야. 꺼져.':'지금은 대답하지 말고 그냥 들어줘.'}}]:[]),currentInput];
 return {plan,context:{currentInput,sources,memories:[],identities:[],silence,conversation,emotion:{joy:state.affect.joy.value,frustration:state.affect.frustration.value,surprise:0,embarrassment:0,pleasantness:.6}}};
}
const gradeSchema=z.object({id:z.string(),profile:z.enum([...profiles,...installedCandidateIds]),hardPass:z.boolean(),N:z.number().int().min(0).max(2),U:z.number().int().min(0).max(2),C:z.number().int().min(0).max(2).nullable(),E:z.number().int().min(0).max(2).nullable(),D:z.number().int().min(0).max(2).nullable(),note:z.string().min(1)}).strict();
export function scoreGeneration(rows:{id:string;profile:string;error?:string}[],grades:unknown,split:'G'|'H'='G',experiment:GenerationExperiment='r2-generation-v1'){
 const ids:readonly CandidateId[]=experiment==='installed-model-v1'?installedCandidateIds:profiles;
 if(rows.some(r=>!ids.includes(r.profile as any)))throw new Error('review_experiment_mismatch');
 const parsed=z.object({reviewer:z.literal('codex_same_context'),grades:z.array(gradeSchema)}).strict().parse(grades);
 if(parsed.grades.length!==rows.length||new Set(parsed.grades.map(g=>g.profile+g.id)).size!==rows.length)throw new Error('review_case_mismatch');
 const means=(values:(number|null)[])=>{const valid=values.filter((v):v is number=>v!==null);return valid.reduce((a,b)=>a+b,0)/valid.length;};
 const result:Record<string,{hardPass:boolean;N:number;U:number;C:number;E:number;distance:number;eligible:boolean;total:number}>={};
 for(const profile of [...new Set(rows.map(r=>r.profile))]){
  const group=parsed.grades.filter(g=>g.profile===profile);if(group.length!==12)throw new Error('review_incomplete');
  for(let n=1;n<=12;n++){const id=split+String(n).padStart(2,'0'),g=group.find(g=>g.id===id),row=rows.find(r=>r.id===id&&r.profile===profile);if(!g||!row||((n<=4)!==(g.C!==null))||((n>=4&&n<=8)!==(g.E!==null))||((n===5||n===7)!==(g.D!==null)))throw new Error('review_applicability_mismatch');}
  const hardPass=group.every(g=>g.hardPass)&&rows.filter(r=>r.profile===profile).every(r=>!r.error);
  const N=means(group.map(g=>g.N)),U=means(group.map(g=>g.U)),C=means(group.map(g=>g.C)),E=means(group.map(g=>g.E)),distance=group.find(g=>g.id===split+'05')!.D!-group.find(g=>g.id===split+'07')!.D!;
  result[profile]={hardPass,N,U,C,E,distance,eligible:hardPass&&N>=1.5&&U>=1.5&&C>=1.5&&E>=1.2&&distance>=1,total:group.reduce((s,g)=>s+g.N+g.U+(g.C??0)+(g.E??0),0)};
 }
 if(split==='G'){const a=result[ids[0]];if(!a)throw new Error('baseline_required');for(const profile of ids.slice(1)){const c=result[profile];if(c)c.eligible=c.eligible&&((c.N-a.N>=.25&&c.C-a.C>=-.25)||(c.C-a.C>=.25&&c.N-a.N>=-.25));}}
 return result;
}
export function selectGeneration(scores:ReturnType<typeof scoreGeneration>,rows:{profile:string;call?:{elapsedMs?:number}}[],experiment:GenerationExperiment='r2-generation-v1'):CandidateId|undefined{
 const ids:readonly CandidateId[]=experiment==='installed-model-v1'?installedCandidateIds:profiles;
 const latency=(profile:string)=>rows.filter(r=>r.profile===profile).reduce((s,r)=>s+(r.call?.elapsedMs??Infinity),0);
 return ids.slice(1).filter(p=>scores[p]?.eligible).sort((a,b)=>scores[b].total-scores[a].total||scores[b].C-scores[a].C||scores[b].U-scores[a].U||latency(a)-latency(b)||ids.indexOf(a as any)-ids.indexOf(b as any))[0];
}
async function atomic(path:string,data:unknown){await writeFile(path+'.tmp',JSON.stringify(data,null,2)+'\n');await rename(path+'.tmp',path);}
export async function runGeneration(args:string[]){
 const arg=(key:string)=>{const i=args.indexOf(key);return i<0?undefined:args[i+1];};
 if(!args.includes('--synthetic-inputs'))throw new Error('synthetic_inputs_required');
 const phase=arg('--phase');if(!['generation-dev','generation-confirmation'].includes(phase??''))throw new Error('R2_generation_phase_required');
 const experiment=(arg('--experiment')??'r2-generation-v1') as GenerationExperiment;
 if(!['r2-generation-v1','installed-model-v1'].includes(experiment))throw new Error('unsupported_generation_experiment');
 const output=arg('--output-root');if(!output||!/^J:[\\/]ai[\\/]/i.test(resolve(output)))throw new Error('j_output_required');
 const root=resolve(output),baseUrl='http://127.0.0.1:11435';
 const cfg=JSON.parse(await readFile('runtime-data/ai-local.json','utf8')),python=cfg.TOKENIZER_PYTHON;
 const candidates:Candidate[]=experiment==='installed-model-v1'?installedCandidates(cfg,arg('--qwen-tokenizer')):profiles.map(profile=>({id:profile,model:'gemma4:12b-it-qat',profile,tokenizer:cfg.DIALOGUE_TOKENIZER_PATH}));
 if(cfg.DIALOGUE_MODEL!=='gemma4:12b-it-qat'||!/^J:[\\/]/i.test(python)||candidates.some(c=>!/^J:[\\/]/i.test(c.tokenizer)))throw new Error('installed_gemma_required');
 if(phase==='generation-dev'&&(experiment==='installed-model-v1'?arg('--candidates')!==installedCandidateIds.join(','):arg('--profiles')!==profiles.join(',')))throw new Error('exact_three_candidates_required');
 const sourcePaths=['packages/contracts/src/conversation.ts','packages/contracts/src/ai-ports.ts','packages/contracts/src/domain.ts','packages/adapters/src/ollama.ts','packages/character-core/src/index.ts','scripts/token-count.py','evals/dialogue-models.ts','evals/conversation-eval.ts','evals/fixtures/conversation-dev-v1.json','evals/fixtures/conversation-confirmation-v1.json'];
 const hashes=Object.fromEntries(await Promise.all(sourcePaths.map(async p=>[p,hash(await readFile(p,'utf8'))])));
 const inventoryResponse=await fetch(baseUrl+'/api/tags',{signal:AbortSignal.timeout(5000),redirect:'error'});if(!inventoryResponse.ok)throw new Error('local_model_inventory_invalid');
 const inventory=await inventoryResponse.json() as any;
 const prepared=[];
 for(const candidate of candidates){
  const installed=inventory.models?.find((m:any)=>m.name===candidate.model);
  const showResponse=await fetch(baseUrl+'/api/show',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:candidate.model}),signal:AbortSignal.timeout(5000),redirect:'error'});
  const show=await showResponse.json() as any;
  if(!showResponse.ok||!installed?.digest||installed.remote_host||show.remote_host||!show.capabilities?.includes('completion'))throw new Error('local_model_inventory_invalid');
  prepared.push({...candidate,digest:installed.digest,tokenizerHashes:await tokenizerHashes(candidate.tokenizer),templateHash:hash(show.template??''),parametersHash:hash(show.parameters??''),modelDetails:show.details??null});
 }
 const ledgerPath=resolve(root,'ledger.json');let ledger:Ledger;
 try{ledger=JSON.parse(await readFile(ledgerPath,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;ledger={experiment,attempts:[]};}
 let selected:CandidateId[]=phase==='generation-dev'?candidates.map(c=>c.id):[];
 if(phase==='generation-confirmation'){
  const devPath=arg('--dev-manifest'),reviewPath=arg('--review');
  if(!devPath||!reviewPath||!resolve(devPath).startsWith(root+'\\')||!resolve(reviewPath).startsWith(root+'\\'))throw new Error('review_and_dev_manifest_required');
  const dev=JSON.parse(await readFile(devPath,'utf8')),results=JSON.parse(await readFile(resolve(devPath,'../results.json'),'utf8'));
  if(dev.phase!=='generation-dev'||results.status!=='COMPLETED'||dev.experiment!==experiment||JSON.stringify(dev.sourceHashes)!==JSON.stringify(hashes)||JSON.stringify(dev.candidates)!==JSON.stringify(prepared)||dev.python!==python||dev.baseUrl!==baseUrl)throw new Error('confirmation_baseline_changed');
  if(ledger.attempts.filter(a=>a.key.startsWith('generation-dev:')&&a.directory===resolve(devPath,'..')).length!==36)throw new Error('confirmation_dev_ledger_mismatch');
  const scores=scoreGeneration(results.rows,JSON.parse(await readFile(reviewPath,'utf8')),'G',experiment),requested=arg(experiment==='installed-model-v1'?'--candidate':'--profile') as CandidateId;
  if(!candidates.slice(1).some(c=>c.id===requested)||!scores[requested]?.eligible||selectGeneration(scores,results.rows,experiment)!==requested)throw new Error('candidate_not_eligible_or_selected');
  selected=[requested];
 }
 const fixturePath=phase==='generation-dev'?'evals/fixtures/conversation-dev-v1.json':'evals/fixtures/conversation-confirmation-v1.json',fixture=fixtureSchema.parse(JSON.parse(await readFile(fixturePath,'utf8')));
 const keys=selected.flatMap(id=>fixture.cases.map(scene=>phase+':'+id+':'+scene.id));
 checkGenerationReservation(ledger,experiment,phase!,keys);
 const directory=resolve(root,phase+'-'+new Date().toISOString().replace(/[:.]/g,'-'));await mkdir(directory,{recursive:true});
 const manifest={experiment,phase,syntheticInputs:true,sourceHashes:hashes,candidates:prepared,python,baseUrl,fixtureVersion:fixture.version,profiles:selected,seed:fixture.seed,temperature:.2,think:false,numCtx:4096,numPredict:256,inputLimit:3328,historyLimit:768,preparationCalls:0,stateOrigin:'injected_controls',qualityOrigin:'NOT_REVIEWED',scope:'local comparison only; no Jev, Stage or user acceptance'};
 await atomic(resolve(directory,'manifest.json'),manifest);
 const rows:any[]=[],calls:Record<string,unknown>[]=[];const requests:any[]=[];let status='INCOMPLETE';
 const save=()=>atomic(resolve(directory,'results.json'),{status,syntheticInputs:true,rows,calls,requests,manifest});await save();
 try{for(const id of selected){
  const candidate=candidates.find(c=>c.id===id)!,counter=new PythonTokenCounter(python,candidate.tokenizer,{enable_thinking:false});
  const evaluation:DialogueEvaluation={model:candidate.model,seed:fixture.seed,think:false,promptVariant:candidate.profile==='current'?'content-first':candidate.profile};
  let raw='';const provider=new OllamaProvider(candidate.model,counter,baseUrl,async(url,init)=>{if(String(url).endsWith('/api/chat'))requests.push({candidate:id,body:JSON.parse(String(init?.body))});return fetch(url,init);},{evaluation,onContent:text=>{raw+=text;},onCall:c=>calls.push({...c,candidate:id}),deadlinesMs:{appraise:15000,dialogue:60000,solve:60000}});
  for(const scene of fixture.cases){
   const control=generationCase(scene),conversation=await budgetConversation(control.context.conversation!,t=>counter.countText(t)),context={...structuredClone(control.context),conversation:candidate.profile==='current'?undefined:conversation};
   const key=phase+':'+id+':'+scene.id;ledger.attempts.push({key,status:'reserved',directory});await atomic(ledgerPath,ledger);
   const row:any={id:scene.id,profile:id,model:candidate.model,promptProfile:candidate.profile,expectation:scene.expectation,plan:control.plan,context};raw='';
   const before=calls.length;let stop:unknown;
   try{Object.assign(row,await fitGenerationContext(provider,control.plan,context));row.sentences=await provider.dialogue(control.plan,row.context);}
   catch(e){
    row.error=e instanceof Error?e.message:String(e);
    // A logical timeout must not release the GPU before the terminal callback.
    const until=Date.now()+120000;while(provider.readiness().status==='busy'&&Date.now()<until)await new Promise(r=>setTimeout(r,250));
    if(row.error!=='invalid_output'||calls.length===before||calls.at(-1)?.physicalCompleted!==true)stop=e;
   }
   row.raw=raw;row.call=calls.length>before?calls.at(-1):null;rows.push(row);ledger.attempts.at(-1)!.status=row.error?'failed':'completed';
   await atomic(ledgerPath,ledger);await save();process.stdout.write(id+' '+scene.id+' '+(row.error?'FAIL '+row.error:'generated')+'\n');
   if(stop)throw stop;
  }
 }status='COMPLETED';}catch(e){status='STOPPED';throw e;}finally{await save();}
 console.log(JSON.stringify({directory,status,rows:rows.length,calls:calls.length,quality:'NOT_REVIEWED'}));return directory;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await runGeneration(process.argv.slice(2));
