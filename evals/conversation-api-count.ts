// Explicit continuation of token-count validation; never invokes generation.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {OpenAIDialogue,DialogueBudget} from '../packages/adapters/src/openai.ts';
const root=resolve('J:/ai/ai-character-runtime/openai-generation-20261014');
if(!process.argv.includes('--synthetic-inputs')||!process.argv.includes('--authorized-count-continuation'))throw new Error('explicit_count_continuation_required');
const directory=resolve(root,'count-continuation-20261014');
if(existsSync(directory))throw new Error('count_continuation_already_attempted');
const ledgerPath=resolve(root,'budget.json'),before=readFileSync(ledgerPath,'utf8'),ledger=JSON.parse(before);
const oldFailure='3f1c4f32-41f7-42f2-b05e-dfe0d65aaaef';
if(ledger.limitUsd!==1||ledger.entries.filter((e:any)=>e.kind==='dialogue').length!==24||ledger.entries.filter((e:any)=>e.status!=='completed').length!==1||!ledger.entries.some((e:any)=>e.id===oldFailure&&e.kind==='count'&&e.status==='unknown'))throw new Error('count_continuation_baseline_mismatch');
mkdirSync(directory);writeFileSync(resolve(directory,'budget-before.json'),before);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const sourcePaths=['packages/adapters/src/openai.ts','packages/adapters/src/dialogue-request.ts','evals/conversation-api-count.ts'];
const manifest={syntheticInputs:true,maxCountedScenes:24,generationCalls:0,limitUsd:1,authorization:'user ㄱ following schema count validation proposal',preservedFailureId:oldFailure,budgetBeforeHash:hash(before),sourceHashes:Object.fromEntries(sourcePaths.map(p=>[p,hash(readFileSync(p,'utf8'))])),startedAt:new Date().toISOString()};
writeFileSync(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2));
process.loadEnvFile('runtime-data/dialogue-api.env');
const rows:any[]=[],calls:any[]=[],requests:any[]=[];let status='INCOMPLETE',activeId='';
const save=()=>writeFileSync(resolve(directory,'results.json'),JSON.stringify({status,rows,calls,requests,manifest},null,2));save();
const provider=new OpenAIDialogue({localOnly:false,allowPaidProviders:true,apiKey:process.env.DIALOGUE_API_KEY??'',budget:new DialogueBudget(ledgerPath,1,{entryId:oldFailure,authorization:manifest.authorization}),onCall:r=>{calls.push({...r,caseId:activeId});save();},fetcher:async(url,init)=>{
 if(String(url)!=='https://api.openai.com/v1/responses/input_tokens')throw new Error('generation_forbidden');
 const body=JSON.parse(String(init?.body));requests.push({caseId:activeId,body});
 const response=await fetch(url,init);
 if(!response.ok){
   // Capture only safe error identifiers, never headers/key or echoed request text.
   const error=await response.clone().json().catch(()=>({}));writeFileSync(resolve(directory,'provider-error.json'),JSON.stringify({status:response.status,type:error.error?.type??null,code:error.error?.code??null,param:error.error?.param??null}));
 }
 return response;
}});
try{for(const phase of ['dev','confirmation']){
 const data=JSON.parse(readFileSync(resolve(root,phase,'results.json'),'utf8'));
 for(const row of data.rows){
   activeId=row.id;const prior=data.requests.find((r:any)=>r.caseId===row.id&&r.url.endsWith('/responses')).body;
   const expected=data.calls.find((c:any)=>c.caseId===row.id&&c.kind==='dialogue').usage.input_tokens;
   const start=requests.length,fit=await provider.fitConversation(row.plan,row.context);
   const count=requests.slice(start).filter(r=>r.body.text).at(-1)?.body;
   const {model,input,reasoning,text}=prior;
   const requestMatches=JSON.stringify(count)===JSON.stringify({model,input,reasoning,text});
   const contextMatches=JSON.stringify(fit.conversation)===JSON.stringify(row.context.conversation);
   rows.push({id:row.id,inputTokens:fit.inputTokens,recordedGenerationInputTokens:expected,delta:fit.inputTokens-expected,requestMatches,contextMatches});save();
   console.log(row.id+' count='+fit.inputTokens+' delta='+(fit.inputTokens-expected));
   if(!requestMatches||!contextMatches||fit.inputTokens!==expected)throw new Error('count_validation_mismatch');
 }
}status='COMPLETED';}catch(e){status='STOPPED';console.log(e instanceof Error?e.message:'count_validation_failed');}finally{save();}
writeFileSync(resolve(directory,'budget-after.json'),readFileSync(ledgerPath,'utf8'));
console.log(JSON.stringify({directory,status,scenes:rows.length,countCalls:calls.length,generationCalls:0}));
