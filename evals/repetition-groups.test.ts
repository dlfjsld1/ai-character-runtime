import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {testDatabase,reset,IDENTITY_IDS} from './helpers.ts';
import {Store} from '../packages/database/src/store.ts';
import {JevRepetitionCandidate,JevRepetitionV8Candidate,JevRepetitionV9Candidate,JevAppraisalProvider} from '../packages/adapters/src/jev.ts';
import {jevEvidenceVerifier} from '../packages/adapters/src/appraisal-evidence.ts';
import {recordedJevResponse} from './jev-fixture.ts';
let db:Awaited<ReturnType<typeof testDatabase>>,store:Store,now:number,session:string;
beforeAll(async()=>{db=await testDatabase();});
beforeEach(async()=>{now=1700000000000;await reset(db,now);store=new Store(db,undefined,()=>now,jevEvidenceVerifier);session=randomUUID();await store.startSession(session,randomUUID());});
afterAll(async()=>{await db?.close();});
const choice=(value:string,keys:string[])=>({type:'choice',choice:value,confidence:1,probabilities:Object.fromEntries(keys.map(k=>[k,k===value?1:0]))});
async function prepare(relations:string[]=[],options:{text?:string;identity?:string;bounded?:boolean;legacy?:boolean;concrete?:boolean;v8?:boolean;v9?:boolean;weakNo?:boolean}={}){
 const identityId=options.identity??IDENTITY_IDS[0],text=options.text??'너 첫 번째 그림 정말 잘 그렸어.';
 const accepted=await store.acceptChat(session,randomUUID(),{identityId,text}),selected=(await store.select(accepted.eventId))!;
 const Provider=options.legacy?JevAppraisalProvider:options.v9?JevRepetitionV9Candidate:options.v8?JevRepetitionV8Candidate:JevRepetitionCandidate;
 const provider=new Provider({localOnly:false,allowPaidProviders:true,apiKey:'fixture'},async(_url,request)=>{
  const body=JSON.parse(String(request?.body)),raw:any=recordedJevResponse('praise','character',3);
  if(options.bounded)raw.answers.strength={...raw.answers.strength,score:2.65,confidence:.65,probabilities:{'0':0,'1':0,'2':.35,'3':.65}};
  if(body.questions.concrete){raw.answers.concrete=choice(options.concrete===false?'no':'yes',['yes','no','unknown']);for(let i=0;i<body.state.previous.length;i++){const relation=relations[i]??'same';if(options.v8||options.v9){raw.answers[`same_event_${i}`]=choice(relation==='same'?'yes':relation==='distinct'?'no':'unknown',['yes','no','unknown']);raw.answers[`separate_event_${i}`]=choice(relation==='distinct'?'yes':relation==='same'?'no':'unknown',['yes','no','unknown']);if(options.weakNo&&relation==='same')raw.answers[`separate_event_${i}`].confidence=.62;}else raw.answers[`comparison_${i}`]=choice(relation,['same','distinct','unknown']);}}
  return Response.json(raw);
 });
 const evaluation=await provider.evaluate({id:accepted.eventId,identityId,revision:String(selected.revision),text},{recentPraise:selected.praiseSnapshot.context});
 return {accepted,selected,evaluation};
}
async function finish(response:any){if(!response)return;const clientId=randomUUID(),owner=await store.grantOwner(session,randomUUID(),clientId),output=(await store.generated(response.id,['고마워.'],{clientId,outputEpoch:owner.outputEpoch}))!;
 for(const segment of output.segments){const body={responseId:response.id,segmentId:segment.id,generationEpoch:output.response.generation_epoch,outputEpoch:String(owner.outputEpoch)};await store.report(session,randomUUID(),'caption.shown',body,clientId);await store.report(session,randomUUID(),'caption.finished',body,clientId);}}
async function commit(p:Awaited<ReturnType<typeof prepare>>){const r=await store.commitAppraisal(p.selected,p.evaluation.appraisal,p.evaluation.metadata);await finish(r.response);return r;}
async function rows(){return (await db.pool.query("SELECT id,status,features,applied FROM relationship_evidence WHERE kind='praise' ORDER BY order_version,id")).rows;}
it('S2-C/D stores separate actual affect, A/B/A labels and unchanged relationship consumption',async()=>{
 const first=await prepare();await commit(first);
 for(let i=0;i<3;i++)await commit(await prepare());
 await commit(await prepare(['distinct','distinct','distinct','distinct'],{text:'너 두 번째 그림 정말 잘 그렸어.'}));
 await commit(await prepare(['same','same','same','same','distinct']));
 const evidence=await rows(),a=evidence[0].applied.affect.groupId,b=evidence[4].applied.affect.groupId;
 expect(a).toBeTruthy();expect(b).not.toBe(a);
 for(const [i,expected] of [.18,.09,.03,0,.18,0].entries())expect(evidence[i].applied.affect.stimulus).toBeCloseTo(expected);
 expect(evidence[5].applied.affect.groupId).toBe(a);expect(evidence[4].applied.stimulus).toBe(0);
 expect((await store.state()).body.turn.recentSilences.at(-1)?.reason).toBe('no_addition');
 const version=(await store.state()).version;expect((await commit(first)).status).toBe('stale');expect((await store.state()).version).toBe(version);expect(await rows()).toHaveLength(6);
});
it('S2-D bounded uncertain praise can bootstrap, while its relationship effect remains zero',async()=>{
 await commit(await prepare([],{bounded:true}));await commit(await prepare(['distinct'],{bounded:true}));
 const evidence=await rows();expect(evidence[0].applied.affect.groupId).toBeTruthy();expect(evidence[1].applied.affect.groupId).not.toBe(evidence[0].applied.affect.groupId);
 for(const row of evidence)expect(row).toMatchObject({features:{strength:0,relationshipEligible:false},applied:{stimulus:0,affect:{version:3,stimulus:.12}}});
 await commit(await prepare());expect((await rows())[2].applied.stimulus).toBe(.18);
});
it('S2-D root deletion redacts comparison raw but preserves surviving group consumption across recovery',async()=>{
 const first=await prepare();await commit(first);const second=await prepare();await commit(second);
 const prior=(await rows())[1].applied.affect,joy=(await store.state()).body.affect.joy.value;
 const refs=(await db.pool.query('SELECT context_refs FROM appraisals WHERE event_id=$1',[second.accepted.eventId])).rows[0].context_refs;expect(refs.map((r:any)=>r.id)).toContain(first.accepted.eventId);
 expect(Number((await db.pool.query('SELECT count(*) FROM relationship_evidence_sources WHERE evidence_id=$1',[(await rows())[1].id])).rows[0].count)).toBe(1);
 await store.deleteEvent(first.accepted.eventId,'1',randomUUID());
 const after=await rows();expect(after[0].status).toBe('invalidated');expect(after[1].status).toBe('active');expect(after[1].applied.affect).toEqual(prior);
 expect((await db.pool.query('SELECT provider_result,context_refs FROM appraisals WHERE event_id=$1',[second.accepted.eventId])).rows[0]).toEqual({provider_result:null,context_refs:[]});
 expect((await store.state()).body.affect.joy.value).toBe(joy);
 store=new Store(db,undefined,()=>now,jevEvidenceVerifier);await store.recover();session=randomUUID();await store.startSession(session,randomUUID());
 const next=await prepare();expect(next.selected.praiseSnapshot.context.items.map(i=>i.eventId)).toEqual([second.accepted.eventId]);await commit(next);
 const final=(await rows()).at(-1);expect(final.applied.affect.groupId).toBe(prior.groupId);expect(final.applied.affect.stimulus).toBeCloseTo(.09);
});
it('S2-A/D snapshot excludes other identities and includes cross-session history; ungrouped/v2 forces whole-window fallback',async()=>{
 await commit(await prepare());await commit(await prepare([],{identity:IDENTITY_IDS[1]}));
 let next=await prepare(['distinct']);expect(next.selected.praiseSnapshot.context.items).toHaveLength(1);await commit(next);
 await db.pool.query("UPDATE relationship_evidence SET applied=jsonb_set(applied,'{affect}',jsonb_build_object('version',2,'stimulus',0.12,'habituation',1)) WHERE id=$1",[(await rows())[0].id]);
 next=await prepare(['distinct']);expect(next.selected.praiseSnapshot.context).toMatchObject({complete:false,items:[]});await commit(next);expect((await rows()).at(-1).applied.affect.groupId).toBeNull();
 now+=600000;next=await prepare();expect(next.selected.praiseSnapshot.context).toMatchObject({complete:true,items:[]});await commit(next);expect((await rows()).at(-1).applied.affect.stimulus).toBe(.18);
});
it('S2-A ninth source and total UTF-8 overflow never transmit a partial comparison',async()=>{
 for(let i=0;i<9;i++)await commit(await prepare());
 let next=await prepare();expect(next.selected.praiseSnapshot.context).toMatchObject({complete:false,items:[]});await commit(next);
 now+=600000;
 for(let i=0;i<3;i++)await commit(await prepare([],{text:'가'.repeat(800)}));
 next=await prepare();expect(next.selected.praiseSnapshot.context).toMatchObject({complete:false,items:[]});
});
it('S2-A unobserved, changed-revision or missing-text praise cannot grant a complete snapshot',async()=>{
 const first=await prepare();await commit(first);
 for(const mutation of ["observed_at=NULL","revision=2","payload='{}'::jsonb"]){
  await db.pool.query(`UPDATE events SET ${mutation} WHERE id=$1`,[first.accepted.eventId]);
  const next=await prepare();expect(next.selected.praiseSnapshot.context).toMatchObject({complete:false,items:[]});
  await db.pool.query("UPDATE events SET observed_at=received_at,revision=1,payload=$2 WHERE id=$1",[first.accepted.eventId,{text:'원래 칭찬'}]);
 }
});
it('S2-D a changed comparison set, label or time window during inference discards grouping',async()=>{
 // Look up each praise by its own evidence key; the last row may belong to another input.
 const groupOf=async(eventId:string)=>(await db.pool.query("SELECT applied FROM relationship_evidence WHERE kind='praise' AND evidence_key=$1",['praise:'+eventId])).rows[0]?.applied.affect.groupId;
 await commit(await prepare());
 // Another praise committed during inference makes the late one stale: no grouping, no record.
 const late=await prepare(['distinct']),intervening=await prepare();await commit(intervening);
 expect((await commit(late)).status).toBe('stale');expect(await groupOf(late.accepted.eventId)).toBeUndefined();
 now+=600000;await commit(await prepare());const changed=await prepare(['distinct']);
 await db.pool.query("UPDATE relationship_evidence SET applied=jsonb_set(applied,'{affect,groupId}',to_jsonb($2::text)) WHERE id=$1",[(await rows()).at(-1).id,randomUUID()]);
 await commit(changed);expect(await groupOf(changed.accepted.eventId)).toBeNull();
 now+=600000;await commit(await prepare());const expired=await prepare(['distinct']);now+=600000;await commit(expired);expect(await groupOf(expired.accepted.eventId)).toBeNull();
});
it('S2-D revision/epoch/deletion guards reject late appraisal without allocating a group',async()=>{
 const p=await prepare();
 expect((await store.commitAppraisal({...p.selected,revision:2n},p.evaluation.appraisal,p.evaluation.metadata)).status).toBe('stale');
 expect((await store.commitAppraisal({...p.selected,generationEpoch:99n},p.evaluation.appraisal,p.evaluation.metadata)).status).toBe('stale');
 await store.deleteEvent(p.accepted.eventId,'1',randomUUID());expect((await commit(p)).status).toBe('stale');expect(await rows()).toHaveLength(0);
});

it('S2-R5 v8 bounded praise reaches Store A/B/A without adding relationship stimulus',async()=>{
 await commit(await prepare([],{v8:true,bounded:true}));
 await commit(await prepare(['distinct'],{v8:true,bounded:true,text:'너 두 번째 그림 정말 잘 그렸어.'}));
 await commit(await prepare(['same','distinct'],{v8:true,bounded:true}));
 const evidence=await rows();expect(evidence).toHaveLength(3);
 expect(evidence[0].applied.affect.groupId).toBeTruthy();expect(evidence[1].applied.affect.groupId).not.toBe(evidence[0].applied.affect.groupId);expect(evidence[2].applied.affect.groupId).toBe(evidence[0].applied.affect.groupId);
 expect(evidence.map(e=>e.applied.affect.stimulus)).toEqual([.12,.12,.06]);for(const e of evidence)expect(e).toMatchObject({features:{strength:0,relationshipEligible:false},applied:{stimulus:0}});
});

it('S2-P2 v9 weak separate=no reuses the exact A group through Store while preserving bounded affect and conflict fallback',async()=>{
 const opts={v9:true,bounded:true,weakNo:true};
 await commit(await prepare([],opts));await commit(await prepare(['distinct'],{...opts,text:'너 두 번째 그림 정말 잘 그렸어.'}));await commit(await prepare(['same','distinct'],opts));
 let evidence=await rows();expect(evidence.map(e=>e.applied.affect.stimulus)).toEqual([.12,.12,.06]);expect(evidence[2].applied.affect.groupId).toBe(evidence[0].applied.affect.groupId);expect(evidence[1].applied.affect.groupId).not.toBe(evidence[0].applied.affect.groupId);
 await commit(await prepare(['same','unknown','same'],opts));evidence=await rows();expect(evidence[3].applied.affect.groupId).toBeNull();expect(evidence[3].applied.affect.stimulus).toBe(0);
 for(const e of evidence)expect(e).toMatchObject({features:{relationshipEligible:false},applied:{stimulus:0}});
});
