import {readFileSync,writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {testDatabase,reset,CHARACTER_ID,IDENTITY_IDS} from './helpers.ts';
import {Store} from '../packages/database/src/store.ts';
import {putKnowledgeDocument,deleteKnowledgeDocument} from '../packages/database/src/knowledge-store.ts';
import {PostgresKnowledgeRetriever} from '../packages/adapters/src/postgres-knowledge.ts';
import type {KnowledgeReference,KnowledgeScope} from '../packages/contracts/src/knowledge.ts';

const fixtureText=readFileSync(new URL('./fixtures/knowledge-v1.json',import.meta.url),'utf8'),fixture=JSON.parse(fixtureText);
const results:any[]=[];
let db:Awaited<ReturnType<typeof testDatabase>>,store:Store,retriever:PostgresKnowledgeRetriever,scope:KnowledgeScope;
const matches=(a:KnowledgeReference,b:KnowledgeReference)=>a.documentId===b.documentId&&a.revision===b.revision&&a.chunkId===b.chunkId;
beforeAll(async()=>{
 db=await testDatabase();await reset(db);store=new Store(db);const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
 scope={characterId:CHARACTER_ID,sessionId,identityId:IDENTITY_IDS[0]};retriever=new PostgresKnowledgeRetriever(db.pool);
 for(const document of fixture.documents)await store.locked(async c=>{
  if(document.previousRevision)await putKnowledgeDocument(c,scope,{documentId:document.id,title:document.previousRevision.title,body:document.previousRevision.text});
  const saved=await putKnowledgeDocument(c,scope,{documentId:document.id,title:document.title,body:document.text,...(document.previousRevision?{expectedRevision:document.previousRevision.revision}:{})});
  expect(saved.revision).toBe(document.revision);
 });
});
afterAll(async()=>{
 if(process.env.KNOWLEDGE_RETRIEVAL_REPORT)writeFileSync(process.env.KNOWLEDGE_RETRIEVAL_REPORT,JSON.stringify({fixtureSha256:createHash('sha256').update(fixtureText).digest('hex'),scope:'actual PostgreSQL retrieval only; generated answer semantics and malicious-instruction resistance require H1-B/C',results},null,2));
 await db?.close();
});
it('H1-A actual PostgreSQL retrieval preserves 24 fixed cases and qualifies at >=15/16 answerable cases',async()=>{
 for(const c of fixture.cases){
  const result=await retriever.search({scope,query:c.query});
  const allExpected=c.expectedEvidence.every((ref:KnowledgeReference)=>result.chunks.some(chunk=>matches(chunk,ref)));
  for(const chunk of result.chunks){const doc=fixture.documents.find((d:any)=>d.id===chunk.documentId);expect(doc).toBeDefined();expect(chunk.revision).toBe(doc.revision);expect(doc.chunks.some((candidate:any)=>candidate.chunkId===chunk.chunkId&&candidate.text===chunk.text)).toBe(true);}
  if(c.forbiddenRevision)expect(result.chunks.some(chunk=>chunk.documentId===c.forbiddenRevision.documentId&&chunk.revision===c.forbiddenRevision.revision)).toBe(false);
  results.push({id:c.id,category:c.category,allExpected,candidates:result.chunks.map(({documentId,revision,chunkId})=>({documentId,revision,chunkId})),answerBehavior:c.category==='absent'||c.category==='injection'?'not verified by retrieval':undefined});
 }
 const answerable=results.filter(r=>['direct','variation','multiple'].includes(r.category));expect(answerable).toHaveLength(16);expect(answerable.filter(r=>r.allExpected).length,JSON.stringify(results)).toBeGreaterThanOrEqual(15);
 expect(results.filter(r=>['conflict_revision','injection'].includes(r.category)).every(r=>r.allExpected)).toBe(true);
});
it('H1-A actual SQL excludes other identity/session/character scopes and inactive sessions',async()=>{
 for(const other of [{...scope,identityId:IDENTITY_IDS[1]},{...scope,sessionId:randomUUID()},{...scope,characterId:randomUUID()}])expect((await retriever.search({scope:other,query:'오로라 필터'})).chunks).toEqual([]);
 await store.locked(c=>c.query("UPDATE sessions SET status='ending' WHERE id=$1",[scope.sessionId]));
 expect((await retriever.search({scope,query:'오로라 필터'})).chunks).toEqual([]);
 await store.locked(c=>c.query("UPDATE sessions SET status='active' WHERE id=$1",[scope.sessionId]));
});
it('H1-A deletion removes source immediately from actual SQL retrieval',async()=>{
 const document=fixture.documents[0];await store.locked(c=>deleteKnowledgeDocument(c,scope,{documentId:document.id,expectedRevision:document.revision}));
 expect((await retriever.search({scope,query:'오로라 미니 헤파 필터'})).chunks.some(c=>c.documentId===document.id)).toBe(false);
});
