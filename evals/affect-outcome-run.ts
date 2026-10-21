// Dedicated outcome experiment. The existing full-task runners remain unchanged.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,existsSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {RuntimeError} from '../packages/contracts/src/domain.ts';
import {eventInterpretationSchema,type EventInterpretationRequest} from '../packages/contracts/src/affect-appraisal.ts';
import {DeepSeekOutcomeProbe,type DeepSeekResponseRecord} from '../packages/adapters/src/deepseek.ts';
import {DeepSeekBudget,deepseekCandidate} from '../packages/adapters/src/deepseek-budget.ts';
import {prepareOutcomeProbe,OUTCOME_PROBE_TASK,OUTCOME_PROBE_VERSION,type OutcomeProbeResult} from '../packages/adapters/src/outcome-probe.ts';
import {buildOutcomeProbePreparation,authoredProbeOutcome} from './affect-outcome-probe.ts';
import {buildOutcomeConfirmationPreparation,OUTCOME_CONFIRM_IDS,OUTCOME_CONFIRM_LIVE_POLICY} from './affect-outcome-confirm.ts';
import type {AffectCase} from './affect-cases.ts';

const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const write=(path:string,data:unknown)=>writeFileSync(path,JSON.stringify(data,null,2));
const rawHash=(text:string)=>createHash('sha256').update(text).digest('hex');
const base=resolve('J:/ai/ai-character-runtime');
function inside(path:string){
  const absolute=resolve(path),part=relative(base,absolute);
  assert(part&&part!=='..'&&!part.startsWith(`..${sep}`)&&!part.startsWith(sep)&&!part.includes(':'),'path_must_be_inside_J_ai');return absolute;
}
const resultSchema=z.object({taskKind:z.literal(OUTCOME_PROBE_TASK),promptVersion:z.literal(OUTCOME_PROBE_VERSION),outcome:eventInterpretationSchema.shape.outcome}).strict();
const checksSchema=z.object({status:z.enum(['REVIEW_REQUIRED','FAIL']),failures:z.array(z.string())}).strict();
const rowSchema=z.object({id:z.string(),attempted:z.boolean(),received:z.boolean(),execution:z.enum(['NOT_SENT','ERROR','DECODED']),
  result:resultSchema.nullable(),checks:checksSchema.nullable(),error:z.string().nullable()}).strict();
type RunRow=z.infer<typeof rowSchema>;
const responseSchema=z.object({caseId:z.string(),content:z.string().nullable(),truncated:z.boolean(),finishReason:z.string().nullable(),model:z.string().nullable(),rawSha256:z.string().nullable()}).strict();
type Suite='diagnostic8'|'confirm16';
type Preparation=ReturnType<typeof buildOutcomeProbePreparation>|ReturnType<typeof buildOutcomeConfirmationPreparation>;
function suiteDefinition(suite:Suite){
  assert(suite==='diagnostic8'||suite==='confirm16','outcome_suite_required');
  return suite==='confirm16'
    ?{build:buildOutcomeConfirmationPreparation,compare:compareOutcomeProbeConfirmation}
    :{build:buildOutcomeProbePreparation,compare:compareOutcomeProbeDiagnostic};
}
const lines=(root:string,name:string)=>readFileSync(resolve(root,name),'utf8').split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));

export function checkOutcomeProbeCandidate(item:{expected:Pick<AffectCase['expected'],'outcome'>},request:EventInterpretationRequest,result:OutcomeProbeResult){
  const value=resultSchema.parse(result),expected=item.expected.outcome,failures:string[]=[];
  if(expected===null){if(value.outcome!==null)failures.push('unexpected');}
  else if(value.outcome===null)failures.push('missing');
  else{
    if(value.outcome.episodeId!==request.sources.filter(s=>s.kind==='episode')[expected.episode]?.id)failures.push('episode');
    if(value.outcome.use!==expected.use)failures.push('use');
    if(!expected.result.includes(value.outcome.result))failures.push('result');
  }
  // Match the historical rubric's vocabulary: matching enums still needs raw review.
  return {status:failures.length?'FAIL' as const:'REVIEW_REQUIRED' as const,failures};
}

export function compareOutcomeProbeDiagnostic(rows:RunRow[]){
  const baseline=read('evals/fixtures/affect-outcome-isolation-regression-v1.json');
  assert.deepEqual(rows.map(r=>r.id),baseline.cases.map((r:any)=>r.id),'outcome_case_order');
  return {planned:8,attempted:rows.filter(r=>r.attempted).length,received:rows.filter(r=>r.received).length,
    decoded:rows.filter(r=>r.execution==='DECODED').length,rubricMatched:rows.filter(r=>r.execution==='DECODED'&&r.checks?.status==='REVIEW_REQUIRED').length,
    manualAccepted:null,notSent:rows.filter(r=>!r.attempted).length,baselineMatched:baseline.cases.filter((r:any)=>r.originalChecks.scopes.outcome==='REVIEW_REQUIRED').length,
    diagnosticSuccess:'NOT_VERIFIED',affectEvaluation:'NOT_EVALUATED',
    paired:rows.map((row,i)=>({id:row.id,baseline:baseline.cases[i].originalChecks.scopes.outcome,candidate:row.checks?.status??'NOT_EVALUATED'}))};
}

export function compareOutcomeProbeConfirmation(rows:RunRow[]){
  assert.deepEqual(rows.map(row=>row.id),OUTCOME_CONFIRM_IDS,'outcome_case_order');
  return {planned:16,attempted:rows.filter(r=>r.attempted).length,received:rows.filter(r=>r.received).length,
    decoded:rows.filter(r=>r.execution==='DECODED').length,rubricMatched:rows.filter(r=>r.execution==='DECODED'&&r.checks?.status==='REVIEW_REQUIRED').length,
    manualAccepted:null,notSent:rows.filter(r=>!r.attempted).length,confirmationSuccess:'NOT_VERIFIED',affectEvaluation:'NOT_EVALUATED'};
}

export function verifyOutcomeProbePreparation(root:string,statuses:readonly string[],suite:Suite='diagnostic8'){
  const manifest=read(resolve(root,'manifest.json')),current=suiteDefinition(suite).build();
  assert(statuses.includes(manifest.status),'outcome_preparation_status');
  assert.equal(manifest.artifactVersion,current.manifest.artifactVersion,'outcome_artifact_version');
  assert.equal(manifest.syntheticOnly,true,'outcome_synthetic_required');
  assert.deepEqual(manifest.prepared,current.manifest.prepared,'outcome_preparation_changed');
  assert.deepEqual(read(resolve(root,'original-inputs.json')),current.originals,'outcome_original_changed');
  assert.deepEqual(read(resolve(root,'requests.json')),current.requests,'outcome_wire_changed');
  return {manifest,current};
}

// Replays only this task's recorded raw. A valid late response never repairs a
// failed transport/usage decision or turns a mock into provider-quality evidence.
function inspectRecording(root:string,manifest:any,current:Preparation,suite:Suite){
  assert(['OUTCOME_MOCK_PASS','OUTCOME_SEMANTIC_REVIEW_REQUIRED','STOPPED'].includes(manifest.status),'outcome_recording_status');
  assert(['mock','live'].includes(manifest.mode),'outcome_recording_mode');
  const rows=z.array(rowSchema).length(current.originals.length).parse(manifest.results);
  assert.deepEqual(rows.map(r=>r.id),current.originals.map(r=>r.id),'outcome_case_order');
  assert.deepEqual(lines(root,'results.jsonl'),rows,'outcome_results_changed');
  const responses=z.array(responseSchema).parse(lines(root,'responses.jsonl'));
  const ids=responses.map(r=>r.caseId),order=ids.map(id=>rows.findIndex(r=>r.id===id));
  assert.equal(new Set(ids).size,ids.length,'outcome_duplicate_raw');
  assert(order.every((v,i)=>v>=0&&(i===0||v>order[i-1]!)),'outcome_raw_order');
  assert.deepEqual(manifest.comparison,suiteDefinition(suite).compare(rows),'outcome_comparison_changed');
  const attempted=rows.filter(r=>r.attempted).length;
  assert.equal(manifest.realProviderCalls,manifest.mode==='live'?attempted:0,'outcome_call_count');
  assert.equal(manifest.mockCalls,manifest.mode==='mock'?attempted:0,'outcome_call_count');
  assert.equal(manifest.semanticQuality,manifest.mode==='mock'?'NOT_RUN':'REVIEW_REQUIRED','outcome_quality_scope');
  if(suite==='confirm16'&&manifest.mode==='live')assert.deepEqual(manifest.liveApproval,
    {requestHash:current.manifest.prepared.requestHash,...OUTCOME_CONFIRM_LIVE_POLICY},'outcome_live_approval_changed');
  let stopped=false;
  const replayed=rows.map((row,i)=>{
    const response=responses.find(r=>r.caseId===row.id);
    if(stopped)assert.equal(row.execution,'NOT_SENT','outcome_execution_after_stop');
    if(row.execution!=='DECODED')stopped=true;
    if(row.execution==='NOT_SENT')assert(!row.attempted&&!row.received&&!row.result&&!row.checks&&!row.error&&!response,'outcome_unsent_changed');
    if(row.execution==='ERROR')assert(row.error&&!row.result&&!row.checks,'outcome_error_changed');
    if(row.received)assert(response,'outcome_raw_missing');
    if(response){assert(row.attempted,'outcome_raw_without_attempt');assert.equal(response.rawSha256,response.content===null?null:rawHash(response.content),'outcome_raw_hash');}
    let decoded:OutcomeProbeResult|null=null;
    if(response&&!response.truncated&&response.model===deepseekCandidate.model&&response.finishReason==='stop'&&response.content!==null){
      try{decoded=prepareOutcomeProbe(current.originals[i]!.request).decode(response.content);}catch{}
    }
    if(row.execution==='DECODED'){
      assert(row.attempted&&row.received&&!row.error&&decoded,'outcome_not_replayable');
      assert.deepEqual(row.result,decoded,'outcome_result_changed');
      assert.deepEqual(row.checks,checkOutcomeProbeCandidate(current.diagnostics[i]!.item,current.originals[i]!.request,decoded),'outcome_checks_changed');
    }
    return {id:row.id,execution:row.execution,replay:row.execution==='DECODED'?'REPLAYED':response?'STOPPED_RAW_NOT_PROMOTED':'NOT_REPLAYABLE',result:row.execution==='DECODED'?decoded:null,checks:row.checks};
  });
  if(manifest.status==='STOPPED')assert(rows.some(r=>r.execution==='ERROR')&&typeof manifest.failure==='string','outcome_stop_missing');
  else{
    assert(rows.every(r=>r.execution==='DECODED')&&manifest.failure===null,'outcome_completion_changed');
    assert.equal(manifest.status,manifest.mode==='mock'?'OUTCOME_MOCK_PASS':'OUTCOME_SEMANTIC_REVIEW_REQUIRED','outcome_mode_changed');
  }
  return {rows,replayed};
}

export function replayOutcomeDiagnostic(args:string[]){
  const suite:Suite=args[0]==='--replay-outcome-confirm'?'confirm16':'diagnostic8';
  assert.deepEqual([args[0],args[1],args[3]],[suite==='confirm16'?'--replay-outcome-confirm':'--replay-outcome','--recorded','--output'],'outcome_replay_args');assert.equal(args.length,5,'outcome_replay_args');
  const root=inside(args[2]!),output=inside(args[4]!);assert(!existsSync(output),'evidence_exists');
  const {manifest,current}=verifyOutcomeProbePreparation(root,['OUTCOME_MOCK_PASS','OUTCOME_SEMANTIC_REVIEW_REQUIRED','STOPPED'],suite);
  const {replayed}=inspectRecording(root,manifest,current,suite);
  const report={status:'OUTCOME_OFFLINE_REPLAY',providerCalls:0,recorded:root,recordedStatus:manifest.status,mode:manifest.mode,
    semanticQuality:manifest.semanticQuality,...(suite==='confirm16'?{confirmationSuccess:'NOT_VERIFIED'}:{diagnosticSuccess:'NOT_VERIFIED'}),prepared:manifest.prepared,results:replayed,comparison:manifest.comparison};
  mkdirSync(output);write(resolve(output,'replay.json'),report);return report;
}

export async function runOutcomeDiagnostic(args:string[]){
  if(args[0]==='--replay-outcome'||args[0]==='--replay-outcome-confirm')return replayOutcomeDiagnostic(args);
  const liveConfirm=args[0]==='--live-outcome-confirm';
  const live=args[0]==='--live-outcome-diagnostic'||liveConfirm;
  const suite:Suite=liveConfirm||args[0]==='--rehearse-outcome-confirm'?'confirm16':'diagnostic8';
  assert(live||args[0]==='--rehearse-outcome'||args[0]==='--rehearse-outcome-confirm','outcome_mode_required');
  assert.equal(args.length,liveConfirm?13:live?9:5,'outcome_arguments_required');
  assert.equal(args[1],'--prepared','outcome_arguments_required');assert.equal(args[3],'--output','outcome_arguments_required');
  if(live){
    assert.equal(args[5],'--approved-request-hash','outcome_approval_required');assert(/^[a-f0-9]{64}$/.test(args[6]??''),'outcome_approval_required');
    if(liveConfirm){
      assert.equal(args[7],'--approved-total-usd','outcome_approval_required');assert.equal(Number(args[8]),OUTCOME_CONFIRM_LIVE_POLICY.totalUsd,'outcome_approved_cap');
      assert.equal(args[9],'--approved-max-calls','outcome_approval_required');assert.equal(Number(args[10]),OUTCOME_CONFIRM_LIVE_POLICY.cumulativeCalls,'outcome_approved_cap');
    }
    assert.deepEqual(args.slice(liveConfirm?11:7),['--allow-paid-providers','--synthetic-inputs'],'outcome_approval_required');
  }
  const root=inside(args[4]!),preparedRoot=inside(args[2]!);assert(!existsSync(root),'evidence_exists');
  const {manifest:previous,current}=verifyOutcomeProbePreparation(preparedRoot,live?['OUTCOME_MOCK_PASS']:['OUTCOME_OFFLINE_PREPARED'],suite);
  if(live){assert.equal(args[6],current.manifest.prepared.requestHash,'outcome_approved_request_changed');assert.equal(previous.mode,'mock');inspectRecording(preparedRoot,previous,current,suite);}
  let key='synthetic-no-network',budget:DeepSeekBudget,original:any=null,lock:number|undefined,lockPath='';
  if(live){
    const config=parseEnv(readFileSync('runtime-data/deepseek.env','utf8'));
    assert.equal(config.LOCAL_ONLY,'false');assert.equal(config.ALLOW_PAID_PROVIDERS,'true');
    assert(config.DEEPSEEK_API_KEY?.trim()&&config.DEEPSEEK_BUDGET_AUTHORIZATION?.trim(),'outcome_key_and_authorization_required');
    const ledgerPath=inside(config.DEEPSEEK_BUDGET_PATH??''),limit=Number(config.DEEPSEEK_BUDGET_USD),maxCalls=Number(config.DEEPSEEK_MAX_CALLS);
    if(liveConfirm)assert(limit===OUTCOME_CONFIRM_LIVE_POLICY.totalUsd&&maxCalls===OUTCOME_CONFIRM_LIVE_POLICY.cumulativeCalls,'outcome_authorized_cap');
    else assert(Number.isFinite(limit)&&limit>0&&limit<=.20&&Number.isSafeInteger(maxCalls)&&maxCalls>0&&maxCalls<=36,'outcome_authorized_cap');
    const attempt=`O1 DeepSeek ${OUTCOME_PROBE_TASK} ${current.manifest.prepared.requestHash}`;
    lockPath=ledgerPath+'.o1-dev.lock';lock=openSync(lockPath,'wx');
    try{
      // A missing ledger must not silently reset the paid history.
      assert(existsSync(ledgerPath),'outcome_existing_ledger_required');original=read(ledgerPath);
      assert(!original.entries.some((entry:any)=>entry.authorization.endsWith(attempt)),'outcome_attempt_already_recorded');
      budget=new DeepSeekBudget(ledgerPath,limit,maxCalls,config.DEEPSEEK_BUDGET_AUTHORIZATION+'; '+attempt);
      const summary=budget.summary();assert.equal(budget.availability(),null);
      if(liveConfirm)assert.equal(summary.attempts,OUTCOME_CONFIRM_LIVE_POLICY.priorCalls,'outcome_prior_calls_changed');
      assert(summary.remainingGuardUsd>=current.manifest.prepared.reservationUsd,'outcome_insufficient_budget');assert(maxCalls-summary.attempts>=current.originals.length,'outcome_insufficient_calls');key=config.DEEPSEEK_API_KEY!;
    }catch(error){closeSync(lock);unlinkSync(lockPath);throw error;}
  }else budget=new DeepSeekBudget(resolve(root,'synthetic-budget.json'),.20,current.originals.length,'Offline outcome mock only; not paid authorization');
  const rows:RunRow[]=current.originals.map(r=>({id:r.id,attempted:false,received:false,execution:'NOT_SENT',result:null,checks:null,error:null}));
  let activeIndex=0,failure:string|null=null,completedManifest:any,outputOwned=false;
  try{
    const log=(name:string,data:unknown)=>appendFileSync(resolve(root,name),JSON.stringify(data)+'\n');
    const fetcher:typeof fetch=async(url,init)=>{
      const row=rows[activeIndex]!;assert.equal(String(url),'https://api.deepseek.com/chat/completions');assert(!row.attempted,'outcome_duplicate_call');
      assert.deepEqual(JSON.parse(String(init?.body)),current.requests[activeIndex]!.body,'outcome_request_changed');row.attempted=true;
      if(live)return fetch(url,init);
      const expected=current.diagnostics[activeIndex]!.item.expected.outcome;
      const answer=authoredProbeOutcome(JSON.parse(current.requests[activeIndex]!.body.messages.at(-1)!.content),expected===null?null:{...expected,result:expected.result[0]!});
      return Response.json({model:deepseekCandidate.model,usage:{prompt_tokens:1000,completion_tokens:100},choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(answer)}}]});
    };
    const provider=new DeepSeekOutcomeProbe({localOnly:false,allowPaidProviders:true,apiKey:key,budget,fetcher,
      onResponse:(record:DeepSeekResponseRecord)=>{
        const row=rows[activeIndex]!;row.received=true;
        log('responses.jsonl',{caseId:row.id,...record,rawSha256:record.content===null?null:rawHash(record.content)});
        if(record.truncated)throw new RuntimeError('outcome_raw_truncated',503);
      },onCall:record=>log('calls.jsonl',{caseId:rows[activeIndex]!.id,...record})});
    // Validate provider setup before creating evidence; constructor errors still release the live lock.
    mkdirSync(root);outputOwned=true;
    write(resolve(root,'original-inputs.json'),current.originals);write(resolve(root,'requests.json'),current.requests);
    for(const name of ['responses.jsonl','calls.jsonl'])writeFileSync(resolve(root,name),'');
    for(activeIndex=0;activeIndex<rows.length;activeIndex++){
      const row=rows[activeIndex]!;
      try{
        row.result=await provider.probe(current.originals[activeIndex]!.request);row.execution='DECODED';
        row.checks=checkOutcomeProbeCandidate(current.diagnostics[activeIndex]!.item,current.originals[activeIndex]!.request,row.result);
      }catch(error){row.execution='ERROR';row.error=error instanceof RuntimeError?error.code:'outcome_evaluation_stopped';failure=row.error;break;}
    }
  }catch(error){failure=error instanceof RuntimeError?error.code:'outcome_evaluation_stopped';throw error;}
  finally{
    try{
      if(original)assert.deepEqual(read(budget.path).entries.slice(0,original.entries.length),original.entries,'outcome_history_changed');
      // A failed mkdir may mean another run owns this directory and its ledger.
      if(outputOwned){
        const comparison=suiteDefinition(suite).compare(rows);
        completedManifest={artifactVersion:current.manifest.artifactVersion,syntheticOnly:true,prepared:current.manifest.prepared,
          status:failure?'STOPPED':live?'OUTCOME_SEMANTIC_REVIEW_REQUIRED':'OUTCOME_MOCK_PASS',mode:live?'live':'mock',failure,
          realProviderCalls:live?comparison.attempted:0,mockCalls:live?0:comparison.attempted,semanticQuality:live?'REVIEW_REQUIRED':'NOT_RUN',
          results:structuredClone(rows),comparison,summary:budget.summary(),
          ...(liveConfirm?{liveApproval:{requestHash:current.manifest.prepared.requestHash,...OUTCOME_CONFIRM_LIVE_POLICY}}:{})};
        writeFileSync(resolve(root,'results.jsonl'),rows.map(r=>JSON.stringify(r)).join('\n')+'\n');write(resolve(root,'manifest.json'),completedManifest);
      }
    }finally{if(lock!==undefined){closeSync(lock);unlinkSync(lockPath);}}
  }
  return completedManifest;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=await runOutcomeDiagnostic(process.argv.slice(2));
  if(result.status==='STOPPED')process.exitCode=1;
  console.log(JSON.stringify({status:result.status,realProviderCalls:result.realProviderCalls??0,mockCalls:result.mockCalls??0,comparison:result.comparison}));
}
