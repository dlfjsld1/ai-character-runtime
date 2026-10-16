// B1 uses the normal app entry point and registry, not a separately assembled server.
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {parseEnv} from 'node:util';
import {spawn,type ChildProcess} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium,expect,type BrowserContext,type Page} from '@playwright/test';
import {Database} from '../packages/database/src/connection.ts';

const root=resolve('J:/ai/ai-character-runtime/runtime-baseline-20261015');
const ledgerPath='J:/ai/ai-character-runtime/openai-generation-20261014/budget.json';
const args=process.argv.slice(2),inspect=args.length===1&&args[0]==='--inspect',prepare=args.length===1&&args[0]==='--prepare-live',live=args.length===3&&['--live','--synthetic-inputs','--allow-paid-providers'].every(x=>args.includes(x));
if(!inspect&&!prepare&&!live)throw Error('explicit_baseline_scope_required');
const json=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const save=(path:string,value:unknown)=>writeFileSync(path,JSON.stringify(value,null,2)+'\n');
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const sources=['evals/runtime-baseline.ts','apps/runtime/src/index.ts','apps/runtime/src/providers.ts','apps/runtime/src/http/server.ts','apps/runtime/src/coordinator/index.ts','apps/studio/src/main.tsx','packages/database/src/migrate.ts','packages/database/src/store.ts','packages/adapters/src/openai.ts','packages/adapters/src/openai-conversation.ts','packages/adapters/src/openai-interaction-v3.ts','packages/adapters/src/openai-interaction.ts','packages/adapters/src/dialogue-request.ts','packages/contracts/src/local-config.ts','packages/character-core/src/index.ts'];
const hashes=()=>Object.fromEntries(sources.map(p=>[p,sha(readFileSync(p))]));
const scenes=['지금은 대답하지 말고 그냥 내 얘기만 들어줘.','아까 왜 말 안 했어?'];
const manifestPath=resolve(root,'live-manifest.json'),envPath=resolve(root,live?'app-live.env':'app.env');
const before=json(ledgerPath),beforeHash=sha(readFileSync(ledgerPath));
function baseline(){if(before.entries.length!==211||before.entries.filter((e:any)=>e.kind==='decision').length!==62||before.entries.filter((e:any)=>e.kind==='dialogue').length!==24||before.limitUsd!==1)throw Error('baseline_ledger_changed');const unresolved=before.entries.filter((e:any)=>e.status!=='completed');if(unresolved.length!==1||unresolved[0].id!=='3f1c4f32-41f7-42f2-b05e-dfe0d65aaaef'||unresolved[0].kind!=='count'||unresolved[0].status!=='unknown'||unresolved[0].usd!==.010635)throw Error('unknown_baseline_changed');}
if(prepare){
 baseline();if(existsSync(manifestPath)||existsSync(resolve(root,'live')))throw Error('baseline_already_prepared');
 const env=readFileSync(resolve(root,'app.env'),'utf8')+'\nSTUDIO_DIST_PATH='+resolve(root,'ui')+'\nOPENAI_MAX_DECISION_CALLS=64\nOPENAI_MAX_DIALOGUE_CALLS=25\nOPENAI_BUDGET_AUTHORIZATION=User approved runtime baseline: two synthetic decisions and one generation, same total USD1\nOPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID=3f1c4f32-41f7-42f2-b05e-dfe0d65aaaef\n';
 writeFileSync(resolve(root,'app-live.env'),env);
 save(manifestPath,{sourceHashes:hashes(),ledgerBeforeHash:beforeHash,envHash:sha(env),scenes,maxNewDecisions:2,maxNewGenerations:1,totalLimitUsd:1,retries:0});
 console.log(JSON.stringify({prepared:true,decisions:2,generations:1,apiCalls:0}));
}else{
 if(live){baseline();const m=json(manifestPath);if(m.ledgerBeforeHash!==beforeHash||JSON.stringify(m.sourceHashes)!==JSON.stringify(hashes())||m.envHash!==sha(readFileSync(envPath)))throw Error('baseline_manifest_changed');}
 const out=resolve(root,inspect?'inspect':'live');if(existsSync(out))throw Error('baseline_output_exists');
 const environment:NodeJS.ProcessEnv={...process.env,...parseEnv(readFileSync(envPath,'utf8')),STUDIO_DIST_PATH:resolve(root,'ui'),TEMP:resolve(root,'tmp'),TMP:resolve(root,'tmp')};
 const url=environment.DATABASE_URL??'';if(new URL(url).hostname!=='127.0.0.1'||new URL(url).port!=='55434'||new URL(url).pathname!=='/character_runtime_app_baseline')throw Error('dedicated_database_required');
 if(!existsSync(resolve(root,'ui/index.html')))throw Error('baseline_ui_missing');
 mkdirSync(out,{recursive:true});
 const record:any={status:'RUNNING',mode:inspect?'startup-no-inference':'live-synthetic',sourceHashes:hashes(),ledgerBefore:before,steps:[],browserErrors:[],packets:[]};
 const persist=()=>save(resolve(out,'results.json'),{...record,ledgerAfter:json(ledgerPath)});persist();
 let child:ChildProcess|undefined,browser:BrowserContext|undefined,page:Page|undefined,stage:Page|undefined,sessionId:string|undefined;
 const db=new Database(url);let output='',stderr='';
 try{
  if((await db.pool.query("SELECT count(*)::int AS n FROM sessions WHERE status='active'")).rows[0].n)throw Error('synthetic_session_in_use');
  child=spawn(process.execPath,['--experimental-transform-types','apps/runtime/src/index.ts'],{cwd:process.cwd(),env:environment,windowsHide:true,stdio:['ignore','pipe','pipe']});record.childPid=child.pid;
  child.stdout!.on('data',chunk=>{output+=String(chunk);});child.stderr!.on('data',chunk=>{stderr+=String(chunk);});
  await expect.poll(()=>{if(child?.exitCode!==null)throw Error('runtime_entry_failed');return /일회용 Studio 코드: ([a-f0-9]{64})/.exec(output)?.[1]??'';},{timeout:15000}).not.toBe('');
  const code=/일회용 Studio 코드: ([a-f0-9]{64})/.exec(output)![1]!;
  browser=await chromium.launchPersistentContext(resolve(out,'chrome-profile'),{headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',viewport:{width:1400,height:1000},downloadsPath:resolve(out,'downloads'),env:environment,args:['--disable-breakpad',`--crash-dumps-dir=${resolve(out,'crashes')}`]});
  page=await browser.newPage();page.on('pageerror',e=>record.browserErrors.push(e.message));await page.goto('http://127.0.0.1:3001/studio');
  await page.getByLabel('일회용 연결 코드').fill(code);await page.getByRole('button',{name:'연결',exact:true}).click();await expect(page.getByRole('heading',{name:'캐릭터 작업실'})).toBeVisible();
  const ready=()=>page!.evaluate(async()=>{const r=await fetch('/health/ready',{headers:{authorization:'Bearer '+sessionStorage.getItem('accessToken')}});if(!r.ok)throw Error('readiness_failed');return (await r.json()).data;});
  record.readinessBefore=await ready();if(record.readinessBefore.appraisal.provider!=='openai-decisions'||record.readinessBefore.appraisal.model!=='gpt-6-luna')throw Error('wrong_appraiser');
  if(inspect){
   if(record.readinessBefore.appraisal.errorCode!=='dialogue_usage_unconfirmed'||record.readinessBefore.llmDetails.preparationError!=='dialogue_usage_unconfirmed')throw Error('budget_block_not_visible');
  }else{await page.getByRole('button',{name:'새 만남 시작'}).click();await expect(page.getByRole('button',{name:'만남 종료'})).toBeVisible();sessionId=(await db.pool.query("SELECT id FROM sessions WHERE status='active'")).rows[0].id;record.sessionId=sessionId;}
  const popup=browser.waitForEvent('page');await page.getByRole('button',{name:'Stage 열기'}).click();stage=await popup;stage.on('pageerror',e=>record.browserErrors.push(e.message));stage.on('websocket',socket=>socket.on('framereceived',frame=>{const p=JSON.parse(String(frame.payload));if(['response.start','speech.segment','response.cancel'].includes(p.type))record.packets.push(p);}));await stage.waitForLoadState();
  if(live){
   await expect(page.getByRole('button',{name:'출력 선택'})).toBeEnabled();await page.getByRole('button',{name:'출력 선택'}).click();await expect(stage.locator('.stage-status')).toContainText('자막 출력 중');
   for(const [index,text] of scenes.entries()){
    await page.getByLabel('할 말').fill(text);await page.getByRole('button',{name:'입력 보내기'}).click();let event:any;
    await expect.poll(async()=>{event=(await db.pool.query("SELECT id,attention_status FROM events WHERE session_id=$1 AND kind='chat.final' AND payload->>'text'=$2 ORDER BY received_at DESC LIMIT 1",[sessionId,text])).rows[0];return event?.attention_status;},{timeout:90000}).toBe('observed');
    const appraisal=(await db.pool.query('SELECT status,provider,model,prompt_version,failure_code,usage,provider_result FROM appraisals WHERE event_id=$1',[event.id])).rows[0];
    const state=(await db.pool.query('SELECT body FROM character_state')).rows[0].body,step:any={id:index+1,text,eventId:event.id,appraisal,state};record.steps.push(step);persist();
    if(appraisal?.status!=='accepted'||appraisal.failure_code||appraisal.prompt_version!=='openai-interaction-v3')throw Error('appraisal_rejected');
    if(index===0){if(state.turn.recentSilences[0]?.reason!=='listening'||(await db.pool.query('SELECT 1 FROM response_runs WHERE session_id=$1',[sessionId])).rowCount||await stage.locator('.caption').innerText())throw Error('listening_failed');step.status='PASS';await stage.screenshot({path:resolve(out,'silence.png')});}
    else{
     await expect(stage.locator('.caption')).not.toHaveText('',{timeout:90000});step.visibleCaption=await stage.locator('.caption').innerText();await stage.screenshot({path:resolve(out,'reason-stage.png')});
     let response:any;await expect.poll(async()=>{response=(await db.pool.query('SELECT id,status,cancel_reason,plan FROM response_runs WHERE session_id=$1 ORDER BY created_at DESC LIMIT 1',[sessionId])).rows[0];if(['failed','cancelled'].includes(response?.status))throw Error(response.cancel_reason);return response?.status;},{timeout:90000}).toBe('completed');
     step.response=response;step.segments=(await db.pool.query('SELECT text,text_shown_at,delivery_status FROM speech_segments WHERE response_id=$1 ORDER BY segment_index',[response.id])).rows;
     if(response.plan.reengagement?.silenceEventId!==record.steps[0].eventId||response.plan.reengagement?.disclosure!=='explain'||step.segments.some((s:any)=>!s.text_shown_at||s.delivery_status!=='finished'))throw Error('reason_delivery_failed');step.status='PASS';
    }persist();
   }
  }
  record.readinessAfter=await ready();await page.screenshot({path:resolve(out,'studio.png'),fullPage:true});
  const after=json(ledgerPath),delta=after.entries.slice(before.entries.length);record.newEntries=delta;
  if(JSON.stringify(after.entries.slice(0,before.entries.length))!==JSON.stringify(before.entries)||record.browserErrors.length)throw Error('baseline_audit_failed');
  if(inspect&&sha(readFileSync(ledgerPath))!==beforeHash)throw Error('inspect_changed_ledger');
  if(live&&(delta.filter((e:any)=>e.kind==='decision').length!==2||delta.filter((e:any)=>e.kind==='dialogue').length!==1||delta.some((e:any)=>e.status!=='completed')||after.entries.reduce((n:number,e:any)=>n+e.usd,0)>1||!record.readinessAfter.appraisal.inferenceVerified||!record.readinessAfter.llmDetails.inferenceVerified))throw Error('live_accounting_failed');
  record.status='PASS';
 }catch(e){record.status='FAIL';record.failure=e instanceof Error?e.message:String(e);process.exitCode=1;await page?.screenshot({path:resolve(out,'failed.png'),fullPage:true}).catch(()=>{});}
 finally{
  if(sessionId&&page)await page.getByRole('button',{name:'만남 종료'}).click().catch(()=>{});
  await browser?.close().catch(()=>{});if(child&&child.exitCode===null){const closed=new Promise<void>(r=>child!.once('exit',()=>r()));child.kill();await closed;}
  record.childExited=child?.exitCode!==null||child?.signalCode!==null;record.startupError=stderr.split(/\r?\n/).filter(x=>x.startsWith('Runtime unavailable:'));
  await db.close();persist();for(const path of sources){const target=resolve(out,'source',path);mkdirSync(dirname(target),{recursive:true});copyFileSync(path,target);}
  console.log(JSON.stringify({status:record.status,mode:record.mode,failure:record.failure??null,steps:record.steps.map((s:any)=>({id:s.id,status:s.status??'NOT_REACHED'})),newCalls:record.newEntries?.map((e:any)=>e.kind)??[],evidence:out}));
 }
}
