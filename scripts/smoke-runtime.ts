import { loadLocalEnv } from './env.ts';
import { Database } from '../packages/database/src/connection.ts';
import { Store } from '../packages/database/src/store.ts';
import { CHARACTER_ID } from '../packages/database/src/seed.ts';
import { parseConfig } from '../packages/contracts/src/index.ts';
import { OllamaProvider,PythonTokenCounter } from '../packages/adapters/src/ollama.ts';
import { JevAppraisalProvider } from '../packages/adapters/src/jev.ts';
import { createServer } from '../apps/runtime/src/http/server.ts';
loadLocalEnv();const config=parseConfig(process.env);const db=new Database(config.DATABASE_URL),store=new Store(db);let runtime:Awaited<ReturnType<typeof createServer>>|null=null;
const provider=new OllamaProvider(config.DIALOGUE_MODEL,new PythonTokenCounter(process.env.TOKENIZER_PYTHON??config.OMNIVOICE_PYTHON,process.env.QWEN_TOKENIZER_PATH??''),config.OLLAMA_BASE_URL);
const appraiser=new JevAppraisalProvider({localOnly:config.LOCAL_ONLY,allowPaidProviders:config.ALLOW_PAID_PROVIDERS,apiKey:config.TYPESAFE_API_KEY});
try{await db.own(CHARACTER_ID,()=>{});await store.recover();runtime=await createServer(store,provider,appraiser,{timer:false});await runtime.app.listen({host:'127.0.0.1',port:3001});const live=await fetch('http://127.0.0.1:3001/health/live'),studio=await fetch('http://127.0.0.1:3001/studio');const role=(await db.pool.query("SELECT current_user AS role,(SELECT pg_get_userbyid(datdba)=current_user FROM pg_database WHERE datname=current_database()) AS database_owner")).rows[0];if(live.status!==200||studio.status!==200||role.database_owner)throw new Error('smoke_failed');console.log(JSON.stringify({status:'PASS',bind:'127.0.0.1:3001',live:live.status,studio:studio.status,role,generation:provider.readiness(),appraisal:appraiser.readiness(),jevInferenceRun:false}));}
finally{await runtime?.app.close();await db.close();}
