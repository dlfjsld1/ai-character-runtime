import {randomUUID} from 'node:crypto';
import type pg from 'pg';
import {z} from 'zod';
import {RuntimeError} from '../../contracts/src/domain.ts';
import {personalFactInputSchema,personalRevisionSchema,personalFactChangeSchema,type PersonalFactChange,type PersonalFactSnapshot} from '../../contracts/src/personal-facts.ts';
import {assertKnowledgeScope,type KnowledgeScope} from './knowledge-store.ts';

// The owning Store holds the character lock and commits mutation + invalidation together.
export async function readPersonalFacts(c:pg.PoolClient,scope:KnowledgeScope):Promise<PersonalFactSnapshot>{
 await assertKnowledgeScope(c,scope);
 const revision=(await c.query('SELECT revision FROM personal_fact_scopes WHERE character_id=$1 AND identity_id=$2',[scope.characterId,scope.identityId])).rows[0]?.revision??'0';
 const rows=(await c.query('SELECT id,key,value,revision FROM personal_facts WHERE character_id=$1 AND identity_id=$2 AND deleted_at IS NULL ORDER BY key,id',[scope.characterId,scope.identityId])).rows;
 if(rows.length>20)throw new RuntimeError('personal_fact_limit',409);
 return {characterId:scope.characterId,identityId:scope.identityId,revision:String(revision),facts:rows.map(row=>({id:row.id,key:row.key,value:row.value,revision:String(row.revision)}))};
}
export async function changePersonalFact(c:pg.PoolClient,scope:KnowledgeScope,change:PersonalFactChange){
 await assertKnowledgeScope(c,scope);change=personalFactChangeSchema.parse(change);
 const input=change.kind==='delete'?null:personalFactInputSchema.parse(change.input);
 let id:string,revision='1';
 if(change.kind==='create'){
  const count=(await c.query('SELECT count(*) FROM personal_facts WHERE character_id=$1 AND identity_id=$2 AND deleted_at IS NULL',[scope.characterId,scope.identityId])).rows[0].count;
  if(Number(count)>=20)throw new RuntimeError('personal_fact_limit',409);
  id=randomUUID();
 }else{
  id=z.uuid().parse(change.id);personalRevisionSchema.parse(change.expectedRevision);
  const row=(await c.query('SELECT revision FROM personal_facts WHERE id=$1 AND character_id=$2 AND identity_id=$3 AND deleted_at IS NULL FOR UPDATE',[id,scope.characterId,scope.identityId])).rows[0];
  if(!row)throw new RuntimeError('personal_fact_not_found',404);
  if(String(row.revision)!==change.expectedRevision)throw new RuntimeError('personal_fact_revision_conflict',409);
  revision=(BigInt(row.revision)+1n).toString();
 }
 if(input&&(await c.query('SELECT 1 FROM personal_facts WHERE character_id=$1 AND identity_id=$2 AND key=$3 AND id<>$4 AND deleted_at IS NULL',[scope.characterId,scope.identityId,input.key,id])).rowCount)throw new RuntimeError('personal_fact_key_conflict',409);
 if(change.kind==='create')await c.query('INSERT INTO personal_facts(id,character_id,identity_id,key,value) VALUES($1,$2,$3,$4,$5)',[id,scope.characterId,scope.identityId,input!.key,input!.value]);
 else if(change.kind==='update')await c.query('UPDATE personal_facts SET key=$2,value=$3,revision=$4,updated_at=now() WHERE id=$1',[id,input!.key,input!.value,revision]);
 else await c.query('UPDATE personal_facts SET value=NULL,revision=$2,deleted_at=now(),updated_at=now() WHERE id=$1',[id,revision]);
 const collection=(await c.query('INSERT INTO personal_fact_scopes(character_id,identity_id,revision) VALUES($1,$2,1) ON CONFLICT(character_id,identity_id) DO UPDATE SET revision=personal_fact_scopes.revision+1 RETURNING revision',[scope.characterId,scope.identityId])).rows[0];
 // Mutation receipts deliberately omit both key and value (including on retries).
 return {id,revision,collectionRevision:String(collection.revision),deleted:change.kind==='delete'};
}
