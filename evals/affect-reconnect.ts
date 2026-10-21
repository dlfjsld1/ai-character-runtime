// C2-L is offline only: authored HTTP responses, an isolated ledger, no env loading.
import {RuntimeError} from '../packages/contracts/src/domain.ts';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {affectCaseSchema,materializeAffectCase,checkAffectCandidate,affectHash,type AffectSuite} from './affect-cases.ts';
import {authoredProbeOutcome} from './affect-outcome-probe.ts';
import {prepareOutcomeProbe,OUTCOME_PROBE_VERSION} from '../packages/adapters/src/outcome-probe.ts';
import {prepareAppraisalProbe,APPRAISAL_PROBE_VERSION} from '../packages/adapters/src/appraisal-probe.ts';
import {SplitEventInterpreter,SPLIT_EVENT_INTERPRETER_VERSION} from '../packages/adapters/src/split-event-interpreter.ts';
import {DeepSeekOutcomeProbe,DeepSeekAppraisalProbe,deepseekPayload,type DeepSeekResponseRecord} from '../packages/adapters/src/deepseek.ts';
import {DeepSeekBudget,deepseekCandidate,deepseekInputBound,deepseekReservationUsd} from '../packages/adapters/src/deepseek-budget.ts';
import {appendEventAffect,eventAffectPolicy} from '../packages/character-core/src/event-affect.ts';
import type {EventInterpretationRequest,EventInterpretation,EventInterpretationResult} from '../packages/contracts/src/affect-appraisal.ts';

export const RECONNECT_VERSION='affect-appraisal-reconnect-v1';
type Split='dev'|'confirm';type Stage='outcome'|'appraisal';
const scope=z.enum(['episode','input']),role=z.enum(['speaker','character','other']).nullable();
const observation=z.object({scope,quote:z.string().min(1),congruence:z.number().min(-1).max(1),actor:role,target:role,
  agency:z.enum(['self','other','external','unknown']),stance:z.enum(['endorses','reports','quotes','questions','corrects','unclear']),expectation:z.boolean()}).strict();
const scene=affectCaseSchema.extend({actorLabel:z.string(),roles:z.array(z.object({scope,actor:z.array(role),target:z.array(role),
  stance:z.array(observation.shape.stance),agency:z.array(observation.shape.agency)}).strict()),
  authored:z.object({status:z.enum(['appraised','irrelevant','uncertain']),observations:z.array(observation).max(8)}).strict()}).strict();
const suiteSchema=z.object({version:z.literal(RECONNECT_VERSION),split:z.enum(['dev','confirm']),syntheticOnly:z.literal(true),personas:z.record(z.string(),z.string()),cases:z.array(scene).length(12)}).strict();
type Suite=z.infer<typeof suiteSchema>;type Scene=z.infer<typeof scene>;
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const sha=(text:string|Buffer)=>createHash('sha256').update(text).digest('hex');
const write=(path:string,data:unknown)=>writeFileSync(path,JSON.stringify(data,null,2));
const ids=(split:Split)=>Array.from({length:12},(_,i)=>(split==='dev'?'A':'V')+String(i+1).padStart(2,'0'));
const base=resolve('J:/ai/ai-character-runtime');
function inside(path:string){const absolute=resolve(path),part=relative(base,absolute);assert(part&&part!=='..'&&!part.startsWith(`..${sep}`)&&!part.startsWith(sep)&&!part.includes(':'),'reconnect_J_path_required');return absolute;}
const paths=['packages/adapters/src/event-reference-codec.ts','packages/adapters/src/appraisal-probe.ts','packages/adapters/src/split-event-interpreter.ts',
  'packages/adapters/src/outcome-probe.ts','packages/adapters/src/deepseek.ts','packages/adapters/src/deepseek-budget.ts','packages/adapters/src/event-interpreter.ts',
  'packages/contracts/src/affect-appraisal.ts','packages/contracts/src/ai-ports.ts','packages/character-core/src/event-affect.ts',
  'evals/affect-cases.ts','evals/affect-outcome-probe.ts','evals/affect-reconnect.ts',
  'evals/fixtures/affect-appraisal-reconnect-dev-v1.json','evals/fixtures/affect-appraisal-reconnect-confirm-v1.json'];

export function validateReconnectSuites(rawDev:unknown,rawConfirm:unknown){
  const dev=suiteSchema.parse(rawDev),confirm=suiteSchema.parse(rawConfirm);
  assert.equal(dev.split,'dev');assert.equal(confirm.split,'confirm');
  for(const suite of [dev,confirm]){
    assert.deepEqual(suite.cases.map(c=>c.id),ids(suite.split),'reconnect_case_order');
    for(const item of suite.cases){assert(suite.personas[item.persona],'reconnect_persona_missing');if(item.expected.outcome)assert(item.episodes?.[item.expected.outcome.episode],'reconnect_episode_missing');}
  }
  const devTraits=new Set(Object.values(dev.personas)),devStories=new Set(dev.cases.map(c=>c.family)),devTexts=new Set(dev.cases.map(c=>c.input));
  assert(confirm.cases.every(c=>!devStories.has(c.family)&&!devTexts.has(c.input)),'reconnect_split_leak');
  const unseen=['V01','V02','V04','V05','V06','V07','V08','V12'].map(id=>confirm.cases.find(c=>c.id===id)!);
  assert(unseen.every(c=>!devTraits.has(confirm.personas[c.persona]!))&&new Set(unseen.map(c=>confirm.personas[c.persona])).size>=2,'reconnect_unseen_traits');
  const [v1,v3,v5,v8]=[0,2,4,7].map(i=>confirm.cases[i]!);
  assert.equal(v1.input,v3.input);assert.deepEqual(v1.episodes,v3.episodes);assert.deepEqual(v1.expected.outcome,v3.expected.outcome);assert.notEqual(v1.persona,v3.persona);
  assert.equal(v5.input,v8.input);assert.equal(v5.persona,v8.persona);assert.deepEqual(v5.episodes,v8.episodes);assert.deepEqual(v5.expected.outcome,v8.expected.outcome);
  assert(!v5.history?.length&&v8.history?.some(s=>s.kind==='expectation'),'reconnect_expectation_pair');
  return {dev,confirm};
}
function materialize(suite:Suite,item:Scene){
  const common:AffectSuite={version:'affect-v3-dev1',evaluationVersion:'affect-evaluation-v3',evaluationScope:'outcome_episode_input',split:suite.split,syntheticOnly:true,personas:suite.personas,cases:suite.cases,contrasts:[]};
  const request=materializeAffectCase(common,item);request.actors[2]!.label=item.actorLabel;return request;
}
const actor=(input:EventInterpretationRequest,value:z.infer<typeof role>)=>value===null?null:value==='speaker'?input.speakerId:value==='character'?input.scope.characterId:input.actors[2]!.id;
function authoredAppraisals(item:Scene,view:{input:EventInterpretationRequest;fixedOutcome:EventInterpretation['outcome']}){
  const {input,fixedOutcome}=view,current=input.sources.find(s=>s.id===input.eventId)!,persona=input.sources.find(s=>s.kind==='persona')!;
  const quote=(s:typeof current,text=s.text)=>({sourceId:s.id,revision:s.revision,quote:text});
  return {status:item.authored.status,appraisals:item.authored.observations.map(o=>{
    const episode=o.scope==='episode'?input.sources.find(s=>s.id===fixedOutcome?.episodeId):null;
    assert(o.scope!=='episode'||episode,'authored_episode_missing');
    const prior=o.expectation?input.sources.find(s=>s.kind==='expectation'):null;assert(!o.expectation||prior,'authored_expectation_missing');
    return {episodeId:episode?.id??null,concern:{source:quote(persona)},evidence:[quote(current,o.quote),...(episode?[quote(episode)]:[])],
      actorId:actor(input,o.actor),targetId:actor(input,o.target),stance:o.stance,agency:o.agency,relevance:1,importance:.8,congruence:o.congruence,certainty:.8,
      controllability:null,expectedness:prior ? .2 : null,expectation:prior?quote(prior):null};
  })};
}
export function checkReconnectCandidate(item:Scene,input:EventInterpretationRequest,result:EventInterpretationResult){
  const common=checkAffectCandidate(item,input,result),failures=[...common.failures],scopes={...common.scopes};
  if(result.status==='interpreted')for(const rule of item.roles){
    const before=failures.length;
    for(const a of result.interpretation.appraisals.filter(a=>(a.episodeId===null?'input':'episode')===rule.scope)){
      if(!rule.actor.map(r=>actor(input,r)).includes(a.actorId))failures.push(rule.scope+'.actor');
      if(!rule.target.map(r=>actor(input,r)).includes(a.targetId))failures.push(rule.scope+'.target');
      if(!rule.stance.includes(a.stance))failures.push(rule.scope+'.stance');
      if(!rule.agency.includes(a.agency))failures.push(rule.scope+'.agency');
    }
    if(failures.length>before&&scopes[rule.scope]!=='NOT_EVALUATED')scopes[rule.scope]='FAIL';
  }
  return {...common,scopes,status:failures.length?'FAIL' as const:'REVIEW_REQUIRED' as const,failures:[...new Set(failures)]};
}
export function buildReconnectPreparation(split:Split){
  assert(split==='dev'||split==='confirm','reconnect_split_required');
  const suites=validateReconnectSuites(read('evals/fixtures/affect-appraisal-reconnect-dev-v1.json'),read('evals/fixtures/affect-appraisal-reconnect-confirm-v1.json')),suite=suites[split];
  const originals=suite.cases.map(item=>({id:item.id,request:materialize(suite,item)}));
  const requests=originals.map(({id,request},i)=>{
    const first=prepareOutcomeProbe(request),outcomeBody=deepseekPayload(first.request,2048),expected=suite.cases[i]!.expected.outcome;
    const authored=authoredProbeOutcome(JSON.parse(first.request.messages[1]!.content),expected===null?null:{...expected,result:expected.result[0]!});
    const fixed=first.decode(authored).outcome,second=prepareAppraisalProbe(request,fixed),authoredAppraisalBody=deepseekPayload(second.request,2048);
    second.decode(authoredAppraisals(suite.cases[i]!,JSON.parse(second.request.messages[1]!.content)));
    assert(deepseekInputBound(authoredAppraisalBody)<=deepseekCandidate.inputBound,'reconnect_appraisal_context_limit');
    return {id,outcomeBody,authoredAppraisalBody,reservationUsd:deepseekReservationUsd(deepseekInputBound(outcomeBody),2048)+deepseekReservationUsd(deepseekCandidate.inputBound,2048)};
  });
  const prepared={version:RECONNECT_VERSION,split,syntheticOnly:true,plannedScenes:12,plannedCalls:24,paidAuthorization:false,
    outcomeVersion:OUTCOME_PROBE_VERSION,appraisalVersion:APPRAISAL_PROBE_VERSION,interpreterVersion:SPLIT_EVENT_INTERPRETER_VERSION,policy:eventAffectPolicy,
    originalHash:affectHash(originals),requestHash:affectHash(requests),sourceHashes:Object.fromEntries(paths.map(path=>[path,sha(readFileSync(path))])),
    reservationUsd:requests.reduce((sum,r)=>sum+r.reservationUsd,0),reservationMeasure:'first actual payload bound plus second maximum input bound and output2048; authored second body is not a future live body'};
  return {suite,originals,requests,prepared};
}
function verifyPrepared(root:string){const manifest=read(resolve(root,'manifest.json')),current=buildReconnectPreparation(manifest.prepared?.split);
  assert.equal(manifest.status,'RECONNECT_OFFLINE_PREPARED');assert.deepEqual(manifest.prepared,current.prepared,'reconnect_preparation_changed');
  assert.deepEqual(read(resolve(root,'original-inputs.json')),current.originals);assert.deepEqual(read(resolve(root,'requests.json')),current.requests);return current;
}
type StageRecord={execution:'NOT_SENT'|'ERROR'|'DECODED';attempted:boolean;body:ReturnType<typeof deepseekPayload>|null;response:DeepSeekResponseRecord|null;rawSha256:string|null;error:string|null;call:Record<string,unknown>|null;ledgerEntry:any};
const emptyStage=():StageRecord=>({execution:'NOT_SENT',attempted:false,body:null,response:null,rawSha256:null,error:null,call:null,ledgerEntry:null});
type Row={id:string;outcome:StageRecord;appraisal:StageRecord;result:EventInterpretationResult|null;checks:ReturnType<typeof checkReconnectCandidate>|null;core:ReturnType<typeof appendEventAffect>|null};
const counts=(rows:Row[])=>({planned:12,attempted:rows.filter(r=>r.outcome.attempted).length,stageCalls:rows.reduce((n,r)=>n+Number(r.outcome.attempted)+Number(r.appraisal.attempted),0),
  interpreted:rows.filter(r=>r.result?.status==='interpreted').length,rubricMatched:rows.filter(r=>r.checks?.status==='REVIEW_REQUIRED').length,notSent:rows.filter(r=>!r.outcome.attempted).length,semanticQuality:'NOT_RUN'});
export type ReconnectMockResponse=(id:string,stage:Stage,body:ReturnType<typeof deepseekPayload>,authored:unknown)=>Promise<Response>|Response;
export function ensureReconnectSceneBudget(budget:DeepSeekBudget,reservationUsd:number){
  assert(Number.isFinite(reservationUsd)&&reservationUsd>0,'reconnect_reservation_invalid');
  const summary=budget.summary();assert.equal(budget.availability(),null);
  assert(budget.maxCalls-summary.attempts>=2,'reconnect_two_calls_required');
  assert(summary.remainingGuardUsd>=reservationUsd,'reconnect_pair_budget_required');
}

export async function rehearseReconnect(preparedPath:string,outputPath:string,responseOverride?:ReconnectMockResponse){
  const inputRoot=inside(preparedPath),root=inside(outputPath);assert(!existsSync(root),'evidence_exists');const current=verifyPrepared(inputRoot);
  // Own the output before creating any synthetic ledger. Never touch an existing output.
  mkdirSync(root);const budget=new DeepSeekBudget(resolve(root,'synthetic-budget.json'),current.prepared.reservationUsd,24,'offline authored C2 mock; not paid authorization');
  const rows:Row[]=current.originals.map(r=>({id:r.id,outcome:emptyStage(),appraisal:emptyStage(),result:null,checks:null,core:null}));
  let active=0,stage:Stage='outcome';
  const options={localOnly:false,allowPaidProviders:true,apiKey:'synthetic-c2-key',budget,
    fetcher:async(url:Parameters<typeof fetch>[0],init?:Parameters<typeof fetch>[1])=>{
      assert.equal(String(url),'https://api.deepseek.com/chat/completions');const row=rows[active]!,record=row[stage];assert(!record.attempted,'reconnect_duplicate_call');
      assert(record.body);const body=JSON.parse(String(init?.body));assert.deepEqual(body,record.body,'reconnect_wire_changed');record.attempted=true;
      const item=current.suite.cases[active]!,view=JSON.parse(body.messages.at(-1)!.content),expected=item.expected.outcome;
      const authored=stage==='outcome'?authoredProbeOutcome(view,expected===null?null:{...expected,result:expected.result[0]!}):authoredAppraisals(item,view);
      return responseOverride?responseOverride(row.id,stage,body,authored):Response.json({model:deepseekCandidate.model,usage:{prompt_tokens:1000,completion_tokens:100},choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(authored)}}]});
    },onResponse:(response:DeepSeekResponseRecord)=>{const record=rows[active]![stage];record.response=response;record.rawSha256=response.content===null?null:sha(response.content);if(response.truncated)throw Error('reconnect_raw_truncated');},
    onCall:(call:Record<string,unknown>)=>{const record=rows[active]![stage];record.call=call;record.ledgerEntry=read(budget.path).entries.find((e:any)=>e.id===call.id);}};
  const outcomeProvider=new DeepSeekOutcomeProbe(options),appraisalProvider=new DeepSeekAppraisalProbe(options);
  for(active=0;active<rows.length;active++){
    const row=rows[active]!,input=current.originals[active]!.request;
    const resolver=new SplitEventInterpreter(async request=>{
      stage='outcome';const record=row.outcome;
      try{ensureReconnectSceneBudget(budget,current.requests[active]!.reservationUsd);
        record.body=deepseekPayload(prepareOutcomeProbe(request).request,2048);const result=await outcomeProvider.probe(request);record.execution='DECODED';return result.outcome;
      }catch(error){record.execution='ERROR';record.error=typeof (error as any)?.code==='string'?(error as any).code:'reconnect_outcome_failed';throw error;}
    },async(request,fixed)=>{
      stage='appraisal';const record=row.appraisal;
      try{record.body=deepseekPayload(prepareAppraisalProbe(request,fixed).request,2048);assert(deepseekInputBound(record.body)<=deepseekCandidate.inputBound,'reconnect_appraisal_context_limit');
        const result=await appraisalProvider.probe(request,fixed);record.execution='DECODED';return result;
      }catch(error){record.execution='ERROR';record.error=typeof (error as any)?.code==='string'?(error as any).code:'reconnect_appraisal_failed';throw error;}
    });
    row.result=await resolver.interpret(input);row.checks=checkReconnectCandidate(current.suite.cases[active]!,input,row.result);
    if(row.result.status==='unavailable')break;
    row.core=appendEventAffect([],input,row.result.interpretation,input.eventId);
  }
  const manifest={status:rows.some(r=>r.result?.status==='unavailable')?'RECONNECT_STOPPED':'RECONNECT_MOCK_COMPLETE',mode:'mock',realProviderCalls:0,prepared:current.prepared,comparison:counts(rows),summary:budget.summary()};
  write(resolve(root,'original-inputs.json'),current.originals);write(resolve(root,'results.json'),rows);write(resolve(root,'manifest.json'),manifest);return manifest;
}

export async function replayReconnect(recordedPath:string,outputPath:string){
  const root=inside(recordedPath),output=inside(outputPath);assert(!existsSync(output),'evidence_exists');const manifest=read(resolve(root,'manifest.json')),current=buildReconnectPreparation(manifest.prepared?.split);
  assert(['RECONNECT_MOCK_COMPLETE','RECONNECT_STOPPED'].includes(manifest.status));assert.equal(manifest.mode,'mock');assert.equal(manifest.realProviderCalls,0);
  assert.deepEqual(manifest.prepared,current.prepared,'reconnect_preparation_changed');assert.deepEqual(read(resolve(root,'original-inputs.json')),current.originals);
  const rows:Row[]=read(resolve(root,'results.json'));assert.deepEqual(rows.map(r=>r.id),ids(current.prepared.split),'reconnect_case_order');assert.deepEqual(manifest.comparison,counts(rows),'reconnect_counts_changed');
  const ledger=read(resolve(root,'synthetic-budget.json'));assert.deepEqual(ledger.entries,rows.flatMap(r=>[r.outcome.ledgerEntry,r.appraisal.ledgerEntry].filter(Boolean)),'reconnect_ledger_changed');
  const budget=new DeepSeekBudget(resolve(root,'synthetic-budget.json'),current.prepared.reservationUsd,24,'offline replay');assert.deepEqual(manifest.summary,budget.summary(),'reconnect_budget_changed');
  let stopped=false;const replayed=[];
  for(const [i,row] of rows.entries()){
    if(stopped||row.result===null){assert.deepEqual(row,{id:row.id,outcome:emptyStage(),appraisal:emptyStage(),result:null,checks:null,core:null},'reconnect_execution_after_stop');stopped=true;continue;}
    const input=current.originals[i]!.request;
    let verificationFailure:unknown;
    function decoded<T>(record:StageRecord,body:ReturnType<typeof deepseekPayload>,decode:(raw:string)=>T):T{
      try{
      assert(record.execution!=='NOT_SENT','reconnect_missing_stage');if(record.body)assert.deepEqual(record.body,body,'reconnect_wire_changed');
      if(record.response){assert(record.attempted);assert.equal(record.rawSha256,record.response.content===null?null:sha(record.response.content),'reconnect_raw_hash');}
      else assert.equal(record.rawSha256,null);
      if(record.attempted){assert(record.body&&record.call&&record.ledgerEntry,'reconnect_call_missing');assert.equal(record.call.id,record.ledgerEntry.id);}
      else assert(!record.call&&!record.ledgerEntry&&!record.response);
      if(record.execution==='ERROR')assert(record.error);
      else{
        assert(!record.error&&record.attempted&&record.body&&record.response&&!record.response.truncated&&record.response.model===deepseekCandidate.model&&record.response.finishReason==='stop'&&record.response.content!==null,'reconnect_raw_not_replayable');
        assert.equal(record.ledgerEntry.status,'completed');return decode(record.response.content);
      }
      }catch(error){verificationFailure=error;throw error;}
      // Re-raise the recorded failure class so the interpreter reports it unchanged.
      throw new RuntimeError(record.error!,503);
    }
    const resolver=new SplitEventInterpreter(async()=>{const p=prepareOutcomeProbe(input);return decoded(row.outcome,deepseekPayload(p.request,2048),text=>p.decode(text).outcome);},async(_,fixed)=>{
      const p=prepareAppraisalProbe(input,fixed);return decoded(row.appraisal,deepseekPayload(p.request,2048),text=>p.decode(text));
    });
    const result=await resolver.interpret(input);if(verificationFailure)throw verificationFailure;assert.deepEqual(result,row.result,'reconnect_result_changed');
    assert.deepEqual(checkReconnectCandidate(current.suite.cases[i]!,input,result),row.checks,'reconnect_checks_changed');
    if(result.status==='unavailable'){assert.equal(row.core,null,'reconnect_failed_core_applied');if(row.outcome.execution==='ERROR')assert.deepEqual(row.appraisal,emptyStage(),'reconnect_appraisal_after_failure');stopped=true;}
    else assert.deepEqual(appendEventAffect([],input,result.interpretation,input.eventId),row.core,'reconnect_core_changed');
    replayed.push({id:row.id,result,core:row.core,stoppedRawPromoted:false});
  }
  assert.equal(stopped,rows.some(r=>r.result?.status==='unavailable'),'reconnect_missing_failure');
  assert.equal(manifest.status,stopped?'RECONNECT_STOPPED':'RECONNECT_MOCK_COMPLETE','reconnect_status_changed');
  const report={status:'RECONNECT_OFFLINE_REPLAY',realProviderCalls:0,mode:'mock',semanticQuality:'NOT_RUN',prepared:current.prepared,comparison:manifest.comparison,results:replayed};
  mkdirSync(output);write(resolve(output,'replay.json'),report);return report;
}

export async function runReconnect(args:string[]){
  assert.equal(args.length,5,'reconnect_offline_arguments');
  if(args[0]==='--prepare-reconnect'){
    assert.equal(args[1],'--split');assert.equal(args[3],'--output');const current=buildReconnectPreparation(args[2] as Split),root=inside(args[4]!);assert(!existsSync(root),'evidence_exists');mkdirSync(root);
    write(resolve(root,'manifest.json'),{status:'RECONNECT_OFFLINE_PREPARED',prepared:current.prepared,realProviderCalls:0});write(resolve(root,'original-inputs.json'),current.originals);write(resolve(root,'requests.json'),current.requests);return current.prepared;
  }
  assert(args[0]==='--rehearse-reconnect'||args[0]==='--replay-reconnect','reconnect_offline_only');assert.equal(args[3],'--output');
  assert.equal(args[1],args[0]==='--rehearse-reconnect'?'--prepared':'--recorded');
  return args[0]==='--rehearse-reconnect'?rehearseReconnect(args[2]!,args[4]!):replayReconnect(args[2]!,args[4]!);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=await runReconnect(process.argv.slice(2));console.log(JSON.stringify(result));
}
