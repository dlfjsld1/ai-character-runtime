// Candidate evaluation only; no Store, production registration or retry.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {z} from 'zod';
import {loadLocalEnv} from '../scripts/env.ts';
import {JevAppraisalProvider,JEV_MODEL,JEV_ENDPOINT,mapJevResponse,type JevCall} from '../packages/adapters/src/jev.ts';
import {RuntimeError} from '../packages/contracts/src/domain.ts';
import {summarizeJevCalls} from './jev-accounting.ts';
import {S1_VERSION,S1_QUESTIONS,assessS1} from './jev-s1-candidate.ts';
const arg=(name:string)=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
const outputRoot=arg('--output-root'),budget=Number(arg('--max-cost-usd')),confirmation=process.argv.includes('--confirmation');
if(!process.argv.includes('--synthetic-inputs')||!process.argv.includes('--allow-jev-api'))throw new Error('explicit_synthetic_api_flags_required');
if(!outputRoot||!/^J:[\\/]ai[\\/]/i.test(resolve(outputRoot)))throw new Error('j_ai_output_required');
if(!Number.isFinite(budget)||budget<=0||budget>.005)throw new Error('bounded_budget_required');
const fixturePath='evals/fixtures/jev-s1-v1.json',fixture=JSON.parse(await readFile(fixturePath,'utf8'));
const caseSchema=z.object({id:z.string(),text:z.string().min(1).max(1000),target:z.array(z.string()),act:z.array(z.string()),gate:z.enum(['praise','protected','participation','attack'])}).strict();
const cases=z.array(caseSchema).length(confirmation?8:16).parse(fixture[confirmation?'confirmation':'dev']);
const paths=[fixturePath,'evals/jev-s1-candidate.ts','evals/jev-s1-probe.ts','evals/jev-accounting.ts','packages/adapters/src/jev.ts','packages/adapters/src/jev-schema.ts','packages/character-core/src/index.ts'];
const hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])));
const sourceHashes=await hashes();
if(confirmation){
  const devPath=arg('--passed-dev');if(!devPath||!/^J:[\\/]ai[\\/]/i.test(resolve(devPath)))throw new Error('passed_dev_required');
  const dev=JSON.parse(await readFile(devPath,'utf8'));
  if(dev.status!=='COMPLETED'||dev.mode!=='dev'||dev.rows?.length!==16||!dev.rows.every((r:any)=>r.assessment.pass)||JSON.stringify(dev.sourceHashes)!==JSON.stringify(sourceHashes))throw new Error('unchanged_passing_dev_required');
}
const directory=resolve(outputRoot,`${confirmation?'confirmation':'dev'}-${new Date().toISOString().replace(/[:.]/g,'-')}`);
await mkdir(resolve(directory,'tmp'),{recursive:true});process.env.TEMP=resolve(directory,'tmp');process.env.TMP=process.env.TEMP;
const requests=cases.map(c=>({model:JEV_MODEL,state:{utterance:c.text,speaker:'user',addressee:'character',activity:null},questions:S1_QUESTIONS}));
const manifest={version:S1_VERSION,mode:confirmation?'confirmation':'dev',syntheticInputs:true,personalDataUsed:false,apiCallsMax:cases.length,budgetUsd:budget,globalBudgetUsd:1,priorKnownCostUsd:.009666426,priorUnknownUsageCalls:1,automaticRetries:0,productionChanges:false,sourceHashes,cases,requests,rubric:fixture.rubric,threshold:.8,policy:'One candidate. No prompt revisions after seeing results. No confirmation unless all dev criteria pass. The production v4 mapper is reused, but candidate results are NOT production v4 evidence.'};
await writeFile(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2));
const calls:JevCall[]=[],rows:Record<string,any>[]=[];
let active=-1,attempts=0,stopReason:string|null=null,rawResponse:unknown;
const report={status:'RUNNING',mode:confirmation?'confirmation':'dev',candidate:S1_VERSION,productionAdoption:false,calls,rows,sourceHashes};
function save(){writeFileSync(resolve(directory,'results.json'),JSON.stringify({...report,...summarizeJevCalls(calls),actualHttpAttempts:attempts,stopReason},null,2));}
const fetcher:typeof fetch=async(url,options)=>{
  if(stopReason||String(url)!==JEV_ENDPOINT||active!==attempts||attempts>=cases.length)throw new Error('unregistered_request');
  if(summarizeJevCalls(calls).estimatedKnownCostUsd+.002688>budget)throw new Error('budget_reservation_unavailable');
  if(JSON.parse(String(options?.body)).state.utterance!==cases[active]!.text)throw new Error('unregistered_input');
  const body=JSON.stringify(requests[active]);if(Buffer.byteLength(body)>32000)throw new Error('input_too_large');
  await writeFile(resolve(directory,`${cases[active]!.id}-request.json`),body);attempts++;
  const response=await fetch(url,{...options,body});if(!response.ok)return response;
  const reader=response.body?.getReader();if(!reader)throw new Error('response_missing');
  let size=0;const chunks:Uint8Array[]=[];
  try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>65536)throw new Error('response_too_large');chunks.push(part.value);}}finally{await reader.cancel().catch(()=>{});}
  const text=Buffer.concat(chunks).toString('utf8');await writeFile(resolve(directory,`${cases[active]!.id}-response.json`),text);rawResponse=JSON.parse(text);
  return new Response(text,{status:response.status,headers:{'content-type':'application/json'}});
};
save();
try{
  loadLocalEnv();
  const provider=new JevAppraisalProvider({localOnly:false,allowPaidProviders:true,apiKey:process.env.TYPESAFE_API_KEY??'',onCall:call=>{calls.push(call);if(call.errorCode||call.usageStatus==='unknown')stopReason=call.errorCode??'jev_usage_unknown';save();}},fetcher);
  if(provider.readiness().status==='blocked')throw new RuntimeError(provider.readiness().errorCode??'jev_unavailable',503);
  for(active=0;active<cases.length;active++){
    if(stopReason)throw new Error(stopReason);rawResponse=undefined;
    const item=cases[active]!,eventId=randomUUID();
    await provider.evaluate({id:eventId,identityId:randomUUID(),text:item.text},{activity:null});
    const evaluation=mapJevResponse(rawResponse,eventId),assessment=assessS1(evaluation,item);
    rows.push({id:item.id,assessment,appraisal:evaluation.appraisal,rawAnswers:evaluation.metadata.providerResult.answers,gateReasons:evaluation.metadata.providerResult.gateReasons});save();
    console.log(JSON.stringify({id:item.id,...assessment,appraisal:evaluation.appraisal}));
  }
  if(JSON.stringify(await hashes())!==JSON.stringify(sourceHashes))throw new Error('source_changed');report.status='COMPLETED';
}catch(error){stopReason??=error instanceof RuntimeError?error.code:error instanceof Error?error.message:'probe_failed';report.status='STOPPED';process.exitCode=1;}
finally{save();console.log(JSON.stringify({status:report.status,pass:rows.filter(r=>r.assessment.pass).length,total:cases.length,...summarizeJevCalls(calls),stopReason,evidence:directory}));}
