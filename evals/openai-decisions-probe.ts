// One approved candidate, same ledger, fixed dev24 -> untouched confirmation12.
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {OpenAIConversationCandidate,decisionEvidenceVerifier,readDecisionConversation,buildDecisionRequest,DECISION_VERSION,DECISION_ENDPOINT,DECISION_QUESTIONS} from '../packages/adapters/src/openai-conversation.ts';
import {DialogueBudget,openaiDecisionCandidate} from '../packages/adapters/src/openai.ts';
import {control,assessConversation} from './conversation-actions-probe.ts';
async function main(){
 if(!process.argv.includes('--synthetic-inputs')||!process.argv.includes('--allow-decisions-api'))throw new Error('explicit_synthetic_decisions_required');
 const dir=resolve('J:/ai/ai-character-runtime/goal2-decisions-20261014/provider'),ledgerPath=resolve('J:/ai/ai-character-runtime/openai-generation-20261014/budget.json');
 if(existsSync(dir)||!existsSync(ledgerPath))throw new Error('candidate_already_attempted_or_existing_ledger_missing');
 const fixturePath='evals/fixtures/conversation-actions-v1.json',fixture=JSON.parse(readFileSync(fixturePath,'utf8')) as {dev:Parameters<typeof control>[0][];confirmation:Parameters<typeof control>[0][]};
 if(fixture.dev.length!==24||fixture.confirmation.length!==12)throw new Error('frozen_case_count_required');
 const before=JSON.parse(readFileSync(ledgerPath,'utf8')),unknownId='3f1c4f32-41f7-42f2-b05e-dfe0d65aaaef',unknown=before.entries.filter((e:any)=>e.status!=='completed');
 if(before.version!==1||before.limitUsd!==1||before.entries.filter((e:any)=>e.kind==='dialogue').length!==24||before.entries.some((e:any)=>e.kind==='decision')||unknown.length!==1||unknown[0].id!==unknownId||unknown[0].usd!==.010635||unknown[0].kind!=='count'||unknown[0].status!=='unknown')throw new Error('ledger_baseline_mismatch');
 const cases=[...fixture.dev,...fixture.confirmation].map(scene=>({scene,control:control(scene)}));
 const bodies=cases.map(c=>buildDecisionRequest(c.control.event,{activity:null,conversationContext:c.control.context}));
 const priorUsd=before.entries.reduce((s:number,e:any)=>s+e.usd,0),maxReserved=bodies.reduce((s,b)=>s+(Buffer.byteLength(JSON.stringify(b))+1024)*.1/1e6,0);
 if(priorUsd+maxReserved>1)throw new Error('maximum_comparison_budget_exceeded');
 const sources=[fixturePath,'evals/openai-decisions-probe.ts','evals/conversation-actions-probe.ts','packages/adapters/src/openai-conversation.ts','packages/adapters/src/openai.ts','packages/adapters/src/jev.ts','packages/contracts/src/conversation.ts','packages/contracts/src/appraisal.ts','packages/contracts/src/ai-ports.ts','packages/character-core/src/index.ts','packages/database/src/store.ts'];
 const hashes=()=>Object.fromEntries(sources.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),sourceHashes=hashes();
 mkdirSync(dir,{recursive:true});for(const p of sources){const dest=resolve(dir,'source',p);mkdirSync(dirname(dest),{recursive:true});copyFileSync(p,dest);}
 const authorization='2026-10-14 user: 써도됨; Decisions only, existing OpenAI USD1, dev24 + conditional HA12, retries0';
 const manifest={candidate:DECISION_VERSION,model:openaiDecisionCandidate.model,endpoint:DECISION_ENDPOINT,questions:DECISION_QUESTIONS,authorization,sourceHashes,syntheticInputs:true,priorUsd,maxReserved,maxCalls:36,automaticRetries:0,preparationCalls:0,generationCalls:0,ledgerPath,budgetBefore:before,contextOrigin:'injected_controls; real Store path separately tested with mock provider',stateOrigin:'injected_controls',cases,criteria:'existing functional gate unchanged, all dev required, first provider/usage error stops, confirmation once only, no retuning',priceSource:'https://developers.openai.com/api/docs/guides/decisions',inputUsdPerMillion:.1};
 writeFileSync(resolve(dir,'manifest.json'),JSON.stringify(manifest,null,2));
 process.loadEnvFile('runtime-data/dialogue-api.env');const apiKey=process.env.DIALOGUE_API_KEY??'';
 const calls:Record<string,unknown>[]=[],rows:ReturnType<typeof assessConversation>[]=[],attempts:{id:string}[]=[];let status='RUNNING',stopReason:string|null=null,active=-1;
 const ledger=()=>JSON.parse(readFileSync(ledgerPath,'utf8'));
 const save=()=>writeFileSync(resolve(dir,'results.json'),JSON.stringify({status,stopReason,rows,calls,attempts,sourceHashes,budget:ledger()},null,2));save();
 const provider=new OpenAIConversationCandidate({localOnly:false,allowPaidProviders:true,apiKey,budget:new DialogueBudget(ledgerPath,1,{entryId:unknownId,authorization,kind:'decision'}),onCall:r=>{calls.push(r);if(r.errorCode)stopReason=String(r.errorCode);save();},fetcher:async(url,init)=>{
  if(stopReason||String(url)!==DECISION_ENDPOINT||active!==attempts.length||attempts.length>=36)throw new Error('unregistered_request');
  const body=JSON.parse(String(init?.body));if(JSON.stringify(body)!==JSON.stringify(bodies[active]))throw new Error('request_changed');
  attempts.push({id:cases[active]!.scene.id});writeFileSync(resolve(dir,cases[active]!.scene.id+'-request.json'),JSON.stringify(body,null,2));save();
  const response=await fetch(url,init),text=await response.text();
  if(Buffer.byteLength(text)>65536)throw new Error('response_too_large');
  if(response.ok){if(apiKey&&text.includes(apiKey))throw new Error('response_contains_secret');writeFileSync(resolve(dir,cases[active]!.scene.id+'-response.json'),text);}
  else writeFileSync(resolve(dir,cases[active]!.scene.id+'-error.json'),JSON.stringify({httpStatus:response.status}));
  return new Response(text,{status:response.status,headers:{'content-type':'application/json'}});
 }});
 try{
  for(const phase of ['dev','confirmation'] as const){
   if(phase==='confirmation'&&rows.some(r=>!r.pass)){status='CANDIDATE_REJECTED';stopReason='dev_gate_not_reached';break;}
   if(phase==='confirmation')writeFileSync(resolve(dir,'confirmation-gate.json'),JSON.stringify({devRows:rows.length,allFunctionalPass:rows.every(r=>r.pass),sourceHashes},null,2));
   for(const scene of fixture[phase]){active++;const item=cases[active]!,v=await provider.evaluate(item.control.event,{activity:null,conversationContext:item.control.context});
    rows.push(assessConversation(scene,v,item.control,{verifier:decisionEvidenceVerifier,readConversation:readDecisionConversation}));save();console.log(scene.id+' '+(rows.at(-1)!.pass?'PASS':'FAIL')+' '+JSON.stringify(rows.at(-1)!.qualified));if(stopReason)throw new Error(stopReason);
   }
  }
  if(JSON.stringify(hashes())!==JSON.stringify(sourceHashes))throw new Error('source_changed');
  const after=ledger();if(JSON.stringify(after.entries.slice(0,before.entries.length))!==JSON.stringify(before.entries))throw new Error('old_ledger_entries_changed');
  if(status==='RUNNING')status=rows.every(r=>r.pass)?'CANDIDATE_PASSED':'CANDIDATE_REJECTED';
 }catch(e){status='STOPPED';stopReason=e instanceof Error?e.message:'probe_failed';}finally{save();}
 const after=ledger(),decisionEntries=after.entries.filter((e:any)=>e.kind==='decision');
 console.log(JSON.stringify({status,evaluated:rows.length,pass:rows.filter(r=>r.pass).length,rawPass:rows.filter(r=>r.rawPass).length,confirmationCalls:attempts.filter(a=>a.id.startsWith('HA')).length,decisionCalls:attempts.length,decisionUsd:decisionEntries.reduce((s:number,e:any)=>s+e.usd,0),totalUsd:after.entries.reduce((s:number,e:any)=>s+e.usd,0),newUnresolved:decisionEntries.filter((e:any)=>e.status!=='completed').length,stopReason,dir}));
 if(status==='STOPPED')process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
