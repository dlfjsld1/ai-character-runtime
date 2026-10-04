// Explicit fixture-only server for Playwright; never a normal runtime fallback.
import {writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {testDatabase,reset,fixtureProvider,mockJevAppraiser} from '../evals/helpers.ts';
import {Store} from '../packages/database/src/store.ts';
import {createServer} from '../apps/runtime/src/http/server.ts';
if(!process.argv.includes('--synthetic-fixtures'))throw new Error('explicit_synthetic_fixture_flag_required');
const db=await testDatabase();await reset(db);const store=new Store(db),runtime=await createServer(store,fixtureProvider,mockJevAppraiser());
await runtime.app.listen({host:'127.0.0.1',port:3001});const setupFile=resolve('runtime-data/test-pairing.json');await writeFile(setupFile,JSON.stringify({code:runtime.studioCode,fixture:true}));
const stop=async()=>{await runtime.app.close();await db.close();await unlink(setupFile).catch(()=>{});process.exit(0);};process.once('SIGINT',()=>void stop());process.once('SIGTERM',()=>void stop());console.log('Synthetic fixture server ready on loopback3001; real model not evaluated.');
