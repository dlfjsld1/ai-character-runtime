import { beforeAll,beforeEach,afterAll,it,expect,vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { testDatabase,reset,fixtureProvider,mockJevAppraiser,IDENTITY_IDS } from './helpers.ts';
import { Store } from '../packages/database/src/store.ts';
import { Coordinator } from '../apps/runtime/src/coordinator/index.ts';
import { PostgresKnowledgeRetriever } from '../packages/adapters/src/postgres-knowledge.ts';
import { jevEvidenceVerifier } from '../packages/adapters/src/appraisal-evidence.ts';
import { mapJevResponse } from '../packages/adapters/src/jev.ts';
import { recordedJevResponse } from './jev-fixture.ts';
import {knowledgeNegativeFixture} from './knowledge-negative-fixture.ts';
import { RuntimeError,neutralAppraisal } from '../packages/contracts/src/domain.ts';
import type { DialogueGenerator,KnowledgeAnswer,DialogueContext } from '../packages/contracts/src/ai-ports.ts';
import type { Plan } from '../packages/contracts/src/domain.ts';
import type { KnowledgeRetriever } from '../packages/contracts/src/knowledge.ts';
let db:Awaited<ReturnType<typeof testDatabase>>,store:Store,sessionId:string,now:number;
beforeAll(async()=>{db=await testDatabase();});
beforeEach(async()=>{now=Date.now();await reset(db,now);store=new Store(db,undefined,()=>now);sessionId=randomUUID();await store.startSession(sessionId,randomUUID());});
afterAll(async()=>{await db?.close();});
const identityId=IDENTITY_IDS[0],query='합성 필터의 교체 주기를 찾아줘.';
async function document(){return (await store.mutateKnowledge(sessionId,identityId,randomUUID(),{title:'합성 필터 안내',body:'합성 필터는 여섯 달에 한 번 교체한다.'})).result;}
function deferred(){let release!:()=>void;const promise=new Promise<void>(r=>{release=r;});return {promise,release};}
async function setup(options:{provider?:Partial<DialogueGenerator>;retriever?:KnowledgeRetriever|null}={}){
 const clientId=randomUUID(),owner=await store.grantOwner(sessionId,randomUUID(),clientId),send=vi.fn(),failure=vi.fn(),status=vi.fn(),evaluate=vi.fn(mockJevAppraiser().evaluate);
 const answerKnowledge=vi.fn(async(_plan:Plan,context:DialogueContext):Promise<KnowledgeAnswer>=>context.knowledge?.chunks.length?{sentences:['필터는 여섯 달에 한 번 교체해.'],status:'answered',citationIds:['K1']}:{sentences:['지정한 자료에서 확인하지 못했어.'],status:'not_found',citationIds:[]});
 const provider:DialogueGenerator={...fixtureProvider,answerKnowledge,...options.provider};
 const co=new Coordinator(store,provider,{owner:()=>({clientId,outputEpoch:owner.outputEpoch}),sendOwner:send,changed:async()=>{},failure,inputStatus:status},{...mockJevAppraiser(),evaluate},undefined,options.retriever===null?undefined:options.retriever??new PostgresKnowledgeRetriever(db.pool));
 return {co,clientId,owner,send,failure,status,evaluate,answerKnowledge,provider};
}
async function request(co:Coordinator){const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId,text:query,intent:'knowledge'});await co.drain();return accepted;}
async function delivered(t:Awaited<ReturnType<typeof setup>>){await vi.waitFor(()=>expect(t.send.mock.calls.some(([kind])=>kind==='speech.segment')).toBe(true));return t.send.mock.calls.filter(([kind])=>kind==='speech.segment').map(([,payload])=>payload);}
async function acknowledge(t:Awaited<ReturnType<typeof setup>>){for(const body of await delivered(t)){const payload={responseId:body.responseId,segmentId:body.segmentId,generationEpoch:body.generationEpoch,outputEpoch:body.outputEpoch};await store.report(sessionId,randomUUID(),'caption.shown',payload,t.clientId);await store.report(sessionId,randomUUID(),'caption.finished',payload,t.clientId);}}
async function selected(){const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId,text:query,intent:'knowledge'});return (await store.select(accepted.eventId))!;}
const search=()=>new PostgresKnowledgeRetriever(db.pool).search({scope:{characterId:store.characterId,sessionId,identityId},query});

it('H1-C controlled negative fixture exposes neither pending inputs nor active outputs to the runtime',async()=>{
 const transaction=db.transaction.bind(db),before=(await db.pool.query('SELECT count(*) FROM events')).rows[0].count;
 const spy=vi.spyOn(db,'transaction').mockImplementation(fn=>transaction(async client=>{
  const result=await fn(client);
  expect((await db.pool.query('SELECT count(*) FROM events')).rows[0].count).toBe(before);
  expect(await store.candidates(sessionId)).toEqual([]);expect(await store.busy()).toBe(false);
  return result;
 }));
 try{
  const intervention=await knowledgeNegativeFixture(store,sessionId,identityId);
  expect(intervention.actualJudgment).toBe(false);expect(intervention.events).toHaveLength(2);
  expect(spy).toHaveBeenCalledTimes(1);expect(await store.candidates(sessionId)).toEqual([]);
  expect(await store.busy()).toBe(false);expect((await store.state()).body.affect.frustration.value).toBeGreaterThan(.1);
 }finally{spy.mockRestore();}
});

it('H1-B explicit search speaks through controlled withholding without appraisal or affect reset; citations are server resolved',async()=>{
 const doc=await document(),input=await store.acceptChat(sessionId,randomUUID(),{identityId,text:'합성 감정 원인'});
 await db.pool.query("UPDATE events SET attention_status='observed',observed_at=$2 WHERE id=$1",[input.eventId,new Date(now)]);
 const before=await store.state();before.body.affect.frustration={value:.8,asOf:now,holdUntil:now+300000,causes:[{eventId:input.eventId,targetId:identityId}]};
 before.body.turn.recentSilences=[{eventId:input.eventId,eventRevision:'1',stateVersion:'1',identityId,at:now,reason:'withholding',sourceRefs:[{kind:'event',id:input.eventId,version:'1'}],affect:{joy:0,frustration:.8,surprise:0,embarrassment:0,pleasantness:.2}}];
 await db.pool.query('UPDATE character_state SET body=$2 WHERE character_id=$1',[store.characterId,before.body]);
 const t=await setup();try{
  await request(t.co);const segments=await delivered(t);expect(segments[0].text).toContain('여섯 달');expect(t.evaluate).not.toHaveBeenCalled();expect(t.answerKnowledge).toHaveBeenCalledTimes(1);
  expect((await store.state()).body.affect).toEqual(before.body.affect);expect((await store.state()).body.turn.recentSilences).toEqual(before.body.turn.recentSilences);
  await acknowledge(t);const answer=await store.latestKnowledgeAnswer(sessionId,identityId);expect(JSON.stringify(answer)).toContain(doc.documentId);expect(JSON.stringify(answer)).toContain('합성 필터 안내');expect(await store.busy()).toBe(false);
 }finally{await t.co.stop();}
});
it.each(['retriever_missing','provider_missing','search_error'] as const)('H1-B %s releases selected input and allows the next request',async failureKind=>{
 await document();const retriever=new PostgresKnowledgeRetriever(db.pool);let first=true;
 const t=await setup({...(failureKind==='retriever_missing'?{retriever:null}:failureKind==='search_error'?{retriever:{search:async q=>{if(first){first=false;throw new RuntimeError('db_unavailable',503);}return retriever.search(q);}}}:{}),...(failureKind==='provider_missing'?{provider:{answerKnowledge:undefined}}:{})});
 try{
  const accepted=await request(t.co);await vi.waitFor(()=>expect(t.failure).toHaveBeenCalled());expect(await store.busy()).toBe(false);
  const row=(await db.pool.query('SELECT attention_status FROM events WHERE id=$1',[accepted.eventId])).rows[0];expect(['pending','selected']).not.toContain(row.attention_status);expect(t.send.mock.calls.filter(([kind])=>kind==='speech.segment')).toEqual([]);
 }finally{await t.co.stop();}
 const next=await setup();try{await request(next.co);await acknowledge(next);expect(await store.busy()).toBe(false);}finally{await next.co.stop();}
});
it.each(['found','absence'] as const)('H1-B mutation during %s retrieval rejects stale collection snapshots',async kind=>{
 if(kind==='found')await document();const gate=deferred(),entered=deferred(),base=new PostgresKnowledgeRetriever(db.pool);
 const t=await setup({retriever:{search:async q=>{const result=await base.search(q);entered.release();await gate.promise;return result;}}});
 const draining=request(t.co);try{await entered.promise;await document();gate.release();await draining;await t.co.stop();expect(t.answerKnowledge).not.toHaveBeenCalled();expect(t.send.mock.calls.filter(([k])=>k==='speech.segment')).toEqual([]);expect(await store.busy()).toBe(false);}finally{gate.release();await draining;await t.co.stop();}
});
it.each(['update','delete'] as const)('H1-B %s during generation invalidates output before Stage dispatch',async kind=>{
 const doc=await document(),gate=deferred(),entered=deferred();
 const t=await setup({provider:{answerKnowledge:async()=>{entered.release();await gate.promise;return {sentences:['이전 필터 설명이야.'],status:'answered',citationIds:['K1']};}}});
 try{await request(t.co);await entered.promise;const barrier=vi.fn();await store.mutateKnowledge(sessionId,identityId,randomUUID(),kind==='delete'?{documentId:doc.documentId,expectedRevision:'1',delete:true}:{documentId:doc.documentId,expectedRevision:'1',title:'새 안내',body:'필터는 일 년마다 교체한다.'},barrier);expect(barrier).toHaveBeenCalled();gate.release();await t.co.stop();expect(t.send.mock.calls.filter(([k])=>k==='speech.segment')).toEqual([]);expect(await store.busy()).toBe(false);expect((await db.pool.query("SELECT status FROM response_runs WHERE knowledge_context IS NOT NULL")).rows.every(r=>r.status==='cancelled')).toBe(true);}finally{gate.release();await t.co.stop();}
});
it.each(['text','title','revision','scope','unknown_chunk'] as const)('H1-B forged %s retrieval cannot become authoritative response evidence',async corruption=>{
 const doc=await document(),valid=await search(),candidate={...valid.chunks[0]};
 if(corruption==='text')candidate.text='위조 본문';if(corruption==='title')candidate.title='위조 제목';if(corruption==='revision')candidate.revision='999';if(corruption==='unknown_chunk')candidate.chunkId='missing';
 if(corruption==='scope'){const other=(await store.mutateKnowledge(sessionId,IDENTITY_IDS[1],randomUUID(),{title:candidate.title,body:candidate.text})).result;candidate.documentId=other.documentId;}
 const s=await selected(),revision=await store.knowledgeRevision(sessionId,identityId);
 await expect(store.commitKnowledge(s,{query,chunks:[candidate]},revision)).rejects.toThrow();expect((await db.pool.query('SELECT * FROM response_runs')).rowCount).toBe(0);expect(doc.documentId).toBeTruthy();
});
it('H1-B model cannot cite an absent source ID and its failure releases busy',async()=>{
 await document();const t=await setup({provider:{answerKnowledge:async()=>({sentences:['없는 출처의 답이야.'],status:'answered',citationIds:['K99']})}});
 try{await request(t.co);await vi.waitFor(()=>expect(t.failure).toHaveBeenCalledWith('invalid_knowledge_citation'));expect(t.send.mock.calls.filter(([k])=>k==='speech.segment')).toEqual([]);expect(await store.busy()).toBe(false);expect(await store.latestKnowledgeAnswer(sessionId,identityId)).toMatchObject({status:'failed',sentences:[],citations:[]});}finally{await t.co.stop();}
});
it('H1-B cancellation while model is pending prevents output and a late result cannot restore busy',async()=>{
 await document();const gate=deferred(),entered=deferred(),t=await setup({provider:{answerKnowledge:async()=>{entered.release();await gate.promise;return {sentences:['필터는 여섯 달마다 교체해.'],status:'answered',citationIds:['K1']};}}});
 try{await request(t.co);await entered.promise;const r=(await db.pool.query("SELECT id FROM response_runs WHERE status IN ('planned','generating')")).rows[0];await t.co.cancel(sessionId,randomUUID(),r.id);gate.release();await t.co.stop();expect(t.send.mock.calls.filter(([k])=>k==='speech.segment')).toEqual([]);expect(await store.busy()).toBe(false);}finally{gate.release();await t.co.stop();}
});
it('H1-B deleting an already-sent source rejects stale Stage ACK and hides its citation',async()=>{
 const doc=await document(),t=await setup();try{await request(t.co);const [sent]=await delivered(t);await store.mutateKnowledge(sessionId,identityId,randomUUID(),{documentId:doc.documentId,expectedRevision:'1',delete:true});
  const payload={responseId:sent.responseId,segmentId:sent.segmentId,generationEpoch:sent.generationEpoch,outputEpoch:sent.outputEpoch};await expect(store.report(sessionId,randomUUID(),'caption.shown',payload,t.clientId)).rejects.toThrow('stale_epoch');expect(await store.latestKnowledgeAnswer(sessionId,identityId)).toBeNull();expect(await store.busy()).toBe(false);
 }finally{await t.co.stop();}
});
it('H1-B no-source answer explicitly says not found, has no citations and completes delivery',async()=>{
 const t=await setup();try{await request(t.co);await acknowledge(t);expect(await store.latestKnowledgeAnswer(sessionId,identityId)).toMatchObject({status:'completed',answerStatus:'not_found',sentences:['지정한 자료에서 확인하지 못했어.'],citations:[]});expect(await store.busy()).toBe(false);}finally{await t.co.stop();}
});
it('H1-B conflicting answer preserves two separate authoritative references',async()=>{
 const first=await document(),second=(await store.mutateKnowledge(sessionId,identityId,randomUUID(),{title:'합성 필터의 별도 안내',body:'합성 필터는 일 년에 한 번 교체한다.'})).result;
 const t=await setup({provider:{answerKnowledge:async()=>({sentences:['한 안내는 여섯 달, 다른 안내는 일 년이라 서로 달라.'],status:'conflict',citationIds:['K1','K2']})}});
 try{await request(t.co);await acknowledge(t);const answer=await store.latestKnowledgeAnswer(sessionId,identityId);expect(answer).toMatchObject({status:'completed',answerStatus:'conflict'});expect(answer?.citations.map(c=>c.documentId).sort()).toEqual([first.documentId,second.documentId].sort());}finally{await t.co.stop();}
});
it('H1-B mutation idempotency avoids duplicate revisions and rejects request reuse for different content',async()=>{
 const id=randomUUID(),input={title:'합성 멱등 자료',body:'중복 요청은 같은 한 문서만 만든다.'};
 const first=await store.mutateKnowledge(sessionId,identityId,id,input),again=await store.mutateKnowledge(sessionId,identityId,id,input);
 expect(again.result).toEqual(first.result);expect(await store.knowledgeRevision(sessionId,identityId)).toBe('1');expect(await store.knowledgeDocuments(sessionId,identityId)).toHaveLength(1);
 await expect(store.mutateKnowledge(sessionId,identityId,id,{...input,body:'다른 자료'})).rejects.toThrow('idempotency_conflict');expect(await store.knowledgeRevision(sessionId,identityId)).toBe('1');
});
it('H1-B redaction removes completed knowledge from ordinary history and cancels a dependent ordinary response',async()=>{
 const doc=await document(),t=await setup();let oldResponseId:string;
 try{await request(t.co);const [segment]=await delivered(t);oldResponseId=segment.responseId;await acknowledge(t);}finally{await t.co.stop();}
 const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId,text:'방금 설명을 기억해?'}),ordinary=(await store.select(accepted.eventId))!;
 expect(ordinary.conversation.turns.some(turn=>turn.source.kind==='response'&&turn.source.id===oldResponseId)).toBe(true);
 const result=await store.commitAppraisal(ordinary,{...neutralAppraisal,target:'character',act:'question',strength:0,uncertain:false,evidence_refs:[accepted.eventId]},{provider:'synthetic-fixture',model:'recorded-v1'});expect(result.response).toBeTruthy();
 await store.mutateKnowledge(sessionId,identityId,randomUUID(),{documentId:doc.documentId,expectedRevision:'1',title:'합성 새 필터 안내',body:'필터는 일 년마다 교체한다.'});
 const dependent=(await db.pool.query('SELECT status FROM response_runs WHERE id=$1',[result.response!.id])).rows[0];expect(dependent.status).toBe('cancelled');
 const old=(await db.pool.query('SELECT knowledge_context FROM response_runs WHERE id=$1',[oldResponseId])).rows[0].knowledge_context;
 expect(old).toBeNull();expect((await db.pool.query('SELECT text FROM speech_segments WHERE response_id=$1',[oldResponseId])).rows.every(row=>row.text===null)).toBe(true);
 const next=await store.acceptChat(sessionId,randomUUID(),{identityId,text:'이제 다른 이야기를 해줘.'}),nextSelected=(await store.select(next.eventId))!;
 expect(nextSelected.conversation.turns.some(turn=>turn.source.kind==='response'&&turn.source.id===oldResponseId)).toBe(false);
 expect(JSON.stringify(nextSelected.conversation)).not.toContain('여섯 달');
});
it('H1-B evidence-backed synthetic insults retain formal speech and frustration through search',async()=>{
 store=new Store(db,undefined,()=>now,jevEvidenceVerifier);await document();
 for(let n=0;n<2;n++){
  const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId,text:'너는 쓸모없는 쓰레기야. 꺼져.'}),s=(await store.select(accepted.eventId))!;
  const judged=mapJevResponse(recordedJevResponse('criticism','character',3,3),accepted.eventId),committed=await store.commitAppraisal(s,judged.appraisal,judged.metadata);
  if(committed.response)await store.failResponse(committed.response.id,'fixture_no_stage');now+=1000;
 }
 const before=await store.state();expect(before.body.affect.frustration.value).toBeGreaterThan(.1);expect(before.body.affect.frustration.causes.some(c=>c.targetId===identityId)).toBe(true);
 const answer=vi.fn(async(_plan:Plan,_context:DialogueContext):Promise<KnowledgeAnswer>=>({sentences:['필터 교체 주기는 여섯 달입니다.'],status:'answered',citationIds:['K1']}));
 const t=await setup({provider:{answerKnowledge:answer}});
 try{await request(t.co);await acknowledge(t);expect(answer.mock.calls[0][0].speechStyle?.register).toBe('formal');expect(answer.mock.calls[0][1].emotion?.frustration).toBeGreaterThan(.1);expect((await store.state()).body.affect.frustration.value).toBeGreaterThan(.1);expect(t.evaluate).not.toHaveBeenCalled();expect((await store.latestKnowledgeAnswer(sessionId,identityId))?.sentences).toEqual(['필터 교체 주기는 여섯 달입니다.']);}finally{await t.co.stop();}
});
