// Offline experiment only. No provider instance, secret, ledger or HTTP access.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {prepareOutcomeProbe,OUTCOME_PROBE_TASK,OUTCOME_PROBE_VERSION} from '../packages/adapters/src/outcome-probe.ts';
import {EVENT_REFERENCE_CODEC_VERSION} from '../packages/adapters/src/event-reference-codec.ts';
import {deepseekPayload} from '../packages/adapters/src/deepseek.ts';
import {deepseekInputBound,deepseekReservationUsd,deepseekCandidate} from '../packages/adapters/src/deepseek-budget.ts';
import {eventInterpretationSchema,validateAffectRequest,type EventInterpretationRequest} from '../packages/contracts/src/affect-appraisal.ts';
import {affectRequest,affectSource,affectId,affectNow} from './affect-fixture.ts';
import {validateAffectSuites} from './affect-cases.ts';
import {materializeAffectDiagnostic} from './affect-diagnostic.ts';

const outcomeShape=eventInterpretationSchema.shape.outcome.unwrap().shape;
const expectedSchema=z.object({episode:z.number().int().nonnegative(),use:outcomeShape.use,result:outcomeShape.result}).strict().nullable();
const sceneSchema=z.object({id:z.string().min(1),family:z.enum(['ownership','correction','time','result','external','modality']),input:z.string().min(1),
  episodes:z.array(z.string().min(1)).min(1).max(5),expected:expectedSchema,search:z.enum(['found','empty','ambiguous','stale','unavailable']).optional(),
  history:z.array(z.object({kind:z.enum(['input','response','claim','expectation']),text:z.string().min(1)}).strict()).max(20).optional()}).strict();
const fixtureSchema=z.object({version:z.literal('affect-outcome-isolation-v1'),syntheticOnly:z.literal(true),
  origin:z.literal('authored_contract_contrasts_not_model_outputs'),cases:z.array(sceneSchema).length(24)}).strict();
type Expected=z.infer<typeof expectedSchema>;
type OutcomeView={eventId:string;sources:{id:string;revision:string;kind:string;text:string}[]};
export const outcomeProbeHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const OUTCOME_PREPARATION_VERSION='outcome-probe-preparation-v2';
const read=(file:string)=>JSON.parse(readFileSync(file,'utf8'));

export function materializeOutcomeIsolation(raw:unknown){
  const fixture=fixtureSchema.parse(raw);assert.equal(new Set(fixture.cases.map(r=>r.id)).size,24,'duplicate_scene');
  for(const family of sceneSchema.shape.family.options)assert.equal(fixture.cases.filter(r=>r.family===family).length,4,'scene_balance');
  return fixture.cases.map(item=>{
    const request=affectRequest();request.eventKind='reported_outcome';request.sources[0]!.text=item.input;
    request.actors.push({id:affectId(30),label:'민수'});request.experience.status=item.search??'found';
    item.episodes.forEach((text,i)=>request.sources.push(affectSource(20+i,'episode',text,affectNow-50000+i*1000)));
    item.history?.forEach((entry,i)=>request.sources.push(affectSource(40+i,entry.kind,entry.text,affectNow-30000+i*1000)));
    if(item.expected)assert(item.episodes[item.expected.episode],'fixture_episode_missing');
    return {item,request:validateAffectRequest(request)};
  });
}

// Authored answers prove representation/roundtrip only; never sent to a model.
export function authoredProbeOutcome(input:OutcomeView,expected:Expected){
  if(expected===null)return {outcome:null};
  const current=input.sources.find(s=>s.id===input.eventId),episode=input.sources.filter(s=>s.kind==='episode')[expected.episode];
  assert(current&&episode,'authored_source_missing');
  const quote=(s:NonNullable<typeof current>)=>({sourceId:s.id,revision:s.revision,quote:s.text});
  return {outcome:{episodeId:episode.id,use:expected.use,result:expected.result,evidence:[quote(current),quote(episode)]}};
}

const sourceFiles=['packages/adapters/src/outcome-probe.ts','packages/adapters/src/event-reference-codec.ts','packages/adapters/src/event-interpreter.ts',
  'packages/contracts/src/affect-appraisal.ts','packages/adapters/src/deepseek.ts','packages/adapters/src/deepseek-budget.ts',
  'evals/affect-outcome-probe.ts','evals/affect-outcome-run.ts','evals/affect-fixture.ts','evals/affect-cases.ts','evals/affect-diagnostic.ts',
  'evals/fixtures/affect-outcome-isolation-v1.json','evals/fixtures/affect-outcome-isolation-regression-v1.json',
  'evals/fixtures/affect-dev-v3.json','evals/fixtures/affect-confirm-v3.json','evals/fixtures/affect-diagnostic-v1.json',
  'evals/affect-outcome-confirm.ts','evals/fixtures/affect-outcome-confirm-v1.json'];

export function outcomePreparationSourceHashes(){
  return Object.fromEntries(sourceFiles.map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')]));
}

export function buildOutcomeProbePreparation(){
  const suite=validateAffectSuites(read('evals/fixtures/affect-dev-v3.json'),read('evals/fixtures/affect-confirm-v3.json')).dev;
  const diagnostics=materializeAffectDiagnostic(suite,read('evals/fixtures/affect-diagnostic-v1.json'));
  const authored=materializeOutcomeIsolation(read('evals/fixtures/affect-outcome-isolation-v1.json'));
  const originals:{id:string;request:EventInterpretationRequest}[]=[],requests:{id:string;body:ReturnType<typeof deepseekPayload>}[]=[],results:unknown[]=[];
  for(const row of diagnostics){
    const probe=prepareOutcomeProbe(row.request),expected=row.item.expected.outcome;
    originals.push({id:row.item.id,request:probe.originalInput});requests.push({id:row.item.id,body:deepseekPayload(probe.request,2048)});
    const answer=expected===null?null:{...expected,result:expected.result[0]!};
    const wire=JSON.parse(probe.request.messages[1]!.content),decoded=probe.decode(authoredProbeOutcome(wire,answer));
    assert.deepEqual(decoded.outcome,authoredProbeOutcome(row.request,answer).outcome);
    results.push({id:row.item.id,scope:'authored_transport_roundtrip_not_model_quality',result:decoded});
  }
  for(const row of authored){
    const probe=prepareOutcomeProbe(row.request),wire=JSON.parse(probe.request.messages[1]!.content);
    assert.deepEqual(probe.decode(authoredProbeOutcome(wire,row.item.expected)).outcome,authoredProbeOutcome(row.request,row.item.expected).outcome);
  }
  const sourceHashes=outcomePreparationSourceHashes();
  const reservationUsd=requests.reduce((sum,row)=>sum+deepseekReservationUsd(deepseekInputBound(row.body),2048),0);
  const manifest={status:'OUTCOME_OFFLINE_PREPARED',artifactVersion:OUTCOME_PREPARATION_VERSION,syntheticOnly:true,providerCalls:0,modelInferences:0,semanticQuality:'NOT_RUN',
    prepared:{taskKind:OUTCOME_PROBE_TASK,wireFormat:'refs-v1',codecVersion:EVENT_REFERENCE_CODEC_VERSION,promptVersion:OUTCOME_PROBE_VERSION,
      provider:'deepseek',model:deepseekCandidate.model,evaluationKind:'outcome-only-diagnostic-eight-v1',plannedProviderCalls:8,diagnosticRequests:8,
      authoredScenes:24,eventInputsHash:outcomeProbeHash(originals),requestHash:outcomeProbeHash(requests),sourceHashes,
      reservationUsd,paidAuthorization:false,reservationMeasure:'conservative payload bound; not charged or authorized'}};
  return {manifest,originals,requests,results,diagnostics};
}

export function prepareOutcomeProbeOffline(args:string[]){
  assert.deepEqual(args.slice(0,2),['--prepare-outcome-probe','--output'],'offline_mode_required');assert.equal(args.length,3,'offline_mode_only');
  const base=resolve('J:/ai/ai-character-runtime'),root=resolve(args[2]!),part=relative(base,root);
  assert(part&&part!=='..'&&!part.startsWith(`..${sep}`)&&!part.startsWith(sep)&&!part.includes(':'),'output_must_be_inside_J_ai');
  assert(!existsSync(root),'evidence_exists');
  const {manifest,originals,requests,results}=buildOutcomeProbePreparation();
  mkdirSync(root);
  for(const [name,data] of Object.entries({'manifest.json':manifest,'original-inputs.json':originals,'requests.json':requests,'authored-results.json':results}))writeFileSync(resolve(root,name),JSON.stringify(data,null,2));
  return {status:manifest.status,root,providerCalls:0,modelInferences:0,authoredScenes:24,diagnosticRequests:8,reservationUsd:manifest.prepared.reservationUsd};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(prepareOutcomeProbeOffline(process.argv.slice(2))));
