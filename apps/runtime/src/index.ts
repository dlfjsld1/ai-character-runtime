import { existsSync,readFileSync } from 'node:fs';
import { loadLocalEnv } from '../../../scripts/env.ts';
import { parseConfig } from '../../../packages/contracts/src/index.ts';
import { Database } from '../../../packages/database/src/connection.ts';
import { Store } from '../../../packages/database/src/store.ts';
import { CHARACTER_ID } from '../../../packages/database/src/seed.ts';
import { OllamaProvider,PythonTokenCounter } from '../../../packages/adapters/src/ollama.ts';
import { JevAppraisalProvider } from '../../../packages/adapters/src/jev.ts';
import { createServer } from './http/server.ts';
loadLocalEnv();const config=parseConfig(process.env);
if(!config.DATABASE_URL)throw new Error('database_not_configured');
const db=new Database(config.DATABASE_URL),store=new Store(db);
let runtime:Awaited<ReturnType<typeof createServer>>|undefined;
try {
  const migration=(await db.pool.query('SELECT count(*) FROM schema_migrations')).rows[0];if(Number(migration.count)!==3)throw new Error('schema_migration_required');
  await db.own(CHARACTER_ID,()=>{void runtime?.app.close();});await store.recover();
  const provider=new OllamaProvider(config.DIALOGUE_MODEL,new PythonTokenCounter(process.env.TOKENIZER_PYTHON??config.OMNIVOICE_PYTHON,process.env.QWEN_TOKENIZER_PATH??''),config.OLLAMA_BASE_URL);
  const appraiser=new JevAppraisalProvider({localOnly:config.LOCAL_ONLY,allowPaidProviders:config.ALLOW_PAID_PROVIDERS,apiKey:config.TYPESAFE_API_KEY});
  const localProbes=existsSync('runtime-data/local-probe-status.json')?JSON.parse(readFileSync('runtime-data/local-probe-status.json','utf8')):undefined;
  runtime=await createServer(store,provider,appraiser,{localProbes});await runtime.app.listen({host:'127.0.0.1',port:3001});
  // This one-use code is the explicit local setup display, never a general log.
  process.stdout.write(`Studio http://127.0.0.1:3001/studio\n일회용 Studio 코드: ${runtime.studioCode}\n`);
  const stop=async()=>{await runtime!.app.close();await db.close();process.exit(0);};process.once('SIGINT',()=>{void stop();});process.once('SIGTERM',()=>{void stop();});
}catch(e){await runtime?.app.close().catch(()=>{});await db.close();process.stderr.write(`Runtime unavailable: ${e instanceof Error?e.name:'unknown'}\n`);process.exitCode=1;}
