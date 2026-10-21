// Child-process fixture only. No reset, paid providers or normal-runtime fallback.
import {testDatabase,fixtureProvider,mockJevAppraiser} from './helpers.ts';
import {Store} from '../packages/database/src/store.ts';
import {createServer} from '../apps/runtime/src/http/server.ts';
import {PostgresKnowledgeRetriever} from '../packages/adapters/src/postgres-knowledge.ts';
import {jevEvidenceVerifier} from '../packages/adapters/src/appraisal-evidence.ts';
if(!process.send||!process.argv.includes('--synthetic-restart'))throw new Error('synthetic_restart_only');
const db=await testDatabase(),store=new Store(db,undefined,undefined,jevEvidenceVerifier);
await db.own(store.characterId,()=>process.exit(2));await store.recover();
const runtime=await createServer(store,{...fixtureProvider,dialogue:async(_plan,context)=>[context.personalFacts?.facts[0]?.value??'저장 정보가 없어.']},mockJevAppraiser(),{knowledge:new PostgresKnowledgeRetriever(db.pool),serveStatic:false,timer:false});
await runtime.app.listen({host:'127.0.0.1',port:0});
process.send({port:(runtime.app.server.address() as {port:number}).port,code:runtime.studioCode});
process.on('message',async message=>{if(message==='stop'){await runtime.app.close();await db.close();process.exit(0);}});
