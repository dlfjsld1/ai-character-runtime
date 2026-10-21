import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import {fork,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import WebSocket from 'ws';
import {testDatabase,reset,CHARACTER_ID,IDENTITY_IDS} from './helpers.ts';
import {Store} from '../packages/database/src/store.ts';
let db:Awaited<ReturnType<typeof testDatabase>>;
const children:ChildProcess[]=[],sockets:WebSocket[]=[],origin='http://127.0.0.1:3001';
beforeAll(async()=>{db=await testDatabase();await reset(db);});
afterAll(async()=>{for(const socket of sockets)socket.terminate();for(const child of children)if(child.exitCode===null&&child.signalCode===null){const done=once(child,'exit');child.kill();await done;}await db?.close();});
async function boot(){
 const child=fork(new URL('./persistence-restart-worker.ts',import.meta.url),['--synthetic-restart'],{execArgv:['--experimental-transform-types'],stdio:['ignore','ignore','pipe','ipc'],windowsHide:true});children.push(child);
 const ready=await new Promise<{port:number;code:string}>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('restart_worker_timeout')),10000);child.once('message',message=>{clearTimeout(timer);resolve(message as {port:number;code:string});});child.once('exit',()=>{clearTimeout(timer);reject(new Error('restart_worker_exited'));});child.once('error',reject);});
 const url=`http://127.0.0.1:${ready.port}`,studioId=randomUUID();let token='';
 async function request(path:string,method='GET',body?:object){const response=await fetch(url+path,{method,headers:{origin,authorization:`Bearer ${token}`,'content-type':'application/json','idempotency-key':randomUUID()},...(body?{body:JSON.stringify(body)}:{})});const result=await response.json() as any;expect(response.status,JSON.stringify(result)).toBe(200);return result.data;}
 token=(await request('/api/auth/exchange','POST',{code:ready.code,clientInstanceId:studioId})).accessToken;
 async function session(){const id=randomUUID();await request('/api/sessions','POST',{sessionId:id,characterId:CHARACTER_ID,configVersion:'1'});return id;}
 async function stop(crash=false){const done=once(child,'exit');if(crash)child.kill();else child.send('stop');await done;}
 return {child,url,studioId,token,request,session,stop};
}
async function connect(url:string,token:string,id:string){
 const socket=new WebSocket(url.replace('http:','ws:')+'/ws/control',{headers:{origin}});sockets.push(socket);const packets:any[]=[];let connectionId='',sequence=0;
 const send=(type:string,payload:object,sessionId:string|null,requestId?:string)=>socket.send(JSON.stringify({protocolVersion:1,messageId:randomUUID(),connectionId,sequence:String(++sequence),sessionId,type,payload,...(requestId?{requestId}:{})}));
 socket.on('message',raw=>{const packet=JSON.parse(raw.toString());packets.push(packet);if(packet.type==='connection.welcome')connectionId=packet.connectionId;if(packet.type==='heartbeat.ping')send('heartbeat.pong',packet.payload,null);});
 await once(socket,'open');socket.send(JSON.stringify({protocolVersion:1,type:'auth',accessToken:token,clientInstanceId:id}));
 const wait=async(type:string,match=(packet:any)=>true)=>{await vi.waitFor(()=>expect(packets.some(p=>p.type===type&&match(p))).toBe(true),{timeout:5000});return packets.find(p=>p.type===type&&match(p));};
 await wait('connection.welcome');return {socket,packets,send,wait};
}
it('P02 real process crash/clean restart retains facts/documents and delivers only a new Stage response',async()=>{
 const first=await boot(),s1=await first.session(),path1=`/api/sessions/${s1}`;
 const fact=await first.request(path1+'/personal-facts','POST',{key:'음료 선호',value:'보리차'});
 const doc=await first.request(path1+'/knowledge','POST',{retention:'persistent',title:'합성 설명',body:'필터는 6개월마다 교체한다.'});
 const store=new Store(db),pending=await store.acceptChat(s1,randomUUID(),{identityId:IDENTITY_IDS[3],text:'재시작 전 미처리 합성 입력'});
 await first.stop(true);
 const second=await boot();expect(await second.request('/api/sessions/current')).toBeNull();const s2=await second.session(),path2=`/api/sessions/${s2}`;
 expect((await second.request(path2+'/personal-facts')).facts).toMatchObject([{id:fact.id,value:'보리차',revision:'1'}]);
 expect(await second.request(path2+'/knowledge')).toMatchObject([{documentId:doc.documentId,revision:'1',retention:'persistent'}]);
 expect((await db.pool.query('SELECT attention_status FROM events WHERE id=$1',[pending.eventId])).rows[0].attention_status).toBe('expired');
 const pair=await second.request('/api/stage-pairings','POST',{}),stageId=randomUUID(),stageToken=(await second.request('/api/auth/exchange','POST',{code:pair.code,clientInstanceId:stageId})).accessToken;
 const stage=await connect(second.url,stageToken,stageId),studio=await connect(second.url,second.token,second.studioId);
 stage.send('session.subscribe',{sessionId:s2},s2);studio.send('session.subscribe',{sessionId:s2},s2);await stage.wait('session.snapshot');
 stage.send('stage.ready',{audioUnlocked:false,avatarReady:true,supportsExpressions:['neutral']},s2);
 await vi.waitFor(async()=>expect((await second.request('/api/stages'))[0].ready).toBe(true));
 await second.request(path2+'/output-owner','POST',{stageClientId:stageId,previousStageClosed:false});
 expect(stage.packets.filter(p=>p.type==='speech.segment')).toEqual([]);
 const forged=randomUUID();studio.send('chat.submit',{identityId:IDENTITY_IDS[0],text:'다른 상대를 사칭한 합성 입력'},s2,forged);
 expect((await studio.wait('command.result',p=>p.payload.requestId===forged)).payload).toMatchObject({status:'rejected',error:{code:'forbidden_identity'}});
 expect((await db.pool.query("SELECT count(*) FROM events WHERE session_id=$1 AND kind='chat.final'",[s2])).rows[0].count).toBe('0');
 studio.send('chat.submit',{identityId:IDENTITY_IDS[3],text:'내가 저장한 음료 선호가 뭐야?'},s2,randomUUID());
 const output=(await stage.wait('speech.segment')).payload;expect(output.text).toBe('보리차');
 const ack={responseId:output.responseId,segmentId:output.segmentId,generationEpoch:output.generationEpoch,outputEpoch:output.outputEpoch};
 for(const type of ['caption.shown','caption.finished']){const key=randomUUID();stage.send(type,ack,s2,key);expect((await stage.wait('command.result',p=>p.payload.requestId===key)).payload.status).toBe('committed');}
 expect((await db.pool.query('SELECT status FROM response_runs WHERE id=$1',[output.responseId])).rows[0].status).toBe('completed');
 stage.socket.close();studio.socket.close();await second.stop();
 const third=await boot();expect(await third.request('/api/sessions/current')).toBeNull();const s3=await third.session();
 expect((await third.request(`/api/sessions/${s3}/personal-facts`)).facts).toMatchObject([{id:fact.id,value:'보리차',revision:'1'}]);
 expect((await third.request(`/api/sessions/${s3}/knowledge`))[0].documentId).toBe(doc.documentId);expect(await store.busy()).toBe(false);
 await third.stop();
},30000);
