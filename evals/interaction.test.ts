import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {testDatabase,reset,IDENTITY_IDS} from './helpers.ts';
import {Store} from '../packages/database/src/store.ts';
import {interactionFixture,boundInteraction,pressureFixture} from './interaction-fixture.ts';
import {INTERACTION_V5_VERSION,interactionV5EvidenceVerifier} from '../packages/adapters/src/openai-interaction-v5.ts';
import {interactionEvidenceVerifier} from '../packages/adapters/src/openai-interaction.ts';
import {mapInteractionResponse} from '../packages/adapters/src/openai-interaction.ts';
import {decisionContextHash} from '../packages/adapters/src/openai-conversation.ts';
import {INTERACTION_V3_VERSION,interactionV3EvidenceVerifier} from '../packages/adapters/src/openai-interaction-v3.ts';
import {INTERACTION_V4_VERSION,interactionV4EvidenceVerifier} from '../packages/adapters/src/openai-interaction-v4.ts';
import {decay} from '../packages/character-core/src/index.ts';
import {dropOldestExchange} from '../packages/contracts/src/conversation.ts';
let db:Awaited<ReturnType<typeof testDatabase>>,store:Store,sessionId:string,now:number;
beforeAll(async()=>{db=await testDatabase();});beforeEach(async()=>{now=1700000000000;await reset(db,now);store=new Store(db,undefined,()=>now,interactionEvidenceVerifier);sessionId=randomUUID();await store.startSession(sessionId,randomUUID());});afterAll(async()=>{await db?.close();});
async function prepare(text:string,values:Record<string,string|number>={},intensity=[1,0,0,0]){
 const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId:IDENTITY_IDS[0],text}),selected=(await store.select(accepted.eventId))!,v=boundInteraction(interactionFixture(values,intensity),accepted.eventId,selected.conversationContext);
 return {accepted,selected,v};
}
async function input(text:string,values:Record<string,string|number>={},intensity=[1,0,0,0]){const p=await prepare(text,values,intensity);return {...p,...await store.commitAppraisal(p.selected,p.v.appraisal,p.v.metadata)};}
const attack=()=>input('너는 쓸모없는 쓰레기야. 꺼져.',{direct_attack:1},[0,0,.45,.55]);
const apology=()=>input('아까 네가 아니라 영화 속 인물 얘기였어. 오해하게 해서 미안해.',{apology:1,clarify_target:1,repairs_candidate:1});
async function finish(id:string){const clientId=randomUUID(),owner=await store.grantOwner(sessionId,randomUUID(),clientId),g=(await store.generated(id,['합성 응답이야.'],{clientId,outputEpoch:owner.outputEpoch}))!;for(const segment of g.segments){const payload={responseId:id,segmentId:segment.id,generationEpoch:g.response.generation_epoch,outputEpoch:String(owner.outputEpoch)};await store.report(sessionId,randomUUID(),'caption.shown',payload,clientId);await store.report(sessionId,randomUUID(),'caption.finished',payload,clientId);}}
async function repairCount(){return (await db.pool.query("SELECT 1 FROM transitions WHERE effects ? 'repairUsed'")).rowCount;}
async function naturalWithholding(){
 await input('너는 쓸모없는 쓰레기야.',{direct_attack:1},[0,0,0,1]);now+=1000;
 return input('너 정말 무능하네.',{direct_attack:1},[0,0,0,1]);
}
const askReason=(extra:Record<string,string|number>={})=>input('아까 조용했던 이유를 다시 말해줄래?',{ask_silence_reason:1,speech_form:'question',...extra});
async function pressureInput(text:string,values:Record<string,string|number>={},intensity=[1,0,0,0]){
 const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId:IDENTITY_IDS[0],text}),selected=(await store.select(accepted.eventId))!;
 const v=boundInteraction(pressureFixture(values,intensity),accepted.eventId,selected.conversationContext,INTERACTION_V5_VERSION);
 return {...accepted,...await store.commitAppraisal(selected,v.appraisal,v.metadata)};
}
it('pressure: delivered boundary survives Store restart, repetition stays silent, topic shift keeps affect',async()=>{
 store=new Store(db,undefined,()=>now,interactionV5EvidenceVerifier);
 await pressureInput('너는 쓸모없는 쓰레기야.',{direct_attack:1},[0,0,0,1]);
 const before=(await store.state()).body.affect,first=await pressureInput('대답해 대답 안 해?!',{response_pressure:1});
 expect(first.response?.plan).toMatchObject({purpose:'set_boundary',reengagement:{disclosure:'deflect'}});expect((await store.state()).body.affect).toEqual(before);await finish(first.response!.id);
 store=new Store(db,undefined,()=>now,interactionV5EvidenceVerifier);
 const repeat=await pressureInput('당장 대답하라고!',{response_pressure:1});expect(repeat.response).toBeNull();expect((await store.state()).body.turn.recentSilences[0]?.reason).toBe('withholding');
 const topic=await pressureInput('차 하나 추천해줘.',{speech_form:'question'});expect(topic.response?.plan.purpose).toBe('question');expect((await store.state()).body.affect).toEqual(before);
});
it('pressure does not grant repair and deleting its reason cancels a pending boundary',async()=>{
 store=new Store(db,undefined,()=>now,interactionV5EvidenceVerifier);
 const attack=await pressureInput('너는 쓸모없는 쓰레기야.',{direct_attack:1},[0,0,0,1]);
 const before=(await store.state()).body.affect,first=await pressureInput('미안하다고 했잖아. 당장 대답하라고!',{response_pressure:1,apology:1,repairs_candidate:1});
 expect(first.response?.plan.purpose).toBe('set_boundary');expect((await store.state()).body.affect).toEqual(before);expect(await repairCount()).toBe(0);
 await store.deleteEvent(attack.eventId,'1',randomUUID());expect((await db.pool.query('SELECT status FROM response_runs WHERE id=$1',[first.response!.id])).rows[0].status).toBe('cancelled');
});
it('failed boundary is not treated as delivered and does not become a reason for new silence',async()=>{
 store=new Store(db,undefined,()=>now,interactionV5EvidenceVerifier);
 await pressureInput('너는 쓸모없는 쓰레기야.',{direct_attack:1},[0,0,0,1]);
 const first=await pressureInput('대답해 대답 안 해?!',{response_pressure:1});await store.failResponse(first.response!.id,'fixture_provider_failure');
 const next=await pressureInput('당장 대답하라고!',{response_pressure:1});expect(next.response?.plan.purpose).not.toBe('set_boundary');expect(next.response?.plan.reengagement).toBeUndefined();
});
it.each([
 ['둘이 할 보드게임 하나 추천해줘.',.51,[.32,.04,.63,.01]],
 ['따뜻한 차 하나 추천해줘.',.71,[.18,.04,.78,0]],
] as const)('uncertain sentence-form distribution does not force clarification for ordinary input: %s',async(text,confidence,probabilities)=>{
 const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId:IDENTITY_IDS[0],text}),selected=(await store.select(accepted.eventId))!;
 const raw=interactionFixture({speech_form:'statement'}),form=raw.answers[0] as any;
 form.confidence=confidence;form.probabilities.forEach((p:any,i:number)=>p.probability=probabilities[i]);
 const v=boundInteraction(raw,accepted.eventId,selected.conversationContext),before=(await store.state()).body;
 const result=await store.commitAppraisal(selected,v.appraisal,v.metadata);
 expect(result.response?.plan).toMatchObject({purpose:'other',participation:{mode:'speak'}});
 expect((await store.state()).body.affect).toEqual(before.affect);await finish(result.response!.id);
});
it('recent disclosure choice survives cooling and topic shift, then expires without changing affect',async()=>{
 await naturalWithholding();now+=40000;
 const before=(await store.state()).body,first=await askReason();expect((await store.state()).body.affect.frustration.value).toBeLessThan(.2);
 expect(first.response!.plan.reengagement?.disclosure).toBe('partial');expect((await store.state()).body.affect).toEqual(decay(before,now).affect);await finish(first.response!.id);
 const topic=await input('차 하나 추천해줘.',{speech_form:'question'});await finish(topic.response!.id);
 const again=await askReason();expect(again.response!.plan.reengagement?.disclosure).toBe('deflect');await finish(again.response!.id);
 now+=150000;const cooled=await askReason();expect((await store.state()).body.affect.frustration.value).toBeLessThan(.1);expect(cooled.response!.plan.reengagement?.disclosure).toBe('deflect');await finish(cooled.response!.id);
 now+=600001;const expired=await askReason();expect(expired.response!.plan.reengagement?.disclosure).toBe('explain');
});
it.each([true,false])('recent withholding remains explainable and concealable with zero repeat stimulus; initial affect=%s',async initialAffect=>{
 if(initialAffect)await input('너는 쓸모없어.',{direct_attack:1},[0,0,0,1]);
 now+=10000;const hurt=await input('너는 계속 쓸모없어.',{direct_attack:1},[.24,.03,.05,.68]),before=(await store.state()).body;
 expect(before.affect.frustration.value).toBeLessThan(.2);if(!initialAffect)expect(before.affect.frustration.value).toBe(0);
 const first=await askReason();expect(first.response!.plan.reengagement).toMatchObject({silenceEventId:hurt.accepted.eventId,disclosure:'partial'});await finish(first.response!.id);
 const topic=await input('따뜻한 차 하나 추천해줘.',{speech_form:'question'});await finish(topic.response!.id);
 store=new Store(db,undefined,()=>now,interactionEvidenceVerifier);
 const repeat=await askReason();expect(repeat.response!.plan.reengagement?.disclosure).toBe('deflect');expect((await store.state()).body.affect).toEqual(before.affect);await finish(repeat.response!.id);
});
it.each(['outside-history','expired','deleted','failed','apology','unknown-apology','clarification','unknown-clarification'] as const)('zero-affect disclosure authority respects %s in Store',async boundary=>{
 const hurt=await input('너는 쓸모없어.',{direct_attack:1},[.24,.03,.05,.68]);
 const first=await askReason();expect(first.response!.plan.reengagement?.disclosure).toBe('partial');
 if(boundary==='failed')await store.failResponse(first.response!.id,'synthetic_failure');else await finish(first.response!.id);
 if(boundary==='deleted')await store.deleteEvent(hurt.accepted.eventId,'1',randomUUID());
 if(boundary==='expired')now+=600001;
 if(boundary==='outside-history')for(let i=0;i<4;i++){const topic=await input('다른 질문 '+i,{speech_form:'question'});await finish(topic.response!.id);}
 const repeat=await askReason(boundary==='apology'?{apology:1}:boundary==='unknown-apology'?{apology:.5}:boundary==='clarification'?{clarify_target:1}:boundary==='unknown-clarification'?{clarify_target:.5}:{});
 expect(repeat.response!.plan.reengagement?.disclosure).toBe(['failed','deleted'].includes(boundary)?'unknown':['expired','outside-history'].includes(boundary)?'explain':'partial');expect((await store.state()).body.affect.frustration.value).toBe(0);
});
it('zero new stimulus preserves same-person affect provenance for later disclosure without adding affect',async()=>{
 const prior=await naturalWithholding(),before=(await store.state()).body;now+=1000;
 const latest=await input('너는 계속 쓸모없어.',{direct_attack:1},[.24,.03,.05,.68]);
 const after=(await store.state()).body,record=after.turn.recentSilences[0]!;
 expect(after.affect).toEqual(decay(before,now).affect);expect(after.affect.frustration.causes.some(c=>c.eventId===latest.accepted.eventId)).toBe(false);
 expect(record.eventId).toBe(latest.accepted.eventId);expect(record.sourceRefs.some(r=>r.kind==='event'&&r.id===prior.accepted.eventId)).toBe(true);
 const first=await askReason();expect(first.response!.plan.reengagement?.disclosure).toBe('partial');await finish(first.response!.id);
 const topic=await input('다른 얘기 하자.',{speech_form:'statement'});await finish(topic.response!.id);
 const again=await askReason();expect(again.response!.plan.reengagement).toMatchObject({silenceEventId:latest.accepted.eventId,disclosure:'deflect'});
 let fitted=(await store.responseContext(again.response!.id)).context.conversation!;while(fitted.turns.length)fitted=dropOldestExchange(fitted);
 expect(await store.fitResponseConversation(again.response!.id,fitted)).toBeTruthy();await store.deleteEvent(prior.accepted.eventId,'1',randomUUID());
 expect((await store.state()).body.turn.recentSilences.some(s=>s.eventId===latest.accepted.eventId)).toBe(false);
 const clientId=randomUUID(),owner=await store.grantOwner(sessionId,randomUUID(),clientId);
 expect(await store.generated(again.response!.id,['더 설명하고 싶지 않아.'],{clientId,outputEpoch:owner.outputEpoch})).toBeNull();expect(await store.busy()).toBe(false);
});
it('withholding does not adopt affect causes belonging to another speaker',async()=>{
 await naturalWithholding();const old=(await store.state()).body.affect.frustration.causes.map(c=>c.eventId);
 const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId:IDENTITY_IDS[1],text:'너는 쓸모없어.'}),selected=(await store.select(accepted.eventId))!;
 const value=boundInteraction(interactionFixture({direct_attack:1},[.24,.03,.05,.68]),accepted.eventId,selected.conversationContext);
 await store.commitAppraisal(selected,value.appraisal,value.metadata);
 const record=(await store.state()).body.turn.recentSilences.find(s=>s.identityId===IDENTITY_IDS[1])!;
 expect(record.sourceRefs.some(r=>old.includes(r.id))).toBe(false);
});
it('listening records do not acquire unrelated affect dependencies',async()=>{
 const prior=await naturalWithholding(),listening=await input('지금은 들어만 줘.',{listen_request:1});
 const record=(await store.state()).body.turn.recentSilences[0]!;
 expect(record.reason).toBe('listening');expect(record.sourceRefs.some(r=>r.id===prior.accepted.eventId)).toBe(false);
 // The model did see the previous silence in its validated context. Removing
 // that input still invalidates its appraisal through that existing dependency,
 // even though it was not added as an affect source to the listening record.
 expect(listening.selected.conversationContext.silence?.eventId).toBe(prior.accepted.eventId);
 await store.deleteEvent(prior.accepted.eventId,'1',randomUUID());
 expect((await store.state()).body.turn.recentSilences.some(s=>s.eventId===record.eventId)).toBe(false);
});
it('natural repeated reason after delivered explanation and topic shift can deflect without affect reset',async()=>{
 const hurt=await naturalWithholding(),first=await askReason();expect(first.response!.plan.reengagement).toMatchObject({silenceEventId:hurt.accepted.eventId,disclosure:'partial'});await finish(first.response!.id);
 const topic=await input('집에서 할 취미 하나 추천해줘.',{speech_form:'question'});await finish(topic.response!.id);const before=(await store.state()).body;now+=1000;
 const again=await askReason();expect(again.response!.plan.reengagement).toMatchObject({silenceEventId:hurt.accepted.eventId,disclosure:'deflect'});
 expect(again.selected.conversation.turns.some(t=>t.source.kind==='response'&&t.source.id===first.response!.id)).toBe(true);
 expect((await store.state()).body.affect).toEqual(decay(before,now).affect);expect((await store.responseContext(again.response!.id)).context.silence?.eventId).toBe(hurt.accepted.eventId);
 await finish(again.response!.id);expect(await store.busy()).toBe(false);
});
it.each(['undelivered','deleted-explanation','deleted-reason','new-reason','outside-history','apology','clarification'] as const)('prior explanation does not grant new concealment authority after %s',async boundary=>{
 const hurt=await naturalWithholding(),first=await askReason();
 if(boundary==='undelivered')await store.failResponse(first.response!.id,'synthetic_failure');else await finish(first.response!.id);
 if(boundary==='deleted-explanation')await store.deleteEvent(first.accepted.eventId,'1',randomUUID());
 if(boundary==='deleted-reason')await store.deleteEvent(hurt.accepted.eventId,'1',randomUUID());
 if(boundary==='new-reason')await input('너 정말 쓸모없네.',{direct_attack:1},[0,0,0,1]);
 if(boundary==='outside-history')for(let i=0;i<4;i++){const p=await input('다른 주제 질문 '+i,{speech_form:'question'});await finish(p.response!.id);}
 const again=await askReason(boundary==='apology'?{apology:1}:boundary==='clarification'?{clarify_target:1}:{});
 expect(again.response!.plan.reengagement?.disclosure).not.toBe('deflect');
 if(boundary==='deleted-reason'||boundary==='undelivered')expect(again.response!.plan.reengagement?.disclosure).toBe('unknown');
});
it('deleting the delivered explanation invalidates a pending deflection even after history fitting',async()=>{
 await naturalWithholding();const first=await askReason();await finish(first.response!.id);const again=await askReason();expect(again.response!.plan.reengagement?.disclosure).toBe('deflect');
 let fitted=(await store.responseContext(again.response!.id)).context.conversation!;while(fitted.turns.length)fitted=dropOldestExchange(fitted);
 expect(await store.fitResponseConversation(again.response!.id,fitted)).toBeTruthy();await store.deleteEvent(first.accepted.eventId,'1',randomUUID());
 const clientId=randomUUID(),owner=await store.grantOwner(sessionId,randomUUID(),clientId);expect(await store.generated(again.response!.id,['지금은 더 말하고 싶지 않아.'],{clientId,outputEpoch:owner.outputEpoch})).toBeNull();expect(await store.busy()).toBe(false);
});
it('v4 small praise keeps silence, relationship exclusion, repetition, deletion and recovery boundaries',async()=>{
 store=new Store(db,undefined,()=>now,interactionV4EvidenceVerifier);
 async function praise(){
  const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId:IDENTITY_IDS[0],text:'정말 잘했어. 지금은 답하지 말고 들어줘.'}),selected=(await store.select(accepted.eventId))!;
  const raw=interactionFixture({direct_praise:1,listen_request:1},[.15,.06,.07,.72]),v=mapInteractionResponse(raw,accepted.eventId,0,INTERACTION_V4_VERSION);
  v.metadata.providerResult={version:4,provider:'openai-decisions',mappingVersion:INTERACTION_V4_VERSION,eventId:accepted.eventId,identityId:IDENTITY_IDS[0],eventRevision:String(selected.revision),contextHash:decisionContextHash(selected.conversationContext),payload:{raw}};
  return {accepted,...await store.commitAppraisal(selected,v.appraisal,v.metadata)};
 }
 const first=await praise(),before=(await store.state()).body;expect(first.response).toBeNull();expect(before.affect.joy.value).toBe(.06);expect(before.turn.recentSilences[0].reason).toBe('listening');
 now+=1000;const second=await praise(),after=(await store.state()).body;expect(second.response).toBeNull();expect(after.affect.joy.value).toBeGreaterThan(.06);expect(after.affect.joy.value).toBeLessThan(.12);expect(after.affect.joy.holdUntil).toBe(before.affect.joy.holdUntil);
 const effects=(await db.pool.query("SELECT effects->'affectEvidence' AS evidence FROM transitions WHERE effects ? 'affectEvidence'")).rows;expect(effects).toHaveLength(2);expect(effects.every(r=>r.evidence.basis==='confirmed_event_baseline')).toBe(true);
 expect((await db.pool.query('SELECT affinity FROM relationships WHERE identity_id=$1',[IDENTITY_IDS[0]])).rows[0].affinity).toBe(.5);
 await store.deleteEvent(first.accepted.eventId,'1',randomUUID());expect((await store.state()).body.affect.joy.causes.some(c=>c.eventId===first.accepted.eventId)).toBe(false);expect((await store.state()).body.affect.joy.value).toBe(after.affect.joy.value);
 await store.recover();store=new Store(db,undefined,()=>now,interactionV4EvidenceVerifier);expect((await store.state()).body.affect.joy.value).toBe(after.affect.joy.value);expect(await store.busy()).toBe(false);
});
it('attack -> topic shift keeps affect -> simultaneous repair applies only once, with caption protocol delivery',async()=>{
 const blamed=await attack();expect(blamed.response).toBeNull();const upset=(await store.state()).body;expect(upset.affect.frustration.value).toBeCloseTo(.12);expect(upset.turn.recentSilences[0].reason).toBe('withholding');
 now+=1000;const next=await input('이제 점심 메뉴 얘기하자.');expect(next.response?.plan.purpose).toBe('other');expect((await store.state()).body.affect).toEqual(decay(upset,now).affect);await finish(next.response!.id);
 const before=(await store.state()).body,relationships=(await db.pool.query('SELECT identity_id,affinity,familiarity FROM relationships ORDER BY identity_id')).rows;now+=1000;const fixed=await apology(),expected=decay(before,now),after=(await store.state()).body,amount=Math.min(.03,expected.affect.frustration.value*.1);
 expect(fixed.response?.plan.purpose).toBe('acknowledge_repair');expect(after.affect.frustration.value).toBeCloseTo(expected.affect.frustration.value-amount,12);expect(after.affect.frustration.value).toBeGreaterThan(0);expect(after.affect.frustration.causes).toEqual(expected.affect.frustration.causes);expect(after.affect.frustration.holdUntil).toBe(expected.affect.frustration.holdUntil);for(const key of ['joy','surprise','embarrassment'] as const)expect(after.affect[key]).toEqual(expected.affect[key]);expect((await db.pool.query('SELECT identity_id,affinity,familiarity FROM relationships ORDER BY identity_id')).rows).toEqual(relationships);
 await finish(fixed.response!.id);const again=await apology();expect(again.selected.conversationContext.repairCandidate?.used).toBe(true);expect((await store.state()).body.affect).toEqual(after.affect);expect(await repairCount()).toBe(1);
});
it.each(['apology','cause'])('deletion of %s preserves one-time marker across recovery',async removed=>{
 const blamed=await attack(),fixed=await apology();await finish(fixed.response!.id);await store.deleteEvent(removed==='apology'?fixed.accepted.eventId:blamed.accepted.eventId,'1',randomUUID());
 const marker=(await db.pool.query("SELECT effects FROM transitions WHERE effects ? 'repairUsed'")).rows;expect(marker).toHaveLength(1);expect(marker[0].effects).toEqual({repairUsed:{candidateEventId:blamed.accepted.eventId,candidateRevision:'1'}});
 await store.recover();store=new Store(db,undefined,()=>now,interactionEvidenceVerifier);sessionId=randomUUID();await store.startSession(sessionId,randomUUID());const before=(await store.state()).body,again=await apology();expect(again.selected.conversationContext.repairCandidate).toBeNull();expect((await store.state()).body.affect).toEqual(before.affect);expect(await repairCount()).toBe(1);
});
it('deleting a selected source rejects stale commit, without caption or repair',async()=>{
 const blamed=await attack(),p=await prepare('아까 미안해.',{apology:1,repairs_candidate:1});await store.deleteEvent(blamed.accepted.eventId,'1',randomUUID());expect((await store.commitAppraisal(p.selected,p.v.appraisal,p.v.metadata)).status).toBe('stale');expect(await repairCount()).toBe(0);
});
it.each(['attack','listen','uncertain_attack','reason'])('%s blocks repair even when intensity adds no emotion',async kind=>{
 await attack();const before=(await store.state()).body,values={apology:1,repairs_candidate:1,...(kind==='attack'?{direct_attack:1}:kind==='listen'?{listen_request:1}:kind==='reason'?{ask_silence_reason:1}:{direct_attack:.5})};
 const r=await input('복합 행위 경계 합성 입력',values,[.5,0,0,.5]);expect((await store.state()).body.affect).toEqual(before.affect);expect(await repairCount()).toBe(0);
 expect(r.response?.plan.purpose??'silent').toBe(kind==='reason'?'reengage':kind==='uncertain_attack'?'clarify':'silent');
});
it('reported speech responds, intentional listening retains reason, reason explanation does not imply recovery',async()=>{
 await attack();const before=(await store.state()).body,ordinary=await input('민수가 친구한테 왜 말 안 하냐고 물었대.');expect(ordinary.response?.plan.purpose).toBe('other');await finish(ordinary.response!.id);
 const heard=await input('답하지 말고 들어줘.',{listen_request:1});expect(heard.response).toBeNull();const why=await input('말하지 않은 까닭이 있어?',{ask_silence_reason:1,speech_form:'question'});expect(why.response?.plan).toMatchObject({purpose:'reengage',reengagement:{silenceEventId:heard.accepted.eventId,disclosure:'explain'}});expect((await store.state()).body.affect).toEqual(before.affect);
});
it.each(['hash','forged_appraisal','provider_failure','failure_and_forged_appraisal'])('%s is technical defer, never an invented intentional silence',async kind=>{
 const p=await prepare('안녕.',{speech_form:'greeting'});
 if(kind==='hash')p.v.metadata.providerResult!.contextHash='0'.repeat(64);
 if(kind==='forged_appraisal'||kind==='failure_and_forged_appraisal')p.v.appraisal={...p.v.appraisal,target:'character',act:'criticism',strength:3,hostility:3,uncertain:false};
 if(kind==='provider_failure'||kind==='failure_and_forged_appraisal')p.v.metadata.failureCode='synthetic_timeout';
 const result=await store.commitAppraisal(p.selected,p.v.appraisal,p.v.metadata);expect(result.response).toBeNull();const state=(await store.state()).body;expect(state.turn.recentSilences).toHaveLength(0);expect(state.affect.frustration.value).toBe(0);expect(await repairCount()).toBe(0);
 const effects=(await db.pool.query("SELECT effects FROM transitions WHERE appraisal_id IS NOT NULL ORDER BY state_version DESC LIMIT 1")).rows[0].effects;expect(effects.participation).toEqual({mode:'defer'});
});
it('repeated praise keeps no-addition reason after a successful delivered acknowledgement',async()=>{
 const first=await input('잘했어.',{direct_praise:1},[0,0,1,0]);await finish(first.response!.id);const repeat=await input('잘했어.',{direct_praise:1},[0,0,1,0]);expect(repeat.response).toBeNull();expect((await store.state()).body.turn.recentSilences[0].reason).toBe('no_addition');
});
it('v3 evidence reaches the real Store for attack and one limited repair',async()=>{
 store=new Store(db,undefined,()=>now,interactionV3EvidenceVerifier);
 const send=async(text:string,values:Record<string,string|number>,intensity=[1,0,0,0])=>{
  const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId:IDENTITY_IDS[0],text}),selected=(await store.select(accepted.eventId))!,raw=interactionFixture(values,intensity),v=mapInteractionResponse(raw,accepted.eventId,0,INTERACTION_V3_VERSION);
  v.metadata.providerResult={version:4,provider:'openai-decisions',mappingVersion:INTERACTION_V3_VERSION,eventId:accepted.eventId,identityId:IDENTITY_IDS[0],eventRevision:'1',contextHash:decisionContextHash(selected.conversationContext),payload:v.metadata.providerResult};
  return store.commitAppraisal(selected,v.appraisal,v.metadata);
 };
 const first=await send('너는 쓸모없는 쓰레기야. 꺼져.',{direct_attack:1},[0,0,1,0]);expect(first.response).toBeNull();
 const hurt=(await store.state()).body.affect.frustration.value;expect(hurt).toBeCloseTo(.12);
 now+=1000;const second=await send('아까 너한테 쓰레기라고 한 건 잘못했어. 미안해.',{apology:1,repairs_candidate:1});
 expect(second.response?.plan.purpose).toBe('acknowledge_repair');expect((await store.state()).body.affect.frustration.value).toBeLessThan(hurt);expect(await repairCount()).toBe(1);
});
