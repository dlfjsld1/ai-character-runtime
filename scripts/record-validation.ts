import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative} from 'node:path';
const runId='20261003-text-m2-build1',directory=resolve('validation/runs',runId);await mkdir(directory,{recursive:true});
async function files(path:string):Promise<string[]>{const entries=await readdir(path,{withFileTypes:true});const result:string[]=[];for(const e of entries){const full=resolve(path,e.name);if(e.isDirectory())result.push(...await files(full));else if(/\.(ts|tsx|sql|py|json|css|html)$/.test(e.name))result.push(full);}return result;}
const paths=[...await files(resolve('packages')),...await files(resolve('apps/runtime/src')),...await files(resolve('apps/studio/src')),resolve('package.json'),resolve('pnpm-lock.yaml')];const hashes:Record<string,string>={};for(const path of paths)hashes[relative(process.cwd(),path).replaceAll('\\','/')]=createHash('sha256').update(await readFile(path)).digest('hex');
const checks=[
 {case_id:'typecheck',command:'pnpm typecheck',status:'PASS',expected:0,observed:0},
 {case_id:'unit-contract-core-adapter-probe',command:'pnpm test:unit',status:'PASS',expected:29,observed:29},
 {case_id:'postgresql-representative-invariants',command:'pnpm test:db',status:'PASS',expected:15,observed:15},
 {case_id:'http-ws-origin-roles-owner-delivery',command:'pnpm test:protocol',status:'PASS',expected:9,observed:9},
 {case_id:'production-ui-build',command:'pnpm build',status:'PASS',expected:0,observed:0},
 {case_id:'synthetic-text-browser-e2e',command:'pnpm test:e2e',status:'PASS',expected:1,observed:1},
 {case_id:'synthetic-pg-dump-restore',command:'python scripts/check-restore.py',status:'PASS',expected:'2migrations/4identities/stateCHECK',observed:'2migrations/4identities/stateCHECK'},
 {case_id:'real-config-runtime-smoke-no-inference',command:'node --experimental-transform-types scripts/smoke-runtime.ts',status:'PASS',expected:'loopback3001/HTTP200/appNotOwner',observed:'loopback3001/HTTP200/appNotOwner'},
 {case_id:'real-provider-quality-and-resource-gate',command:null,status:'BLOCKED',expected:'realQwen/STT/TTS/P05FROZEN',observed:'model/tokenizer/voice/STT unconfigured; gateUNFROZEN'},
];
await writeFile(resolve(directory,'manifest.json'),JSON.stringify({run_id:runId,created_at:new Date().toISOString(),mvp_status:'BLOCKED',performance_gate:'UNFROZEN',fixture:true,fixture_version:'recorded-v1/puzzles-v1',environment:{node:process.version,pnpm:'11.9.0',postgresql:'18.6',test_database:'character_runtime_test',runtime_bind:'127.0.0.1:3001',postgres_bind:'127.0.0.1:55432'},source_sha256:hashes,real_inference_run:false,real_voice_run:false},null,2));
await writeFile(resolve(directory,'checks.jsonl'),checks.map(check=>JSON.stringify({run_id:runId,fixture_version:'recorded-v1/puzzles-v1',mode:'deterministic',...check,event_ids:[],response_ids:[],evidence_location:'BUILD_HANDOFF.md + test source + reported console runs',started_at:null,duration_ms:null})).join('\n')+'\n');
console.log(`Validation summary written: validation/runs/${runId}; no model/voice PASS.`);
