import {test,expect,type Page} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {testDatabase,IDENTITY_IDS} from '../helpers.ts';
import {neutralAppraisal} from '../../packages/contracts/src/domain.ts';
import {Store} from '../../packages/database/src/store.ts';
import {captureStageCaption} from './caption.ts';
let studioAuth:{token:string;id:string}|undefined;
const artifactRoot=resolve(process.env.TEST_ARTIFACT_ROOT||'runtime-data');
test('synthetic fixture: Studio input→PostgreSQL→single Stage caption and responsive UI',async({page,context})=>{
  const setup=JSON.parse(await readFile(resolve(artifactRoot,'test-pairing.json'),'utf8'));expect(setup.fixture).toBe(true);await page.goto('/studio');await page.getByLabel('일회용 연결 코드').fill(setup.code);await page.getByRole('button',{name:'연결',exact:true}).click();await expect(page.getByRole('heading',{name:'캐릭터 작업실'})).toBeVisible();await expect(page.getByText('사건 해석: 검증용 모의 응답')).toBeVisible();await page.getByRole('button',{name:'새 만남 시작'}).click();await expect(page.getByRole('button',{name:'만남 종료'})).toBeVisible();
  studioAuth=await page.evaluate(()=>({token:sessionStorage.getItem('accessToken')!,id:sessionStorage.getItem('clientId')!}));
  const popupPromise=context.waitForEvent('page');await page.getByRole('button',{name:'Stage 열기'}).click();const stage=await popupPromise;await stage.waitForLoadState();await expect(stage.getByText('자막 Stage',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'출력 선택'})).toBeEnabled();await page.getByRole('button',{name:'출력 선택'}).click();await page.getByLabel('할 말').fill('합성 fixture 질문');await page.getByRole('button',{name:'입력 보내기'}).click();await expect(stage.locator('.caption')).toHaveText('안녕. 천천히 같이 알아보자.');await expect(page.getByText('관측 상태 #',{exact:false})).toBeVisible();
  expect(await captureStageCaption(stage,resolve(artifactRoot,'playwright-results/stage-text.png'))).toBe('안녕. 천천히 같이 알아보자.');await page.screenshot({path:resolve(artifactRoot,'playwright-results/studio-desktop.png'),fullPage:true});
  const db=await testDatabase();try{await expect.poll(async()=> (await db.pool.query('SELECT status FROM response_runs ORDER BY created_at DESC LIMIT 1')).rows[0]?.status).toBe('completed');expect((await db.pool.query('SELECT provider,provider_result,usage FROM appraisals ORDER BY created_at DESC LIMIT 1')).rows[0]).toMatchObject({provider:'jev',provider_result:{mappingVersion:'jev-conversation-v1'},usage:{input_tokens:123}});expect((await db.pool.query("SELECT kind FROM events WHERE kind IN ('caption.shown','caption.finished')")).rows.map(x=>x.kind).sort()).toEqual(['caption.finished','caption.shown']);}finally{await db.close();}
  await page.setViewportSize({width:390,height:844});await expect(page.getByLabel('할 말')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:resolve(artifactRoot,'playwright-results/studio-mobile.png'),fullPage:true});await page.getByRole('button',{name:'만남 종료'}).click();await expect(page.getByRole('button',{name:'새 만남 시작'})).toBeVisible();
});
async function auditStudio(page:Page){
 if(studioAuth)await page.addInitScript(auth=>{sessionStorage.setItem('accessToken',auth.token);sessionStorage.setItem('clientId',auth.id);},studioAuth);
 await page.goto('/studio');if(!studioAuth){const setup=JSON.parse(await readFile(resolve(artifactRoot,'test-pairing.json'),'utf8'));await page.getByLabel('일회용 연결 코드').fill(setup.code);await page.getByRole('button',{name:'연결',exact:true}).click();}
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

test('SP04/06 real synthetic Store and Stage distinguish hidden and allowed embarrassment',async({page,context})=>{
 await auditStudio(page);const db=await testDatabase(),store=new Store(db),records:any[]=[];
 try{
  const session=(await store.currentSession())!.id,identity=IDENTITY_IDS[0];
  const oldActivity=await store.activity();if(oldActivity)await store.activityCommand(session,crypto.randomUUID(),oldActivity.id,'end');
  const run=await store.startActivity(session,crypto.randomUUID(),'sequence-v1'),before=await store.state(),activity=await store.activity();
  const wrong=await store.submitCandidate(session,run.activityId,'46',{generationEpoch:before.generationEpoch,activityVersion:BigInt(activity.version)});if(wrong.response)await store.failResponse(wrong.response.id,'synthetic_preparation');await store.activityCommand(session,crypto.randomUUID(),run.activityId,'end');
  const accepted=await store.acceptChat(session,crypto.randomUUID(),{identityId:identity,text:'합성 비난'}),selected=(await store.select(accepted.eventId))!;
  const silence=await store.commitAppraisal(selected,{...neutralAppraisal,target:'character',act:'criticism',hostility:3,strength:3,uncertain:false,evidence_refs:[accepted.eventId]},{provider:'synthetic-fixture',model:'recorded-v1'});expect(silence.response).toBeFalsy();
  const popup=context.waitForEvent('page');await page.getByRole('button',{name:'Stage 열기'}).click();const stage=await popup;const packets:any[]=[];stage.on('websocket',s=>s.on('framereceived',f=>packets.push(JSON.parse(String(f.payload)))));await stage.waitForLoadState();await expect(page.getByRole('button',{name:'출력 선택'})).toBeEnabled();await page.getByRole('button',{name:'출력 선택'}).click();await expect(stage.locator('.stage-status')).toContainText('자막 출력 중');
  await expect(stage.locator('.stage')).toHaveClass('stage expression-neutral');
  for(const [name,text,f,visible,label] of [['hidden','왜 말 안 해?',.7,'neutral','차분하게 말하는 중'],['cautious','따뜻한 차 추천해 줘.',.2,'embarrassed','조심스럽게 말하는 중']] as const){
   const state=(await store.state()).body,now=Date.now();state.affect.frustration={...state.affect.frustration,value:f,asOf:now,holdUntil:now};state.affect.embarrassment={...state.affect.embarrassment,value:.99,asOf:now,holdUntil:now};state.expression={kind:'embarrassed',since:now};
   await db.pool.query('UPDATE character_state SET body=$1 WHERE character_id=$2',[state,store.characterId]);const offset=packets.length;
   await page.getByLabel('할 말').fill(text);await page.getByRole('button',{name:'입력 보내기'}).click();await expect(stage.locator('.caption')).toHaveText('안녕. 천천히 같이 알아보자.');await expect(stage.locator('.stage')).toHaveClass('stage expression-'+visible);await expect(stage.locator('.expression-label')).toHaveText(label);
   expect(await captureStageCaption(stage,resolve(artifactRoot,'playwright-results/sp-'+name+'.png'))).toBe('안녕. 천천히 같이 알아보자.');
   await expect(page.getByText(/내부 기준 표정 embarrassed/)).toBeVisible();
   await expect.poll(async()=>(await db.pool.query('SELECT status FROM response_runs ORDER BY created_at DESC LIMIT 1')).rows[0].status).toBe('completed');
   const response=(await db.pool.query('SELECT id,plan FROM response_runs ORDER BY created_at DESC LIMIT 1')).rows[0];
   if(name==='hidden')expect(response.plan).toMatchObject({reengagement:{disclosure:'deflect'},speechStyle:{register:'casual',positiveTone:'neutral'}});
   const acks=(await db.pool.query("SELECT kind FROM events WHERE payload->>'responseId'=$1 AND kind IN ('caption.shown','caption.finished')",[response.id])).rows;expect(acks.map(a=>a.kind).sort()).toEqual(['caption.finished','caption.shown']);
   await expect(stage.locator('.stage')).toHaveClass('stage expression-neutral');await expect(stage.locator('.expression-label')).toHaveText('대기 중');expect(await store.busy()).toBe(false);
   const used=packets.slice(offset);expect(used.filter(p=>p.type==='expression.set').every(p=>p.payload.expression==='neutral')).toBe(true);expect(used.find(p=>p.type==='response.start')?.payload.expression).toBe(visible);expect(JSON.stringify(used)).not.toMatch(/workingMemoryEventIds|"affect"|합성 비난/);
   records.push({name,response,acks,packets:used,after:(await store.state()).body});
  }
  const responseCount=Number((await db.pool.query('SELECT count(*) FROM response_runs')).rows[0].count),offset=packets.length;
  await page.getByLabel('할 말').fill('대답하지 말아 줘');await page.getByRole('button',{name:'입력 보내기'}).click();
  await expect.poll(async()=>(await db.pool.query("SELECT attention_status FROM events WHERE session_id=$1 AND payload->>'text'='대답하지 말아 줘' ORDER BY received_at DESC LIMIT 1",[session])).rows[0]?.attention_status).toBe('observed');
  expect(Number((await db.pool.query('SELECT count(*) FROM response_runs')).rows[0].count)).toBe(responseCount);expect((await store.state()).body.turn.recentSilences.at(-1)?.reason).toBe('listening');
  expect((await store.state()).body.affect.embarrassment.value).toBeGreaterThan(.5);await expect(stage.locator('.caption')).toHaveText('');await expect(stage.locator('.stage')).toHaveClass('stage expression-neutral');expect(packets.slice(offset).some(p=>p.type==='speech.segment'||p.type==='response.start')).toBe(false);expect(await store.busy()).toBe(false);
  records.push({name:'listening-silence',responseCountUnchanged:true,packets:packets.slice(offset),after:(await store.state()).body});
  await writeFile(resolve(artifactRoot,'sp-browser-store.json'),JSON.stringify({source:'synthetic controlled states + fixture generation, real Store/HTTP/WS/Chrome',records},null,2));
 }finally{await page.getByRole('button',{name:'만남 종료'}).click();await db.close();}
});

test('SP04/05 browser transport fixture fences public performance through lifecycle and two segments',async({page})=>{
 // Controlled server packets exercise the real Stage/Wire UI, not provider or DB quality.
 await page.addInitScript(()=>{sessionStorage.setItem('accessToken','synthetic-stage');sessionStorage.setItem('clientId','synthetic-stage');});
 await page.route('**/api/sessions/current',r=>r.fulfill({json:{data:{id:'session'}}}));
 let send!:(type:string,payload:any)=>void,close!:()=>void,epoch=0,seq=0;const sent:any[]=[],received:any[]=[];
 await page.routeWebSocket('**/ws/control',socket=>{
  seq=0;epoch++;send=(type,payload)=>{const packet={protocolVersion:1,connectionId:'fixture-'+epoch,sessionId:'session',sequence:String(++seq),type,payload};received.push(packet);socket.send(JSON.stringify(packet));};close=()=>socket.close({code:4000,reason:'synthetic_disconnect'});
  socket.onMessage(raw=>{const p=JSON.parse(String(raw));sent.push(p);if(p.type==='auth')send('connection.welcome',{activeSessionId:'session'});if(p.type==='session.subscribe'){send('session.snapshot',{generationEpoch:'1'});send('output.granted',{outputEpoch:String(epoch),generationEpoch:'1'});}});
 });
 await page.goto('/stage');await expect(page.locator('.stage-status')).toContainText('자막 출력 중');
 const heartbeat=setInterval(()=>send('heartbeat.ping',{}),800);
 const start=(id:string,expression:string,generationEpoch='1',outputEpoch=String(epoch))=>send('response.start',{responseId:id,expression,generationEpoch,outputEpoch});
 const segment=(id:string,index=0,generationEpoch='1',outputEpoch=String(epoch))=>send('speech.segment',{responseId:id,segmentId:id+'-'+index,segmentIndex:index,text:index?'두 번째 문장이야.':'첫 번째 문장이야.',generationEpoch,outputEpoch});
 const seal=(id:string,count=1)=>send('response.sealed',{responseId:id,segmentCount:count,generationEpoch:'1',outputEpoch:String(epoch)});
 const visible=async(e:string)=>expect(page.locator('.stage')).toHaveClass('stage expression-'+e);
 try{
  start('multi','uncomfortable');segment('multi');segment('multi',1);seal('multi',2);await visible('uncomfortable');
  send('expression.set',{expression:'embarrassed',generationEpoch:'1'});send('response.cancel',{responseId:'unrelated',outputEpoch:String(epoch)});await visible('uncomfortable');
  await expect(page.locator('.caption')).toHaveText('두 번째 문장이야.');await visible('uncomfortable');await expect(page.locator('.caption')).toHaveText('');await visible('neutral');
  expect(sent.filter(p=>p.type==='caption.shown'&&p.payload.responseId==='multi')).toHaveLength(2);expect(sent.filter(p=>p.type==='caption.finished'&&p.payload.responseId==='multi')).toHaveLength(2);
  start('multi','embarrassed');segment('multi');await expect(page.locator('.caption')).toHaveText('');
  start('wrong-owner','embarrassed','1','0');segment('wrong-owner');await expect(page.locator('.caption')).not.toBeEmpty();await visible('neutral');send('response.cancel',{responseId:'wrong-owner'});
  start('invalid','bogus');segment('invalid');await visible('neutral');send('response.cancel',{responseId:'invalid'});
  start('cancel','happy');segment('cancel');await visible('happy');send('response.cancel',{responseId:'cancel'});await visible('neutral');start('cancel','happy');segment('cancel');await expect(page.locator('.caption')).toHaveText('');
  start('generation','embarrassed');segment('generation');await visible('embarrassed');send('session.snapshot',{generationEpoch:'2'});await visible('neutral');start('old','embarrassed','1');segment('old',0,'1');await expect(page.locator('.caption')).toHaveText('');
  start('revoke','happy','2');segment('revoke',0,'2');await visible('happy');send('output.revoke',{outputEpoch:String(epoch),stopRequestId:'revoke'});await visible('neutral');
  send('output.granted',{outputEpoch:'2',generationEpoch:'2'});start('end','happy','2','2');segment('end',0,'2','2');await visible('happy');send('session.ended',{});await visible('neutral');
  send('output.granted',{outputEpoch:'2',generationEpoch:'2'});start('disconnect','happy','2','2');segment('disconnect',0,'2','2');await visible('happy');close();await visible('neutral');await expect.poll(()=>epoch).toBe(2);await expect(page.locator('.stage-status')).toContainText('자막 출력 중');
  start('fresh','happy');segment('fresh');seal('fresh');await visible('happy');await expect(page.locator('.caption')).toHaveText('');await visible('neutral');expect(sent.filter(p=>p.type==='caption.finished'&&p.payload.responseId==='fresh')).toHaveLength(1);
  await writeFile(resolve(artifactRoot,'sp-browser-transport.json'),JSON.stringify({source:'controlled transport fixture, real Chrome Stage',sent,received},null,2));
 }finally{clearInterval(heartbeat);}
});
