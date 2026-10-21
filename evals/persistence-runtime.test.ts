import {beforeAll,beforeEach,afterAll,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {testDatabase,reset,IDENTITY_IDS,fixtureProvider,mockJevAppraiser} from './helpers.ts';
import {Coordinator} from '../apps/runtime/src/coordinator/index.ts';
import {RuntimeError} from '../packages/contracts/src/domain.ts';
import {PostgresKnowledgeRetriever} from '../packages/adapters/src/postgres-knowledge.ts';
import {Store} from '../packages/database/src/store.ts';
import {neutralAppraisal} from '../packages/contracts/src/domain.ts';
import {buildDialogueRequest,buildKnowledgeRequest} from '../packages/adapters/src/dialogue-request.ts';
let db:Awaited<ReturnType<typeof testDatabase>>,store:Store,sessionId:string;
const identityId=IDENTITY_IDS[0];
beforeAll(async()=>{db=await testDatabase();});
beforeEach(async()=>{await reset(db);store=new Store(db);sessionId=randomUUID();await store.startSession(sessionId,randomUUID());});
afterAll(async()=>{await db?.close();});
async function save(value='카페인 없는 보리차만 선호'){return (await store.mutatePersonalFact(sessionId,identityId,randomUUID(),{kind:'create',input:{key:'음료 선호',value}})).result;}
async function response(text='내 음료 선호가 뭐야?',owner=identityId){
 const input=await store.acceptChat(sessionId,randomUUID(),{identityId:owner,text});
 const selected=await store.select(input.eventId);expect(selected).not.toBeNull();
 const result=await store.commitAppraisal(selected!,{...neutralAppraisal,target:'character',act:'question',strength:3,uncertain:false,evidence_refs:[input.eventId]},{provider:'synthetic-fixture',model:'recorded-v1'});
 expect(result.response).toBeTruthy();return result.response!;
}
async function deliver(id:string){
 const clientId=randomUUID(),grant=await store.grantOwner(sessionId,randomUUID(),clientId);
 const output=await store.generated(id,['카페인 없는 보리차를 선호한다고 저장했어.'],{clientId,outputEpoch:grant.outputEpoch});expect(output).not.toBeNull();
 const payload={responseId:id,segmentId:output!.segments[0]!.id,generationEpoch:output!.response.generation_epoch,outputEpoch:grant.outputEpoch.toString()};
 return {clientId,payload};
}
it('P07/P13 pins explicit statements at creation and carries identical facts through fitting and generation payloads',async()=>{
 const fact=await save(),r=await response(),before=await store.responseContext(r.id);
 expect(before.context.personalFacts).toMatchObject({identityId,revision:'1',facts:[{id:fact.id,value:'카페인 없는 보리차만 선호'}]});
 const fitted=await store.fitResponseConversation(r.id,before.context.conversation);
 expect(fitted!.context.personalFacts).toEqual(before.context.personalFacts);
 const request=buildDialogueRequest(r.plan,fitted!.context,'gpt-6-sol');
 expect(JSON.parse(request.messages[1]!.content).personalFacts).toEqual(before.context.personalFacts!.facts);
 expect(request.messages[0]!.content).toContain('문구의 부정·조건을 보존');
 expect((await db.pool.query('SELECT personal_fact_id,source_version FROM response_sources WHERE response_id=$1 AND personal_fact_id IS NOT NULL',[r.id])).rows).toEqual([{personal_fact_id:fact.id,source_version:'1'}]);
 const knowledge=buildKnowledgeRequest({...r.plan,purpose:'knowledge_answer'},{...before.context,knowledge:{query:'필터 주기',chunks:[],revision:'0'}});
 expect(JSON.stringify(knowledge.messages)).not.toContain('보리차');
});
it('P01/P07 current owner facts survive a new meeting without importing old dialogue',async()=>{
 await save();await store.stopSession(sessionId,randomUUID());sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
 const r=await response(),context=(await store.responseContext(r.id)).context;
 expect(context.personalFacts!.facts[0]!.value).toContain('보리차');expect(context.conversation?.turns??[]).toEqual([]);
});
it('P04 another owner receives no facts and cannot invalidate a snapshot with no dependency on them',async()=>{
 const r=await response('선호를 알려줘',IDENTITY_IDS[1]);await save();
 expect((await store.responseContext(r.id)).context.personalFacts).toMatchObject({identityId:IDENTITY_IDS[1],revision:'0',facts:[]});
 expect(await store.busy()).toBe(true);
});
it('P09 an empty collection is a dependency: a new fact cancels its old response and releases busy',async()=>{
 const r=await response();expect((await store.responseContext(r.id)).context.personalFacts!.facts).toEqual([]);
 await save();expect(await store.busy()).toBe(false);
 expect(await store.generated(r.id,['저장된 선호가 없어.'],null)).toBeNull();
 const cleared=await store.responseContext(r.id);expect(cleared.response.plan).toBeNull();expect(cleared.context.personalFacts).toBeUndefined();
 const next=await response();expect((await store.responseContext(next.id)).context.personalFacts!.revision).toBe('1');
});
it('P09 rejects forged snapshot values even when owner and collection revision are unchanged',async()=>{
 await save();const r=await response(),context=(await store.responseContext(r.id)).context;
 context.personalFacts!.facts[0]!.value='변조된 값';
 await db.pool.query('UPDATE response_runs SET personal_context=$2 WHERE id=$1',[r.id,context.personalFacts]);
 await expect(store.responseContext(r.id)).rejects.toThrow('personal_changed');
 expect(await store.generated(r.id,['변조된 값'],null)).toBeNull();expect(await store.busy()).toBe(false);
});
it('P08/P09 a fact edit clears the snapshot and captions, rejects late ACKs and permits the next reply',async()=>{
 const fact=await save(),r=await response(),out=await deliver(r.id);
 await store.mutatePersonalFact(sessionId,identityId,randomUUID(),{kind:'update',id:fact.id,expectedRevision:'1',input:{key:'음료 선호',value:'루이보스차'}});
 await expect(store.report(sessionId,randomUUID(),'caption.shown',out.payload,out.clientId)).rejects.toThrow('stale_epoch');
 expect((await db.pool.query('SELECT personal_context,plan FROM response_runs WHERE id=$1',[r.id])).rows[0]).toEqual({personal_context:null,plan:null});
 expect((await db.pool.query('SELECT text FROM speech_segments WHERE response_id=$1',[r.id])).rows).toEqual([{text:null}]);
 const next=await response();expect((await store.responseContext(next.id)).context.personalFacts!.facts[0]!.value).toBe('루이보스차');
});
it('P08 deletion in a new meeting clears an already delivered old response and its personal snapshot',async()=>{
 const fact=await save(),r=await response(),out=await deliver(r.id);
 await store.report(sessionId,randomUUID(),'caption.shown',out.payload,out.clientId);await store.report(sessionId,randomUUID(),'caption.finished',out.payload,out.clientId);
 await store.stopSession(sessionId,randomUUID());sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
 await store.mutatePersonalFact(sessionId,identityId,randomUUID(),{kind:'delete',id:fact.id,expectedRevision:'1'});
 expect((await db.pool.query('SELECT personal_context,plan FROM response_runs WHERE id=$1',[r.id])).rows[0]).toEqual({personal_context:null,plan:null});
 expect((await db.pool.query('SELECT text FROM speech_segments WHERE response_id=$1',[r.id])).rows).toEqual([{text:null}]);
 const next=await response();expect((await store.responseContext(next.id)).context.personalFacts!.facts).toEqual([]);
});
it.each(['fit','generate'])('P09 a mutation during %s prevents stale Stage output and the next input still works',async phase=>{
 const fact=await save(),clientId=randomUUID(),owner=await store.grantOwner(sessionId,randomUUID(),clientId),send=vi.fn();
 let release!:()=>void,entered!:()=>void;const held=new Promise<void>(r=>{release=r;}),started=new Promise<void>(r=>{entered=r;});let first=true;
 const provider={...fixtureProvider,fitConversation:async(p:Parameters<typeof fixtureProvider.fitConversation>[0],c:Parameters<typeof fixtureProvider.fitConversation>[1])=>{if(phase==='fit'&&first){first=false;entered();await held;}return fixtureProvider.fitConversation(p,c);},dialogue:async(_p:Parameters<typeof fixtureProvider.dialogue>[0],c:Parameters<typeof fixtureProvider.dialogue>[1])=>{if(phase==='generate'&&first){first=false;entered();await held;}return [c.personalFacts!.facts[0]!.value];}};
 const co=new Coordinator(store,provider,{owner:()=>({clientId,outputEpoch:owner.outputEpoch}),sendOwner:send,changed:async()=>{},failure:vi.fn(),inputStatus:vi.fn()},mockJevAppraiser());
 const r=await response(),pending=co.dispatch(r.id);
 try{
  await started;await co.control(()=>store.mutatePersonalFact(sessionId,identityId,randomUUID(),{kind:'update',id:fact.id,expectedRevision:'1',input:{key:'음료 선호',value:'루이보스차'}},rows=>{for(const row of rows)co.barrier(row.id,'personal_changed',BigInt(row.generation_epoch));}));
  release();await pending;expect(send.mock.calls.filter(([type])=>type==='speech.segment')).toHaveLength(0);expect(await store.busy()).toBe(false);
  const next=await response();await co.dispatch(next.id);expect(send.mock.calls.filter(([type])=>type==='speech.segment').map(([,body])=>body.text)).toEqual(['루이보스차']);
 }finally{release();await pending;await co.stop();}
});
it('P10 fit failure retains all saved information, releases busy and permits another response',async()=>{
 await save();const failure=vi.fn(),send=vi.fn(),clientId=randomUUID(),owner=await store.grantOwner(sessionId,randomUUID(),clientId);let reject=true;
 const co=new Coordinator(store,{...fixtureProvider,fitConversation:async(p,c)=>{if(reject)throw new RuntimeError('input_budget_exceeded',503);return fixtureProvider.fitConversation(p,c);}},{owner:()=>({clientId,outputEpoch:owner.outputEpoch}),sendOwner:send,changed:async()=>{},failure,inputStatus:vi.fn()},mockJevAppraiser());
 try{await co.dispatch((await response()).id);expect(failure).toHaveBeenCalledWith('input_budget_exceeded');expect(send).not.toHaveBeenCalled();expect(await store.busy()).toBe(false);expect((await store.personalFacts(sessionId,identityId)).facts).toHaveLength(1);reject=false;await co.dispatch((await response()).id);expect(send.mock.calls.some(([kind])=>kind==='speech.segment')).toBe(true);}finally{await co.stop();}
});
it.each(['question','criticism'] as const)('P08 deletes derived %s appraisal context and any dependent reply or silence reason',async act=>{
 const fact=await save(),first=await response(),out=await deliver(first.id);
 await store.report(sessionId,randomUUID(),'caption.shown',out.payload,out.clientId);await store.report(sessionId,randomUUID(),'caption.finished',out.payload,out.clientId);
 const input=await store.acceptChat(sessionId,randomUUID(),{identityId,text:act==='question'?'그 얘기를 이어서 해줘.':'그런 식으로 말하지 마.'}),selected=(await store.select(input.eventId))!;
 expect(selected.conversation.turns.some(t=>t.source.kind==='response'&&t.source.id===first.id)).toBe(true);
 const result=await store.commitAppraisal(selected,{...neutralAppraisal,target:'character',act,strength:3,hostility:act==='criticism'?3:0,uncertain:false,evidence_refs:[input.eventId]},{provider:'synthetic-fixture',model:'recorded-v1',providerResult:{copiedReply:selected.conversation.turns.map(t=>t.text).join(' ')}});
 if(act==='criticism'){expect(result.response).toBeNull();expect((await store.state()).body.turn.recentSilences.some(r=>r.eventId===input.eventId)).toBe(true);}else expect(result.response).toBeTruthy();
 await store.mutatePersonalFact(sessionId,identityId,randomUUID(),{kind:'delete',id:fact.id,expectedRevision:'1'});
 expect((await db.pool.query('SELECT status,provider_result,context_refs FROM appraisals WHERE event_id=$1',[input.eventId])).rows[0]).toMatchObject({status:'stale',provider_result:null,context_refs:[]});
 if(result.response)expect((await store.responseContext(result.response.id)).response.plan).toBeNull();
 expect((await store.state()).body.turn.recentSilences.some(r=>r.eventId===input.eventId)).toBe(false);
 const next=await store.acceptChat(sessionId,randomUUID(),{identityId,text:'다음 얘기를 하자.'}),history=(await store.select(next.eventId))!.conversation;
 expect(JSON.stringify(history)).not.toContain('보리차');
});
it('P08/P09 editing a persistent document clears old-meeting output and a newly planned search before using the new revision',async()=>{
 const doc=(await store.mutateKnowledge(sessionId,identityId,randomUUID(),{retention:'persistent',title:'합성 필터',body:'필터는 6개월마다 교체한다.'})).result;
 async function search(){const query='필터 교체 주기',input=await store.acceptChat(sessionId,randomUUID(),{identityId,text:query,intent:'knowledge'}),selected=(await store.select(input.eventId))!;
  const fence=await store.knowledgeRevisions(sessionId,identityId),found=await new PostgresKnowledgeRetriever(db.pool).search({scope:{characterId:store.characterId,sessionId,identityId},query});return (await store.commitKnowledge(selected,found,fence.revision,fence.libraryRevision)).response;}
 const first=await search(),clientId=randomUUID(),owner=await store.grantOwner(sessionId,randomUUID(),clientId),sentences=['6개월마다 교체해.'];
 const generated=(await store.generated(first.id,sentences,{clientId,outputEpoch:owner.outputEpoch},{sentences,status:'answered',citationIds:['K1']}))!;
 const ack={responseId:first.id,segmentId:generated.segments[0]!.id,generationEpoch:generated.response.generation_epoch,outputEpoch:String(owner.outputEpoch)};
 await store.report(sessionId,randomUUID(),'caption.shown',ack,clientId);await store.report(sessionId,randomUUID(),'caption.finished',ack,clientId);
 await store.stopSession(sessionId,randomUUID());sessionId=randomUUID();await store.startSession(sessionId,randomUUID());const second=await search();
 await store.mutateKnowledge(sessionId,identityId,randomUUID(),{documentId:doc.documentId,expectedRevision:'1',title:'합성 필터',body:'필터는 12개월마다 교체한다.'});
 expect((await db.pool.query('SELECT plan,knowledge_context FROM response_runs WHERE id=ANY($1::uuid[])',[ [first.id,second.id] ])).rows).toEqual([{plan:null,knowledge_context:null},{plan:null,knowledge_context:null}]);
 expect((await db.pool.query('SELECT text FROM speech_segments WHERE response_id=$1',[first.id])).rows).toEqual([{text:null}]);expect(await store.busy()).toBe(false);
 const next=await search();expect((await store.responseContext(next.id)).context.knowledge!.chunks[0]!.text).toContain('12개월');
});
