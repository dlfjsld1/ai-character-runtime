import {it,expect} from 'vitest';
import {randomUUID,createHash} from 'node:crypto';
import {readFile,readdir,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {testDatabase,reset,CHARACTER_ID,IDENTITY_IDS} from './helpers.ts';
import {Store} from '../packages/database/src/store.ts';
import {migrate} from '../packages/database/src/migrate.ts';
it('P12 a real pg_dump backup of synthetic H1 data restores and upgrades again without changing memory or old checksums',async()=>{
 if(!/^J:[/\\]ai[/\\]/i.test(tmpdir()))throw new Error('J_ai_artifact_directory_required');
 const db=await testDatabase(),schema='h2a_backup_'+randomUUID().replaceAll('-',''),directory=await mkdtemp(join(tmpdir(),'h2a-backup-')),backup=join(directory,'h1.dump');
 const source=new URL('../packages/database/migrations/',import.meta.url),url=new URL(process.env.TEST_DATABASE_URL!);
 const env={...process.env,PGHOST:url.hostname,PGPORT:url.port,PGDATABASE:url.pathname.slice(1),PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGCONNECT_TIMEOUT:'5'};
 const pg=async(name:string,args:string[])=>{try{await promisify(execFile)(resolve('runtime-data/tools/pgsql/bin',name+'.exe'),args,{env,windowsHide:true,timeout:15000});}catch{throw new Error(name+'_failed');}};
 try{
  await reset(db);const sessionId=randomUUID();await new Store(db).startSession(sessionId,randomUUID());
  await db.transaction(async c=>{
   await c.query('CREATE SCHEMA '+schema);await c.query('SET LOCAL search_path TO '+schema);
   await c.query('CREATE TABLE schema_migrations(name text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
   for(const name of (await readdir(source)).filter(n=>/^000[1-5]_.*\.sql$/.test(n)).sort()){const sql=await readFile(new URL(name,source),'utf8');await c.query(sql);await c.query('INSERT INTO schema_migrations(name,sha256) VALUES($1,$2)',[name,createHash('sha256').update(sql).digest('hex')]);}
   for(const table of ['characters','identities','character_configs','character_state','sessions'])await c.query(`INSERT INTO ${table} SELECT * FROM public.${table}`);
   const id=randomUUID();await c.query("INSERT INTO knowledge_documents(id,character_id,session_id,identity_id,title,revision) VALUES($1,$2,$3,$4,'H1 합성 자료',1)",[id,CHARACTER_ID,sessionId,IDENTITY_IDS[3]]);await c.query("INSERT INTO knowledge_chunks VALUES($1,1,'c1',0,'필터는 6개월마다 교체한다.')",[id]);
   await c.query("INSERT INTO memories(id,character_id,session_id,memory_key,kind,status,content_version,fact_kind,visibility,content,facts,occurred_at,updated_at) VALUES($1,$2,$3,'backup-fixture','activity_result','active',1,'observed','test_public','H1 합성 경험 기억','{}',now(),now())",[randomUUID(),CHARACTER_ID,sessionId]);
  });
  const snapshot=async()=>({state:(await db.pool.query(`SELECT * FROM ${schema}.character_state ORDER BY character_id`)).rows,memory:(await db.pool.query(`SELECT * FROM ${schema}.memories ORDER BY id`)).rows,chunks:(await db.pool.query(`SELECT * FROM ${schema}.knowledge_chunks ORDER BY document_id,ordinal`)).rows,checksums:(await db.pool.query(`SELECT name,sha256 FROM ${schema}.schema_migrations ORDER BY name LIMIT 5`)).rows});
  const before=await snapshot();await pg('pg_dump',['--format=custom','--no-owner','--no-privileges','--schema='+schema,'--file='+backup]);
  const upgrade=()=>db.transaction(async c=>{await c.query('SET LOCAL search_path TO '+schema);const scoped=Object.create(db) as typeof db;scoped.transaction=async fn=>fn(c);await migrate(scoped);});
  await upgrade();expect(await snapshot()).toEqual(before);
  // Only this UUID-named schema in the guarded synthetic DB is removed.
  if(!/^h2a_backup_[a-f0-9]{32}$/.test(schema))throw new Error('invalid_test_schema');
  await db.pool.query('DROP SCHEMA '+schema+' CASCADE');
  await pg('pg_restore',['--dbname='+url.pathname.slice(1),'--no-owner','--no-privileges','--single-transaction',backup]);
  expect(await snapshot()).toEqual(before);expect((await db.pool.query(`SELECT count(*) FROM ${schema}.schema_migrations`)).rows[0].count).toBe('5');
  await upgrade();await upgrade();expect(await snapshot()).toEqual(before);expect((await db.pool.query(`SELECT retention FROM ${schema}.knowledge_documents`)).rows).toEqual([{retention:'session'}]);
 }finally{if(/^h2a_backup_[a-f0-9]{32}$/.test(schema))await db.pool.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await db.close();}
},30000);
