// Explicit fixture-only server for Playwright; never a normal runtime fallback.
import {writeFile,unlink,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {testDatabase,reset,fixtureProvider,mockJevAppraiser} from '../evals/helpers.ts';
import {Store} from '../packages/database/src/store.ts';
import {jevEvidenceVerifier} from '../packages/adapters/src/appraisal-evidence.ts';
import {createServer} from '../apps/runtime/src/http/server.ts';
import {PostgresKnowledgeRetriever} from '../packages/adapters/src/postgres-knowledge.ts';
import type {DialogueGenerator} from '../packages/contracts/src/ai-ports.ts';
if(!process.argv.includes('--synthetic-fixtures'))throw new Error('explicit_synthetic_fixture_flag_required');
const syntheticKnowledge:DialogueGenerator={...fixtureProvider,dialogue:async(plan,context)=>process.env.TEST_IDENTITY_MODE==='operator'&&context.personalFacts?(context.personalFacts.facts.length?[context.personalFacts.facts[0]!.value+'를 선호한다고 저장했어.']:['저장된 선호가 없어.']):fixtureProvider.dialogue(plan,context),answerKnowledge:async(_plan,context)=>context.knowledge?.chunks.length?{sentences:[context.knowledge.chunks[0]!.text.split('.')[0]+'.'],status:'answered',citationIds:['K1']}:{sentences:['지정한 자료로는 확인할 수 없어.'],status:'not_found',citationIds:[]}};
const db=await testDatabase();await reset(db);const store=new Store(db,undefined,undefined,jevEvidenceVerifier),runtime=await createServer(store,syntheticKnowledge,mockJevAppraiser(),{syntheticIdentities:process.env.TEST_IDENTITY_MODE!=='operator',knowledge:new PostgresKnowledgeRetriever(db.pool),solver:fixtureProvider,staticRoot:process.env.STUDIO_DIST_PATH});
const artifactRoot=resolve(process.env.TEST_ARTIFACT_ROOT||'runtime-data');await mkdir(artifactRoot,{recursive:true});
await runtime.app.listen({host:'127.0.0.1',port:3001});const setupFile=resolve(artifactRoot,'test-pairing.json');await writeFile(setupFile,JSON.stringify({code:runtime.studioCode,fixture:true}));
const stop=async()=>{await runtime.app.close();await db.close();await unlink(setupFile).catch(()=>{});process.exit(0);};process.once('SIGINT',()=>void stop());process.once('SIGTERM',()=>void stop());console.log('Synthetic fixture server ready on loopback3001; real model not evaluated.');
