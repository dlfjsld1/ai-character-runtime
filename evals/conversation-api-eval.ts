// Bounded synthetic generation only. No Jev, Stage, local inference or adoption.
import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {OpenAIDialogue,DialogueBudget,openaiCandidate} from '../packages/adapters/src/openai.ts';
import {generationCase,fitGenerationContext,scoreGeneration} from './conversation-eval.ts';
const root=resolve('J:/ai/ai-character-runtime/openai-generation-20261014');
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const sources=['packages/adapters/src/openai.ts','packages/adapters/src/dialogue-request.ts','packages/contracts/src/conversation.ts','packages/contracts/src/ai-ports.ts','packages/contracts/src/domain.ts','packages/character-core/src/index.ts','evals/conversation-eval.ts','evals/conversation-api-eval.ts','evals/fixtures/conversation-dev-v1.json','evals/fixtures/conversation-confirmation-v1.json'];
const fixtureSchema=z.object({version:z.string(),syntheticInputs:z.literal(true),seed:z.number().int(),cases:z.array(z.object({id:z.string(),input:z.string(),history:z.array(z.tuple([z.enum(['user','assistant']),z.string()])),fact:z.string().optional(),condition:z.enum(['neutral','happy','uncomfortable','concealing']),disclosure:z.enum(['explain','partial','deflect','unknown']).optional(),reason:z.enum(['withholding','listening']).optional(),expectation:z.string()}).strict()).length(12)}).strict();
function atomic(path:string,value:unknown){writeFileSync(path+'.tmp',JSON.stringify(value,null,2)+'\n');renameSync(path+'.tmp',path);}
export function scoreApi(rows:{id:string;error?:string}[],review:unknown,split:'G'|'H'){
 // Reuse the frozen rubric and applicability rules. 'current' is its internal
 // single-candidate slot, not a claim that this candidate is the operating model.
 return scoreGeneration(rows.map(r=>({...r,profile:'current'})),review,split)['current'];
}
export async function runApi(args:string[]){
 if(!args.includes('--synthetic-inputs'))throw new Error('synthetic_inputs_required');
 const phase=args.includes('--confirmation')?'confirmation':'dev';
 const hashes=Object.fromEntries(sources.map(p=>[p,hash(readFileSync(p,'utf8'))]));
 mkdirSync(root,{recursive:true});
 const manifestPath=resolve(root,'manifest.json'),attemptPath=resolve(root,'attempts.json');
 const configuration={provider:'openai',...openaiCandidate,budgetUsd:1,promptVariant:'conversation-history-v1',sourceHashes:hashes,inputLimit:3328,historyLimit:768,syntheticInputs:true,retries:0,preparationInferenceCalls:0,seed:null,seedReason:'Responses API has no seed setting',schemaProjection:'omit $schema/minLength/maxLength only; retain full application validation',tokenCounter:'native responses/input_tokens; count requests conservatively reserved, billing unverified',stateOrigin:'injected_controls',qualityOrigin:'codex_same_context; user acceptance pending',scope:'no real Jev, DB, Stage or production adoption'};
 if(existsSync(manifestPath)){if(JSON.stringify(JSON.parse(readFileSync(manifestPath,'utf8')))!==JSON.stringify(configuration))throw new Error('api_baseline_changed');}else atomic(manifestPath,configuration);
 const attempts:string[]=existsSync(attemptPath)?JSON.parse(readFileSync(attemptPath,'utf8')):[];
 if(!Array.isArray(attempts)||attempts.includes(phase)||phase==='dev'&&attempts.length)throw new Error('api_phase_already_attempted');
 if(phase==='confirmation'){
   const dev=JSON.parse(readFileSync(resolve(root,'dev/results.json'),'utf8')),review=JSON.parse(readFileSync(resolve(root,'dev/review.json'),'utf8'));
   if(!attempts.includes('dev')||dev.status!=='COMPLETED'||!scoreApi(dev.rows,review,'G')?.eligible)throw new Error('api_dev_not_eligible');
   atomic(resolve(root,'confirmation-gate.json'),{devHash:hash(JSON.stringify(dev)),reviewHash:hash(JSON.stringify(review)),sourceHashes:hashes,decision:'dev eligible; confirmation authorized by frozen plan',at:new Date().toISOString()});
 }
 process.loadEnvFile('runtime-data/dialogue-api.env');
 const apiKey=process.env.DIALOGUE_API_KEY??'';
 if(!apiKey.trim())throw new Error('dialogue_key_missing');
 const fixture=fixtureSchema.parse(JSON.parse(readFileSync(phase==='dev'?'evals/fixtures/conversation-dev-v1.json':'evals/fixtures/conversation-confirmation-v1.json','utf8')));
 const directory=resolve(root,phase);mkdirSync(directory,{recursive:true});attempts.push(phase);atomic(attemptPath,attempts);
 const rows:any[]=[],calls:any[]=[],requests:any[]=[];let raw='',status='INCOMPLETE',activeId='';
 const provider=new OpenAIDialogue({localOnly:false,allowPaidProviders:true,apiKey,budget:new DialogueBudget(resolve(root,'budget.json'),1),onCall:r=>{calls.push({...r,caseId:activeId});save();},onContent:text=>{raw=text;},fetcher:async(url,init)=>{requests.push({caseId:activeId,url:String(url),body:JSON.parse(String(init?.body))});return fetch(url,init);}});
 const save=()=>atomic(resolve(directory,'results.json'),{status,rows,calls,requests,manifest:configuration});save();
 try{for(const scene of fixture.cases){
   activeId=scene.id;raw='';const control=generationCase(scene),row:any={id:scene.id,expectation:scene.expectation,plan:control.plan};let stop=false;
   try{Object.assign(row,await fitGenerationContext(provider,control.plan,control.context));row.sentences=await provider.dialogue(control.plan,row.context);}
   catch(e){row.error=e instanceof Error?e.message:'unknown_error';stop=row.error!=='invalid_output';}
   row.raw=raw;rows.push(row);save();console.log(scene.id+' '+(row.error?'FAIL '+row.error:'generated'));
   if(stop){status='STOPPED';break;}
 }if(status!=='STOPPED')status='COMPLETED';}finally{save();}
 console.log(JSON.stringify({phase,status,cases:rows.length,quality:'NOT_REVIEWED',directory}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await runApi(process.argv.slice(2));
