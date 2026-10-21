// Fixed confirmation preparation only. No key, paid ledger or network access.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {eventInterpretationSchema,validateAffectRequest} from '../packages/contracts/src/affect-appraisal.ts';
import {prepareOutcomeProbe,OUTCOME_PROBE_TASK,OUTCOME_PROBE_VERSION} from '../packages/adapters/src/outcome-probe.ts';
import {EVENT_REFERENCE_CODEC_VERSION} from '../packages/adapters/src/event-reference-codec.ts';
import {deepseekPayload} from '../packages/adapters/src/deepseek.ts';
import {deepseekInputBound,deepseekReservationUsd,deepseekCandidate} from '../packages/adapters/src/deepseek-budget.ts';
import {affectRequest,affectSource,affectId,affectNow} from './affect-fixture.ts';
import {authoredProbeOutcome,outcomeProbeHash,outcomePreparationSourceHashes} from './affect-outcome-probe.ts';

export const OUTCOME_CONFIRM_PREPARATION_VERSION='outcome-confirm-preparation-v2';
// Proposed C1-P limits, never an authorization by themselves.
export const OUTCOME_CONFIRM_LIVE_POLICY=Object.freeze({totalUsd:.20,cumulativeCalls:52,priorCalls:36,newCalls:16});
export const OUTCOME_CONFIRM_IDS=Object.freeze(Array.from({length:16},(_,i)=>`F${String(i+1).padStart(2,'0')}`));
const shape=eventInterpretationSchema.shape.outcome.unwrap().shape;
const scene=z.object({id:z.string(),group:z.enum(['traceable','abstention','contrast']),family:z.string().min(1),
  input:z.string().min(1),episodes:z.array(z.string().min(1)).max(5),
  expected:z.object({episode:z.number().int().nonnegative(),use:shape.use,result:shape.result}).strict().nullable(),
  search:z.enum(['found','empty','ambiguous','stale','unavailable']).optional(),truncated:z.boolean().optional(),
  actors:z.array(z.string().min(1)).max(5).optional(),pair:z.enum(['shared_work','current_correction']).optional(),
  history:z.array(z.object({kind:z.literal('claim'),text:z.string().min(1)}).strict()).max(5).optional()}).strict();
const schema=z.object({version:z.literal('affect-outcome-confirm-v1'),syntheticOnly:z.literal(true),
  origin:z.literal('authored_confirmation_not_model_outputs'),cases:z.array(scene).length(16)}).strict();

export function materializeOutcomeConfirmation(raw:unknown){
  const fixture=schema.parse(raw);
  assert.deepEqual(fixture.cases.map(row=>row.id),OUTCOME_CONFIRM_IDS,'confirmation_case_order');
  assert.deepEqual(fixture.cases.map(row=>row.group),[...Array(8).fill('traceable'),...Array(4).fill('abstention'),...Array(4).fill('contrast')],'confirmation_balance');
  for(const [first,second,pair] of [[12,13,'shared_work'],[14,15,'current_correction']] as const){
    const a=fixture.cases[first]!,b=fixture.cases[second]!;
    assert.equal(a.pair,pair,'confirmation_pair');assert.equal(b.pair,pair,'confirmation_pair');
    for(const key of ['episodes','history','actors'] as const)assert.deepEqual(a[key],b[key],'confirmation_pair_context');
  }
  return fixture.cases.map(item=>{
    // Same neutral IDs for every scene: no case label or expected result on wire.
    const request=affectRequest();request.eventKind='reported_outcome';request.sources[0]!.text=item.input;
    request.experience.status=item.search??'found';request.experience.truncated=item.truncated??false;
    item.actors?.forEach((label,i)=>request.actors.push({id:affectId(30+i),label}));
    item.episodes.forEach((text,i)=>request.sources.push(affectSource(20+i,'episode',text,affectNow-50000+i*1000)));
    item.history?.forEach((entry,i)=>request.sources.push({...affectSource(40+i,entry.kind,entry.text,affectNow-30000+i*1000),speakerId:request.scope.ownerId}));
    if(item.expected)assert(item.episodes[item.expected.episode],'confirmation_episode_missing');
    const checked=validateAffectRequest(request),probe=prepareOutcomeProbe(checked);
    // Validate authored expectations against host authority; not model quality.
    probe.decode(authoredProbeOutcome(JSON.parse(probe.request.messages[1]!.content),item.expected));
    return {item:{...item,expected:{outcome:item.expected===null?null:{...item.expected,result:[item.expected.result]}}},request:checked};
  });
}

export function buildOutcomeConfirmationPreparation(){
  const diagnostics=materializeOutcomeConfirmation(JSON.parse(readFileSync('evals/fixtures/affect-outcome-confirm-v1.json','utf8')));
  const originals=diagnostics.map(row=>({id:row.item.id,request:row.request}));
  const requests=diagnostics.map(row=>({id:row.item.id,body:deepseekPayload(prepareOutcomeProbe(row.request).request,2048)}));
  const results=diagnostics.map((row,i)=>{
    const expected=row.item.expected.outcome,answer=expected===null?null:{...expected,result:expected.result[0]!};
    const result=prepareOutcomeProbe(row.request).decode(authoredProbeOutcome(JSON.parse(requests[i]!.body.messages.at(-1)!.content),answer));
    assert.deepEqual(result.outcome,authoredProbeOutcome(row.request,answer).outcome);
    return {id:row.item.id,scope:'authored_transport_roundtrip_not_model_quality',result};
  });
  const reservationUsd=requests.reduce((sum,row)=>sum+deepseekReservationUsd(deepseekInputBound(row.body),2048),0);
  const manifest={status:'OUTCOME_OFFLINE_PREPARED',artifactVersion:OUTCOME_CONFIRM_PREPARATION_VERSION,syntheticOnly:true,providerCalls:0,modelInferences:0,semanticQuality:'NOT_RUN',
    prepared:{taskKind:OUTCOME_PROBE_TASK,wireFormat:'refs-v1',codecVersion:EVENT_REFERENCE_CODEC_VERSION,promptVersion:OUTCOME_PROBE_VERSION,
      provider:'deepseek',model:deepseekCandidate.model,evaluationKind:'outcome-only-confirm-sixteen-v1',plannedProviderCalls:16,confirmationRequests:16,
      approvalRequirements:OUTCOME_CONFIRM_LIVE_POLICY,
      eventInputsHash:outcomeProbeHash(originals),requestHash:outcomeProbeHash(requests),sourceHashes:outcomePreparationSourceHashes(),
      reservationUsd,paidAuthorization:false,reservationMeasure:'conservative payload bound; not charged or authorized'}};
  return {manifest,originals,requests,results,diagnostics};
}

export function prepareOutcomeConfirmationOffline(args:string[]){
  assert.deepEqual(args.slice(0,2),['--prepare-outcome-confirm','--output'],'offline_mode_required');assert.equal(args.length,3,'offline_mode_only');
  const base=resolve('J:/ai/ai-character-runtime'),root=resolve(args[2]!),part=relative(base,root);
  assert(part&&part!=='..'&&!part.startsWith(`..${sep}`)&&!part.startsWith(sep)&&!part.includes(':'),'output_must_be_inside_J_ai');
  assert(!existsSync(root),'evidence_exists');
  const {manifest,originals,requests,results}=buildOutcomeConfirmationPreparation();
  mkdirSync(root);
  for(const [name,data] of Object.entries({'manifest.json':manifest,'original-inputs.json':originals,'requests.json':requests,'authored-results.json':results}))writeFileSync(resolve(root,name),JSON.stringify(data,null,2));
  return {status:manifest.status,root,providerCalls:0,modelInferences:0,confirmationRequests:16,reservationUsd:manifest.prepared.reservationUsd};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(prepareOutcomeConfirmationOffline(process.argv.slice(2))));
