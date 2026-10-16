// One user-approved, frozen synthetic v2 diagnostic run. No confirmation set or retries.
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {OpenAIInteractionCandidate,INTERACTION_VERSION} from '../packages/adapters/src/openai-interaction.ts';
import {DECISION_ENDPOINT} from '../packages/adapters/src/openai-conversation.ts';
import {DialogueBudget,openaiDecisionCandidate} from '../packages/adapters/src/openai.ts';
import {assessInteraction} from './interaction-eval.ts';
import type {InteractionExpectation} from './interaction-eval.ts';
import {control} from './conversation-actions-probe.ts';

type PreparedCase={id:string;input:ReturnType<typeof control>;expected:InteractionExpectation;request:{model:string;input:string;questions:unknown[]}};
const root=resolve('J:/ai/ai-character-runtime/interaction-v2-20261014');
const providerDir=resolve(root,'provider-dev12');
const ledgerPath=resolve('J:/ai/ai-character-runtime/openai-generation-20261014/budget.json');
const unknownId='3f1c4f32-41f7-42f2-b05e-dfe0d65aaaef';
const readJson=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const sha=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
const authorization='2026-10-14 user: 새 v2 진단12건 진행; same OpenAI total USD1, prior count unknown retained, decision max36; 2026-10-15 ㄱ resumes paused task';

async function main(){
 const args=process.argv.slice(2),checkOnly=args.length===1&&args[0]==='--check';
 if(!checkOnly&&!(args.length===3&&args.includes('--synthetic-inputs')&&args.includes('--allow-decisions-api')&&args.includes('--v2-dev12')))throw new Error('explicit_v2_diagnostic_scope_required');
 const prepared=readJson(resolve(root,'prepared-dev12.json')) as {version:string;sourceHashes:Record<string,string>;cases:PreparedCase[]};
 if(prepared.version!==INTERACTION_VERSION||prepared.cases.length!==12||new Set(prepared.cases.map(c=>c.id)).size!==12||prepared.cases.some((c,i)=>c.id!==`I${String(i+1).padStart(2,'0')}`))throw new Error('frozen_v2_diagnostic_required');
 const sources={...prepared.sourceHashes,'evals/openai-interaction-probe.ts':sha('evals/openai-interaction-probe.ts')};
 if(Object.entries(prepared.sourceHashes).some(([path,hash])=>sha(path)!==hash))throw new Error('prepared_source_changed');
 const ledger=readJson(ledgerPath),oldUnknown=ledger.entries.filter((e:{status:string})=>e.status!=='completed');
 if(ledger.version!==1||ledger.model!=='gpt-6-sol'||ledger.limitUsd!==1||ledger.entries.length!==173||ledger.entries.filter((e:{kind:string})=>e.kind==='decision').length!==24||ledger.entries.filter((e:{kind:string})=>e.kind==='dialogue').length!==24||oldUnknown.length!==1||oldUnknown[0].id!==unknownId||oldUnknown[0].kind!=='count'||oldUnknown[0].status!=='unknown'||oldUnknown[0].usd!==.010635)throw new Error('v2_ledger_baseline_changed');
 const priorUsd=ledger.entries.reduce((s:number,e:{usd:number})=>s+e.usd,0),maxReserved=prepared.cases.reduce((s,c)=>s+(Buffer.byteLength(JSON.stringify(c.request))+1024)*openaiDecisionCandidate.inputUsdPerMillion/1e6,0);
 if(priorUsd+maxReserved>1||maxReserved<=0)throw new Error('v2_budget_reservation_unavailable');
 if(existsSync(providerDir))throw new Error('v2_diagnostic_already_started');
 if(checkOnly){console.log(JSON.stringify({cases:12,sourceHashesMatch:true,priorEntries:ledger.entries.length,priorDecisionCalls:24,priorUsd,maxReserved,totalUpperBound:priorUsd+maxReserved,alreadyStarted:false}));return;}
 process.loadEnvFile('runtime-data/dialogue-api.env');
 const key=process.env.DIALOGUE_API_KEY??'';
 if(!key.trim()||/\s/.test(key.trim()))throw new Error('dialogue_key_missing');
 mkdirSync(providerDir,{recursive:true});
 const saveJson=(name:string,value:unknown)=>writeFileSync(resolve(providerDir,name),JSON.stringify(value,null,2)+'\n');
 const manifest={version:INTERACTION_VERSION,model:openaiDecisionCandidate.model,endpoint:DECISION_ENDPOINT,authorization,syntheticInputs:true,sourceHashes:sources,preparedPath:resolve(root,'prepared-dev12.json'),preparedHash:sha(resolve(root,'prepared-dev12.json')),priorUsd,maxReserved,maxCalls:12,automaticRetries:0,generationCalls:0,confirmationCalls:0,criteria:'four separate dimensions; every diagnostic case required for adoption; no auto-promotion; stop on first provider, format, usage or budget error',priceSource:'https://developers.openai.com/api/docs/guides/decisions',inputUsdPerMillion:openaiDecisionCandidate.inputUsdPerMillion};
 saveJson('manifest.json',manifest);copyFileSync(resolve(root,'prepared-dev12.json'),resolve(providerDir,'prepared-dev12.json'));saveJson('budget-before.json',ledger);
 for(const path of Object.keys(sources)){const dest=resolve(providerDir,'source',path);mkdirSync(dirname(dest),{recursive:true});copyFileSync(path,dest);}
 const calls:Record<string,unknown>[]=[],attempts:{id:string;ledgerEntryId:string|null}[]=[],rows:Record<string,unknown>[]=[];
 let status='RUNNING',active=-1,stopReason:string|null=null;
 const currentLedger=()=>readJson(ledgerPath);
 const save=()=>saveJson('results.json',{status,stopReason,rows,attempts,calls,budget:currentLedger(),sourceHashes:sources});save();
 const provider=new OpenAIInteractionCandidate({localOnly:false,allowPaidProviders:true,apiKey:key,budget:new DialogueBudget(ledgerPath,1,{entryId:unknownId,authorization,kind:'decision'}),onCall:call=>{calls.push(call);if(call.errorCode)stopReason=String(call.errorCode);save();},fetcher:async(url,init)=>{
   if(stopReason||String(url)!==DECISION_ENDPOINT||active!==attempts.length||attempts.length>=12)throw new Error('unregistered_v2_request');
   const body=JSON.parse(String(init?.body));if(JSON.stringify(body)!==JSON.stringify(prepared.cases[active]!.request))throw new Error('prepared_request_changed');
   const entries=currentLedger().entries,entry=entries.at(-1);if(entry?.kind!=='decision'||entry.status!=='reserved')throw new Error('decision_reservation_missing');
   attempts.push({id:prepared.cases[active]!.id,ledgerEntryId:entry.id});save();saveJson(`${prepared.cases[active]!.id}-request.json`,body);
   const response=await fetch(url,init);if(!response.ok)return response;
   const raw=await response.text();if(Buffer.byteLength(raw)>65536)throw new Error('decision_response_too_large');writeFileSync(resolve(providerDir,`${prepared.cases[active]!.id}-response.json`),raw);return new Response(raw,{status:response.status,headers:{'content-type':'application/json'}});
 }});
 try{
  for(const item of prepared.cases){active++;
   const value=await provider.evaluate(item.input.event,{conversationContext:item.input.context});
   const assessed=assessInteraction(value,item.input,item.expected),row={id:item.id,expected:item.expected,appraisal:value.appraisal,metadata:value.metadata,...assessed};
   rows.push(row);save();console.log(JSON.stringify({id:item.id,pass:assessed.pass,checks:assessed.checks,outcome:assessed.outcome,purpose:assessed.plan.purpose,affect:assessed.effect.category,stimulus:assessed.effect.stimulus,repair:assessed.repairAmount}));
   if(stopReason)throw new Error(stopReason);
  }
  if(Object.entries(sources).some(([path,hash])=>sha(path)!==hash))throw new Error('source_changed_during_run');
  status=rows.every(r=>r.pass)?'DIAGNOSTIC_PASSED':'DIAGNOSTIC_REJECTED';
 }catch(e){status='STOPPED';stopReason=e instanceof Error?e.message:'v2_probe_failed';}finally{save();}
 console.log(JSON.stringify({status,evaluated:rows.length,passed:rows.filter(r=>r.pass).length,attempts:attempts.length,stopReason,priorUsd,totalUsd:currentLedger().entries.reduce((s:number,e:{usd:number})=>s+e.usd,0),dir:providerDir}));
 if(status==='STOPPED')process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
