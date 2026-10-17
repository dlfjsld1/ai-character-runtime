import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { z } from 'zod';
import { RuntimeError } from '../../contracts/src/domain.ts';

export const knowledgeScopeSchema=z.object({characterId:z.uuid(),sessionId:z.uuid(),identityId:z.uuid()}).strict();
export type KnowledgeScope=z.infer<typeof knowledgeScopeSchema>;
const revisionSchema=z.string().regex(/^(0|[1-9][0-9]*)$/).refine(v=>BigInt(v)<9223372036854775807n);
export const knowledgePutSchema=z.object({documentId:z.uuid().optional(),expectedRevision:revisionSchema.optional(),title:z.string().trim().min(1).max(160),body:z.string().trim().min(1).refine(v=>Buffer.byteLength(v,'utf8')<=32768&&!v.includes('\0'))}).strict();
export type KnowledgePut=z.infer<typeof knowledgePutSchema>;
export type KnowledgeDocument={documentId:string;title:string;revision:string;deleted:boolean};

// All mutations must run inside the caller's character_state lock and transaction.
// The caller also invalidates dependent responses before committing this change.
async function assertScope(c:pg.PoolClient,scope:KnowledgeScope){
 knowledgeScopeSchema.parse(scope);
 if(!(await c.query("SELECT 1 FROM sessions WHERE id=$1 AND character_id=$2 AND status='active'",[scope.sessionId,scope.characterId])).rowCount)throw new RuntimeError('session_closed');
 if(!(await c.query('SELECT 1 FROM identities WHERE id=$1',[scope.identityId])).rowCount)throw new RuntimeError('identity_not_found',404);
}
export function splitKnowledgeText(body:string){
 const chunks:string[]=[];
 for(const paragraph of body.replace(/\r\n?/g,'\n').split(/\n\s*\n/).map(v=>v.trim()).filter(Boolean)){
  // Slice Unicode code points, keeping surrogate pairs intact.
  // At most 1,920 UTF-8 bytes, including four-byte code points.
  const points=[...paragraph];for(let i=0;i<points.length;i+=480)chunks.push(points.slice(i,i+480).join(''));
 }
 return chunks.map((text,ordinal)=>({chunkId:`c${ordinal+1}`,ordinal,text}));
}
export async function currentKnowledgeRevision(c:pg.PoolClient,scope:KnowledgeScope){
 await assertScope(c,scope);return String((await c.query('SELECT knowledge_revision FROM sessions WHERE id=$1 AND character_id=$2',[scope.sessionId,scope.characterId])).rows[0].knowledge_revision);
}
export async function listKnowledgeDocuments(c:pg.PoolClient,scope:KnowledgeScope):Promise<KnowledgeDocument[]>{
 await assertScope(c,scope);
 return (await c.query('SELECT id,title,revision FROM knowledge_documents WHERE character_id=$1 AND session_id=$2 AND identity_id=$3 AND deleted_at IS NULL ORDER BY title,id',[scope.characterId,scope.sessionId,scope.identityId])).rows.map(r=>({documentId:r.id,title:r.title,revision:String(r.revision),deleted:false}));
}
async function bumpCollection(c:pg.PoolClient,scope:KnowledgeScope){return String((await c.query('UPDATE sessions SET knowledge_revision=knowledge_revision+1 WHERE id=$1 AND character_id=$2 RETURNING knowledge_revision',[scope.sessionId,scope.characterId])).rows[0].knowledge_revision);}
export async function putKnowledgeDocument(c:pg.PoolClient,scope:KnowledgeScope,input:KnowledgePut){
 await assertScope(c,scope);const parsed=knowledgePutSchema.parse(input),id=parsed.documentId??randomUUID();
 const row=(await c.query('SELECT * FROM knowledge_documents WHERE id=$1 AND character_id=$2 AND session_id=$3 AND identity_id=$4 FOR UPDATE',[id,scope.characterId,scope.sessionId,scope.identityId])).rows[0];
 let revision='1';
 if(row){
  if(row.deleted_at)throw new RuntimeError('knowledge_not_found',404);
  if(parsed.expectedRevision!==String(row.revision))throw new RuntimeError('knowledge_revision_conflict');
  revision=(BigInt(row.revision)+1n).toString();
  await c.query('DELETE FROM knowledge_chunks WHERE document_id=$1',[id]);
  await c.query('UPDATE knowledge_documents SET title=$2,revision=$3 WHERE id=$1',[id,parsed.title,revision]);
 }else{
  if(parsed.expectedRevision!==undefined&&parsed.expectedRevision!=='0')throw new RuntimeError('knowledge_revision_conflict');
  const inserted=await c.query('INSERT INTO knowledge_documents(id,character_id,session_id,identity_id,title,revision) VALUES($1,$2,$3,$4,$5,1) ON CONFLICT(id) DO NOTHING RETURNING id',[id,scope.characterId,scope.sessionId,scope.identityId,parsed.title]);
  if(!inserted.rowCount)throw new RuntimeError('knowledge_not_found',404);
 }
 const chunks=splitKnowledgeText(parsed.body);
 for(const chunk of chunks)await c.query('INSERT INTO knowledge_chunks(document_id,revision,chunk_id,ordinal,body) VALUES($1,$2,$3,$4,$5)',[id,revision,chunk.chunkId,chunk.ordinal,chunk.text]);
 const collectionRevision=await bumpCollection(c,scope);
 return {documentId:id,title:parsed.title,revision,collectionRevision,deleted:false};
}
export async function deleteKnowledgeDocument(c:pg.PoolClient,scope:KnowledgeScope,input:{documentId:string;expectedRevision:string}){
 await assertScope(c,scope);z.uuid().parse(input.documentId);revisionSchema.parse(input.expectedRevision);
 const row=(await c.query('SELECT * FROM knowledge_documents WHERE id=$1 AND character_id=$2 AND session_id=$3 AND identity_id=$4 AND deleted_at IS NULL FOR UPDATE',[input.documentId,scope.characterId,scope.sessionId,scope.identityId])).rows[0];
 if(!row)throw new RuntimeError('knowledge_not_found',404);
 if(String(row.revision)!==input.expectedRevision)throw new RuntimeError('knowledge_revision_conflict');
 const revision=(BigInt(row.revision)+1n).toString();
 await c.query('DELETE FROM knowledge_chunks WHERE document_id=$1',[input.documentId]);
 await c.query('UPDATE knowledge_documents SET revision=$2,deleted_at=now() WHERE id=$1',[input.documentId,revision]);
 return {documentId:input.documentId,title:String(row.title),revision,collectionRevision:await bumpCollection(c,scope),deleted:true};
}
