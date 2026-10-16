// One approved synthetic v3 run: dev6, then HA12 only if every dev case passes.
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {OpenAIInteractionV3Candidate,INTERACTION_V3_VERSION,interactionV3EvidenceVerifier} from '../packages/adapters/src/openai-interaction-v3.ts';
import {DECISION_ENDPOINT} from '../packages/adapters/src/openai-conversation.ts';
import {DialogueBudget,openaiDecisionCandidate} from '../packages/adapters/src/openai.ts';
import {assessInteraction} from './interaction-eval.ts';
import {prepareInteractionV3Cases,interactionV3SourceHashes} from './interaction-v3-eval.ts';

type Prepared=ReturnType<typeof prepareInteractionV3Cases>;
const root=resolve('J:/ai/ai-character-runtime/interaction-v3-20261015'),preparedPath=resolve(root,'prepared-cap-fix.json'),providerDir=resolve(root,'provider-cap-fix');
const ledgerPath=resolve('J:/ai/ai-character-runtime/openai-generation-20261014/budget.json');
const unknownId='3f1c4f32-41f7-42f2-b05e-dfe0d65aaaef';
const authorization='2026-10-15 user approved increase from decision36 to max54: dev6 then conditional HA12; same existing OpenAI total USD1; no retries or generation';
const json=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const sha=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
const saveJson=(path:string,value:unknown)=>writeFileSync(path,JSON.stringify(value,null,2)+'\n');
function checkLedger(){
 const ledger=json(ledgerPath),oldUnknown=ledger.entries.filter((e:{status:string})=>e.status!=='completed');
 if(ledger.version!==1||ledger.model!=='gpt-6-sol'||ledger.limitUsd!==1||ledger.entries.length!==185||ledger.entries.filter((e:{kind:string})=>e.kind==='decision').length!==36||ledger.entries.filter((e:{kind:string})=>e.kind==='dialogue').length!==24||oldUnknown.length!==1||oldUnknown[0].id!==unknownId||oldUnknown[0].kind!=='count'||oldUnknown[0].status!=='unknown'||oldUnknown[0].usd!==.010635)throw new Error('v3_ledger_baseline_changed');
 return ledger;
}
function checkPrepared(){
 const prepared=json(preparedPath) as Prepared;
 if(prepared.version!==INTERACTION_V3_VERSION||prepared.devCount!==6||prepared.confirmationCount!==12||prepared.cases.length!==18||prepared.cases.some((c,i)=>c.id!==(i<6?`D${String(i+1).padStart(2,'0')}`:`HA${String(i-5).padStart(2,'0')}`)))throw new Error('frozen_v3_cases_required');
 if(JSON.stringify(interactionV3SourceHashes())!==JSON.stringify(prepared.sourceHashes))throw new Error('prepared_source_changed');
 const fresh=prepareInteractionV3Cases();
 for(let i=0;i<18;i++)if(fresh.cases[i]!.id!==prepared.cases[i]!.id||fresh.cases[i]!.text!==prepared.cases[i]!.text||JSON.stringify(fresh.cases[i]!.request)!==JSON.stringify(prepared.cases[i]!.request)||JSON.stringify(fresh.cases[i]!.expected)!==JSON.stringify(prepared.cases[i]!.expected))throw new Error('prepared_criteria_changed');
 return prepared;
}
async function main(){
 const args=process.argv.slice(2),prepare=args.length===1&&args[0]==='--prepare',check=args.length===1&&args[0]==='--check',run=args.length===3&&args.includes('--synthetic-inputs')&&args.includes('--allow-decisions-api')&&args.includes('--v3-dev6-conditional-ha12');
 if(!prepare&&!check&&!run)throw new Error('explicit_v3_scope_required');
 if(prepare){
  if(existsSync(preparedPath)||existsSync(providerDir))throw new Error('v3_already_prepared');checkLedger();
  const failed=json(resolve(root,'provider/results.json')),old=json(resolve(root,'prepared.json')) as Prepared;
  if(failed.status!=='STOPPED'||failed.stopReason!=='decision_attempt_limit'||failed.attempts.length||failed.calls.length||failed.rows.length||old.cases.length!==18)throw new Error('cap_fix_recovery_not_safe');
  const value=prepareInteractionV3Cases();
  for(let i=0;i<18;i++)if(old.cases[i]!.id!==value.cases[i]!.id||old.cases[i]!.text!==value.cases[i]!.text||JSON.stringify(old.cases[i]!.request)!==JSON.stringify(value.cases[i]!.request)||JSON.stringify(old.cases[i]!.expected)!==JSON.stringify(value.cases[i]!.expected))throw new Error('recovery_requests_changed');
  saveJson(preparedPath,value);console.log(JSON.stringify({prepared:value.cases.length,dev:6,confirmation:12,providerCalls:0,previousPreflightStopped:true,requestsUnchanged:true,location:preparedPath}));return;
 }
 const prepared=checkPrepared(),ledger=checkLedger(),priorUsd=ledger.entries.reduce((s:number,e:{usd:number})=>s+e.usd,0);
 const maxReserved=prepared.cases.reduce((s,c)=>s+(Buffer.byteLength(JSON.stringify(c.request))+1024)*openaiDecisionCandidate.inputUsdPerMillion/1e6,0);
 if(maxReserved>.02||priorUsd+maxReserved>1)throw new Error('v3_budget_reservation_unavailable');
 if(existsSync(providerDir))throw new Error('v3_run_already_started');
 if(check){console.log(JSON.stringify({prepared:18,sourceHashesMatch:true,priorEntries:185,priorDecisions:36,priorUsd,maxReserved,totalUpperBound:priorUsd+maxReserved,alreadyStarted:false}));return;}
 process.loadEnvFile('runtime-data/dialogue-api.env');const key=process.env.DIALOGUE_API_KEY??'';
 if(!key.trim()||/\s/.test(key.trim()))throw new Error('dialogue_key_missing');
 mkdirSync(providerDir,{recursive:true});
 const sources={...prepared.sourceHashes,'evals/openai-interaction-v3-probe.ts':sha('evals/openai-interaction-v3-probe.ts')};
 const manifest={version:INTERACTION_V3_VERSION,model:openaiDecisionCandidate.model,endpoint:DECISION_ENDPOINT,authorization,syntheticInputs:true,sourceHashes:sources,preparedHash:sha(preparedPath),priorUsd,maxReserved,maxCalls:18,maxDecisionCallsTotal:54,automaticRetries:0,generationCalls:0,criteria:'dev6 all four dimensions then HA12 all four dimensions; stop on first provider, format, usage or budget error; no auto-promotion',priceSource:'https://developers.openai.com/api/docs/guides/decisions',inputUsdPerMillion:openaiDecisionCandidate.inputUsdPerMillion};
 saveJson(resolve(providerDir,'manifest.json'),manifest);copyFileSync(preparedPath,resolve(providerDir,'prepared.json'));saveJson(resolve(providerDir,'budget-before.json'),ledger);
 for(const path of Object.keys(sources)){const dest=resolve(providerDir,'source',path);mkdirSync(dirname(dest),{recursive:true});copyFileSync(path,dest);}
 const calls:Record<string,unknown>[]=[],attempts:{id:string;ledgerEntryId:string|null}[]=[],rows:Record<string,unknown>[]=[];
 let status='RUNNING',active=-1,stopReason:string|null=null;
 const currentLedger=()=>json(ledgerPath),save=()=>saveJson(resolve(providerDir,'results.json'),{status,stopReason,rows,attempts,calls,budget:currentLedger(),sourceHashes:sources});save();
 const provider=new OpenAIInteractionV3Candidate({localOnly:false,allowPaidProviders:true,apiKey:key,budget:new DialogueBudget(ledgerPath,1,{entryId:unknownId,authorization,kind:'decision',maxDecisionCalls:54}),onCall:call=>{calls.push(call);if(call.errorCode)stopReason=String(call.errorCode);save();},fetcher:async(url,init)=>{
  if(stopReason||String(url)!==DECISION_ENDPOINT||active!==attempts.length||attempts.length>=18)throw new Error('unregistered_v3_request');
  const body=JSON.parse(String(init?.body));if(JSON.stringify(body)!==JSON.stringify(prepared.cases[active]!.request))throw new Error('prepared_request_changed');
  const entries=currentLedger().entries,entry=entries.at(-1);
  if(entries.length!==186+attempts.length||entries.filter((e:{kind:string})=>e.kind==='decision').length!==37+attempts.length||entry?.kind!=='decision'||entry.status!=='reserved')throw new Error('decision_reservation_missing');
  attempts.push({id:prepared.cases[active]!.id,ledgerEntryId:entry.id});save();saveJson(resolve(providerDir,`${prepared.cases[active]!.id}-request.json`),body);
  const response=await fetch(url,init);if(!response.ok)return response;
  const raw=await response.text();if(Buffer.byteLength(raw)>65536)throw new Error('decision_response_too_large');writeFileSync(resolve(providerDir,`${prepared.cases[active]!.id}-response.json`),raw);return new Response(raw,{status:response.status,headers:{'content-type':'application/json'}});
 }});
 try{
  for(const phase of ['dev','confirmation'] as const){
   if(phase==='confirmation'){
    const passed=rows.length===6&&rows.every(r=>r.pass);saveJson(resolve(providerDir,'confirmation-gate.json'),{devRows:rows.length,allPass:passed,sourceHashes:sources,decisionCalls:currentLedger().entries.filter((e:{kind:string})=>e.kind==='decision').length});
    if(!passed){status='DEV_REJECTED';break;}
   }
   const first=phase==='dev'?0:6,last=phase==='dev'?6:18;
   for(let i=first;i<last;i++){
    active=i;const item=prepared.cases[i]!;
    const entries=currentLedger().entries;if(entries.length!==185+i||entries.filter((e:{kind:string})=>e.kind==='decision').length!==36+i)throw new Error('decision_call_limit_or_ledger_changed');
    const value=await provider.evaluate(item.input.event,{conversationContext:item.input.context});
    const assessed=assessInteraction(value,item.input,item.expected,interactionV3EvidenceVerifier),row={id:item.id,expected:item.expected,appraisal:value.appraisal,metadata:value.metadata,...assessed};
    rows.push(row);save();console.log(JSON.stringify({id:item.id,pass:assessed.pass,checks:assessed.checks,outcome:assessed.outcome,purpose:assessed.plan.purpose,affect:assessed.effect.category,stimulus:assessed.effect.stimulus,repair:assessed.repairAmount}));
    if(stopReason)throw new Error(stopReason);
   }
  }
  if(Object.entries(sources).some(([path,hash])=>sha(path)!==hash))throw new Error('source_changed_during_run');
  if(status==='RUNNING')status=rows.every(r=>r.pass)?'CANDIDATE_PASSED':'CONFIRMATION_REJECTED';
 }catch(e){status='STOPPED';stopReason=e instanceof Error?e.message:'v3_probe_failed';}finally{save();}
 console.log(JSON.stringify({status,evaluated:rows.length,passed:rows.filter(r=>r.pass).length,attempts:attempts.length,stopReason,priorUsd,totalUsd:currentLedger().entries.reduce((s:number,e:{usd:number})=>s+e.usd,0),dir:providerDir}));
 if(status==='STOPPED')process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
