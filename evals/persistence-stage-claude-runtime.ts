// H2-A P15 child (2026-10-27): the production runtime providers from config
// (Claude Opus dialogue, Claude Sonnet interpreter with Jev-first outcome, Jev
// conversation appraisal). Evaluation entry point only. The single
// concealment intervention is explicitly controlled, never a natural-policy claim.
import assert from 'node:assert/strict';
import {parseConfig} from '../packages/contracts/src/index.ts';
import {Database} from '../packages/database/src/connection.ts';
import {Store} from '../packages/database/src/store.ts';
import {assertMigrations} from '../packages/database/src/migrate.ts';
import {CHARACTER_ID} from '../packages/database/src/seed.ts';
import {createProviders} from '../apps/runtime/src/providers.ts';
import {createServer} from '../apps/runtime/src/http/server.ts';
import {PostgresKnowledgeRetriever} from '../packages/adapters/src/postgres-knowledge.ts';

assert(process.send&&process.argv[2]==='--live','evaluation_child_only');
const config=parseConfig(process.env),url=new URL(config.DATABASE_URL);
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/character_runtime_test');
assert.equal(config.DIALOGUE_PROVIDER,'claude');assert.equal(config.EVENT_INTERPRETER,'claude');assert.equal(config.APPRAISAL_PROVIDER,'jev');
const providers=createProviders(config),db=new Database(url.href),store=new Store(db,undefined,undefined,providers.evidenceVerifier);
await assertMigrations(db);await db.own(CHARACTER_ID,()=>process.exit(2));await store.recover();
let concealNext=false;
const fit=providers.dialogue.fitConversation.bind(providers.dialogue);
providers.dialogue.fitConversation=async(plan,context)=>{
 if(concealNext){
  assert.equal(plan.purpose,'knowledge_answer');assert.equal(plan.speechStyle?.register,'formal');
  const original=JSON.stringify(plan);plan.speechStyle={...plan.speechStyle!,concealAffect:true};
  const changed=await db.pool.query("UPDATE response_runs SET plan=$2 WHERE character_id=$1 AND status='planned' AND plan=$3::jsonb RETURNING id",[store.characterId,plan,original]);
  assert.equal(changed.rowCount,1,'controlled_concealment_requires_one_pending_response');
  concealNext=false;process.send!({type:'intervention',kind:'controlled_concealment_before_fit',responseId:changed.rows[0].id,plan});
 }
 return fit(plan,context);
};
const runtime=await createServer(store,providers.dialogue,providers.appraiser,{knowledge:new PostgresKnowledgeRetriever(db.pool),interpreter:providers.interpreter,staticRoot:config.STUDIO_DIST_PATH||undefined});
await runtime.app.listen({host:'127.0.0.1',port:3001});
process.send!({type:'ready',code:runtime.studioCode});
process.on('message',async message=>{
 if(message==='conceal-next'){assert(!concealNext);concealNext=true;process.send!({type:'armed'});}
 if(message==='stop'){await runtime.app.close();await db.close();process.exit(0);}
});
