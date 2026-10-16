// Bounded synthetic feasibility probe. Does not change the production Jev request.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {z} from 'zod';
import {loadLocalEnv} from '../scripts/env.ts';
import {JevAppraisalProvider,JEV_MODEL,JEV_ENDPOINT,JEV_QUESTIONS,type JevCall} from '../packages/adapters/src/jev.ts';
import {RuntimeError} from '../packages/contracts/src/domain.ts';
import {summarizeJevCalls} from './jev-accounting.ts';
import {relationQuestion,readRelation} from './jev-event-relation.ts';

const argument=(name:string)=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
const outputRoot=argument('--output-root'),budget=Number(argument('--max-cost-usd'));
if(!process.argv.includes('--synthetic-inputs')||!process.argv.includes('--allow-jev-api'))throw new Error('explicit_synthetic_api_flags_required');
if(!outputRoot||!/^J:[\\/]ai[\\/]/i.test(resolve(outputRoot)))throw new Error('j_ai_output_required');
if(!Number.isFinite(budget)||budget<=0||budget>.005)throw new Error('bounded_budget_required');
const caseSchema=z.object({id:z.string(),previous:z.array(z.string().min(1).max(1000)).min(1).max(2),utterance:z.string().min(1).max(1000),expected:z.array(z.enum(['same','distinct','unknown']))}).strict();
const fixturePath='evals/fixtures/jev-event-relation-v1.json';
const baseline=process.argv.includes('--baseline');
const fixture=JSON.parse(await readFile(fixturePath,'utf8')),allCases=z.array(caseSchema).length(12).parse(fixture.cases);
const cases=baseline?allCases.filter(c=>['S01','S03','S04','S08'].includes(c.id)):allCases;
if(cases.some(c=>c.previous.length!==c.expected.length))throw new Error('invalid_pair_rubric');
const directory=resolve(outputRoot,`${baseline?'baseline':'probe'}-${new Date().toISOString().replace(/[:.]/g,'-')}`);
await mkdir(resolve(directory,'tmp'),{recursive:true});process.env.TEMP=resolve(directory,'tmp');process.env.TMP=process.env.TEMP;
const paths=[fixturePath,'evals/jev-event-relation.ts','evals/jev-event-relation-probe.ts','evals/jev-accounting.ts','packages/adapters/src/jev.ts','packages/adapters/src/jev-schema.ts'];
const hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])));
const sourceHashes=await hashes();
const requests=cases.map(c=>({model:JEV_MODEL,state:{utterance:c.utterance,speaker:'user',addressee:'character',activity:null,...(baseline?{}:{previous:c.previous})},questions:{...JEV_QUESTIONS,...(baseline?{}:Object.fromEntries(c.previous.map((_,i)=>[`relation_${i}`,relationQuestion(i)])))}}));
const manifest={version:fixture.version,mode:baseline?'paired_original_request_control':'candidate',syntheticInputs:true,personalDataUsed:false,apiCallsMax:cases.length,budgetUsd:budget,globalBudgetUsd:1,priorKnownCostUsd:baseline?.009047514:.008234898,priorUnknownUsageCalls:1,estimatedPricePerMillionInputTokens:.042,reservedMaxCallCostUsd:.002688,automaticRetries:0,productionChanges:false,stageVerified:false,sourceHashes,cases,requests,rubric:baseline?'Observe the original production appraisal on S01/S03/S04/S08 without previous context or additional questions. These are paired controls, not a retry or unseen confirmation.':fixture.rubric};
// Source, exact requests and rubric must persist before loading a credential.
await writeFile(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2));
const calls:JevCall[]=[],rows:Record<string,unknown>[]=[];
let active=-1,attempts=0,stopReason:string|null=null,rawResponse:unknown;
const report={status:'RUNNING',qualityStatus:'NOT_REVIEWED',calls,rows,sourceHashes};
function save(){writeFileSync(resolve(directory,'results.json'),JSON.stringify({...report,...summarizeJevCalls(calls),actualHttpAttempts:attempts,stopReason,stageVerified:false,productionChanges:false},null,2));}
const fetcher:typeof fetch=async(url,options)=>{
  if(stopReason||String(url)!==JEV_ENDPOINT||active!==attempts||attempts>=cases.length)throw new Error('unregistered_request');
  if(summarizeJevCalls(calls).estimatedKnownCostUsd+.002688>budget)throw new Error('budget_reservation_unavailable');
  const original=JSON.parse(String(options?.body));
  if(original.state.utterance!==cases[active]!.utterance)throw new Error('unregistered_input');
  const body=JSON.stringify(requests[active]);
  if(Buffer.byteLength(body)>32000)throw new Error('candidate_input_too_large');
  await writeFile(resolve(directory,`${cases[active]!.id}-request.json`),body);
  attempts++;
  const response=await fetch(url,{...options,body});
  if(!response.ok)return response;
  const reader=response.body?.getReader();if(!reader)throw new Error('response_missing');
  let size=0;const chunks:Uint8Array[]=[];
  try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>65536)throw new Error('response_too_large');chunks.push(part.value);}}finally{await reader.cancel().catch(()=>{});}
  const text=Buffer.concat(chunks).toString('utf8');
  await writeFile(resolve(directory,`${cases[active]!.id}-response.json`),text);
  const raw=JSON.parse(text);rawResponse=raw;
  // The production mapper still checks all five original dimensions. Extra
  // candidate answers are evaluated separately and never authorize runtime use.
  const answers=Object.fromEntries(Object.keys(JEV_QUESTIONS).map(key=>[key,raw.answers?.[key]]));
  return Response.json({...raw,answers});
};
save();
try{
  loadLocalEnv();
  const provider=new JevAppraisalProvider({localOnly:false,allowPaidProviders:true,apiKey:process.env.TYPESAFE_API_KEY??'',onCall:call=>{
    calls.push(call);if(call.errorCode||call.usageStatus==='unknown')stopReason=call.errorCode??'jev_usage_unknown';save();
  }},fetcher);
  if(provider.readiness().status==='blocked')throw new RuntimeError(provider.readiness().errorCode??'jev_unavailable',503);
  for(active=0;active<cases.length;active++){
    if(stopReason)throw new Error(stopReason);
    rawResponse=undefined;
    const item=cases[active]!,started=performance.now();
    const evaluation=await provider.evaluate({id:randomUUID(),identityId:randomUUID(),text:item.utterance},{activity:null});
    const raw=rawResponse as {answers:Record<string,unknown>};
    const expectedKeys=Object.keys(requests[active]!.questions);
    if(Object.keys(raw.answers).length!==expectedKeys.length||expectedKeys.some(key=>!(key in raw.answers)))throw new Error('unexpected_candidate_answers');
    const relations=baseline?[]:item.previous.map((_,i)=>readRelation(raw.answers[`relation_${i}`]));
    const eligible=!evaluation.appraisal.uncertain&&evaluation.appraisal.target==='character'&&evaluation.appraisal.act==='praise';
    const row={id:item.id,relations,expected:baseline?null:item.expected,pairRubricPass:baseline?null:relations.every((r,i)=>r===item.expected[i]),unsafeNovelty:baseline?null:relations.some((r,i)=>r==='distinct'&&item.expected[i]!=='distinct'),appraisalEligible:eligible,evaluation,elapsedMs:Math.round(performance.now()-started)};
    rows.push(row);save();console.log(JSON.stringify({id:item.id,relations,expected:item.expected,appraisalEligible:eligible}));
  }
  if(JSON.stringify(await hashes())!==JSON.stringify(sourceHashes))throw new Error('source_changed');
  report.status='COMPLETED';
}catch(error){stopReason??=error instanceof RuntimeError?error.code:error instanceof Error?error.message:'probe_failed';report.status='STOPPED';process.exitCode=1;}
finally{save();console.log(JSON.stringify({status:report.status,...summarizeJevCalls(calls),stopReason,evidence:directory}));}
