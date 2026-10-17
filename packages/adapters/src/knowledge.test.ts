import {readFileSync} from 'node:fs';
import {it,expect,vi} from 'vitest';
import {PostgresKnowledgeRetriever,rankKnowledgeChunks} from './postgres-knowledge.ts';
import type {KnowledgeChunk,KnowledgeReference} from '../../contracts/src/knowledge.ts';

const fixture=JSON.parse(readFileSync(new URL('../../../evals/fixtures/knowledge-v1.json',import.meta.url),'utf8'));
const chunks:KnowledgeChunk[]=fixture.documents.flatMap((d:any)=>d.chunks.map((c:any)=>({...c,documentId:d.id,revision:d.revision,title:d.title})));
const matches=(candidate:KnowledgeReference,reference:KnowledgeReference)=>candidate.documentId===reference.documentId&&candidate.revision===reference.revision&&candidate.chunkId===reference.chunkId;
const scope={characterId:'character',sessionId:'session',identityId:'identity'};
it('H1 fixed fixture has eight synthetic documents and the planned 24-case split',()=>{
 expect(fixture.documents).toHaveLength(8);expect(fixture.cases).toHaveLength(24);
 expect(Object.fromEntries(['direct','variation','multiple','absent','conflict_revision','injection'].map(category=>[category,fixture.cases.filter((c:any)=>c.category===category).length]))).toEqual({direct:8,variation:4,multiple:4,absent:4,conflict_revision:2,injection:2});
 for(const document of fixture.documents)expect(document.text).toBe(document.chunks.map((c:any)=>c.text).join('\n\n'));
});
it('H1 Korean lexical candidate includes all necessary chunks in top five for at least 15 of 16 answerable cases',()=>{
 const cases=fixture.cases.filter((c:any)=>['direct','variation','multiple'].includes(c.category));
 const results=cases.map((c:any)=>({id:c.id,passed:c.expectedEvidence.every((ref:KnowledgeReference)=>rankKnowledgeChunks(c.query,chunks).some(chunk=>matches(chunk,ref)))}));
 expect(results.filter((r:any)=>r.passed).length,JSON.stringify(results)).toBeGreaterThanOrEqual(15);
});
it('H1 no-overlap search is empty; relevant product overlap does not prove a missing answer exists',()=>{
 expect(rankKnowledgeChunks('zzzzzz',chunks)).toEqual([]);
 const missing=fixture.cases.find((c:any)=>c.id==='A02');expect(rankKnowledgeChunks(missing.query,chunks).length).toBeGreaterThan(0);expect(missing.expectedEvidence).toEqual([]);
});
it('H1 SQL binds scope only, never interpolates query or document commands',async()=>{
 const query=vi.fn(async(_sql:string,_values?:any[])=>({rows:[]})),input="'; DROP TABLE knowledge_documents; --";
 await new PostgresKnowledgeRetriever({query}).search({scope,query:input});
 expect(query).toHaveBeenCalledOnce();expect(query.mock.calls[0]?.[0]).not.toContain(input);
 const call=vi.mocked(query).mock.calls[0] as unknown as [string,string[]];expect(call[1]).toEqual(['session','character','identity']);
 expect(call[0]).toContain('d.session_id=s.id');expect(call[0]).toContain('d.identity_id=$3');expect(call[0]).toContain('c.revision=d.revision');
});
it('H1 collection overflow and SQL failure fail explicitly without partial candidates',async()=>{
 await expect(new PostgresKnowledgeRetriever({query:async()=>({rows:Array(501).fill({})})}).search({scope,query:'검색'})).rejects.toThrow('knowledge_collection_too_large');
 await expect(new PostgresKnowledgeRetriever({query:async()=>{throw new Error('fixture_db_unavailable');}}).search({scope,query:'검색'})).rejects.toThrow('fixture_db_unavailable');
});
it.each(['',' '.repeat(3),'가'.repeat(2001)])('H1 invalid query is rejected before DB access',async query=>{
 const execute=vi.fn();await expect(new PostgresKnowledgeRetriever({query:execute}).search({scope,query})).rejects.toThrow('knowledge_query_invalid');expect(execute).not.toHaveBeenCalled();
});
