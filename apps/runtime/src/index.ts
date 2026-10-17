import { existsSync,readFileSync } from 'node:fs';
import { loadLocalEnv } from '../../../scripts/env.ts';
import { parseConfig } from '../../../packages/contracts/src/index.ts';
import { Database } from '../../../packages/database/src/connection.ts';
import {assertMigrations} from '../../../packages/database/src/migrate.ts';
import { Store } from '../../../packages/database/src/store.ts';
import { CHARACTER_ID } from '../../../packages/database/src/seed.ts';
import {createProviders} from './providers.ts';
import { createServer } from './http/server.ts';
import {PostgresKnowledgeRetriever} from '../../../packages/adapters/src/postgres-knowledge.ts';
loadLocalEnv();const config=parseConfig(process.env);
if(!config.DATABASE_URL)throw new Error('database_not_configured');
const providers=createProviders(config);
const db=new Database(config.DATABASE_URL),store=new Store(db,undefined,undefined,providers.evidenceVerifier);
let runtime:Awaited<ReturnType<typeof createServer>>|undefined;
try {
  await assertMigrations(db);
  await db.own(CHARACTER_ID,()=>{void runtime?.app.close();});await store.recover();
  const localProbes=existsSync('runtime-data/local-probe-status.json')?JSON.parse(readFileSync('runtime-data/local-probe-status.json','utf8')):undefined;
  runtime=await createServer(store,providers.dialogue,providers.appraiser,{knowledge:new PostgresKnowledgeRetriever(db.pool),localProbes,solver:providers.solver,staticRoot:config.STUDIO_DIST_PATH||undefined});await runtime.app.listen({host:'127.0.0.1',port:3001});
  // This one-use code is the explicit local setup display, never a general log.
  process.stdout.write(`Studio http://127.0.0.1:3001/studio\n일회용 Studio 코드: ${runtime.studioCode}\n`);
  const stop=async()=>{await runtime!.app.close();await db.close();process.exit(0);};process.once('SIGINT',()=>{void stop();});process.once('SIGTERM',()=>{void stop();});
}catch(e){await runtime?.app.close().catch(()=>{});await db.close();process.stderr.write(`Runtime unavailable: ${e instanceof Error?['schema_migration_required','migration_checksum_mismatch'].includes(e.message)?e.message:e.name:'unknown'}\n`);process.exitCode=1;}
