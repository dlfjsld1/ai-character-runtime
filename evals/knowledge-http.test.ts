import { beforeAll,beforeEach,afterEach,afterAll,it,expect,vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { testDatabase,reset,fixtureProvider,mockJevAppraiser,IDENTITY_IDS,CHARACTER_ID } from './helpers.ts';
import { Store } from '../packages/database/src/store.ts';
import { createServer } from '../apps/runtime/src/http/server.ts';
import { PostgresKnowledgeRetriever } from '../packages/adapters/src/postgres-knowledge.ts';
let db:Awaited<ReturnType<typeof testDatabase>>,store:Store,runtime:Awaited<ReturnType<typeof createServer>>,studioToken:string,stageToken:string,sessionId:string;
const origin='http://127.0.0.1:3001',identityId=IDENTITY_IDS[0],query='합성 필터 교체 주기';
const documentInput={identityId,title:'합성 필터 설명',body:'합성 필터의 교체 주기는 여섯 달이다.'};
beforeAll(async()=>{db=await testDatabase();});
beforeEach(async()=>{
 await reset(db);store=new Store(db);runtime=await createServer(store,fixtureProvider,mockJevAppraiser(),{knowledge:new PostgresKnowledgeRetriever(db.pool),serveStatic:false,timer:false});
 const exchange=await runtime.app.inject({method:'POST',url:'/api/auth/exchange',headers:{origin,'content-type':'application/json'},payload:{code:runtime.studioCode,clientInstanceId:randomUUID()}});studioToken=exchange.json().data.accessToken;
 const pair=(await request('/api/stage-pairings','POST',{})).json().data;stageToken=(await request('/api/auth/exchange','POST',{code:pair.code,clientInstanceId:randomUUID()})).json().data.accessToken;
 sessionId=randomUUID();expect((await request('/api/sessions','POST',{sessionId,characterId:CHARACTER_ID,configVersion:'1'})).statusCode).toBe(200);
});
afterEach(async()=>{await runtime?.app.close();});afterAll(async()=>{await db?.close();});
function request(path:string,method='GET',body?:object,headers:Record<string,string>={}){return runtime.app.inject({method:method as 'GET'|'POST'|'DELETE',url:path,headers:{origin,authorization:`Bearer ${studioToken}`,...(body?{'content-type':'application/json'}:{}),'idempotency-key':randomUUID(),...headers},...(body?{payload:body}:{})});}
const listPath=(identity=identityId,session=sessionId)=>`/api/sessions/${session}/knowledge?identityId=${identity}`;
const answerPath=(identity=identityId,session=sessionId)=>`/api/sessions/${session}/knowledge-answer?identityId=${identity}`;
const postPath=(session=sessionId)=>`/api/sessions/${session}/knowledge`;
const deletePath=(documentId:string,identity=identityId,session=sessionId)=>`/api/sessions/${session}/knowledge/${documentId}?identityId=${identity}`;
async function create(key=randomUUID()){const result=await request(postPath(),'POST',documentInput,{'idempotency-key':key});expect(result.statusCode).toBe(200);return result.json().data as {documentId:string;revision:string};}
async function planned(){const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId,text:query,intent:'knowledge'}),selected=(await store.select(accepted.eventId))!;
 const result=await new PostgresKnowledgeRetriever(db.pool).search({scope:{characterId:store.characterId,sessionId,identityId},query}),committed=await store.commitKnowledge(selected,result,await store.knowledgeRevision(sessionId,identityId));expect(committed.response).toBeTruthy();return {accepted,response:committed.response!};}

it.each(['GET documents','GET answer','POST document','DELETE document'] as const)('H1 HTTP %s rejects wrong origin, absent credentials, and Stage role',async route=>{
 const doc=await create(),path=route==='GET documents'?listPath():route==='GET answer'?answerPath():route==='POST document'?postPath():deletePath(doc.documentId),method=route.split(' ')[0],body=method==='POST'?documentInput:undefined;
 for(const [headers,expected] of [[{origin:'https://attacker.invalid'},403],[{authorization:''},401],[{authorization:`Bearer ${stageToken}`},403]] as const){const result=await request(path,method,body,{'if-match':'"1"',...headers});expect(result.statusCode).toBe(expected);expect(JSON.stringify(result.json())).not.toContain(documentInput.body);}
 expect(await store.knowledgeRevision(sessionId,identityId)).toBe('1');expect(await store.knowledgeDocuments(sessionId,identityId)).toHaveLength(1);
});
it('H1 HTTP explicitly chosen identity cannot see or delete another identity document',async()=>{
 const doc=await create();expect((await request(listPath(IDENTITY_IDS[1]))).json().data).toEqual([]);expect((await request(answerPath(IDENTITY_IDS[1]))).json().data).toBeNull();
 const result=await request(deletePath(doc.documentId,IDENTITY_IDS[1]),'DELETE',undefined,{'if-match':'"1"'});expect(result.statusCode).toBe(404);expect(await store.knowledgeRevision(sessionId,identityId)).toBe('1');
});
it('H1 HTTP malformed or unknown sessions and identities cannot mutate or return private data',async()=>{
 const doc=await create();
 for(const id of ['bad-uuid',randomUUID()]){
  for(const path of [listPath(identityId,id),answerPath(identityId,id)]){const response=await request(path);expect(response.statusCode).toBeGreaterThanOrEqual(400);expect(JSON.stringify(response.json())).not.toContain(documentInput.title);}
  expect((await request(postPath(id),'POST',documentInput)).statusCode).toBeGreaterThanOrEqual(400);
  expect((await request(deletePath(doc.documentId,identityId,id),'DELETE',undefined,{'if-match':'"1"'})).statusCode).toBeGreaterThanOrEqual(400);
  for(const path of [listPath(id),answerPath(id)])expect((await request(path)).statusCode).toBeGreaterThanOrEqual(400);
  expect((await request(postPath(),'POST',{...documentInput,identityId:id})).statusCode).toBeGreaterThanOrEqual(400);
  expect((await request(deletePath(doc.documentId,id),'DELETE',undefined,{'if-match':'"1"'})).statusCode).toBeGreaterThanOrEqual(400);
 }
 expect(await store.knowledgeRevision(sessionId,identityId)).toBe('1');
});
it('H1 HTTP CAS errors and an idempotent retry preserve active output and collection revision',async()=>{
 const key=randomUUID(),doc=await create(key),running=await planned(),epoch=(await store.state()).generationEpoch,barrier=vi.spyOn(runtime.coordinator,'barrier');
 const stale=await request(postPath(),'POST',{...documentInput,documentId:doc.documentId,expectedRevision:'2',body:'오래된 수정 요청'});expect(stale.statusCode).toBe(409);
 expect((await request(deletePath(doc.documentId),'DELETE',undefined,{'if-match':'"2"'})).statusCode).toBe(409);
 const replay=await request(postPath(),'POST',documentInput,{'idempotency-key':key});expect(replay.statusCode).toBe(200);expect(replay.json().data.documentId).toBe(doc.documentId);expect(replay.json().data.revision).toBe('1');
 expect((await request(postPath(),'POST',{...documentInput,body:'요청 키 재사용'}, {'idempotency-key':key})).statusCode).toBe(409);
 expect(barrier).not.toHaveBeenCalled();expect(await store.knowledgeRevision(sessionId,identityId)).toBe('1');expect((await store.state()).generationEpoch).toBe(epoch);expect((await db.pool.query('SELECT status FROM response_runs WHERE id=$1',[running.response.id])).rows[0].status).toBe('planned');
 const updated=await request(postPath(),'POST',{...documentInput,documentId:doc.documentId,expectedRevision:'1',body:'합성 필터는 일 년마다 교체한다.'});expect(updated.statusCode).toBe(200);expect(barrier).toHaveBeenCalledWith(running.response.id,'knowledge_changed',epoch);expect((await db.pool.query('SELECT status FROM response_runs WHERE id=$1',[running.response.id])).rows[0].status).toBe('cancelled');
});
it('H1 HTTP deleting the search input redacts generated knowledge and captions without deleting imported documents',async()=>{
 const doc=await create(),running=await planned(),clientId=randomUUID(),owner=await store.grantOwner(sessionId,randomUUID(),clientId),sentences=['필터 교체 주기는 여섯 달이야.'];
 const generated=(await store.generated(running.response.id,sentences,{clientId,outputEpoch:owner.outputEpoch},{sentences,status:'answered',citationIds:['K1']}))!;
 for(const segment of generated.segments){const payload={responseId:running.response.id,segmentId:segment.id,generationEpoch:generated.response.generation_epoch,outputEpoch:String(owner.outputEpoch)};await store.report(sessionId,randomUUID(),'caption.shown',payload,clientId);await store.report(sessionId,randomUUID(),'caption.finished',payload,clientId);}
 expect((await request(answerPath())).json().data.citations[0].documentId).toBe(doc.documentId);
 const removed=await request(`/api/events/${running.accepted.eventId}`,'DELETE',undefined,{'if-match':'"1"'});expect(removed.statusCode).toBe(200);
 const row=(await db.pool.query('SELECT plan,conversation_refs,knowledge_context FROM response_runs WHERE id=$1',[running.response.id])).rows[0];expect(row).toEqual({plan:null,conversation_refs:null,knowledge_context:null});expect((await db.pool.query('SELECT text FROM speech_segments WHERE response_id=$1',[running.response.id])).rows.every(r=>r.text===null)).toBe(true);
 expect((await request(answerPath())).json().data).toBeNull();expect((await request(listPath())).json().data[0].documentId).toBe(doc.documentId);expect(await store.busy()).toBe(false);
});
