import { loadLocalEnv } from './env.ts';
import { Database } from '../packages/database/src/connection.ts';
import {assertMigrations} from '../packages/database/src/migrate.ts';
import {Store} from '../packages/database/src/store.ts';
import { CHARACTER_ID } from '../packages/database/src/seed.ts';
import { parseConfig } from '../packages/contracts/src/index.ts';
import {createProviders} from '../apps/runtime/src/providers.ts';
import { createServer } from '../apps/runtime/src/http/server.ts';
loadLocalEnv();const config=parseConfig(process.env),providers=createProviders(config);const db=new Database(config.DATABASE_URL),store=new Store(db,undefined,undefined,providers.evidenceVerifier);let runtime:Awaited<ReturnType<typeof createServer>>|null=null;
const provider=providers.dialogue,appraiser=providers.appraiser;
try{await assertMigrations(db);await db.own(CHARACTER_ID,()=>{});await store.recover();runtime=await createServer(store,provider,appraiser,{solver:providers.solver,timer:false,staticRoot:config.STUDIO_DIST_PATH||undefined});await runtime.app.listen({host:'127.0.0.1',port:3001});const live=await fetch('http://127.0.0.1:3001/health/live'),studio=await fetch('http://127.0.0.1:3001/studio');const role=(await db.pool.query("SELECT current_user AS role,(SELECT pg_get_userbyid(datdba)=current_user FROM pg_database WHERE datname=current_database()) AS database_owner")).rows[0];if(live.status!==200||studio.status!==200||role.database_owner)throw new Error('smoke_failed');console.log(JSON.stringify({status:'PASS',bind:'127.0.0.1:3001',live:live.status,studio:studio.status,role,generation:provider.readiness?.(),appraisal:appraiser.readiness(),jevInferenceRun:false}));}
finally{await runtime?.app.close();await db.close();}
