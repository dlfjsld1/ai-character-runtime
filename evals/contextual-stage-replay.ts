// Offline evidence replay. Never constructs a provider, opens a database or reads a live ledger.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,mkdirSync,realpathSync} from 'node:fs';
import {resolve,relative,join,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {buildDialogueRequest,decodeDialogueOutput} from '../packages/adapters/src/dialogue-request.ts';
import {deepseekPayload} from '../packages/adapters/src/deepseek.ts';
import {deepseekCandidate,deepseekInputBound,deepseekReservationUsd} from '../packages/adapters/src/deepseek-budget.ts';
import {conversationSnapshotSchema,isConversationSuffix} from '../packages/contracts/src/conversation.ts';
import {stageExpression} from '../packages/character-core/src/index.ts';
import {contextualStageScenes,contextualStageIdentity} from './contextual-stage-fixture.ts';
import {assertStageEvidence} from './contextual-stage-evidence.ts';
import {sourceHashes} from './contextual-stage.ts';
import {stageBudgetPolicy} from './contextual-stage-guard.ts';

type RecordValue=Record<string,any>;
export type ContextualStageReplayInput={
 manifest:RecordValue;result:RecordValue;ledgerBefore?:RecordValue;
 snapshotHashes:Record<string,string>;currentSourceHashes:Record<string,string>;
};
export type StageReplayStep={id:string;status:'DELIVERY_REPLAYED'|'SILENCE_REPLAYED'|'STOPPED';rawReplay:'MATCHED'|'DECODE_REJECTED'|'PROVIDER_REJECTED'|'VALID_UNDELIVERED'|'UNAVAILABLE';deliveryEvidenceComplete:boolean;evidenceErrors:string[]};
const json=(value:unknown)=>JSON.stringify(value,(_key,item)=>typeof item==='bigint'?item.toString():item,2)+'\n';
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const digest=(value:unknown)=>sha(JSON.stringify(value));
const hashPattern=/^[a-f0-9]{64}$/;
const requiredSources=['evals/contextual-stage.ts','evals/contextual-stage-fixture.ts','evals/contextual-stage-evidence.ts','evals/contextual-stage-guard.ts','packages/adapters/src/deepseek.ts','packages/adapters/src/deepseek-budget.ts','packages/adapters/src/dialogue-request.ts','packages/contracts/src/conversation.ts','packages/database/src/store.ts','packages/character-core/src/index.ts','apps/runtime/src/coordinator/index.ts','apps/runtime/src/http/server.ts','apps/studio/src/main.tsx','apps/studio/src/wire.ts'];
const evidenceArrays=['segments','packets','observations','dbAcks','sources','sentAcks'] as const;
function accepted(e:RecordValue,id:string){
 assert(e&&e.id===id&&e.kind==='chat.final'&&e.identity_id===contextualStageIdentity,'replay_input_identity');
 assert(/^[1-9]\d*$/.test(e.revision)&&e.event_revision===e.revision,'replay_input_revision');
 assert(e.appraisal_status==='accepted'&&e.data_status==='active'&&e.provider==='synthetic-cx-stage'&&e.failure_code===null&&e.replay_status==='available'&&e.observed_at,'replay_appraisal_evidence');
}
function near(actual:number,expected:number,code:string){assert(Number.isFinite(actual)&&Math.abs(actual-expected)<1e-10,code);}
function ledgerSummary(ledger:RecordValue){
 assert(ledger.version===1&&ledger.provider==='deepseek'&&ledger.model===deepseekCandidate.model&&ledger.inputUsdPerMillion===.3&&ledger.outputUsdPerMillion===1.2,'replay_ledger_header');
 assert(Number.isFinite(ledger.limitUsd)&&ledger.limitUsd>0&&Array.isArray(ledger.entries),'replay_ledger_shape');
 assert.equal(new Set(ledger.entries.map((e:RecordValue)=>e.id)).size,ledger.entries.length,'replay_duplicate_call');
 for(const entry of ledger.entries){
  assert(typeof entry.id==='string'&&entry.id.length>0&&typeof entry.authorization==='string'&&entry.authorization.length>0,'replay_call_identity');assert(['reserved','completed','unknown'].includes(entry.status)&&Number.isFinite(entry.usd)&&entry.usd>=0,'replay_call_status');
  const reserved=deepseekReservationUsd(entry.inputBound,entry.maxOutputTokens),usage=entry.usage;
  if(usage){assert(Number.isSafeInteger(usage.prompt_tokens)&&usage.prompt_tokens>=0&&Number.isSafeInteger(usage.completion_tokens)&&usage.completion_tokens>=0,'replay_call_usage');const cost=(usage.prompt_tokens*.3+usage.completion_tokens*1.2)/1e6;if(entry.status==='completed'){assert(usage.prompt_tokens<=entry.inputBound&&usage.completion_tokens<=entry.maxOutputTokens,'replay_usage_bound');near(entry.usd,cost,'replay_usage_cost');}else near(entry.usd,Math.max(reserved,cost),'replay_unknown_cost');}
  else{assert.notEqual(entry.status,'completed','replay_completed_usage_missing');near(entry.usd,reserved,'replay_reservation_cost');}
 }
 const enforcedTotalUsd=ledger.entries.reduce((sum:number,e:RecordValue)=>sum+e.usd,0);
 return {provider:'deepseek',billingVerified:false,limitUsd:ledger.limitUsd,enforcedTotalUsd,remainingGuardUsd:Math.max(0,ledger.limitUsd-enforcedTotalUsd),attempts:ledger.entries.length,unresolvedEntries:ledger.entries.filter((e:RecordValue)=>e.status!=='completed').length};
}
function checkAccounting(input:ContextualStageReplayInput,passed:boolean){
 const {result:r,ledgerBefore:before}=input,a=r.accounting;
 if(!a){assert(!passed,'replay_accounting_missing');return 'UNAVAILABLE' as const;}
 assert(before,'replay_ledger_before_missing');
 const start=ledgerSummary(before),end=ledgerSummary(a.after),prior=before.entries.length,own=a.after.entries.slice(prior);
 assert.equal(a.beforeHash,digest(before),'replay_ledger_before_hash');assert.equal(a.afterHash,digest(a.after),'replay_ledger_after_hash');
 assert.deepEqual(a.after.entries.slice(0,prior),before.entries,'replay_ledger_prefix');assert.equal(a.after.limitUsd,before.limitUsd,'replay_ledger_limit');
 assert.deepEqual(a.startSummary,start,'replay_start_summary');assert.deepEqual(a.summary,end,'replay_end_summary');
 assert.equal(a.requestHash,r.requestHash,'replay_accounting_request');assert.equal(a.newCalls,own.length,'replay_accounting_calls');assert.equal(a.priorPrefixPreserved,true,'replay_prefix_claim');
 assert(typeof a.authorization==='string'&&a.authorization.endsWith(' '+r.requestHash),'replay_authorization');
 assert.equal(a.authorizationOrigin.calls,r.mode==='mock'?0:64,'replay_origin_calls');
 const originEntries=before.entries.slice(0,a.authorizationOrigin.calls),originSpent=originEntries.reduce((sum:number,e:RecordValue)=>sum+e.usd,0);
 assert.equal(a.authorizationOrigin.entriesHash,digest(originEntries),'replay_origin_prefix');near(a.authorizationOrigin.spentUsd,originSpent,'replay_origin_spent');
 assert.equal(prior,r.mode==='mock'?0:151,'replay_prior_calls');assert.equal(before.limitUsd,r.mode==='mock'?.20:.25,'replay_budget_cap');
 near(a.newCostUsd,end.enforcedTotalUsd-start.enforcedTotalUsd,'replay_new_cost');
 near(a.authorizationSpentBefore,start.enforcedTotalUsd-originSpent,'replay_authorization_before');near(a.authorizationSpentAfter,end.enforcedTotalUsd-originSpent,'replay_authorization_after');
 near(a.authorizationRemainingUsd,.20-a.authorizationSpentAfter,'replay_authorization_remaining');assert.equal(a.withinAuthorization,a.authorizationSpentAfter<=.20+1e-12,'replay_authorization_claim');
 const calls=r.steps.filter((s:RecordValue)=>s.call);
 assert.equal(calls.length,own.length,'replay_owned_call_count');
 calls.forEach((step:RecordValue,i:number)=>{const entry=own[i];assert.equal(step.call.id,entry.id,'replay_owned_call_id');assert.equal(step.call.provider,'deepseek','replay_call_provider');assert.equal(step.call.model,deepseekCandidate.model,'replay_call_model');assert.equal(entry.authorization,a.authorization,'replay_owned_authorization');assert.equal(entry.inputBound,deepseekInputBound(step.request),'replay_reserved_request');assert.equal(entry.maxOutputTokens,256,'replay_output_bound');if(passed)assert(entry.status==='completed'&&step.call.physicalCompleted===true,'replay_unsettled_success');});
 if(r.transportCalls!==undefined)assert(r.transportCalls<=own.length,'replay_transport_accounting_count');
 if(passed){assert.equal(own.length,8,'replay_fixed_call_count');assert.equal(r.transportCalls,own.length,'replay_transport_count');assert.equal(end.unresolvedEntries,0,'replay_unresolved_success');assert.equal(a.withinAuthorization,true,'replay_budget_exceeded');assert(end.enforcedTotalUsd<=before.limitUsd+1e-12,'replay_project_budget_exceeded');assert(start.remainingGuardUsd+1e-12>=stageBudgetPolicy.reservationUsd,'replay_project_reservation');assert(a.authorizationSpentBefore+stageBudgetPolicy.reservationUsd<=.20+1e-12,'replay_authorization_reservation');}
 return 'VERIFIED_SNAPSHOT' as const;
}

/** Throws for contradictory/missing success evidence; an original failure can only return STOPPED. */
export function replayContextualStage(input:ContextualStageReplayInput){
 const {manifest:m,result:r}=input;
 assert.equal(m.version,1,'replay_manifest_version');assert.equal(m.scope,'generation-db-stage','replay_manifest_scope');assert.deepEqual(m.scenes,contextualStageScenes,'replay_fixed_scenes');
 assert(m.sourceHashes&&Object.keys(m.sourceHashes).length>0,'replay_sources_missing');
 for(const path of requiredSources)assert(hashPattern.test(m.sourceHashes[path]),'replay_required_source_missing');
 for(const [path,value] of Object.entries(m.sourceHashes)){assert(typeof value==='string'&&hashPattern.test(value),'replay_source_hash');assert(/^(?:packages\/|apps\/|evals\/|fixtures\/|package\.json$|pnpm-lock\.yaml$)/.test(path)&&!path.includes('..')&&!path.includes('\\'),'replay_source_path');}
 assert.deepEqual(input.snapshotHashes,m.sourceHashes,'replay_snapshot_source_changed');assert.deepEqual(input.currentSourceHashes,m.sourceHashes,'replay_current_source_changed');
 assert.equal(r.preparedHash,sha(json(m)),'replay_manifest_binding');assert(hashPattern.test(r.requestHash),'replay_run_request_hash');
 assert(['mock','live'].includes(r.mode),'replay_mode');assert(['TECHNICAL_PASS_QUALITY_DEFERRED','FAIL','RUNNING'].includes(r.status),'replay_recorded_status');
 assert(Array.isArray(r.steps)&&r.steps.length<=contextualStageScenes.length&&Array.isArray(r.failures)&&Array.isArray(r.browserErrors),'replay_result_shape');
 const passed=r.status==='TECHNICAL_PASS_QUALITY_DEFERRED';
 if(passed||r.transportCalls!==undefined)assert(Number.isSafeInteger(r.transportCalls)&&r.transportCalls>=0&&r.transportCalls<=8,'replay_transport_count_missing');
 if(passed||r.apiCalls!==undefined){assert(Number.isSafeInteger(r.apiCalls)&&r.apiCalls>=0&&r.apiCalls<=8,'replay_api_count');if(r.mode==='mock')assert.equal(r.apiCalls,0,'replay_mock_api_count');else if(r.transportCalls!==undefined)assert.equal(r.apiCalls,r.transportCalls,'replay_api_count');}
 if(passed){assert.equal(r.steps.length,9,'replay_incomplete_success');assert.deepEqual(r.failures,[],'replay_failed_success');assert.deepEqual(r.browserErrors,[],'replay_browser_failed_success');assert.deepEqual(r.accountingErrors,[],'replay_accounting_failed_success');assert.deepEqual(r.cleanup?.errors,[],'replay_cleanup_failed_success');assert.equal(r.cleanup.busyAfter,false,'replay_cleanup_busy');assert.equal(r.physicalDrained,true,'replay_physical_pending');assert.equal(r.lockReleased,true,'replay_lock_pending');assert.equal(r.claims?.dbStageDelivery,'PASS','replay_delivery_claim');assert.equal(r.claims?.actualGeneration,r.mode==='mock'?'NOT_TESTED_SYNTHETIC_HTTP':'PASS','replay_generation_claim');}
 const seenInputs=new Map<string,RecordValue>(),completed=new Map<string,RecordValue>(),reports:StageReplayStep[]=[];
 let previous:RecordValue|undefined,silence:RecordValue|undefined,group='';
 if(r.steps.length){assert(r.seed?.identityId===contextualStageIdentity&&Array.isArray(r.seed.causes)&&r.seed.causes.length===2,'replay_seed_missing');assert.deepEqual(r.seed.causes.map((c:RecordValue)=>c.emotion).sort(),['frustration','joy'],'replay_seed_emotions');for(const c of r.seed.causes)accepted(c.evidence,c.eventId);}
 for(const [index,step] of r.steps.entries()){
  const scene=contextualStageScenes[index],f=step.fixture,success=step.status==='DELIVERY_PASS_QUALITY_DEFERRED',silent=step.status==='SILENCE_PASS';
  assert(step.status===undefined||['FAIL','DELIVERY_PASS_QUALITY_DEFERRED','SILENCE_PASS'].includes(step.status),'replay_step_status');assert(scene.participation==='silent'?!success:!silent,'replay_participation_status');
  assert.deepEqual(step.scene,scene,'replay_scene_order');assert(f,'replay_fixture_missing');assert.deepEqual(f.scene,scene,'replay_fixture_scene');accepted(f.evidence,f.inputId);assert(!seenInputs.has(f.inputId),'replay_duplicate_input');
  if(group!==scene.group){group=scene.group;previous=undefined;silence=undefined;}
  for(const cause of r.seed.causes){const affect=f.after?.affect?.[cause.emotion];assert(affect?.value>=.6&&affect.causes.some((c:RecordValue)=>c.eventId===cause.eventId&&c.targetId===contextualStageIdentity),'replay_affect_cause');}
  const report:StageReplayStep={id:scene.id,status:'STOPPED',rawReplay:'UNAVAILABLE',deliveryEvidenceComplete:false,evidenceErrors:step.evidenceErrors??[]};reports.push(report);
  assert(Array.isArray(report.evidenceErrors),'replay_evidence_errors');
  if(!success&&!silent){assert(!passed&&index===r.steps.length-1,'replay_call_after_failure');}
  if(success||silent){assert.deepEqual(report.evidenceErrors,[],'replay_success_evidence_errors');assert.equal(step.busy,false,'replay_busy_success');for(const key of evidenceArrays)assert(Array.isArray(step[key]),'replay_missing_'+key);}
  if(scene.participation==='silent'){
   assert.equal(f.response,null,'replay_silence_response');assert(!step.request&&!step.raw&&!step.decoded&&!step.call,'replay_silence_generation');
   const reason=f.silence;assert(reason?.eventId===f.inputId&&reason.identityId===contextualStageIdentity&&reason.reason==='withholding','replay_silence_reason');assert.equal(reason.eventRevision,f.evidence.revision,'replay_silence_revision');
   assert(reason.sourceRefs.some((ref:RecordValue)=>ref.kind==='event'&&ref.id===f.inputId&&ref.version===f.evidence.revision),'replay_silence_source');assert(f.after.turn.recentSilences.some((s:RecordValue)=>JSON.stringify(s)===JSON.stringify(reason)),'replay_silence_state');
   for(const key of ['segments','observations','dbAcks','sentAcks'] as const)if(step[key]!==undefined)assert.deepEqual(step[key],[],'replay_silence_'+key);
   if(step.packets)assert(!step.packets.some((p:RecordValue)=>['response.start','speech.segment','response.sealed'].includes(p.type)),'replay_silence_packets');
   if(silent){report.status='SILENCE_REPLAYED';report.deliveryEvidenceComplete=true;}else assert(!passed,'replay_silence_not_successful');
   silence=reason;seenInputs.set(f.inputId,step);continue;
  }
  assert(f.response?.id&&f.context?.currentInput?.id===f.inputId,'replay_response_input');
  if(step.request!==undefined){
   assert(step.plan&&step.context,'replay_request_context_missing');assert.deepEqual(step.plan,f.response.plan,'replay_plan_changed');
   const style=step.plan.speechStyle;assert(style?.register===scene.expected.register&&style.positiveTone===scene.expected.positiveTone&&style.discomfortTone===scene.expected.discomfortTone&&style.concealAffect===scene.expected.concealAffect,'replay_expression_plan');assert.equal(stageExpression(step.plan),scene.expected.expression,'replay_expression');
   assert.equal(step.context.currentInput?.id,f.inputId,'replay_actual_input');assert.equal(step.context.currentInput?.payload?.text,scene.text,'replay_actual_input_text');
   const history=conversationSnapshotSchema.parse(step.context.conversation);assert(isConversationSuffix(f.context.conversation,history),'replay_fitted_history');assert.equal(history.sessionId,f.response.sessionId,'replay_history_session');assert.equal(history.cutoffEventId,f.inputId,'replay_history_cutoff');
   for(const turn of history.turns){if(turn.source.kind==='response'){const prior=completed.get(turn.source.id);assert(prior&&prior.scene.group===scene.group,'replay_history_not_completed');assert.equal(turn.text,prior.decoded.join(' '),'replay_history_text');assert.equal(turn.source.generationEpoch,prior.response.generation_epoch,'replay_history_epoch');}else{const prior=seenInputs.get(turn.source.id);assert(prior&&prior.scene.group===scene.group,'replay_history_input_missing');assert.equal(turn.source.revision,prior.fixture.evidence.revision,'replay_history_input_revision');assert.equal(turn.text,prior.scene.text,'replay_history_input_text');}}
   if(previous)assert(history.turns.some(t=>t.source.kind==='response'&&t.source.id===previous!.response.id),'replay_previous_delivery_missing');
   if(scene.expected.disclosure){assert(silence,'replay_previous_silence_missing');assert.deepEqual(step.context.silence,silence,'replay_silence_context');assert.equal(step.plan.reengagement?.silenceEventId,silence.eventId,'replay_silence_link');assert.equal(step.plan.reengagement?.disclosure,'deflect','replay_silence_disclosure');}
   const request=buildDialogueRequest(step.plan,step.context,deepseekCandidate.model,{promptVariant:'conversation-history-v1'}),body=deepseekPayload(request,256);
   assert.deepEqual(step.request,body,'replay_request_changed');assert.equal(step.requestHash,sha(json(body)),'replay_request_hash');
   if(step.raw){
    assert((typeof step.raw.content==='string'||step.raw.content===null)&&typeof step.raw.truncated==='boolean','replay_raw_shape');
    const envelope=step.raw.model===deepseekCandidate.model&&step.raw.finishReason==='stop'&&!step.raw.truncated;
    let decoded:string[]|undefined;if(typeof step.raw.content==='string'){try{decoded=decodeDialogueOutput(request,step.raw.content,step.plan.maxSentences);}catch{report.rawReplay=envelope?'DECODE_REJECTED':'PROVIDER_REJECTED';}}else report.rawReplay='PROVIDER_REJECTED';
    if(step.decoded!==undefined){assert(envelope&&decoded,'replay_decoded_without_valid_raw');assert.deepEqual(step.decoded,decoded,'replay_raw_decoded_mismatch');report.rawReplay='MATCHED';}
    else if(decoded)report.rawReplay=envelope?'VALID_UNDELIVERED':'PROVIDER_REJECTED';
   }else assert(step.decoded===undefined,'replay_decoded_without_raw');
  }else assert(!success&&!step.raw&&!step.decoded,'replay_request_missing');
  if(success){
   assert.equal(report.rawReplay,'MATCHED','replay_success_raw_missing');assert.equal(step.response?.id,f.response.id,'replay_response_id');assert.equal(step.response.generation_epoch,String(f.response.generationEpoch),'replay_response_epoch');assert.deepEqual(step.response.plan,step.plan,'replay_db_plan');
   assertStageEvidence({...step,expectedExpression:scene.expected.expression});
   assert.equal(step.sentAcks.length,step.observations.length,'replay_sent_ack_count');step.sentAcks.forEach((ack:RecordValue,i:number)=>{const o=step.observations[i];assert.equal(ack.type,o.type,'replay_sent_ack_type');assert.equal(ack.requestId,o.requestId,'replay_sent_ack_id');assert.deepEqual(ack.payload,o.payload,'replay_sent_ack_payload');});
   for(const source of step.sources)assert.equal(source.response_id,step.response.id,'replay_source_response');
   assert(step.sources.some((s:RecordValue)=>s.event_id===f.inputId&&s.source_version===f.evidence.revision),'replay_current_source_revision');
   if(!scene.expected.concealAffect)for(const cause of r.seed.causes)assert(step.sources.some((s:RecordValue)=>s.event_id===cause.eventId&&s.source_version===cause.evidence.revision),'replay_cause_source_revision');
   for(const turn of step.context.conversation.turns)assert(step.sources.some((s:RecordValue)=>turn.source.kind==='event'?s.event_id===turn.source.id&&s.source_version===turn.source.revision:s.source_response_id===turn.source.id&&s.source_version===turn.source.generationEpoch),'replay_history_source_revision');
   report.status='DELIVERY_REPLAYED';report.deliveryEvidenceComplete=true;previous=step;completed.set(step.response.id,step);
  }else report.deliveryEvidenceComplete=evidenceArrays.every(key=>Array.isArray(step[key]))&&!!step.response&&typeof step.busy==='boolean'&&!report.evidenceErrors.length;
  seenInputs.set(f.inputId,step);
 }
 const accounting=checkAccounting(input,passed);
 return {status:passed?'VERIFIED_RECORDED_PASS' as const:'STOPPED' as const,recordedStatus:r.status,mode:r.mode as 'mock'|'live',apiCalls:0,originalApiCalls:r.apiCalls??null,transportCalls:r.transportCalls??null,accounting,steps:reports,recordedFailures:structuredClone(r.failures),recordedExecution:{physicalDrained:r.physicalDrained??null,lockReleased:r.lockReleased??null,accountingErrors:structuredClone(r.accountingErrors??[]),cleanupErrors:structuredClone(r.cleanup?.errors??[]),busyAfter:r.cleanup?.busyAfter??null},claims:{scope:'offline evidence consistency only',newGeneration:'NOT_RUN',newDbStageDelivery:'NOT_RUN',koreanQuality:'DEFERRED_CX-SF01',naturalAppraisal:'NOT_TESTED',operationalProviderReplacement:'NOT_TESTED'}};
}

export function parseStageReplayArgs(argv:string[]){
 const {values}=parseArgs({args:argv,strict:true,allowPositionals:false,options:{recorded:{type:'string'},out:{type:'string'}}});
 assert(values.recorded&&values.out,'replay_recorded_and_out_required');const recorded=resolve(values.recorded),out=resolve(values.out);
 assert(/^J:[\\/]ai[\\/]/i.test(out),'replay_artifacts_must_be_in_ai_directory');assert(recorded!==out&&!out.startsWith(recorded+'\\')&&!out.startsWith(recorded+'/'),'replay_output_must_be_separate');return {recorded,out};
}
function containedFile(root:string,path:string){
 const base=realpathSync(root),file=realpathSync(join(base,path)),rel=relative(base,file);assert(rel&&!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..\\')&&!rel.startsWith('../'),'replay_source_outside_root');return file;
}
export function loadContextualStageReplay(recorded:string,repo=resolve(fileURLToPath(new URL('..',import.meta.url)))):ContextualStageReplayInput{
 const read=(name:string)=>JSON.parse(readFileSync(containedFile(recorded,name),'utf8'));
 const manifest=read('manifest.json'),result=read('results.json'),snapshotHashes:Record<string,string>={},currentSourceHashes:Record<string,string>={};
 for(const path of Object.keys(manifest.sourceHashes??{})){
  assert(!isAbsolute(path)&&!path.includes('..')&&!path.includes('\\')&&!path.includes(':'),'replay_source_path');
  snapshotHashes[path]=sha(readFileSync(containedFile(join(recorded,'source'),path)));
 }
 // The current runner owns the source inventory, so deleting a manifest entry cannot hide a changed dependency.
 for(const path of Object.keys(sourceHashes()))currentSourceHashes[path]=sha(readFileSync(containedFile(repo,path)));
 return {manifest,result,...(existsSync(join(recorded,'ledger-before.json'))?{ledgerBefore:read('ledger-before.json')}:{}),snapshotHashes,currentSourceHashes};
}
export function runContextualStageReplay(argv:string[]){
 const o=parseStageReplayArgs(argv);assert(!existsSync(o.out),'replay_evidence_exists');
 const report={...replayContextualStage(loadContextualStageReplay(o.recorded)),replaySourceHash:sha(readFileSync(fileURLToPath(import.meta.url)))};mkdirSync(o.out,{recursive:true});writeFileSync(join(o.out,'replay.json'),json(report),{flag:'wx'});console.log(json(report));return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))runContextualStageReplay(process.argv.slice(2));
