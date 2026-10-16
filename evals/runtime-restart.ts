// Real process restart / browser lifecycle, synthetic transport only, no paid calls.
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {parseEnv} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {chromium,expect,type BrowserContext,type Page} from '@playwright/test';
import {Database} from '../packages/database/src/connection.ts';
import {Store} from '../packages/database/src/store.ts';
import {migrate} from '../packages/database/src/migrate.ts';
import {seed} from '../packages/database/src/seed.ts';
import {captureStageCaption} from './browser/caption.ts';

if(process.argv.length!==3||process.argv[2]!=='--synthetic-fixtures')throw Error('explicit_restart_scope_required');
const root=resolve('J:/ai/ai-character-runtime/runtime-restart-20261015'),baseline=resolve('J:/ai/ai-character-runtime/runtime-baseline-20261015');
if(existsSync(root))throw Error('restart_evidence_exists');
const paidLedger=resolve('J:/ai/ai-character-runtime/openai-generation-20261014/budget.json');
const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex'),paidBefore=hash(paidLedger);
const profile=parseEnv(readFileSync(resolve(baseline,'app-live.env'),'utf8')),url=new URL(profile.DATABASE_URL!);
url.pathname='/character_runtime_restart_test';if(url.hostname!=='127.0.0.1'||url.port!=='55434')throw Error('dedicated_database_required');
mkdirSync(root);mkdirSync(resolve(root,'tmp'));
const env:NodeJS.ProcessEnv={...process.env,...profile,DATABASE_URL:url.href,DIALOGUE_API_KEY:'synthetic-restart-key',TYPESAFE_API_KEY:'synthetic-unused',DIALOGUE_BUDGET_PATH:resolve(root,'synthetic-budget.json'),OPENAI_MAX_DECISION_CALLS:'10',OPENAI_MAX_DIALOGUE_CALLS:'10',OPENAI_BUDGET_AUTHORIZATION:'Synthetic restart fixture only; external fetch is forbidden',OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID:'',RUNTIME_RESTART_FIXTURES:'true',TEMP:resolve(root,'tmp'),TMP:resolve(root,'tmp')};
const sources=['evals/runtime-restart.ts','evals/runtime-restart-fixtures.ts','evals/browser/caption.ts','apps/runtime/src/index.ts','apps/runtime/src/providers.ts','apps/runtime/src/http/server.ts','apps/runtime/src/coordinator/index.ts','apps/studio/src/main.tsx','apps/studio/src/wire.ts','packages/database/src/store.ts','packages/adapters/src/openai.ts','packages/adapters/src/openai-interaction.ts','packages/adapters/src/openai-interaction-v3.ts','packages/character-core/src/index.ts'];
const result:any={status:'RUNNING',scope:'normal app entry with explicit synthetic API transport; not provider quality',sourceHashes:Object.fromEntries(sources.map(p=>[p,hash(p)])),paidLedgerBeforeHash:paidBefore,processes:[],packets:[],browserErrors:[]};
const persist=()=>writeFileSync(resolve(root,'results.json'),JSON.stringify(result,null,2)+'\n');persist();
const adminUrl=new URL(url);adminUrl.pathname='/postgres';const admin=new Database(adminUrl.href);
try{if((await admin.pool.query("SELECT 1 FROM pg_database WHERE datname='character_runtime_restart_test'")).rowCount)throw Error('restart_database_exists');await admin.pool.query('CREATE DATABASE character_runtime_restart_test');}finally{await admin.close();}
const db=new Database(url.href),store=new Store(db);await migrate(db);await seed(db);
let child:ChildProcess|undefined,browser:BrowserContext|undefined,page:Page|undefined,stage:Page|undefined,phase='first';
async function boot(){
 let stdout='',stderr='';child=spawn(process.execPath,['--experimental-transform-types','--import','./evals/runtime-restart-fixtures.ts','apps/runtime/src/index.ts'],{cwd:process.cwd(),env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 const running=child;result.processes.push({pid:running.pid,phase});running.stdout!.on('data',x=>stdout+=String(x));running.stderr!.on('data',x=>stderr+=String(x));
 await expect.poll(()=>{if(running.exitCode!==null)throw Error('restart_entry_failed_'+stderr.split(/\r?\n/).filter(x=>x.startsWith('Runtime unavailable:')).join(''));return /일회용 Studio 코드: ([a-f0-9]{64})/.exec(stdout)?.[1]??'';},{timeout:15000}).not.toBe('');
 return /일회용 Studio 코드: ([a-f0-9]{64})/.exec(stdout)![1]!;
}
async function kill(){if(!child||child.exitCode!==null||child.signalCode!==null)return;const running=child,ended=new Promise<void>(r=>running.once('exit',()=>r()));running.kill('SIGKILL');await ended;result.processes.find((p:any)=>p.pid===running.pid).exited=true;}
async function pair(code:string){await page!.getByLabel('일회용 연결 코드').fill(code);await page!.getByRole('button',{name:'연결',exact:true}).click();await expect(page!.getByRole('heading',{name:'캐릭터 작업실'})).toBeVisible();}
async function openStage(){const popup=browser!.waitForEvent('page');await page!.getByRole('button',{name:'Stage 열기'}).click();stage=await popup;stage.on('pageerror',e=>result.browserErrors.push(e.message));stage.on('websocket',socket=>socket.on('framereceived',frame=>{const p=JSON.parse(String(frame.payload));if(['speech.segment','response.start','response.cancel'].includes(p.type))result.packets.push({phase,...p});}));await stage.waitForLoadState();await expect(page!.getByRole('button',{name:'출력 선택'})).toBeEnabled();await page!.getByRole('button',{name:'출력 선택'}).click();await expect(stage.locator('.stage-status')).toContainText('자막 출력 중');}
async function input(text:string){await page!.getByLabel('할 말').fill(text);await page!.getByRole('button',{name:'입력 보내기'}).click();}
try{
 const code=await boot();browser=await chromium.launchPersistentContext(resolve(root,'chrome-profile'),{headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',viewport:{width:1400,height:1000},env,downloadsPath:resolve(root,'downloads')});page=await browser.newPage();page.on('pageerror',e=>result.browserErrors.push(e.message));await page.goto('http://127.0.0.1:3001/studio');await pair(code);
 await page.getByRole('button',{name:'새 만남 시작'}).click();await expect(page.getByRole('button',{name:'만남 종료'})).toBeVisible();const session=(await store.currentSession())!.id;result.oldSession=session;await openStage();
 await input('합성 공격 사건');await expect.poll(async()=> (await store.state()).body.turn.recentSilences.length).toBe(1);
 const silence=(await store.state()).body.turn.recentSilences[0]!;expect(silence.reason).toBe('withholding');expect((await store.state()).body.affect.frustration.value).toBeGreaterThan(0);result.silenceBefore=silence;
 await input('합성 중단 응답 확인');result.captionBefore=await captureStageCaption(stage!,resolve(root,'before-crash.png'));
 await expect.poll(async()=> (await db.pool.query('SELECT text_shown_at FROM speech_segments ORDER BY created_at DESC LIMIT 1')).rows[0]?.text_shown_at??null).not.toBeNull();
 const oldResponse=(await db.pool.query('SELECT id,status,generation_epoch FROM response_runs ORDER BY created_at DESC LIMIT 1')).rows[0],oldSegment=(await db.pool.query('SELECT id,delivery_status,output_epoch FROM speech_segments WHERE response_id=$1',[oldResponse.id])).rows[0];expect(oldResponse.status).toBe('delivering');result.oldResponse=oldResponse;result.oldSegment=oldSegment;result.stateBefore=(await store.state()).body;result.epochBefore=(await store.state()).generationEpoch.toString();persist();
 const oldClient=await stage!.evaluate(()=>sessionStorage.getItem('clientId')!);await kill();await expect(stage!.locator('.caption')).toHaveText('');phase='restarted';const nextCode=await boot();
 result.recoveredResponse=(await db.pool.query('SELECT status,cancel_reason FROM response_runs WHERE id=$1',[oldResponse.id])).rows[0];expect(result.recoveredResponse).toEqual({status:'interrupted',cancel_reason:'runtime_restart'});
 expect((await db.pool.query('SELECT status FROM sessions WHERE id=$1',[session])).rows[0].status).toBe('interrupted');expect((await db.pool.query('SELECT delivery_status FROM speech_segments WHERE id=$1',[oldSegment.id])).rows[0].delivery_status).toBe('unknown');
 const state=await store.state();result.stateAfter=state.body;result.epochAfter=state.generationEpoch.toString();expect(state.generationEpoch).toBeGreaterThan(BigInt(result.epochBefore));expect(state.body.affect.frustration.value).toBeGreaterThan(0);expect(state.body.affect.frustration.value).toBeLessThanOrEqual(result.stateBefore.affect.frustration.value);expect(state.body.affect.frustration.causes).toEqual(result.stateBefore.affect.frustration.causes);expect(state.body.turn.recentSilences).toEqual(result.stateBefore.turn.recentSilences);expect(await store.busy()).toBe(false);
 expect(await store.generated(oldResponse.id,['오래된 합성 응답.'],{clientId:oldClient,outputEpoch:BigInt(oldSegment.output_epoch)})).toBeNull();
 await expect(store.report(session,randomUUID(),'caption.finished',{responseId:oldResponse.id,segmentId:oldSegment.id,generationEpoch:oldResponse.generation_epoch,outputEpoch:oldSegment.output_epoch},oldClient)).rejects.toThrow();result.lateCompletionRejected=true;
 await expect(stage!.locator('.caption')).toHaveText('');await stage!.close();await page.getByRole('button',{name:'다시 연결',exact:true}).click();await pair(nextCode);await page.getByRole('button',{name:'새 만남 시작'}).click();await expect(page.getByRole('button',{name:'만남 종료'})).toBeVisible();result.newSession=(await store.currentSession())!.id;expect(result.newSession).not.toBe(session);await openStage();
 await input('합성 재시작 후 새 질문');result.captionAfter=await captureStageCaption(stage!,resolve(root,'after-restart.png'));expect(result.captionAfter).toBe('새 세션의 합성 응답이야.');
 await expect.poll(async()=> (await db.pool.query('SELECT status FROM response_runs WHERE session_id=$1 ORDER BY created_at DESC LIMIT 1',[result.newSession])).rows[0]?.status).toBe('completed');expect(result.packets.filter((p:any)=>p.phase==='restarted'&&p.type==='speech.segment'&&p.payload.responseId===oldResponse.id)).toHaveLength(0);
 result.recoveryEvents=(await db.pool.query("SELECT count(*)::int AS n FROM events WHERE kind='runtime.recovered' AND session_id=$1",[session])).rows[0].n;expect(result.recoveryEvents).toBe(1);expect(result.browserErrors).toEqual([]);await page.getByRole('button',{name:'만남 종료'}).click();await expect(page.getByRole('button',{name:'새 만남 시작'})).toBeVisible();result.status='PASS';
}catch(error){result.status='FAIL';result.failure=error instanceof Error?error.message:String(error);process.exitCode=1;}
finally{
 await browser?.close().catch(()=>{});await kill();await db.close();result.paidLedgerUnchanged=hash(paidLedger)===paidBefore;result.fixtureCalls=existsSync(resolve(root,'fixture-calls.jsonl'))?readFileSync(resolve(root,'fixture-calls.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(x=>JSON.parse(x)):[];
 if(!result.paidLedgerUnchanged||result.fixtureCalls.some((c:any)=>c.kind==='forbidden')){result.status='FAIL';result.finalCheckFailed=true;process.exitCode=1;}
 for(const p of sources){const dest=resolve(root,'source',p);mkdirSync(dirname(dest),{recursive:true});copyFileSync(p,dest);if(hash(p)!==result.sourceHashes[p]){result.status='FAIL';result.sourceChanged=p;process.exitCode=1;}}
 persist();console.log(JSON.stringify({status:result.status,failure:result.failure,root,paidLedgerUnchanged:result.paidLedgerUnchanged,fixtureCalls:result.fixtureCalls.length,processes:result.processes}));
}
