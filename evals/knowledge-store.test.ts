import { beforeAll,beforeEach,afterAll,it,expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp,writeFile,rm,symlink,mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { testDatabase,reset,IDENTITY_IDS,CHARACTER_ID } from './helpers.ts';
import { Store } from '../packages/database/src/store.ts';
import { migrate } from '../packages/database/src/migrate.ts';
import { putKnowledgeDocument,deleteKnowledgeDocument,listKnowledgeDocuments,currentKnowledgeRevision,splitKnowledgeText,type KnowledgeScope } from '../packages/database/src/knowledge-store.ts';
import { readExplicitKnowledgeFile } from '../scripts/import-knowledge.ts';
let db:Awaited<ReturnType<typeof testDatabase>>,store:Store,scope:KnowledgeScope,temp:string;
beforeAll(async()=>{db=await testDatabase();temp=await mkdtemp(join(tmpdir(),'h1-import-'));});
beforeEach(async()=>{await reset(db);store=new Store(db);const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());scope={characterId:CHARACTER_ID,sessionId,identityId:IDENTITY_IDS[0]};});
afterAll(async()=>{await db?.close();if(temp)await rm(temp,{recursive:true,force:true});});
const put=(body='필터 교체: 여섯 달에 한 번.',extra:Record<string,string>={})=>store.locked(c=>putKnowledgeDocument(c,scope,{title:'합성 공기청정기',body,...extra}));
it('H1 migration reruns without loss; documents retain scoped revision and authoritative chunks',async()=>{
 const doc=await put('첫 문단.\n\n둘째 문단.');await migrate(db);
 expect(doc).toMatchObject({revision:'1',collectionRevision:'1',deleted:false});
 expect(await store.locked(c=>listKnowledgeDocuments(c,scope))).toEqual([{documentId:doc.documentId,title:'합성 공기청정기',revision:'1',deleted:false}]);
 const rows=(await db.pool.query('SELECT revision,chunk_id,ordinal,body FROM knowledge_chunks WHERE document_id=$1 ORDER BY ordinal',[doc.documentId])).rows;
 expect(rows).toEqual([{revision:'1',chunk_id:'c1',ordinal:0,body:'첫 문단.'},{revision:'1',chunk_id:'c2',ordinal:1,body:'둘째 문단.'}]);
});
it('H1 edit and deletion replace old text, advance fences, and reject stale edits without mutation',async()=>{
 const doc=await put();
 const updated=await put('필터 교체: 일 년에 한 번.',{documentId:doc.documentId,expectedRevision:'1'});
 expect(updated).toMatchObject({revision:'2',collectionRevision:'2'});
 await expect(put('오래된 수정',{documentId:doc.documentId,expectedRevision:'1'})).rejects.toThrow('knowledge_revision_conflict');
 expect((await db.pool.query('SELECT revision,body FROM knowledge_chunks WHERE document_id=$1',[doc.documentId])).rows).toEqual([{revision:'2',body:'필터 교체: 일 년에 한 번.'}]);
 await expect(store.locked(c=>deleteKnowledgeDocument(c,scope,{documentId:doc.documentId,expectedRevision:'1'}))).rejects.toThrow('knowledge_revision_conflict');
 expect(await store.locked(c=>currentKnowledgeRevision(c,scope))).toBe('2');
 expect(await store.locked(c=>deleteKnowledgeDocument(c,scope,{documentId:doc.documentId,expectedRevision:'2'}))).toMatchObject({revision:'3',collectionRevision:'3',deleted:true});
 expect((await db.pool.query('SELECT * FROM knowledge_chunks WHERE document_id=$1',[doc.documentId])).rowCount).toBe(0);
 expect(await store.locked(c=>listKnowledgeDocuments(c,scope))).toEqual([]);
 await expect(put('복구',{documentId:doc.documentId,expectedRevision:'3'})).rejects.toThrow('knowledge_not_found');
});
it('H1 another identity or session cannot see or replace a document',async()=>{
 const doc=await put(),other={...scope,identityId:IDENTITY_IDS[1]};
 expect(await store.locked(c=>listKnowledgeDocuments(c,other))).toEqual([]);
 await expect(store.locked(c=>putKnowledgeDocument(c,other,{documentId:doc.documentId,expectedRevision:'0',title:'남의 자료',body:'교체'}))).rejects.toThrow('knowledge_not_found');
 await expect(store.locked(c=>deleteKnowledgeDocument(c,other,{documentId:doc.documentId,expectedRevision:'1'}))).rejects.toThrow('knowledge_not_found');
 await store.stopSession(scope.sessionId,randomUUID());const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
 expect(await store.locked(c=>listKnowledgeDocuments(c,{...scope,sessionId}))).toEqual([]);
 await expect(store.locked(c=>listKnowledgeDocuments(c,scope))).rejects.toThrow('session_closed');
 await expect(store.locked(c=>putKnowledgeDocument(c,{...scope,sessionId},{documentId:doc.documentId,expectedRevision:'0',title:'다른 세션',body:'교체'}))).rejects.toThrow('knowledge_not_found');
});
it('H1 caller transaction rollback preserves text and collection fence',async()=>{
 const doc=await put();
 await expect(store.locked(async c=>{await putKnowledgeDocument(c,scope,{documentId:doc.documentId,expectedRevision:'1',title:'변경',body:'변경'});throw new Error('simulated_database_failure');})).rejects.toThrow('simulated_database_failure');
 expect(await store.locked(c=>currentKnowledgeRevision(c,scope))).toBe('1');
 expect((await db.pool.query('SELECT revision,body FROM knowledge_chunks WHERE document_id=$1',[doc.documentId])).rows).toEqual([{revision:'1',body:'필터 교체: 여섯 달에 한 번.'}]);
});
it('H1 concurrent same-revision changes admit one writer under character lock',async()=>{
 const doc=await put();
 const results=await Promise.allSettled([put('수정 A',{documentId:doc.documentId,expectedRevision:'1'}),put('수정 B',{documentId:doc.documentId,expectedRevision:'1'})]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
 expect(await store.locked(c=>currentKnowledgeRevision(c,scope))).toBe('2');
});
it('H1 bounds input, rejects NUL and chunks text without dropped Unicode content',async()=>{
 await expect(put('가'.repeat(12000))).rejects.toThrow();await expect(put('가\0나')).rejects.toThrow();
 expect(await store.locked(c=>currentKnowledgeRevision(c,scope))).toBe('0');
 const body='가'.repeat(2600)+'😀';const chunks=splitKnowledgeText(body);expect(chunks.map(x=>x.text).join('')).toBe(body);expect(chunks.map(x=>x.chunkId)).toEqual(['c1','c2','c3','c4','c5','c6']);
 expect(splitKnowledgeText('😀'.repeat(1300)).every(x=>Buffer.byteLength(x.text,'utf8')<=1920)).toBe(true);
});
it('H1 explicit file import allows UTF8 text and rejects private names, invalid UTF8, oversized and binary files',async()=>{
 const good=join(temp,'synthetic.md');await writeFile(good,'# 합성 안내\n\n필터는 여섯 달마다 교체.');expect(await readExplicitKnowledgeFile(good)).toMatchObject({title:'synthetic',body:'# 합성 안내\n\n필터는 여섯 달마다 교체.'});
 for(const [name,body] of [['private-key.txt','합성'],['bad.txt',Buffer.from([0xff,0xfe])],['large.txt','a'.repeat(32769)],['data.bin','합성'],['nul.txt','a\0b']] as const){const file=join(temp,name);await writeFile(file,body);await expect(readExplicitKnowledgeFile(file)).rejects.toThrow();}
 await expect(readExplicitKnowledgeFile(temp)).rejects.toThrow();
});
it('H1 explicit file import rejects directory symlinks and path-disguised credential directories',async()=>{
 const real=join(temp,'actual'),linked=join(temp,'linked');await mkdir(real);await writeFile(join(real,'synthetic.txt'),'합성');await symlink(real,linked,process.platform==='win32'?'junction':'dir');
 await expect(readExplicitKnowledgeFile(join(linked,'synthetic.txt'))).rejects.toThrow('knowledge_symlink_not_allowed');
 const privateDir=join(temp,'.aws');await mkdir(privateDir);await writeFile(join(privateDir,'notes.md'),'합성');await expect(readExplicitKnowledgeFile(join(privateDir,'notes.md'))).rejects.toThrow('knowledge_file_not_allowed');
});
