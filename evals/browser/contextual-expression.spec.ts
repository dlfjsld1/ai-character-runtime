import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {initialState,dialoguePlan,speechStyle,continueRegister,stageExpression} from '../../packages/character-core/src/index.ts';
import {captureStageCaption} from './caption.ts';

const cases=[
 {id:'masked-neutral',joy:0,cautious:false,all:false,expression:'neutral',label:'차분하게 말하는 중'},
 {id:'masked-happy',joy:.7,cautious:false,all:false,expression:'happy',label:'밝게 말하는 중'},
 {id:'masked-cautious',joy:.7,cautious:true,all:false,expression:'embarrassed',label:'조심스럽게 말하는 중'},
 {id:'full-hide',joy:.7,cautious:true,all:true,expression:'neutral',label:'차분하게 말하는 중'},
] as const;
for(const item of cases)test(`CX04/06 controlled formal ${item.id} reaches the real Stage and ACK`,async({page})=>{
 // Authored text and controlled transport prove display only, never model quality.
 const identity='00000000-0000-4000-8000-000000000002',state=initialState(1000);
 state.affect.frustration.value=.7;state.affect.frustration.causes=[{eventId:'00000000-0000-4000-8000-000000000001',targetId:identity}];state.affect.joy.value=item.joy;
 if(item.cautious){state.affect.embarrassment.value=.7;state.expression={kind:'embarrassed',since:1000};}
 const before=structuredClone(state),previous=dialoguePlan(state,'question',identity);
 const mask=item.all?{joy:'mask' as const,discomfort:'mask' as const,embarrassment:'mask' as const}:{discomfort:'mask' as const};
 const plan=continueRegister(state,{...dialoguePlan(state,'question',identity),speechStyle:speechStyle(state,identity,mask)},previous);
 expect(plan.speechStyle?.register).toBe('formal');expect(stageExpression(plan)).toBe(item.expression);expect(state).toEqual(before);
 await page.addInitScript(()=>{sessionStorage.setItem('accessToken','synthetic-stage');sessionStorage.setItem('clientId','synthetic-stage');});
 const blocked:string[]=[];
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='127.0.0.1'&&url.port==='3001')return route.continue();
  blocked.push(url.origin);return route.abort('blockedbyclient');
 });
 await page.route('**/api/sessions/current',route=>route.fulfill({json:{data:{id:'session'}}}));
 let send!:(type:string,payload:object)=>void,sequence=0;const received:any[]=[],sent:any[]=[];
 await page.routeWebSocket('**/ws/control',socket=>{
  send=(type,payload)=>{const packet={protocolVersion:1,connectionId:'cx-fixture',sessionId:'session',sequence:String(++sequence),type,payload};received.push(packet);socket.send(JSON.stringify(packet));};
  socket.onMessage(raw=>{const packet=JSON.parse(String(raw));sent.push(packet);if(packet.type==='auth')send('connection.welcome',{activeSessionId:'session'});if(packet.type==='session.subscribe'){send('session.snapshot',{generationEpoch:'1'});send('output.granted',{generationEpoch:'1',outputEpoch:'1'});}});
 });
 await page.goto('/stage');await expect(page.locator('.stage-status')).toContainText('자막 출력 중');
 const heartbeat=setInterval(()=>send('heartbeat.ping',{}),800),root=resolve(process.env.TEST_ARTIFACT_ROOT||'runtime-data'),responseId=item.id,segmentId=item.id+'-0',caption='모임은 오후 3시입니다.',started=performance.now();
 try{
  send('response.start',{responseId,expression:stageExpression(plan),generationEpoch:'1',outputEpoch:'1'});
  send('speech.segment',{responseId,segmentId,segmentIndex:0,text:caption,generationEpoch:'1',outputEpoch:'1'});
  send('response.sealed',{responseId,segmentCount:1,generationEpoch:'1',outputEpoch:'1'});
  await expect(page.locator('.caption')).toHaveText(caption);
  const captionObservedMs=performance.now()-started;
  await expect(page.locator('.stage')).toHaveClass('stage expression-'+item.expression);await expect(page.locator('.expression-label')).toHaveText(item.label);
  expect(await captureStageCaption(page,resolve(root,item.id+'.png'))).toBe(caption);
  await expect(page.locator('.caption')).toHaveText('');await expect(page.locator('.stage')).toHaveClass('stage expression-neutral');await expect(page.locator('.expression-label')).toHaveText('대기 중');
  const acks=sent.filter(packet=>['caption.shown','caption.finished'].includes(packet.type));
  expect(acks.map(packet=>packet.type).sort()).toEqual(['caption.finished','caption.shown']);
  for(const ack of acks)expect(ack.payload).toEqual({responseId,segmentId,generationEpoch:'1',outputEpoch:'1'});
  expect(blocked).toEqual([]);expect(state).toEqual(before);
  expect(JSON.stringify(received)).not.toMatch(/"affect"|"causes"|"speechStyle"|"frustration"/);
  await writeFile(resolve(root,item.id+'.json'),JSON.stringify({scope:'controlled Core projection + WebSocket fixture + real Chrome Stage; canned caption, no provider or Store path',case:item.id,plan,stateBefore:before,stateAfter:state,caption,captionObservedMs,completedMs:performance.now()-started,received,acks,externalCalls:0,quality:'NOT_VERIFIED'},null,2)+'\n');
 }finally{clearInterval(heartbeat);}
});
