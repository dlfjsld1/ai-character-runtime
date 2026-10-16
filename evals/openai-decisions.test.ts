import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {testDatabase,reset,IDENTITY_IDS} from './helpers.ts';
import {Store} from '../packages/database/src/store.ts';
import {decisionFixture} from './decision-fixture.ts';
import {mapDecisionResponse,decisionContextHash,decisionEvidenceVerifier,DECISION_VERSION} from '../packages/adapters/src/openai-conversation.ts';
import {decay} from '../packages/character-core/src/index.ts';
let db:Awaited<ReturnType<typeof testDatabase>>,store:Store,sessionId:string,now:number;
beforeAll(async()=>{db=await testDatabase();});beforeEach(async()=>{now=1700000000000;await reset(db,now);store=new Store(db,undefined,()=>now,decisionEvidenceVerifier);sessionId=randomUUID();await store.startSession(sessionId,randomUUID());});afterAll(async()=>{await db?.close();});
async function prepare(text:string,values:Record<string,string|number>,confidence:Record<string,number>={}){
 const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId:IDENTITY_IDS[0],text}),selected=(await store.select(accepted.eventId))!,v=mapDecisionResponse(decisionFixture(values,confidence),accepted.eventId);
 v.metadata.providerResult={version:4,provider:'openai-decisions',mappingVersion:DECISION_VERSION,eventId:accepted.eventId,identityId:IDENTITY_IDS[0],eventRevision:'1',contextHash:decisionContextHash(selected.conversationContext),payload:v.metadata.providerResult};
 return {accepted,selected,v};
}
async function commit(text:string,values:Record<string,string|number>){const p=await prepare(text,values);return {...p,...await store.commitAppraisal(p.selected,p.v.appraisal,p.v.metadata)};}
const attack=()=>commit('너는 쓸모없는 쓰레기야. 꺼져.',{act:'criticism',strength:3,hostility:3});
it('provider swap in real Store accepts clarification to character about another target; source marker stays one-time',async()=>{
 const blamed=await attack();now+=1000;const before=(await store.state()).body,expected=decay(before,now),clarified=await commit('아까 욕한 건 네가 아니라 영화 속 인물이었어.',{target:'other',conversation_act:'clarify_target',repair_target:'candidate'});
 expect(clarified.response?.plan.purpose).toBe('acknowledge_repair');const after=(await store.state()).body;expect(after.affect.frustration.value).toBeCloseTo(expected.affect.frustration.value-Math.min(.03,.1*expected.affect.frustration.value),12);expect(after.affect.frustration.causes).toEqual(expected.affect.frustration.causes);
 await store.failResponse(clarified.response!.id,'synthetic_no_stage');const again=await commit('아까 욕한 건 네가 아니라 영화 속 인물이었어.',{target:'other',conversation_act:'clarify_target',repair_target:'candidate'});expect(again.selected.conversationContext.repairCandidate?.used).toBe(true);expect((await store.state()).body.affect).toEqual(after.affect);expect((await db.pool.query("SELECT effects FROM transitions WHERE effects->'repairUsed'->>'candidateEventId'=$1",[blamed.accepted.eventId])).rowCount).toBe(1);
});
it('selected source deletion rejects candidate commit with no repair or caption',async()=>{
 const blamed=await attack(),p=await prepare('아까 심하게 말해서 미안해.',{conversation_act:'apology',repair_target:'candidate'});await store.deleteEvent(blamed.accepted.eventId,'1',randomUUID());expect((await store.commitAppraisal(p.selected,p.v.appraisal,p.v.metadata)).status).toBe('stale');expect((await db.pool.query("SELECT 1 FROM transitions WHERE effects ? 'repairUsed'")).rowCount).toBe(0);
});
it('current attack cannot borrow repair intent or erase affect; no candidate cannot repair',async()=>{
 const first=await commit('미안해.',{conversation_act:'apology',repair_target:'candidate'});expect(first.selected.conversationContext.repairCandidate).toBeNull();expect((await db.pool.query("SELECT 1 FROM transitions WHERE effects ? 'repairUsed'")).rowCount).toBe(0);await store.failResponse(first.response!.id,'synthetic_no_stage');await attack();
 const p=await commit('너는 쓰레기야. 미안하다고 해줄게.',{act:'criticism',strength:3,hostility:3,conversation_act:'apology',repair_target:'candidate'});expect(p.response?.plan.purpose).not.toBe('acknowledge_repair');expect((await db.pool.query("SELECT 1 FROM transitions WHERE effects ? 'repairUsed'")).rowCount).toBe(0);
});
it('semantic listen and reason use retained silence, low confidence never grants repair',async()=>{
 const heard=await commit('조언은 나중에 하고 내 얘기를 들어줄래?',{conversation_act:'listen_request'});expect(heard.response).toBeNull();const why=await commit('대꾸하지 않은 까닭이 있어?',{conversation_act:'ask_silence_reason'});expect(why.response?.plan).toMatchObject({purpose:'reengage',reengagement:{silenceEventId:heard.accepted.eventId,disclosure:'explain'}});await store.failResponse(why.response!.id,'synthetic_no_stage');await attack();
 const before=(await store.state()).body,p=await prepare('아까 미안해.',{conversation_act:'apology',repair_target:'candidate'},{addressee:.79});await store.commitAppraisal(p.selected,p.v.appraisal,p.v.metadata);expect((await store.state()).body.affect).toEqual(before.affect);expect((await db.pool.query("SELECT 1 FROM transitions WHERE effects ? 'repairUsed'")).rowCount).toBe(0);
});
