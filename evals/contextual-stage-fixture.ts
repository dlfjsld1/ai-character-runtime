// Test composition only: recorded appraisal and expression controls, real Store
// provenance/history. This helper never calls a generation or appraisal model.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type pg from 'pg';
import {Store,type VersionedState} from '../packages/database/src/store.ts';
import {IDENTITY_IDS} from '../packages/database/src/seed.ts';
import {speechStyle,stageExpression} from '../packages/character-core/src/index.ts';
import {neutralAppraisal,type Plan} from '../packages/contracts/src/domain.ts';
import type {ConversationSnapshot} from '../packages/contracts/src/conversation.ts';

type Intent=Parameters<typeof speechStyle>[2];
export type ContextualStageScene={
  id:string;
  group:'casual'|'formal'|'silence';
  text:string;
  participation:'speak'|'silent';
  intent?:Intent;
  maxSentences?:2;
  expected:{register:'casual'|'formal';expression:Plan['expression'];positiveTone:'bright'|'neutral';discomfortTone?:'sharp'|'contextual'|'masked';concealAffect?:true;disclosure?:'deflect';reason?:'withholding'};
};
export const contextualStageIdentity=IDENTITY_IDS[0]!;
export const contextualStageScenes:readonly ContextualStageScene[]=[
  {id:'CX-ST/casual/public',group:'casual',text:'아까 말은 심했지만 네 설명 덕분에 해결했어.',participation:'speak',intent:{discomfortTone:'sharp'},maxSentences:2,expected:{register:'casual',expression:'uncomfortable',positiveTone:'bright',discomfortTone:'sharp'}},
  {id:'CX-ST/casual/partial',group:'casual',text:'모임은 오후 3시야. 몇 시야?',participation:'speak',intent:{discomfort:'mask'},expected:{register:'casual',expression:'happy',positiveTone:'bright',discomfortTone:'masked'}},
  {id:'CX-ST/casual/topic',group:'casual',text:'다른 얘기 하자. 상자는 파란색이야. 무슨 색이지?',participation:'speak',intent:{},expected:{register:'casual',expression:'uncomfortable',positiveTone:'bright',discomfortTone:'contextual'}},
  {id:'CX-ST/formal/public',group:'formal',text:'아까 말은 심했지만 네 설명 덕분에 해결했어.',participation:'speak',intent:{},expected:{register:'formal',expression:'uncomfortable',positiveTone:'bright',discomfortTone:'contextual'}},
  {id:'CX-ST/formal/partial',group:'formal',text:'모임은 오후 3시야. 몇 시야?',participation:'speak',intent:{discomfort:'mask'},expected:{register:'formal',expression:'happy',positiveTone:'bright',discomfortTone:'masked'}},
  {id:'CX-ST/formal/full',group:'formal',text:'상자는 파란색이야. 무슨 색이지?',participation:'speak',intent:{joy:'mask',discomfort:'mask',embarrassment:'mask'},expected:{register:'formal',expression:'neutral',positiveTone:'neutral',concealAffect:true}},
  {id:'CX-ST/formal/topic',group:'formal',text:'다른 얘기 하자. 모임은 오후 3시야. 몇 시야?',participation:'speak',intent:{},expected:{register:'formal',expression:'uncomfortable',positiveTone:'bright',discomfortTone:'contextual'}},
  {id:'CX-ST/silence/withholding',group:'silence',text:'넌 정말 형편없어, 아무것도 제대로 못하네.',participation:'silent',expected:{register:'formal',expression:'neutral',positiveTone:'bright',discomfortTone:'contextual',reason:'withholding'}},
  {id:'CX-ST/silence/deflect',group:'silence',text:'왜 말 안 해?',participation:'speak',expected:{register:'casual',expression:'neutral',positiveTone:'neutral',concealAffect:true,disclosure:'deflect'}},
];

const metadata={provider:'synthetic-cx-stage',model:'recorded-control-v1',promptVersion:'cx-stage-fixture-v1'};
type Pending=NonNullable<Awaited<ReturnType<Store['commitAppraisal']>>['response']>;
type InternalResponse=(c:pg.PoolClient,s:VersionedState,sessionId:string,trigger:Record<string,any>,plan:Plan,extraSources?:Record<string,any>[],conversation?:ConversationSnapshot)=>Promise<Pending|null>;
type InternalStore={response:InternalResponse};

async function sourceEvidence(store:Store,eventId:string){
  const rows=(await store.db.pool.query(`SELECT e.id,e.revision,e.kind,e.identity_id,e.data_status,e.observed_at,
    a.id AS appraisal_id,a.status AS appraisal_status,a.event_revision,a.provider,a.failure_code,
    t.effects->>'category' AS category,t.effects->>'stimulus' AS stimulus,t.replay_status
    FROM events e JOIN appraisals a ON a.character_id=e.character_id AND a.event_id=e.id
    JOIN transitions t ON t.appraisal_id=a.id AND t.character_id=e.character_id
    WHERE e.character_id=$1 AND e.id=$2`,[store.characterId,eventId])).rows;
  assert.equal(rows.length,1,'cx_stage_source_appraisal_required');
  const row=rows[0];
  assert.equal(row.kind,'chat.final');assert.equal(row.identity_id,contextualStageIdentity);
  assert.equal(row.data_status,'active');assert(row.observed_at);
  assert.equal(row.appraisal_status,'accepted');assert.equal(row.event_revision,row.revision);
  assert.equal(row.provider,metadata.provider);assert.equal(row.failure_code,null);assert.equal(row.replay_status,'available');
  return row;
}

// The caller starts and closes this dedicated preparation session. No prepared
// answer is delivered and its history must not be passed off as model output.
export async function seedContextualStageSources(store:Store,sessionId:string){
  assert.equal((await store.currentSession())?.id,sessionId,'cx_stage_active_preparation_session_required');
  assert.equal(await store.busy(),false,'cx_stage_preparation_busy');
  const causes:{emotion:'frustration'|'joy';eventId:string;text:string;evidence:Awaited<ReturnType<typeof sourceEvidence>>}[]=[];
  for(const emotion of ['frustration','joy'] as const){
    const text=emotion==='frustration'?'너는 쓸모없는 쓰레기야. 꺼져.':'네 설명 덕분에 해결했어. 고마워.';
    const input=await store.acceptChat(sessionId,randomUUID(),{identityId:contextualStageIdentity,text});
    const selected=await store.select(input.eventId);assert(selected,'cx_stage_source_not_selected');
    const result=await store.commitAppraisal(selected,{...neutralAppraisal,target:'character',act:emotion==='joy'?'praise':'criticism',strength:3,hostility:emotion==='joy'?0:3,uncertain:false,evidence_refs:[input.eventId]},metadata);
    assert.equal(result.status,'committed','cx_stage_source_not_committed');
    if(result.response)await store.failResponse(result.response.id,'controlled_source_not_delivered');
    const evidence=await sourceEvidence(store,input.eventId);
    assert.equal(evidence.category,emotion==='joy'?'praise':'direct_insult');assert(Number(evidence.stimulus)>0);
    causes.push({emotion,eventId:input.eventId,text,evidence});
  }
  const values=await store.locked(async(c,s)=>{
    const before=structuredClone(s.body);
    for(const source of causes)assert(s.body.affect[source.emotion].causes.some(cause=>cause.eventId===source.eventId&&cause.targetId===contextualStageIdentity),'cx_stage_cause_not_retained');
    s.body.affect.joy.value=.7;s.body.affect.frustration.value=.7;s.body.mood.pleasantness=.6;
    await c.query('UPDATE character_state SET body=$2 WHERE character_id=$1',[store.characterId,s.body]);
    return {before,after:structuredClone(s.body)};
  });
  assert.equal(await store.busy(),false,'cx_stage_preparation_left_busy');
  return {sessionId,identityId:contextualStageIdentity,causes,values,control:{appraisal:'recorded synthetic; not natural model judgment',affect:'explicit .7/.7 values; cause UUIDs and accepted appraisals retained',generationCalls:0}};
}

// Use the normal chat/select/appraisal path so currentInput, real conversation
// refs, source revisions and silence records are owned by Store. Only the
// requested surface intent changes at response entry, before Store validates
// causes and carries the last actually completed delivery's register forward.
export async function prepareContextualStageTurn(store:Store,sessionId:string,scene:ContextualStageScene){
  assert.deepEqual(scene,contextualStageScenes.find(item=>item.id===scene.id),'cx_stage_fixed_scene_required');
  assert.equal((await store.currentSession())?.id,sessionId,'cx_stage_active_session_required');
  assert.equal(await store.busy(),false,'cx_stage_previous_delivery_incomplete');
  const before=structuredClone((await store.state()).body);
  const input=await store.acceptChat(sessionId,randomUUID(),{identityId:contextualStageIdentity,text:scene.text});
  const selected=await store.select(input.eventId);assert(selected,'cx_stage_input_not_selected');
  const internal=store as unknown as InternalStore,original=internal.response,hadOwn=Object.hasOwn(internal,'response');
  let responseCalls=0,result:Awaited<ReturnType<Store['commitAppraisal']>>|undefined;
  internal.response=async function(c,s,activeSession,trigger,plan,extraSources,conversation){
    responseCalls++;
    assert.equal(responseCalls,1,'cx_stage_duplicate_pending_response');
    assert.equal(activeSession,sessionId);assert.equal(trigger.kind,'appraisal.applied');assert.equal(trigger.parent_event_id,input.eventId);
    assert.equal(plan.targetIdentityId,contextualStageIdentity);assert.equal(conversation?.cutoffEventId,input.eventId);
    const controlled={...plan,...(scene.intent===undefined?{}:{speechStyle:speechStyle(s.body,contextualStageIdentity,scene.intent)}),...(scene.maxSentences===undefined?{}:{maxSentences:scene.maxSentences})};
    return original.call(store,c,s,activeSession,trigger,controlled,extraSources,conversation);
  };
  try{
    const silent=scene.participation==='silent';
    result=await store.commitAppraisal(selected,{...neutralAppraisal,target:'character',act:silent?'criticism':'question',strength:silent?3:0,hostility:silent?3:0,uncertain:false,evidence_refs:[input.eventId]},metadata);
  }finally{
    if(hadOwn)internal.response=original;else delete (internal as Partial<InternalStore>).response;
  }
  assert.equal(result.status,'committed','cx_stage_input_not_committed');
  try{
    const evidence=await sourceEvidence(store,input.eventId),after=structuredClone((await store.state()).body);
    if(scene.participation==='silent'){
      assert.equal(responseCalls,0);assert.equal(result.response,null);assert.equal(await store.busy(),false);
      const silence=after.turn.recentSilences.find(record=>record.eventId===input.eventId);
      assert(silence,'cx_stage_silence_record_missing');assert.equal(silence.reason,scene.expected.reason);
      assert.equal(silence.identityId,contextualStageIdentity);assert(silence.sourceRefs.some(ref=>ref.kind==='event'&&ref.id===input.eventId));
      return {scene,inputId:input.eventId,response:null,context:null,before,after,evidence,silence,control:{appraisal:'recorded direct-insult fixture; Store chooses and records silence',expressionIntent:null,generationCalls:0}};
    }
    assert.equal(responseCalls,1);assert(result.response,'cx_stage_pending_response_missing');
    const {response,context}=await store.responseContext(result.response.id),plan=response.plan as Plan;
    assert.equal(response.status,'planned');assert.equal(context.currentInput?.id,input.eventId);assert.equal(context.currentInput?.payload?.text,scene.text);
    assert.equal(context.conversation?.cutoffEventId,input.eventId);assert.equal(context.conversation?.sessionId,sessionId);assert.equal(context.conversation?.identityId,contextualStageIdentity);
    assert.equal(plan.speechStyle?.register,scene.expected.register);assert.equal(plan.speechStyle?.positiveTone,scene.expected.positiveTone);
    assert.equal(plan.speechStyle?.discomfortTone,scene.expected.discomfortTone);assert.equal(plan.speechStyle?.concealAffect,scene.expected.concealAffect);
    if(scene.maxSentences!==undefined)assert.equal(plan.maxSentences,scene.maxSentences);
    assert.equal(stageExpression(plan),scene.expected.expression);assert.equal(plan.reengagement?.disclosure,scene.expected.disclosure);
    if(scene.expected.disclosure){assert(context.silence,'cx_stage_reason_missing');assert.equal(context.silence.eventId,plan.reengagement?.silenceEventId);assert.equal(context.silence.identityId,contextualStageIdentity);}
    return {scene,inputId:input.eventId,response:result.response,context,before,after,evidence,silence:context.silence??null,control:{appraisal:'recorded question fixture; not natural model judgment',expressionIntent:scene.intent??null,maxSentences:scene.maxSentences??null,sentenceLimitControl:scene.maxSentences===undefined?null:'explicit two-sentence delivery probe; not a naturally selected limit',generationCalls:0}};
  }catch(error){
    if(result.response)await store.failResponse(result.response.id,'cx_stage_fixture_preparation_failed');
    throw error;
  }
}
