import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest';
import {randomUUID,createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {testDatabase,reset,IDENTITY_IDS,CHARACTER_ID} from './helpers.ts';
import {Store} from '../packages/database/src/store.ts';
import {migrate,assertMigrations} from '../packages/database/src/migrate.ts';
import {changePersonalFact} from '../packages/database/src/personal-fact-store.ts';
import {PostgresKnowledgeRetriever} from '../packages/adapters/src/postgres-knowledge.ts';
let db:Awaited<ReturnType<typeof testDatabase>>,store:Store,sessionId:string;
const identityId=IDENTITY_IDS[0];
beforeAll(async()=>{db=await testDatabase();});
beforeEach(async()=>{await reset(db);store=new Store(db);sessionId=randomUUID();await store.startSession(sessionId,randomUUID());});
afterAll(async()=>{await db?.close();});
const scope=()=>({characterId:CHARACTER_ID,sessionId,identityId});
const create=(key='음료 선호',value='보리차',requestId=randomUUID())=>store.mutatePersonalFact(sessionId,identityId,requestId,{kind:'create',input:{key,value}});
const document=(retention:'session'|'persistent',title='합성 필터',body='필터는 6개월마다 교체한다.')=>store.mutateKnowledge(sessionId,identityId,randomUUID(),{retention,title,body});
async function nextSession(){await store.stopSession(sessionId,randomUUID());sessionId=randomUUID();await store.startSession(sessionId,randomUUID());}
it('P01/P03 persistent documents cross meetings while H1 defaults remain session scoped',async()=>{
 const temporary=await document('session'),persistent=await document('persistent');await nextSession();
 expect((await store.knowledgeDocuments(sessionId,identityId)).map(d=>d.documentId)).toEqual([persistent.result.documentId]);
 expect((await new PostgresKnowledgeRetriever(db.pool).search({scope:scope(),query:'필터 교체 주기'})).chunks.map(c=>c.documentId)).not.toContain(temporary.result.documentId);
 expect(await store.knowledgeRevisions(sessionId,identityId)).toEqual({revision:'0',libraryRevision:'1'});
 await expect(store.mutateKnowledge(sessionId,identityId,randomUUID(),{documentId:temporary.result.documentId,expectedRevision:'1',retention:'persistent',title:'승격 시도',body:'같은 ID'})).rejects.toThrow('knowledge_not_found');
 const edit=await store.mutateKnowledge(sessionId,identityId,randomUUID(),{documentId:persistent.result.documentId,expectedRevision:'1',title:'수정',body:'필터는 12개월마다 교체한다.'});
 expect(edit.result).toMatchObject({retention:'persistent',revision:'2',libraryRevision:'2',collectionRevision:'0'});
 await store.mutateKnowledge(sessionId,identityId,randomUUID(),{documentId:persistent.result.documentId,expectedRevision:'2',delete:true});
 expect((await new PostgresKnowledgeRetriever(db.pool).search({scope:scope(),query:'필터'})).chunks).toEqual([]);
});
it('P04 storage binds owner and active request meeting for persistent documents and explicit facts',async()=>{
 const doc=await document('persistent'),fact=await create();
 expect(await store.knowledgeDocuments(sessionId,IDENTITY_IDS[1])).toEqual([]);
 expect((await store.personalFacts(sessionId,IDENTITY_IDS[1])).facts).toEqual([]);
 await expect(store.mutateKnowledge(sessionId,IDENTITY_IDS[1],randomUUID(),{documentId:doc.result.documentId,expectedRevision:'1',delete:true})).rejects.toThrow('knowledge_not_found');
 await expect(store.mutatePersonalFact(sessionId,IDENTITY_IDS[1],randomUUID(),{kind:'delete',id:fact.result.id,expectedRevision:'1'})).rejects.toThrow('personal_fact_not_found');
 const old=sessionId;await nextSession();
 await expect(store.personalFacts(old,identityId)).rejects.toThrow('session_closed');
 await expect(store.knowledgeDocuments(old,identityId)).rejects.toThrow('session_closed');
 expect((await store.personalFacts(sessionId,identityId)).facts).toMatchObject([{id:fact.result.id,value:'보리차'}]);
});
it('P04 two active characters with the same identity cannot read or change each other data',async()=>{
 const doc=await document('persistent'),fact=await create(),characterId=randomUUID();
 await db.pool.query('INSERT INTO characters(id,display_name) VALUES($1,$2)',[characterId,'두 번째 합성 캐릭터']);
 for(const table of ['character_configs','character_state'])await db.pool.query(`INSERT INTO ${table} SELECT (jsonb_populate_record(NULL::${table},to_jsonb(source)||jsonb_build_object('character_id',$2::uuid))).* FROM ${table} source WHERE character_id=$1`,[CHARACTER_ID,characterId]);
 const other=new Store(db,characterId),otherSession=randomUUID();await other.startSession(otherSession,randomUUID());
 expect(await other.knowledgeDocuments(otherSession,identityId)).toEqual([]);expect((await other.personalFacts(otherSession,identityId)).facts).toEqual([]);
 await expect(other.mutateKnowledge(otherSession,identityId,randomUUID(),{documentId:doc.result.documentId,expectedRevision:'1',delete:true})).rejects.toThrow('knowledge_not_found');
 await expect(other.mutatePersonalFact(otherSession,identityId,randomUUID(),{kind:'delete',id:fact.result.id,expectedRevision:'1'})).rejects.toThrow('personal_fact_not_found');
 expect((await store.personalFacts(sessionId,identityId)).facts).toHaveLength(1);
});
it('P05/P06 explicit facts normalize keys, reject duplicate keys and keep plaintext out of command receipts',async()=>{
 const requestId=randomUUID(),first=await create(' Ａ 음료 ','보리차',requestId);
 expect((await store.personalFacts(sessionId,identityId)).facts).toEqual([{id:first.result.id,key:'A 음료',value:'보리차',revision:'1'}]);
 expect(await create(' Ａ 음료 ','보리차',requestId)).toMatchObject({status:'duplicate',result:first.result});
 await expect(create('A 음료','다른 값')).rejects.toThrow('personal_fact_key_conflict');
 await expect(create('A 음료','다른 값',requestId)).rejects.toThrow('idempotency_conflict');
 const serialized=JSON.stringify((await db.pool.query("SELECT payload FROM events WHERE kind='personal.changed'")).rows);
 expect(serialized).not.toContain('보리차');expect(serialized).not.toContain('음료');
});
it('P06 CAS, idempotent deletion and explicit re-registration cannot resurrect a tombstone',async()=>{
 const first=await create();
 const writes=await Promise.allSettled(['루이보스차','녹차'].map(value=>store.mutatePersonalFact(sessionId,identityId,randomUUID(),{kind:'update',id:first.result.id,expectedRevision:'1',input:{key:'음료 선호',value}})));
 expect(writes.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(writes.filter(r=>r.status==='rejected')).toHaveLength(1);
 const requestId=randomUUID(),change={kind:'delete' as const,id:first.result.id,expectedRevision:'2'};
 await store.mutatePersonalFact(sessionId,identityId,requestId,change);expect((await store.personalFacts(sessionId,identityId)).facts).toEqual([]);
 expect((await db.pool.query('SELECT value,revision FROM personal_facts WHERE id=$1',[first.result.id])).rows[0]).toEqual({value:null,revision:'3'});
 const next=await create();expect(next.result.id).not.toBe(first.result.id);
 expect((await store.mutatePersonalFact(sessionId,identityId,requestId,change)).status).toBe('duplicate');
 expect((await store.personalFacts(sessionId,identityId)).facts).toHaveLength(1);
 await expect(store.mutatePersonalFact(sessionId,identityId,randomUUID(),{kind:'update',id:first.result.id,expectedRevision:'3',input:{key:'음료 선호',value:'부활'}})).rejects.toThrow('personal_fact_not_found');
});
it('P06/P10 value, key and count limits reject excess without changing the collection revision',async()=>{
 await create('😀'.repeat(80),'가'.repeat(300));
 for(const [key,value] of [['😀'.repeat(81),'가'],['다른 키','가'.repeat(301)],['공백','   '],['널','가\0나']])await expect(create(key,value)).rejects.toThrow();
 expect((await store.personalFacts(sessionId,identityId)).revision).toBe('1');
 for(let i=1;i<20;i++)await create('합성 '+i,'값');
 await expect(create('21번째','값')).rejects.toThrow('personal_fact_limit');
 expect((await store.personalFacts(sessionId,identityId)).revision).toBe('20');
});
it('P10 transaction failure rolls back data and collection counters',async()=>{
 const before=await store.personalFacts(sessionId,identityId);
 await expect(store.locked(async c=>{await changePersonalFact(c,scope(),{kind:'create',input:{key:'합성',value:'실패'}});throw Error('fixture_rollback');})).rejects.toThrow('fixture_rollback');
 expect(await store.personalFacts(sessionId,identityId)).toEqual(before);
});
it('P09 persistent revisions fence selected retrieval; legacy snapshots cannot authorize persistent chunks',async()=>{
 const doc=await document('persistent');const input=await store.acceptChat(sessionId,randomUUID(),{identityId,text:'필터 교체',intent:'knowledge'}),selected=(await store.select(input.eventId))!;
 const fences=await store.knowledgeRevisions(sessionId,identityId),result=await new PostgresKnowledgeRetriever(db.pool).search({scope:scope(),query:'필터 교체'});
 await expect(store.commitKnowledge(selected,result,fences.revision)).rejects.toThrow('knowledge_changed');
 await store.mutateKnowledge(sessionId,identityId,randomUUID(),{documentId:doc.result.documentId,expectedRevision:'1',title:'필터',body:'12개월'});
 await expect(store.commitKnowledge(selected,result,fences.revision,fences.libraryRevision)).rejects.toThrow('knowledge_changed');
 expect((await db.pool.query('SELECT 1 FROM response_runs')).rowCount).toBe(0);
});
it('P09 an empty persistent retrieval is invalidated when new material is saved',async()=>{
 const input=await store.acceptChat(sessionId,randomUUID(),{identityId,text:'필터 교체',intent:'knowledge'}),selected=(await store.select(input.eventId))!;
 const fences=await store.knowledgeRevisions(sessionId,identityId);await document('persistent');
 await expect(store.commitKnowledge(selected,{query:'필터 교체',chunks:[]},fences.revision,fences.libraryRevision)).rejects.toThrow('knowledge_changed');
});
it('P12 migrate H1 data in an isolated schema, rerun without loss, and retain old checksums',async()=>{
 const schema='h2a_'+randomUUID().replaceAll('-','');
 await db.transaction(async c=>{
  await c.query('CREATE SCHEMA '+schema);await c.query('SET LOCAL search_path TO '+schema);
  await c.query('CREATE TABLE schema_migrations(name text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
  const dir=new URL('../packages/database/migrations/',import.meta.url);
  for(const name of (await readdir(dir)).filter(n=>/^000[1-5]_.*\.sql$/.test(n)).sort()){
   const sql=await readFile(new URL(name,dir),'utf8');await c.query(sql);await c.query('INSERT INTO schema_migrations(name,sha256) VALUES($1,$2)',[name,createHash('sha256').update(sql).digest('hex')]);
  }
  for(const table of ['characters','identities','character_configs','character_state','sessions'])await c.query(`INSERT INTO ${table} SELECT * FROM public.${table}`);
  const id=randomUUID();await c.query("INSERT INTO knowledge_documents(id,character_id,session_id,identity_id,title,revision) VALUES($1,$2,$3,$4,'H1 문서',1)",[id,CHARACTER_ID,sessionId,identityId]);
  await c.query("INSERT INTO knowledge_chunks VALUES($1,1,'c1',0,'H1 원문')",[id]);
  const before=(await c.query('SELECT name,sha256 FROM schema_migrations ORDER BY name')).rows,state=(await c.query('SELECT * FROM character_state')).rows;
  const scoped=Object.create(db) as typeof db;scoped.transaction=async fn=>fn(c);
  await migrate(scoped);await migrate(scoped);
  expect((await c.query('SELECT name,sha256 FROM schema_migrations ORDER BY name LIMIT 5')).rows).toEqual(before);
  expect((await c.query('SELECT * FROM character_state')).rows).toEqual(state);
  expect((await c.query('SELECT retention FROM knowledge_documents WHERE id=$1',[id])).rows[0].retention).toBe('session');
  expect((await c.query('SELECT body FROM knowledge_chunks WHERE document_id=$1',[id])).rows[0].body).toBe('H1 원문');
  expect((await c.query('SELECT count(*) FROM schema_migrations')).rows[0].count).toBe('8');
  await c.query('DROP SCHEMA '+schema+' CASCADE');
 });
 await assertMigrations(db);
});
