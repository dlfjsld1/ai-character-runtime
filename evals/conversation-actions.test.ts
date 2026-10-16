import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {testDatabase,reset,IDENTITY_IDS} from './helpers.ts';
import {Store} from '../packages/database/src/store.ts';
import {JevConversationCandidate} from '../packages/adapters/src/jev.ts';
import {jevEvidenceVerifier} from '../packages/adapters/src/appraisal-evidence.ts';
import {recordedJevResponse} from './jev-fixture.ts';
import {decay} from '../packages/character-core/src/index.ts';
let db:Awaited<ReturnType<typeof testDatabase>>,store:Store,now:number,sessionId:string;
beforeAll(async()=>{db=await testDatabase();});beforeEach(async()=>{now=1700000000000;await reset(db,now);store=new Store(db,undefined,()=>now,jevEvidenceVerifier);sessionId=randomUUID();await store.startSession(sessionId,randomUUID());});afterAll(async()=>{await db?.close();});
const choice=(value:string,keys:string[],confidence=.95)=>({type:'choice',choice:value,confidence,probabilities:Object.fromEntries(keys.map(k=>[k,k===value?1:0]))});
async function input(text:string,conversationAct='ordinary',repairTarget='unknown',base=recordedJevResponse(),identityId=IDENTITY_IDS[0]){
 const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId,text}),selected=(await store.select(accepted.eventId))!;
 const raw={...base,answers:{...base.answers,conversation_act:choice(conversationAct,['ordinary','ask_silence_reason','listen_request','apology','clarify_target','unknown']),repair_target:choice(repairTarget,['candidate','other','unknown'])}};
 const provider=new JevConversationCandidate({localOnly:false,allowPaidProviders:true,apiKey:'fixture'},async()=>Response.json(raw));
 const evaluated=await provider.evaluate({id:accepted.eventId,identityId,revision:'1',text},{conversation:selected.conversation,conversationContext:selected.conversationContext});
 return {accepted,selected,evaluated,...await store.commitAppraisal(selected,evaluated.appraisal,evaluated.metadata)};
}
async function attack(identityId=IDENTITY_IDS[0]){return input('너는 쓸모없는 쓰레기야. 꺼져.','ordinary','unknown',recordedJevResponse('criticism','character',3,3),identityId);}
async function complete(id:string){const clientId=randomUUID(),owner=await store.grantOwner(sessionId,randomUUID(),clientId),generated=(await store.generated(id,['합성 응답이야.'],{clientId,outputEpoch:owner.outputEpoch}))!;for(const segment of generated.segments){const payload={responseId:id,segmentId:segment.id,generationEpoch:generated.response.generation_epoch,outputEpoch:String(owner.outputEpoch)};await store.report(sessionId,randomUUID(),'caption.shown',payload,clientId);await store.report(sessionId,randomUUID(),'caption.finished',payload,clientId);}}
it('CR07 semantic listening and reason question bypass regex while preserving emotion and reasons',async()=>{
 const heard=await input('조언은 나중에 하고 지금은 내 얘기만 들어줄래?','listen_request');expect(heard.response).toBeNull();expect((await store.state()).body.turn.recentSilences[0].reason).toBe('listening');
 const raw=recordedJevResponse();raw.answers.strength.confidence=.1;const before=await store.state();now+=1000;
 const why=await input('내 말에 대꾸하지 않은 까닭이 있어?','ask_silence_reason','unknown',raw);expect(why.response?.plan).toMatchObject({purpose:'reengage',reengagement:{silenceEventId:heard.accepted.eventId,disclosure:'explain'}});expect((await store.state()).body.affect).toEqual(decay(before.body,now).affect);
});
it('CR09 exact one-time bounded recovery preserves hold, causes, other affects and relationships',async()=>{
 await attack();now+=1000;const latest=await attack(),before=await store.state(),relationships=(await db.pool.query('SELECT * FROM relationships ORDER BY identity_id')).rows;
 now+=1000;const repaired=await input('아까 너한테 심하게 말해서 미안해. 그 말은 취소할게.','apology','candidate',recordedJevResponse('other'));
 expect(repaired.response?.plan.purpose).toBe('acknowledge_repair');const after=(await store.state()).body,expected=decay(before.body,now),amount=Math.min(.03,expected.affect.frustration.value*.1);
 expect(after.affect.frustration.value).toBeCloseTo(expected.affect.frustration.value-amount,12);expect(after.affect.frustration.value).toBeGreaterThan(0);expect(after.mood.pleasantness).toBeCloseTo(expected.mood.pleasantness+.1*amount,12);expect(after.affect.frustration.causes).toEqual(expected.affect.frustration.causes);expect(after.affect.frustration.holdUntil).toBe(expected.affect.frustration.holdUntil);
 for(const key of ['joy','surprise','embarrassment'] as const)expect(after.affect[key]).toEqual(expected.affect[key]);expect((await db.pool.query('SELECT * FROM relationships ORDER BY identity_id')).rows.map(r=>[r.identity_id,r.affinity,r.familiarity])).toEqual(relationships.map(r=>[r.identity_id,r.affinity,r.familiarity]));
 await complete(repaired.response!.id);const repeated=await input('아까 한 말은 정말 미안해.','apology','candidate',recordedJevResponse('other'));expect(repeated.selected.conversationContext.repairCandidate?.used).toBe(true);expect((await store.state()).body.affect).toEqual(after.affect);expect((await db.pool.query("SELECT effects FROM transitions WHERE effects->'repairUsed'->>'candidateEventId'=$1",[latest.accepted.eventId])).rows).toHaveLength(1);
});
it.each(['apology','candidate'] as const)('CR09 deleting %s evidence preserves a text-free consumed marker',async deletion=>{
 const blamed=await attack();const apology=await input('아까 심하게 말해서 미안해.','apology','candidate',recordedJevResponse('other'));await complete(apology.response!.id);
 await store.deleteEvent(deletion==='apology'?apology.accepted.eventId:blamed.accepted.eventId,'1',randomUUID());
 expect((await db.pool.query('SELECT plan FROM response_runs WHERE id=$1',[apology.response!.id])).rows[0].plan).toBeNull();expect((await db.pool.query('SELECT text FROM speech_segments WHERE response_id=$1',[apology.response!.id])).rows.every(r=>r.text===null)).toBe(true);
 const markers=(await db.pool.query("SELECT effects FROM transitions WHERE effects->'repairUsed'->>'candidateEventId'=$1",[blamed.accepted.eventId])).rows;expect(markers).toHaveLength(1);expect(markers[0].effects).toEqual({repairUsed:{candidateEventId:blamed.accepted.eventId,candidateRevision:'1'}});
 store=new Store(db,undefined,()=>now,jevEvidenceVerifier);const before=(await store.state()).body;const repeated=await input('아까 그 말은 미안했어.','apology','candidate',recordedJevResponse('other'));
 expect((await store.state()).body.affect).toEqual(before.affect);expect(repeated.selected.conversationContext.repairCandidate?.used??true).toBe(true);
});
it('CR09 different-person causes and expired/absent candidates cannot reduce frustration',async()=>{
 await attack(IDENTITY_IDS[1]);await attack(IDENTITY_IDS[0]);const before=(await store.state()).body;
 const apology=await input('아까 내가 심하게 말해서 미안해.','apology','candidate',recordedJevResponse('other'));expect((await store.state()).body.affect).toEqual(before.affect);await complete(apology.response!.id);
 now+=600001;const decayed=decay((await store.state()).body,now),expired=await input('아까 그 말 미안해.','apology','candidate',recordedJevResponse('other'));expect(expired.selected.conversationContext.repairCandidate).toBeNull();expect((await store.state()).body.affect).toEqual(decayed.affect);
});
it('CR07 selected candidate deletion/altered snapshot prevents stale semantic commit',async()=>{
 const blamed=await attack(),accepted=await store.acceptChat(sessionId,randomUUID(),{identityId:IDENTITY_IDS[0],text:'아까 심하게 말해서 미안해.'}),selected=(await store.select(accepted.eventId))!;
 const provider=new JevConversationCandidate({localOnly:false,allowPaidProviders:true,apiKey:'fixture'},async()=>Response.json({...recordedJevResponse('other'),answers:{...recordedJevResponse('other').answers,conversation_act:choice('apology',['ordinary','ask_silence_reason','listen_request','apology','clarify_target','unknown']),repair_target:choice('candidate',['candidate','other','unknown'])}}));const evaluated=await provider.evaluate({id:accepted.eventId,identityId:IDENTITY_IDS[0],revision:'1',text:'아까 심하게 말해서 미안해.'},{conversation:selected.conversation,conversationContext:selected.conversationContext});
 await store.deleteEvent(blamed.accepted.eventId,'1',randomUUID());expect((await store.commitAppraisal(selected,evaluated.appraisal,evaluated.metadata)).status).toBe('stale');expect((await db.pool.query("SELECT 1 FROM transitions WHERE effects ? 'repairUsed'")).rowCount).toBe(0);
});
it('CR09 real runtime recovery preserves consumed markers; new session does not reuse old candidates',async()=>{
 const blamed=await attack(),apology=await input('아까 심하게 말해서 미안해.','apology','candidate',recordedJevResponse('other'));await complete(apology.response!.id);await store.recover();
 store=new Store(db,undefined,()=>now,jevEvidenceVerifier);sessionId=randomUUID();await store.startSession(sessionId,randomUUID());const before=(await store.state()).body;
 const repeated=await input('아까 심하게 말해서 미안해.','apology','candidate',recordedJevResponse('other'));expect(repeated.selected.conversationContext.repairCandidate).toBeNull();expect((await store.state()).body.affect).toEqual(before.affect);expect((await db.pool.query("SELECT 1 FROM transitions WHERE effects->'repairUsed'->>'candidateEventId'=$1",[blamed.accepted.eventId])).rowCount).toBe(1);
});
it('CR07 selected context timestamp is bound to the committed attention snapshot',async()=>{
 const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId:IDENTITY_IDS[0],text:'평범한 질문이야.'}),selected=(await store.select(accepted.eventId))!;selected.conversationContext.asOf++;
 expect((await store.commitAppraisal(selected,{target:'character',act:'question',strength:0,hostility:0,goal_relation:'unrelated',uncertain:false,evidence_refs:[accepted.eventId]},{provider:'fixture',model:'fixture'})).status).toBe('stale');
 expect((await db.pool.query('SELECT 1 FROM appraisals WHERE event_id=$1',[accepted.eventId])).rowCount).toBe(0);
});
it('CR07 candidate outside recent history still invalidates the reply when its source is deleted',async()=>{
 const blamed=await attack();for(let i=0;i<5;i++){const intervening=await input('일반 질문 '+i+'야.');await store.failResponse(intervening.response!.id,'fixture_delivery_failed');}
 const apology=await input('아까 심하게 말해서 미안해.','apology','candidate',recordedJevResponse('other'));expect(apology.selected.conversation.turns.some(t=>t.source.id===blamed.accepted.eventId)).toBe(false);await complete(apology.response!.id);
 await store.deleteEvent(blamed.accepted.eventId,'1',randomUUID());expect((await db.pool.query('SELECT plan FROM response_runs WHERE id=$1',[apology.response!.id])).rows[0].plan).toBeNull();expect((await db.pool.query('SELECT text FROM speech_segments WHERE response_id=$1',[apology.response!.id])).rows.every(r=>r.text===null)).toBe(true);
});
