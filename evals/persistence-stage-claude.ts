// H2-A P15 with the current runtime providers (2026-10-27): Claude Opus dialogue, Claude Sonnet
// interpreter (Jev-first outcome) and Jev conversation appraisal. Same nine synthetic scenes and
// checks as evals/persistence-stage.ts (the OpenAI version, kept for its own records).
// H2-A fixed synthetic acceptance journey. Rehearsal never reads a key or calls a provider.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {parseEnv} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {fork,type ChildProcess} from 'node:child_process';
import {chromium,expect,type BrowserContext,type Page} from '@playwright/test';
import {Database} from '../packages/database/src/connection.ts';
import {Store} from '../packages/database/src/store.ts';
import {migrate} from '../packages/database/src/migrate.ts';
import {reset} from './helpers.ts';
import {seed,IDENTITY_IDS} from '../packages/database/src/seed.ts';
import {stageExpression} from '../packages/character-core/src/index.ts';
import {knowledgeNegativeFixture} from './knowledge-negative-fixture.ts';
import {captureStageCaption} from './browser/caption.ts';
const args=process.argv.slice(2);
assert(args[0]==='--live'&&args[1]==='--attempt'&&/^r[1-3]$/.test(args[2]??'')&&args[3]==='--synthetic-inputs'&&args[4]==='--allow-paid-providers'&&args.length===5,'explicit_live_attempt_and_flags_required');
const live=true,mode='--live',base='J:/ai/ai-character-runtime',attempt=args[2]!,root=resolve(`${base}/home-assistant-h2a-claude-20261027-${attempt}`);
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8')),hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const fixture=read('evals/fixtures/persistence-v1.json');assert.equal(fixture.syntheticOnly,true);assert.equal(fixture.liveScenes.length,9);
const sourceFiles=['evals/persistence-stage-claude.ts','evals/persistence-stage-claude-runtime.ts','evals/knowledge-negative-fixture.ts','evals/fixtures/persistence-v1.json','evals/browser/caption.ts'];
const studioDist=resolve(`${base}/cue-20261026/studio-dist`),index=resolve(studioDist,'index.html');
const assets=[...readFileSync(index,'utf8').matchAll(/(?:src|href)="(\/assets\/[A-Za-z0-9_.-]+)"/g)].map(m=>resolve(studioDist,'.'+m[1]));
assert(assets.some(p=>p.endsWith('.js')&&readFileSync(p,'utf8').includes('personal-facts')),'h2a_ui_required');
const sourceHashes=Object.fromEntries(sourceFiles.map(p=>[p,hash(p)])),studioHashes=Object.fromEntries([index,...assets].map(p=>[p,hash(p)]));
const assertSources=()=>{for(const [p,digest] of Object.entries({...sourceHashes,...studioHashes}))assert.equal(hash(p),digest,'source_changed: '+p);};
// Runtime settings come from the gitignored runtime-data files; keys never leave the child.
const profile:Record<string,string>={};for(const f of ['local.env','jev.env','claude.env'])Object.assign(profile,parseEnv(readFileSync('runtime-data/'+f,'utf8')));
const claudeLedger=profile.CLAUDE_BUDGET_PATH!,jevCounter=profile.APPRAISAL_CALL_COUNT_PATH!;assert(claudeLedger&&jevCounter,'runtime_profile_incomplete');
const ledgerEntries=()=>existsSync(claudeLedger)?read(claudeLedger).entries:[],jevCalls=()=>{if(!existsSync(jevCounter))return 0;const v=read(jevCounter);return v.day===new Date().toLocaleDateString('sv')?v.calls:0;};
assert(!existsSync(claudeLedger+'.lock'),'ledger_in_use');
const before={entries:ledgerEntries()},jevBefore=jevCalls();
assert(!existsSync(root),'evidence_exists');mkdirSync(root);mkdirSync(resolve(root,'tmp'));
process.env.TEMP=resolve(root,'tmp');process.env.TMP=process.env.TEMP;
const url=new URL(profile.TEST_DATABASE_URL!);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/character_runtime_test');
const env={...process.env,...profile,DATABASE_URL:url.href,STUDIO_DIST_PATH:studioDist,LOCAL_ONLY:'false',ALLOW_PAID_PROVIDERS:'true'};
const result:any={status:'RUNNING',mode,providers:{dialogue:profile.DIALOGUE_MODEL,interpreter:profile.CLAUDE_INTERPRETER_MODEL,outcomeFirst:profile.EVENT_OUTCOME_FIRST,appraisal:'jev'},scenes:fixture.liveScenes,sourceHashes,studioHashes,steps:[],requests:[],interventions:[],packets:[],browserErrors:[],children:[],claims:{actualProviders:true,semanticQuality:'NOT_VERIFIED',naturalConcealment:'NOT_TESTED',userAcceptance:'NOT_VERIFIED'}};
const persist=()=>writeFileSync(resolve(root,'results.json'),JSON.stringify(result,null,2)+'\n');persist();
const db=new Database(url.href),store=new Store(db),operator=IDENTITY_IDS[3];
let child:ChildProcess|undefined,browser:BrowserContext|undefined,page:Page|undefined,stage:Page|undefined,sessionId:string|undefined,code='',armed=false;
async function stopChild(){
 if(!child||child.exitCode!==null||child.signalCode!==null)return;
 child.send('stop');try{await expect.poll(()=>child!.exitCode!==null||child!.signalCode!==null,{timeout:10000}).toBe(true);}catch{child.kill();await expect.poll(()=>child!.exitCode!==null||child!.signalCode!==null,{timeout:5000}).toBe(true);}
}
async function start(){
 code='';child=fork('evals/persistence-stage-claude-runtime.ts',['--live'],{execArgv:['--experimental-transform-types'],env,windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});result.children.push(child.pid);
 child.stderr!.on('data',()=>{});child.on('message',(m:any)=>{if(m.type==='ready')code=m.code;if(m.type==='request')result.requests.push({...m,at:Date.now()});if(m.type==='intervention')result.interventions.push(m);if(m.type==='armed')armed=true;});
 await expect.poll(()=>{assert.equal(child!.exitCode,null,'child_failed');return code;},{timeout:20000}).not.toBe('');
 browser=await chromium.launchPersistentContext(resolve(root,'chrome-'+result.children.length),{headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',viewport:{width:1400,height:1000},env,downloadsPath:resolve(root,'downloads')});
 page=await browser.newPage();page.on('pageerror',e=>result.browserErrors.push(e.message));await page.goto('http://127.0.0.1:3001/studio');await page.getByLabel('일회용 연결 코드').fill(code);await page.getByRole('button',{name:'연결',exact:true}).click();await expect(page.getByRole('heading',{name:'캐릭터 작업실'})).toBeVisible();
 assert.equal(await store.currentSession(),null);await newMeeting();
}
async function newMeeting(){
 if(stage)await stage.close();
 if(sessionId)await page!.getByRole('button',{name:'만남 종료'}).click();
 await page!.getByRole('button',{name:'새 만남 시작'}).click();await expect(page!.getByRole('button',{name:'만남 종료'})).toBeVisible();sessionId=(await store.currentSession())!.id;
 await expect(page!.getByLabel('대화 상대')).toHaveCount(0);
 const popup=browser!.waitForEvent('page');await page!.getByRole('button',{name:'Stage 열기'}).click();stage=await popup;stage.on('pageerror',e=>result.browserErrors.push(e.message));
 stage.on('websocket',socket=>socket.on('framereceived',frame=>{const p=JSON.parse(String(frame.payload));if(['response.start','speech.segment','response.cancel'].includes(p.type))result.packets.push(p);}));
 await stage.waitForLoadState();await expect(page!.getByRole('button',{name:'출력 선택'})).toBeEnabled();await page!.getByRole('button',{name:'출력 선택'}).click();await expect(stage.locator('.stage-status')).toContainText('자막 출력 중');await expect(stage.locator('.caption')).toHaveText('');
}
async function http(path:string,method='GET',body?:unknown,headers:Record<string,string>={}){
 return page!.evaluate(async({path,method,body,headers})=>{const r=await fetch(path,{method,headers:{Authorization:`Bearer ${sessionStorage.getItem('accessToken')}`,Origin:location.origin,...(method==='GET'?{}:{'Idempotency-Key':crypto.randomUUID()}),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});const value=await r.json();if(!r.ok)throw Error(value.error?.code??'http_failure');return value.data;},{path,method,body,headers});
}
const factsPath=()=>`/api/sessions/${sessionId}/personal-facts`,docsPath=()=>`/api/sessions/${sessionId}/knowledge`;
async function dataState(){return {facts:(await db.pool.query('SELECT id,key,value,revision,deleted_at FROM personal_facts ORDER BY id')).rows,docs:(await db.pool.query('SELECT id,title,revision,deleted_at FROM knowledge_documents ORDER BY id')).rows};}
try{
 // The dedicated test database is emptied and seeded by the guarded helper.
 process.env.TEST_DATABASE_URL=url.href;await migrate(db);await reset(db);await start();
 const fact=await http(factsPath(),'POST',{key:fixture.fact.key,value:fixture.fact.value});
 await http(factsPath(),'POST',fixture.adversarialFact);
 const document=await http(docsPath(),'POST',{title:fixture.document.title,body:fixture.document.body,retention:'persistent'});
 await http(docsPath(),'POST',{...fixture.distractorDocument,retention:'persistent'});
 await http(docsPath(),'POST',{title:'합성 임시 자료',body:'이번 만남에만 남는다.'});
 for(const scene of fixture.liveScenes){
  assertSources();assert.equal(await store.busy(),false);
  if(scene.id==='new-meeting'||scene.id==='persistent-document')await newMeeting();
  if(scene.id==='restart'){
   await browser!.close();browser=undefined;stage=undefined;await stopChild();sessionId=undefined;await start();
   assert((await http(factsPath())).facts.some((f:any)=>f.id===fact.id&&f.value===fixture.fact.value));
   assert(!(await http(docsPath())).some((d:any)=>d.title==='합성 임시 자료'));
  }
  if(scene.id==='edit')await http(`${factsPath()}/${fact.id}`,'PATCH',{key:fixture.fact.key,value:fixture.fact.replacement},{'If-Match':'"1"'});
  if(scene.id==='delete')await http(`${factsPath()}/${fact.id}`,'DELETE',undefined,{'If-Match':'"2"'});
  const step:any={id:scene.id,question:scene.question,expected:scene.expected,sessionId,before:(await store.state()).body};result.steps.push(step);
  if(scene.id==='edit-document-concealed'){
   await http(docsPath(),'POST',{documentId:document.documentId,title:fixture.document.title,body:fixture.document.replacement,retention:'persistent',expectedRevision:'1'});
   step.intervention=await knowledgeNegativeFixture(store,sessionId!,operator);assert((await store.state()).body.affect.frustration.value>.1);
   armed=false;child!.send('conceal-next');await expect.poll(()=>armed,{timeout:5000}).toBe(true);
  }
  if(scene.id==='delete-document')await http(`${docsPath()}/${document.documentId}`,'DELETE',undefined,{'If-Match':'"2"'});
  const knowledge=['persistent-document','edit-document-concealed','delete-document'].includes(scene.id),intent=knowledge?'knowledge':'chat',dataBefore=await dataState();
  step.submittedAt=Date.now();persist();await page!.getByLabel('입력 종류').selectOption(intent);await page!.getByLabel('할 말').fill(scene.question);await page!.getByRole('button',{name:'입력 보내기'}).click();
  let event:any,response:any;
  await expect.poll(async()=>{event=(await db.pool.query("SELECT id,attention_status FROM events WHERE session_id=$1 AND kind='chat.final' AND payload->>'text'=$2 AND id<>ALL($3::uuid[]) ORDER BY received_at DESC LIMIT 1",[sessionId,scene.question,result.steps.filter((s:any)=>s.eventId).map((s:any)=>s.eventId)])).rows[0];if(event?.attention_status==='expired')throw Error('input_expired');return event?.attention_status;},{timeout:60000}).toBe('observed');step.eventId=event.id;
  response=(await db.pool.query('SELECT r.* FROM response_runs r JOIN events phase ON phase.id=r.trigger_event_id WHERE phase.parent_event_id=$1',[event.id])).rows[0];assert(response,'no_response_no_forced_retry');step.responseId=response.id;
  step.visibleCaption=await captureStageCaption(stage!,resolve(root,scene.id+'.png'));step.firstCaptionMs=Date.now()-step.submittedAt;
  step.visibleCitations=await stage!.locator('.knowledge-citations').allTextContents();
  await expect.poll(async()=>{response=(await db.pool.query('SELECT * FROM response_runs WHERE id=$1',[response.id])).rows[0];if(['failed','cancelled','interrupted'].includes(response.status))throw Error('output_'+response.cancel_reason);return response.status;},{timeout:60000}).toBe('completed');
  step.plan=response.plan;step.personal=response.personal_context;step.knowledge=response.knowledge_context;
  step.segments=(await db.pool.query('SELECT id,text,text_shown_at,delivery_status FROM speech_segments WHERE response_id=$1 ORDER BY segment_index',[response.id])).rows;step.caption=step.segments.map((s:any)=>s.text).join(' ');assert.equal(step.visibleCaption,step.segments[0].text);
  step.acks=(await db.pool.query("SELECT kind,payload->>'segmentId' AS segment FROM events WHERE session_id=$1 AND kind IN ('caption.shown','caption.finished') AND payload->>'responseId'=$2",[sessionId,response.id])).rows;
  assert.equal(step.acks.length,step.segments.length*2);for(const s of step.segments){assert(s.text_shown_at);assert.equal(s.delivery_status,'finished');for(const kind of ['caption.shown','caption.finished'])assert.equal(step.acks.filter((a:any)=>a.kind===kind&&a.segment===s.id).length,1);}
  const startPacket=result.packets.find((p:any)=>p.type==='response.start'&&p.payload.responseId===response.id);assert(startPacket);assert.equal(startPacket.payload.expression,stageExpression(response.plan));
  if(knowledge){
   const expectedStatus=scene.id==='delete-document'?'not_found':'answered';assert.equal(step.knowledge.answer.status,expectedStatus);step.citations=startPacket.payload.knowledge.citations;
   if(expectedStatus==='not_found')assert.equal(step.citations.length,0);else assert(step.citations.some((c:any)=>c.documentId===document.documentId&&c.revision===(scene.id==='persistent-document'?'1':'2')));
   for(const c of step.citations){assert(step.knowledge.chunks.some((s:any)=>JSON.stringify(s)===JSON.stringify(c)),'citation_not_current_source');assert(step.visibleCitations.join(' ').includes(c.title),'citation_not_rendered');}
   assert.equal(step.personal,null);
  }else{
   assert.equal(step.personal.identityId,operator);const saved=step.personal.facts.find((f:any)=>f.id===fact.id);if(scene.id==='delete')assert.equal(saved,undefined);else assert.equal(saved.value,scene.id==='edit'?fixture.fact.replacement:fixture.fact.value);
  }
  if(scene.id==='edit-document-concealed'){assert.equal(step.plan.speechStyle.concealAffect,true);assert.equal(step.plan.speechStyle.register,'formal');assert.equal(startPacket.payload.expression,'neutral');assert((await store.state()).body.affect.frustration.value>.1);}
  assert.deepEqual(await dataState(),dataBefore,'provider_must_not_mutate_saved_data');assert.deepEqual(result.browserErrors,[]);assert.equal(await store.busy(),false);
  step.after=(await store.state()).body;step.status=live?'TECHNICAL_PASS_REVIEW_PENDING':'REHEARSAL_PASS';step.completedMs=Date.now()-step.submittedAt;persist();console.log(JSON.stringify({id:scene.id,status:step.status,caption:step.caption}));
 }
 assert.equal(result.interventions.length,1);result.status=live?'TECHNICAL_PASS_REVIEW_PENDING':'REHEARSAL_PASS';
}catch(error){result.status='FAIL';result.failure=error instanceof Error?error.message:String(error);process.exitCode=1;}
finally{
 if(page&&sessionId)await page.getByRole('button',{name:'만남 종료'}).click({timeout:3000}).catch(()=>{});
 // Wait for any open Claude reservation to settle before reading the ledger.
 await expect.poll(()=>ledgerEntries().slice(before.entries.length).filter((e:any)=>e.status==='reserved').length,{timeout:60000,intervals:[500,1000]}).toBe(0).catch(()=>{});
 await browser?.close().catch(()=>{});await stopChild();await db.close();
 const ids=new Set(before.entries.map((e:any)=>e.id)),newEntries=ledgerEntries().filter((e:any)=>!ids.has(e.id));
 result.claude={calls:newEntries.length,byModel:Object.fromEntries([...new Set(newEntries.map((e:any)=>e.model))].map(m=>[m,newEntries.filter((e:any)=>e.model===m).length])),usd:newEntries.reduce((s:number,e:any)=>s+e.usd,0),statuses:[...new Set(newEntries.map((e:any)=>e.status))],billingVerified:false};
 result.jevCalls=jevCalls()-jevBefore;result.childExited=!child||child.exitCode!==null||child.signalCode!==null;
 const times=result.steps.filter((s:any)=>s.firstCaptionMs).map((s:any)=>s.firstCaptionMs).sort((a:number,b:number)=>a-b);result.latency={measure:'submit_to_first_captured_stage_caption_ms',count:times.length,p50:times[Math.ceil(times.length*.5)-1]??null,p95:times[Math.ceil(times.length*.95)-1]??null};
 if(newEntries.some((e:any)=>e.status!=='completed')){result.status='FAIL';result.accountingFailure=true;process.exitCode=1;}
 for(const p of sourceFiles){const dest=resolve(root,'source',p);mkdirSync(dirname(dest),{recursive:true});copyFileSync(p,dest);if(hash(p)!==sourceHashes[p]){result.status='FAIL';result.sourceChanged=true;process.exitCode=1;}}
 persist();console.log(JSON.stringify({status:result.status,failure:result.failure,root,claude:result.claude,jevCalls:result.jevCalls,latency:result.latency,childExited:result.childExited}));
}
