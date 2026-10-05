import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {testDatabase} from '../helpers.ts';
import {Store} from '../../packages/database/src/store.ts';
let studioAuth:{token:string;id:string}|undefined;
test('synthetic fixture: Studio input→PostgreSQL→single Stage caption and responsive UI',async({page,context})=>{
  const setup=JSON.parse(await readFile('runtime-data/test-pairing.json','utf8'));expect(setup.fixture).toBe(true);await page.goto('/studio');await page.getByLabel('일회용 연결 코드').fill(setup.code);await page.getByRole('button',{name:'연결',exact:true}).click();await expect(page.getByRole('heading',{name:'캐릭터 작업실'})).toBeVisible();await expect(page.getByText('사건 해석(Jev): 검증용 모의 응답')).toBeVisible();await page.getByRole('button',{name:'새 만남 시작'}).click();await expect(page.getByRole('button',{name:'만남 종료'})).toBeVisible();
  studioAuth=await page.evaluate(()=>({token:sessionStorage.getItem('accessToken')!,id:sessionStorage.getItem('clientId')!}));
  const popupPromise=context.waitForEvent('page');await page.getByRole('button',{name:'Stage 열기'}).click();const stage=await popupPromise;await stage.waitForLoadState();await expect(stage.getByText('자막 Stage',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'출력 선택'})).toBeEnabled();await page.getByRole('button',{name:'출력 선택'}).click();await page.getByLabel('할 말').fill('합성 fixture 질문');await page.getByRole('button',{name:'입력 보내기'}).click();await expect(stage.locator('.caption')).toHaveText('안녕. 천천히 같이 알아보자.');await expect(page.getByText('관측 상태 #',{exact:false})).toBeVisible();
  await page.screenshot({path:'runtime-data/playwright-results/studio-desktop.png',fullPage:true});await stage.screenshot({path:'runtime-data/playwright-results/stage-text.png'});
  const db=await testDatabase();try{await expect.poll(async()=> (await db.pool.query('SELECT status FROM response_runs ORDER BY created_at DESC LIMIT 1')).rows[0]?.status).toBe('completed');expect((await db.pool.query('SELECT provider,provider_result,usage FROM appraisals ORDER BY created_at DESC LIMIT 1')).rows[0]).toMatchObject({provider:'jev-mock',provider_result:{mappingVersion:'jev-appraisal-v1'},usage:{input_tokens:123}});expect((await db.pool.query("SELECT kind FROM events WHERE kind IN ('caption.shown','caption.finished')")).rows.map(x=>x.kind).sort()).toEqual(['caption.finished','caption.shown']);}finally{await db.close();}
  await page.setViewportSize({width:390,height:844});await expect(page.getByLabel('할 말')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'runtime-data/playwright-results/studio-mobile.png',fullPage:true});await page.getByRole('button',{name:'만남 종료'}).click();await expect(page.getByRole('button',{name:'새 만남 시작'})).toBeVisible();
});
async function auditStudio(page:Page){
 if(studioAuth)await page.addInitScript(auth=>{sessionStorage.setItem('accessToken',auth.token);sessionStorage.setItem('clientId',auth.id);},studioAuth);
 await page.goto('/studio');if(!studioAuth){const setup=JSON.parse(await readFile('runtime-data/test-pairing.json','utf8'));await page.getByLabel('일회용 연결 코드').fill(setup.code);await page.getByRole('button',{name:'연결',exact:true}).click();}
 await expect(page.getByRole('heading',{name:'캐릭터 작업실'})).toBeVisible();studioAuth=await page.evaluate(()=>({token:sessionStorage.getItem('accessToken')!,id:sessionStorage.getItem('clientId')!}));
 await page.getByRole('button',{name:'새 만남 시작'}).click();await expect(page.getByRole('button',{name:'만남 종료'})).toBeVisible();
}
async function browserRequest(page:Page,path:string,method:string,body?:object,headers:Record<string,string>={}){
 return page.evaluate(async args=>{const r=await fetch(args.path,{method:args.method,headers:{Authorization:`Bearer ${sessionStorage.getItem('accessToken')}`,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),...args.headers},...(args.body?{body:JSON.stringify(args.body)}:{})});const result=await r.json();if(!r.ok)throw new Error(result.error.code);return result.data;},{path,method,body,headers});
}
async function auditChat(page:Page,stage:Page,db:Awaited<ReturnType<typeof testDatabase>>,text:string){
 await page.getByLabel('할 말').fill(text);await page.getByRole('button',{name:'입력 보내기'}).click();await expect(stage.locator('.caption')).toHaveText('안녕. 천천히 같이 알아보자.',{timeout:5000});
 await expect.poll(async()=> (await db.pool.query('SELECT status FROM response_runs ORDER BY created_at DESC LIMIT 1')).rows[0]?.status).toBe('completed');
}
test('AR01 Stage keeps delivering after idle correction/deletion and in-flight source invalidation',async({page,context})=>{
 await context.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);(window as any).__auditFrames=[];(window as any).__auditFramesPaused=false;window.requestAnimationFrame=callback=>{if((window as any).__auditFramesPaused){(window as any).__auditFrames.push(callback);return -1;}return raf(callback);};(window as any).__releaseAuditFrames=()=>{(window as any).__auditFramesPaused=false;for(const callback of (window as any).__auditFrames.splice(0))raf(callback);};});
 await auditStudio(page);const db=await testDatabase(),store=new Store(db);
 try{
  const id=(await store.currentSession())!.id,run=await store.startActivity(id,crypto.randomUUID(),'sequence-v1'),state=await store.state(),activity=await store.activity();
  const result=await store.submitCandidate(id,run.activityId,'47',{generationEpoch:state.generationEpoch,activityVersion:BigInt(activity.version)});if(result.response)await store.failResponse(result.response.id,'synthetic_setup');
  let memory=(await store.memories())[0];await expect(page.getByText(memory.content,{exact:true})).toBeVisible();
  const popup=context.waitForEvent('page');await page.getByRole('button',{name:'Stage 열기'}).click();const stage=await popup;await stage.waitForLoadState();await expect(page.getByRole('button',{name:'출력 선택'})).toBeEnabled();await page.getByRole('button',{name:'출력 선택'}).click();await expect(stage.locator('.stage-status')).toContainText('자막 출력 중');
  await browserRequest(page,`/api/memories/${memory.id}/corrections`,'POST',{expectedVersion:memory.content_version,content:'합성 정정 기억',sourceEventIds:memory.source_event_ids});
  await auditChat(page,stage,db,'합성 정정 후 질문');
  // Hold the render acknowledgement, invalidate its source, and release old callbacks after fresh output starts.
  await stage.evaluate(()=>{(window as any).__auditFramesPaused=true;});
  await page.getByLabel('할 말').fill('합성 처리 중 질문');await page.getByRole('button',{name:'입력 보내기'}).click();await expect(stage.locator('.caption')).toHaveText('안녕. 천천히 같이 알아보자.');
  await expect(page.getByText('합성 정정 기억',{exact:true})).toBeVisible();await page.getByRole('button',{name:'기억 삭제',exact:true}).click();
  await expect(stage.locator('.caption')).toHaveText('');await expect.poll(()=>store.busy()).toBe(false);
  await page.getByLabel('할 말').fill('합성 삭제 후 질문');await page.getByRole('button',{name:'입력 보내기'}).click();await expect(stage.locator('.caption')).toHaveText('안녕. 천천히 같이 알아보자.');await stage.evaluate(()=>{(window as any).__releaseAuditFrames();});
  await expect.poll(async()=> (await db.pool.query('SELECT status FROM response_runs ORDER BY created_at DESC LIMIT 1')).rows[0]?.status).toBe('completed');await auditChat(page,stage,db,'합성 다음 질문도 처리');
 }finally{await page.getByRole('button',{name:'만남 종료'}).click();await db.close();}
});
for(const mode of ['socket_close','heartbeat_timeout'] as const)test(`${mode==='heartbeat_timeout'?'A01':'AR02'} ${mode}: same authenticated Stage reconnects and receives only fresh captions`,async({page,context})=>{
 await context.addInitScript(()=>{const Native=window.WebSocket;(window as any).__auditSockets=[];(window as any).__auditCloses=[];(window as any).__dropPongs=false;window.WebSocket=class extends Native{constructor(url:string|URL,protocols?:string|string[]){super(url,protocols);(window as any).__auditSockets.push(this);this.addEventListener('close',event=>{(window as any).__auditCloses.push({code:event.code,reason:event.reason});(window as any).__dropPongs=false;});}send(data:Parameters<WebSocket['send']>[0]){if((window as any).__dropPongs&&typeof data==='string'&&JSON.parse(data).type==='heartbeat.pong')return;super.send(data);}};});
 await auditStudio(page);const db=await testDatabase();
 try{
  const popup=context.waitForEvent('page');await page.getByRole('button',{name:'Stage 열기'}).click();const stage=await popup;await stage.waitForLoadState();await expect(page.getByRole('button',{name:'출력 선택'})).toBeEnabled();await page.getByRole('button',{name:'출력 선택'}).click();await expect(stage.locator('.stage-status')).toContainText('자막 출력 중');
  const previous=(await db.pool.query("SELECT output_epoch FROM sessions WHERE status='active'")).rows[0].output_epoch;
  await auditChat(page,stage,db,'합성 연결 종료 전 질문');
  if(mode==='heartbeat_timeout'){
   await stage.evaluate(()=>{(window as any).__dropPongs=true;});
   await expect.poll(()=>stage.evaluate(()=>(window as any).__auditCloses),{timeout:8500}).toContainEqual({code:1008,reason:'heartbeat_timeout'});
  }else await stage.evaluate(()=>{(window as any).__auditSockets.find((s:WebSocket)=>s.readyState===1).close(4000,'synthetic_reconnect');});
  await expect.poll(async()=> (await db.pool.query("SELECT output_epoch FROM sessions WHERE status='active'")).rows[0]?.output_epoch).not.toBe(previous);
  await expect(stage.locator('.stage-status')).toContainText('자막 출력 중');await expect(stage.locator('.caption')).toHaveText('');expect(await stage.evaluate(()=>(window as any).__auditSockets.length)).toBe(2);await auditChat(page,stage,db,'합성 재연결 뒤 질문');
 }finally{await page.getByRole('button',{name:'만남 종료'}).click();await db.close();}
});
