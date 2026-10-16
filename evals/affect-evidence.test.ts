import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {testDatabase,reset,IDENTITY_IDS} from './helpers.ts';
import {Store} from '../packages/database/src/store.ts';
import {JevAppraisalProvider} from '../packages/adapters/src/jev.ts';
import {jevEvidenceVerifier} from '../packages/adapters/src/appraisal-evidence.ts';
import {recordedJevResponse} from './jev-fixture.ts';
let db:Awaited<ReturnType<typeof testDatabase>>,store:Store,now:number,session:string;
beforeAll(async()=>{db=await testDatabase();});
beforeEach(async()=>{now=1700000000000;await reset(db,now);store=new Store(db,undefined,()=>now,jevEvidenceVerifier);session=randomUUID();await store.startSession(session,randomUUID());});
afterAll(async()=>{await db?.close();});
async function prepare(certain=false){
 const accepted=await store.acceptChat(session,randomUUID(),{identityId:IDENTITY_IDS[0],text:'너 번역 정말 잘했어.'});const selected=(await store.select(accepted.eventId))!;
 const raw=recordedJevResponse('praise','character',3);if(!certain)raw.answers.strength={...raw.answers.strength,score:2.65,confidence:.65,probabilities:{'0':0,'1':0,'2':.35,'3':.65}};
 const provider=new JevAppraisalProvider({localOnly:false,allowPaidProviders:true,apiKey:'fixture'},async()=>Response.json(raw));
 const evaluation=await provider.evaluate({id:accepted.eventId,identityId:IDENTITY_IDS[0],revision:String(selected.revision),text:'너 번역 정말 잘했어.'},{activity:null});
 return {accepted,selected,evaluation};
}
async function commit(prepared:Awaited<ReturnType<typeof prepare>>){return store.commitAppraisal(prepared.selected,prepared.evaluation.appraisal,prepared.evaluation.metadata);}
async function complete(response:any){
 const clientId=randomUUID(),owner=await store.grantOwner(session,randomUUID(),clientId),output=(await store.generated(response.id,['고마워.'],{clientId,outputEpoch:owner.outputEpoch}))!;
 for(const segment of output.segments){const body={responseId:response.id,segmentId:segment.id,generationEpoch:output.response.generation_epoch,outputEpoch:String(owner.outputEpoch)};await store.report(session,randomUUID(),'caption.shown',body,clientId);await store.report(session,randomUUID(),'caption.finished',body,clientId);}
}
async function rows(){return (await db.pool.query("SELECT id,status,features,applied FROM relationship_evidence WHERE kind='praise' ORDER BY order_version")).rows;}
it('S1B-D/E uncertain praise changes affect, participates once and never changes relationship repetition',async()=>{
 const first=await prepare(),result=await commit(first);expect(result.response?.plan.participation).toEqual({mode:'speak'});await complete(result.response);
 expect((await store.state()).body.affect.joy.value).toBe(.12);
 expect((await rows())[0]).toMatchObject({features:{strength:0,relationshipEligible:false},applied:{stimulus:0,affect:{version:3,stimulus:.12}}});
 expect(Number((await db.pool.query('SELECT affinity FROM relationships WHERE identity_id=$1',[IDENTITY_IDS[0]])).rows[0].affinity)).toBe(.5);
 const version=(await store.state()).version;await commit(first);expect((await store.state()).version).toBe(version);expect(await rows()).toHaveLength(1);
 const second=await commit(await prepare());expect(second.response).toBeNull();expect((await store.state()).body.turn.recentSilences.at(-1)?.reason).toBe('no_addition');expect((await rows())[1].applied.affect.stimulus).toBe(.06);
 now+=15000;const third=await commit(await prepare(true));expect(third.response).not.toBeNull();expect((await rows())[2].applied.stimulus).toBe(.18);expect((await rows())[2].applied.affect.stimulus).toBeLessThan(.07);
});
it('S1B-C stale revision, epoch and mismatched bound metadata cannot apply affect',async()=>{
 const p=await prepare();const before=(await store.state()).body.affect;
 expect((await store.commitAppraisal({...p.selected,revision:2n},p.evaluation.appraisal,p.evaluation.metadata)).status).toBe('stale');
 expect((await store.commitAppraisal({...p.selected,generationEpoch:99n},p.evaluation.appraisal,p.evaluation.metadata)).status).toBe('stale');
 (p.evaluation.metadata.providerResult as any).eventRevision='2';await commit(p);expect(await rows()).toHaveLength(0);expect((await store.state()).body.affect).toEqual(before);
});
it('S1B-D deletion excludes affect-only evidence from replay and restart preserves actual affect',async()=>{
 const first=await prepare();await complete((await commit(first)).response);now+=15000;await complete((await commit(await prepare())).response);now+=15000;await complete((await commit(await prepare(true))).response);
 const prior=await rows(),emotion=(await store.state()).body.affect;
 await store.deleteEvent(first.accepted.eventId,'1',randomUUID());const after=await rows();expect(after[0].status).toBe('invalidated');expect(after[1].applied.stimulus).toBe(0);expect(after[2].applied.stimulus).toBe(.18);expect(after[2].applied.affect).toEqual(prior[2].applied.affect);expect((await store.state()).body.affect.joy.value).toBe(emotion.joy.value);expect((await store.state()).body.affect.joy.causes.some(c=>c.eventId===first.accepted.eventId)).toBe(false);
 store=new Store(db,undefined,()=>now,jevEvidenceVerifier);await store.recover();expect((await store.state()).body.affect.joy.value).toBe(emotion.joy.value);expect((await store.state()).body.affect.joy.causes.some(c=>c.eventId===first.accepted.eventId)).toBe(false);
 session=randomUUID();await store.startSession(session,randomUUID());now+=600000;await commit(await prepare());expect((await rows()).at(-1).applied.affect.stimulus).toBe(.12);
});
