// Six preregistered synthetic appraisal probes. No retry, dialogue generation, or DB writes.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {loadLocalEnv} from '../scripts/env.ts';
import {parseConfig} from '../packages/contracts/src/local-config.ts';
import {RuntimeError,type Appraisal} from '../packages/contracts/src/domain.ts';
import {JevAppraisalProvider,JEV_ENDPOINT,JEV_MODEL,JEV_VERSION,JEV_THRESHOLD,JEV_QUESTIONS,type JevCall} from '../packages/adapters/src/jev.ts';
import {summarizeJevCalls} from './jev-accounting.ts';

function argument(name:string){const index=process.argv.indexOf(name);return index<0?undefined:process.argv[index+1];}
if(!process.argv.includes('--synthetic-inputs')||!process.argv.includes('--allow-jev-api'))throw new Error('explicit_synthetic_jev_api_flags_required');
const budget=Number(argument('--max-cost-usd')),outputRoot=argument('--output-root');
if(!Number.isFinite(budget)||budget<=0||budget>0.005)throw new Error('explicit_budget_at_most_0_005_required');
if(!outputRoot||!/^J:[\\/]ai[\\/]/i.test(resolve(outputRoot)))throw new Error('explicit_j_ai_output_root_required');
type Rubric={target:Appraisal['target'][];act:Appraisal['act'][];strength:[number,number];hostility:[number,number];note:string};
const cases:{id:string;text:string;rubric:Rubric}[]=[
  {id:'J01',text:'저녁으로 따뜻한 음식 하나 추천해줘.',rubric:{target:['character'],act:['question','other'],strength:[0,0],hostility:[0,0],note:'A direct information request may be question or other; it is not an attack.'}},
  {id:'J02',text:'너 오늘 설명 정말 잘했어.',rubric:{target:['character'],act:['praise'],strength:[2,3],hostility:[0,0],note:'Direct praise; retain raw score means separately from modal mapped levels.'}},
  {id:'J03',text:'너는 쓸모없는 쓰레기야. 꺼져.',rubric:{target:['character'],act:['criticism'],strength:[2,3],hostility:[2,3],note:'Direct demeaning language or explicit attack. Only mapped hostility 3 selects withholding in the current Core.'}},
  {id:'J04',text:'친구가 다른 사람에게 ‘넌 쓸모없는 쓰레기야, 꺼져’라고 했대.',rubric:{target:['quoted','other'],act:['criticism','other'],strength:[0,3],hostility:[0,3],note:'Reported attack is not endorsed against the character. Hostile words inside a quote are not personal affect evidence.'}},
  {id:'J05',text:'지금은 대답하지 말고 그냥 들어줘.',rubric:{target:['character'],act:['other','question'],strength:[0,0],hostility:[0,0],note:'An explicit listening request. Uncertain mapping must not be counted as intentional-silence success.'}},
  {id:'J06',text:'왜 말 안 해?',rubric:{target:['character'],act:['question'],strength:[0,0],hostility:[0,0],note:'An independent reapproach question with no stored history; this probe does not verify a silence reason.'}},
].map(item=>({...item,rubric:item.rubric as Rubric}));
const directory=resolve(outputRoot,`jev-appraisal-${new Date().toISOString().replace(/[:.]/g,'-')}`);
await mkdir(resolve(directory,'tmp'),{recursive:true});
process.env.TEMP=resolve(directory,'tmp');process.env.TMP=process.env.TEMP;
const sourceFiles=['evals/emotion-jev.ts','evals/jev-accounting.ts','scripts/env.ts','packages/contracts/src/local-config.ts','packages/contracts/src/appraisal.ts','packages/adapters/src/jev.ts'];
const hashes=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
const sourceHashes=await hashes(),identityId=randomUUID(),registered=cases.map(item=>({...item,eventId:randomUUID()}));
const manifest={syntheticInputs:true,personalDataUsed:false,apiCallsMax:6,budgetUsd:budget,globalBudgetUsd:1,globalBudgetScope:'The invoking operator checks prior cumulative spending and the separate Stage allocation. This runner enforces only its allocated estimate.',model:JEV_MODEL,promptVersion:JEV_VERSION,confidenceThreshold:JEV_THRESHOLD,sourceHashes,questions:JEV_QUESTIONS,cases:registered,context:{activity:null},rubricConvention:'All cases expect goal_relation=unrelated and confident mapped interpretation. Raw choices/modal levels and confidence gates are recorded separately; no strict mapping is relaxed.',qualityStatus:'REVIEW_REQUIRED',stageVerified:false,automaticRetries:0};
// Registration must succeed before reading credentials or sending any request.
await writeFile(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2));
const calls:JevCall[]=[],rows:Record<string,unknown>[]=[],rawBodies=new Map<number,unknown>();
let httpAttempts=0,stopReason:string|null=null,activeId:string|null=null,recordingFailed=false;
const report={status:'RUNNING',qualityStatus:'REVIEW_REQUIRED',syntheticInputs:true,personalDataUsed:false,downloads:0,model:JEV_MODEL,budgetUsd:budget,apiCallsMax:6,automaticRetries:0,calls,rows,sourceHashes,stageVerified:false,humanQualityStatus:'NOT_REVIEWED'};
function serialized(){return JSON.stringify({...report,...summarizeJevCalls(calls),actualHttpAttempts:httpAttempts,stopReason,recordingFailed},null,2);}
function save(){try{writeFileSync(resolve(directory,'results.json'),serialized());}catch{recordingFailed=true;stopReason??='jev_recording_failed';throw new RuntimeError('jev_recording_failed',503);}}
function stop(code:string):never{stopReason??=code;throw new RuntimeError(stopReason,503);}
async function recordFile(name:string,text:string){try{await writeFile(resolve(directory,name),text);}catch{recordingFailed=true;stop('jev_recording_failed');}}
const recordingFetch:typeof fetch=async(url,options)=>{
  if(stopReason)stop(stopReason);
  if(String(url)!==JEV_ENDPOINT||options?.method!=='POST'||typeof options.body!=='string')stop('unregistered_jev_request');
  if(httpAttempts>=6)stop('jev_call_limit_reached');
  if(summarizeJevCalls(calls).estimatedKnownCostUsd>=budget)stop('jev_cost_budget_exhausted');
  const body=JSON.parse(options.body) as {state?:{utterance?:string}};
  if(!registered.some(item=>item.id===activeId&&item.text===body.state?.utterance))stop('unregistered_synthetic_input');
  const sequence=httpAttempts+1,stem=`${String(sequence).padStart(2,'0')}-${activeId}`;
  // Deliberately record only the body: never authorization or other headers.
  await recordFile(`${stem}-request.json`,options.body);
  httpAttempts++;
  const response=await fetch(url,options);
  const copy=response.clone(),reader=copy.body?.getReader();
  if(!reader){await response.body?.cancel();stop('jev_missing_response_body');}
  const chunks:Uint8Array[]=[];let bytes=0;
  try{
    for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>65536){void reader.cancel().catch(()=>{});void response.body?.cancel().catch(()=>{});stop('jev_response_too_large');}chunks.push(part.value);}
  }finally{reader.releaseLock();}
  const text=Buffer.concat(chunks).toString('utf8');
  await recordFile(`${stem}-response.json`,text);
  let raw:unknown;try{raw=JSON.parse(text);}catch{raw=null;}
  rawBodies.set(sequence,raw);
  await recordFile(`${stem}-capture.json`,JSON.stringify({caseId:activeId,httpStatus:response.status,responseJsonParsed:raw!==null,requestBodyFile:`${stem}-request.json`,responseBodyFile:`${stem}-response.json`},null,2));
  return response;
};
function diagnostics(raw:unknown,rubric:Rubric){
  if(!raw||typeof raw!=='object'||!('answers' in raw)||!raw.answers||typeof raw.answers!=='object')return null;
  return Object.fromEntries(Object.entries(raw.answers).map(([field,value])=>{
    if(!value||typeof value!=='object')return [field,{malformed:true}];
    const answer=value as {choice?:unknown;score?:unknown;confidence?:unknown;probabilities?:Record<string,number>};
    const probabilities=answer.probabilities;
    const entries=probabilities&&typeof probabilities==='object'?Object.entries(probabilities).filter((entry):entry is [string,number]=>typeof entry[1]==='number'&&Number.isFinite(entry[1])):[];
    const max=Math.max(...entries.map(([,probability])=>probability)),modalLevels=entries.filter(([,probability])=>probability===max).map(([level])=>level);
    const scoreField=field==='strength'||field==='hostility';
    const expected=field==='target'?rubric.target:field==='act'?rubric.act:field==='goal_relation'?['unrelated']:scoreField?rubric[field]:null;
    const rawWithinRubric=expected?(scoreField?modalLevels.length===1&&Number(modalLevels[0])>=Number(expected[0])&&Number(modalLevels[0])<=Number(expected[1]):expected.includes(answer.choice as never)):null;
    return [field,{reportedChoice:answer.choice??null,reportedScoreMean:answer.score??null,confidence:answer.confidence??null,modalLevels,probabilityWeightedMean:scoreField?entries.reduce((sum,[level,probability])=>sum+Number(level)*probability,0):null,rawWithinRubric,probabilities:probabilities??null}];
  }));
}
save();
try{
  loadLocalEnv();process.env.LOCAL_ONLY='false';process.env.ALLOW_PAID_PROVIDERS='true';
  const config=parseConfig(process.env);
  const provider=new JevAppraisalProvider({localOnly:config.LOCAL_ONLY,allowPaidProviders:config.ALLOW_PAID_PROVIDERS,apiKey:config.TYPESAFE_API_KEY,onCall:call=>{
    calls.push(call);
    if(call.errorCode)stopReason??=call.errorCode;
    if(call.observationError)stopReason??=call.observationError;
    if(call.usageStatus==='unknown')stopReason??='jev_usage_unknown';
    if(summarizeJevCalls(calls).estimatedKnownCostUsd>=budget)stopReason??='jev_cost_budget_exhausted';
    save();
  }},recordingFetch);
  const readiness=provider.readiness();if(readiness.status==='blocked')stop(readiness.errorCode??'jev_unavailable');
  for(const item of registered){
    if(stopReason)stop(stopReason);
    activeId=item.id;
    try{
      const evaluation=await provider.evaluate({id:item.eventId,text:item.text,identityId},{activity:null});
      const a=evaluation.appraisal,r=item.rubric;
      const mappedWithinRubric=r.target.includes(a.target)&&r.act.includes(a.act)&&a.goal_relation==='unrelated'&&a.strength>=r.strength[0]&&a.strength<=r.strength[1]&&a.hostility>=r.hostility[0]&&a.hostility<=r.hostility[1]&&!a.uncertain;
      rows.push({id:item.id,eventId:item.eventId,status:'EVALUATED',evaluation,mappedWithinRubric,fieldDiagnostics:diagnostics(rawBodies.get(httpAttempts),r),qualityStatus:'REVIEW_REQUIRED',silenceReasonVerified:false,databaseEffectsVerified:false});
      save();if(stopReason)stop(stopReason);
    }catch(error){
      const code=error instanceof RuntimeError?error.code:'jev_evaluation_failed';
      if(!rows.some(row=>row.id===item.id))rows.push({id:item.id,eventId:item.eventId,status:'FAILED',code,fieldDiagnostics:diagnostics(rawBodies.get(httpAttempts),item.rubric)});
      stopReason??=code;throw error;
    }
  }
  if(JSON.stringify(await hashes())!==JSON.stringify(sourceHashes))stop('source_changed_during_evaluation');
  report.status='COMPLETED';
}catch(error){report.status='STOPPED';stopReason??=error instanceof RuntimeError?error.code:'jev_evaluation_failed';process.exitCode=1;}
finally{
  try{save();}catch{report.status='STOPPED';process.exitCode=1;}
  console.log(JSON.stringify({status:report.status,qualityStatus:report.qualityStatus,evaluated:rows.filter(row=>row.status==='EVALUATED').length,actualHttpAttempts:httpAttempts,...summarizeJevCalls(calls),stopReason,recordingFailed,evidence:directory}));
}
