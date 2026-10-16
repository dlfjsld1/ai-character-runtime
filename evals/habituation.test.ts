import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {testDatabase,reset,IDENTITY_IDS} from './helpers.ts';
import {Store} from '../packages/database/src/store.ts';
import {neutralAppraisal} from '../packages/contracts/src/domain.ts';
import {decay} from '../packages/character-core/src/index.ts';
let db:Awaited<ReturnType<typeof testDatabase>>,store:Store,now:number,session:string;
beforeAll(async()=>{db=await testDatabase();});
beforeEach(async()=>{now=1700000000000;await reset(db,now);store=new Store(db,undefined,()=>now);session=randomUUID();await store.startSession(session,randomUUID());});
afterAll(async()=>{await db?.close();});
async function praise(text='정말 잘했어.',strength=3){
 const accepted=await store.acceptChat(session,randomUUID(),{identityId:IDENTITY_IDS[0],text});const selected=(await store.select(accepted.eventId))!;
 const appraisal={...neutralAppraisal,target:'character' as const,act:'praise' as const,strength,uncertain:false,evidence_refs:[accepted.eventId]};
 const result=await store.commitAppraisal(selected,appraisal,{provider:'synthetic-fixture',model:'recorded-v1'});
 if(result.response)await store.failResponse(result.response.id,'fixture_no_stage');
 return {accepted,selected,appraisal,result};
}
async function rows(){return (await db.pool.query("SELECT id,status,applied FROM relationship_evidence WHERE kind='praise' ORDER BY order_version")).rows;}
it('C2-H3 stores actual recovering affect separately while relationship v1 remains unchanged',async()=>{
 await praise();now+=300000;const before=(await store.state()).body;const next=await praise('아주 훌륭해.');const evidence=await rows();
 expect(evidence[1].applied).toMatchObject({stimulus:.09,habituation:.5,affect:{version:3,stimulus:.12}});
 expect((await store.state()).body.affect.joy.value).toBeCloseTo(decay(before,now).affect.joy.value+.12,12);
 expect(Number((await db.pool.query('SELECT affinity FROM relationships WHERE identity_id=$1',[IDENTITY_IDS[0]])).rows[0].affinity)).toBeCloseTo(.5075,12);
 const version=(await store.state()).version;await store.commitAppraisal(next.selected,next.appraisal,{provider:'synthetic-fixture',model:'recorded-v1'});
 expect((await store.state()).version).toBe(version);expect(await rows()).toEqual(evidence);
});
it('C2-H3 deleting a source recalculates relationship only, preserving surviving actual affect',async()=>{
 const first=await praise();now+=300000;await praise();const evidence=await rows(),before=(await store.state()).body;
 await store.deleteEvent(first.accepted.eventId,'1',randomUUID());const after=await rows();
 expect(after[0].status).toBe('invalidated');expect(after[1].applied.stimulus).toBe(.18);expect(after[1].applied.affect).toEqual(evidence[1].applied.affect);
 expect((await store.state()).body.affect.joy.value).toBe(before.affect.joy.value);
 now+=600000;await praise();expect((await rows()).at(-1).applied.affect.stimulus).toBe(.18);
});
it('C2-H3 restart retains suppression, legacy rows remain readable, and elapsed rest restores sensitivity',async()=>{
 await praise();await db.pool.query("UPDATE relationship_evidence SET applied=applied-'affect' WHERE kind='praise'");
 store=new Store(db,undefined,()=>now);await store.recover();session=randomUUID();await store.startSession(session,randomUUID());
 now+=300000;await praise();expect((await rows())[1].applied.affect.stimulus).toBe(.12);
 now+=600000;await praise();expect((await rows())[2].applied.affect.stimulus).toBe(.18);
});
it('C2-H3 zero strength may still speak and wording changes do not reset repetition pressure',async()=>{
 const first=await praise('칭찬해.');now+=15000;await praise('아주 대단해.');
 expect((await rows())[1].applied.affect.stimulus).toBeLessThan(.1);
 now+=15000;const before=(await store.state()).body;const zero=await praise('잘했어.',0);
 expect(zero.result.response?.plan.participation).toEqual({mode:'speak'});expect((await rows())[2].applied.affect.stimulus).toBe(0);
 expect((await store.state()).body.affect).toEqual(decay(before,now).affect);
 expect(first.result.response).not.toBeNull();
});
