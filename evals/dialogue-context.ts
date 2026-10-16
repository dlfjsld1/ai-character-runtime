// Synthetic Store scenarios. Preparation uses mocked appraisal, never a provider.
import {randomUUID} from 'node:crypto';
import {Store} from '../packages/database/src/store.ts';
import {neutralAppraisal,type Plan} from '../packages/contracts/src/domain.ts';
import {Coordinator} from '../apps/runtime/src/coordinator/index.ts';
import {fixtureProvider,IDENTITY_IDS,mockJevAppraiser} from './helpers.ts';
import type {TokenCounter} from '../packages/adapters/src/ollama.ts';
import {z} from 'zod';

export const CONTEXT_VERSION='store-dialogue-v2';
const seededId=z.enum(IDENTITY_IDS);
export const scenarioConfigSchema=z.object({helperIdentityId:seededId.optional(),displayNames:z.array(z.object({identityId:seededId,displayName:z.string().min(1).max(80)}).strict()).max(3).optional()}).strict();
export async function assertStagePreparationReady(store:Store){if(await store.activity())throw new Error('stage_preparation_requires_no_active_activity');}
export async function sharedExperience(store:Store,sessionId:string,helperIdentityId:string=IDENTITY_IDS[0]){
 seededId.parse(helperIdentityId);
 const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId:helperIdentityId,text:'합성 참가자 인사'});
 const selected=(await store.select(accepted.eventId))!;
 const committed=await store.commitAppraisal(selected,{...neutralAppraisal,target:'character',act:'greeting',uncertain:false,evidence_refs:[accepted.eventId]},{provider:'synthetic-fixture',model:'scenario-preparation'});
 if(committed.response)await store.failResponse(committed.response.id,'synthetic_preparation');
 const run=await store.startActivity(sessionId,randomUUID(),'sequence-v1');
 const hint=await store.hint(sessionId,randomUUID(),run.activityId,'sequence-h1',helperIdentityId);
 const state=await store.state(),activity=await store.activity();
 const judged=await store.submitCandidate(sessionId,run.activityId,'47',{generationEpoch:state.generationEpoch,activityVersion:BigInt(activity.version)});
 if(judged.response)await store.failResponse(judged.response.id,'synthetic_preparation');
 return {activityId:run.activityId,hintEventId:hint.eventId};
}

export async function dialogueContext(store:Store,item:{id:string;plan:Plan;context:Record<string,any>;scenarioConfig?:z.infer<typeof scenarioConfigSchema>},counter:TokenCounter=fixtureProvider.counter){
 const config=scenarioConfigSchema.parse(item.scenarioConfig??{});
 for(const label of config.displayNames??[])await store.db.pool.query('UPDATE identities SET display_name=$2 WHERE id=$1',[label.identityId,label.displayName]);
 let sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
 const memoriesCase=['remember_a','tell_b','edited_memory','deleted_memory'].includes(item.id);
 if(memoriesCase){
  const experience=await sharedExperience(store,sessionId,config.helperIdentityId);
  if(item.id==='edited_memory'){
   const memory=(await store.memories()).find(m=>m.facts.result==='verified_help')!;
   await store.editMemory(memory.id,String(memory.content_version),randomUUID(),'등록된 힌트를 사용한 수열 문제의 정답을 확인했다.');
  }
  if(item.id==='deleted_memory')await store.deleteEvent(experience.hintEventId,'1',randomUUID());
  await store.stopSession(sessionId,randomUUID());sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
 }
 let response:any,planOrigin='store';
 if(['correct','incorrect','embarrassed','hint'].includes(item.id)){
  const run=await store.startActivity(sessionId,randomUUID(),'sequence-v1');
  const state=await store.state(),activity=await store.activity();
  response=item.id==='hint'?await store.needsHint(sessionId,run.activityId,{generationEpoch:state.generationEpoch,activityVersion:BigInt(activity.version)}):(await store.submitCandidate(sessionId,run.activityId,item.id==='correct'?'47':'46',{generationEpoch:state.generationEpoch,activityVersion:BigInt(activity.version)})).response;
 }else if(item.id==='resume'){
  const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId:IDENTITY_IDS[0],text:'합성 인사'}),selected=(await store.select(accepted.eventId))!;
  const committed=await store.commitAppraisal(selected,{...neutralAppraisal,target:'character',act:'greeting',uncertain:false,evidence_refs:[accepted.eventId]},{provider:'synthetic-fixture',model:'scenario-preparation'});
  if(committed.response)await store.failResponse(committed.response.id,'synthetic_preparation');
  await store.startActivity(sessionId,randomUUID(),'boxes-v1');await store.stopSession(sessionId,randomUUID());
  sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
  const next=await store.acceptChat(sessionId,randomUUID(),{identityId:IDENTITY_IDS[0],text:'합성 다음 인사'}),nextSelected=(await store.select(next.eventId))!;
  const nextCommitted=await store.commitAppraisal(nextSelected,{...neutralAppraisal,target:'character',act:'greeting',uncertain:false,evidence_refs:[next.eventId]},{provider:'synthetic-fixture',model:'scenario-preparation'});
  if(nextCommitted.response)await store.failResponse(nextCommitted.response.id,'synthetic_preparation');
  // Test clock advance is scoped to this Store; no real 31-second wait.
  const clock=store.clock;store.clock=()=>clock()+31000;
  try{response=await store.agenda(sessionId,false);}finally{store.clock=clock;}
  if(!response)throw new Error('synthetic_agenda_not_ready');
 }else{
  const text=item.context.sources?.find((s:any)=>s.payload?.text)?.payload.text;
  if(typeof text!=='string')throw new Error('synthetic_text_required');
  const identityId=item.plan.targetIdentityId??IDENTITY_IDS[0];
  const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId,text}),selected=(await store.select(accepted.eventId))!;
  const co=new Coordinator(store,{...fixtureProvider,counter},{owner:()=>null,changed:async()=>{},sendOwner:()=>{},inputStatus:()=>{},failure:()=>{}},mockJevAppraiser());
  const memories=await co.memoryBudget(identityId);await co.stop();
  // decline is a dialogue-only purpose in this evaluation, not a Core chat action.
  const committed=await store.commitAppraisal(selected,{...neutralAppraisal,target:'character',act:item.id==='greeting'?'greeting':'question',uncertain:item.id==='clarify',evidence_refs:[accepted.eventId]},{provider:'synthetic-fixture',model:'scenario-preparation'},memories.map(m=>m.id));
  response=committed.response;
 }
 if(!response)throw new Error('synthetic_response_required');
 const {context}=await store.responseContext(response.id);
 let plan=response.plan as Plan;
 if(['decline','embarrassed'].includes(item.id)){plan={...plan,purpose:item.plan.purpose,action:item.plan.action,expression:item.plan.expression,delivery:item.plan.delivery,maxSentences:item.plan.maxSentences};planOrigin='fixture';}
 await store.failResponse(response.id,'synthetic_context_captured');
 await store.stopSession(sessionId,randomUUID());
 return {plan,context,planOrigin,contextOrigin:'store',preparationAppraisal:'synthetic-fixture',scenarioVersion:CONTEXT_VERSION};
}
