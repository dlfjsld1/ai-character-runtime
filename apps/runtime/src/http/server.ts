import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import staticPlugin from '@fastify/static';
import { randomBytes,randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { WebSocket } from 'ws';
import { authSchema,envelopeSchema,messageSchemas,uuid,counter,RuntimeError } from '../../../../packages/contracts/src/domain.ts';
import { Store } from '../../../../packages/database/src/store.ts';
import { decay,expression } from '../../../../packages/character-core/src/index.ts';
import type { Provider } from '../../../../packages/adapters/src/ollama.ts';
import type { AppraisalProvider } from '../../../../packages/adapters/src/appraisal.ts';
import { Coordinator,type OutputOwner } from '../coordinator/index.ts';
type Role='studio'|'stage';
type Credential={role:Role;clientId:string;expires:number};
type Connection={socket:WebSocket;credential:Credential;id:string;clientId:string;sent:bigint;received:bigint;sessionId:string|null;ready:boolean;queued:number;queuedBytes:number;lastHeartbeat:number;pending:Promise<unknown>;rate:{at:number;count:number}};
const serialize=(value:unknown)=>JSON.stringify(value,(_key,item)=>typeof item==='bigint'?item.toString():item);
export async function createServer(store:Store,provider:Provider,appraiser:AppraisalProvider,options:{serveStatic?:boolean;timer?:boolean;localProbes?:{stt:boolean;syntheticTts:boolean}}={}) {
  if(provider.ready)await provider.ready().catch(()=>{}); // one startup preparation; never infer on health polls
  const app=Fastify({logger:false,bodyLimit:65536});
  app.setSerializerCompiler(()=>serialize);
  app.addHook('preSerialization',async(_request,_reply,payload)=>JSON.parse(serialize(payload)));
  const instanceId=randomUUID(),tokens=new Map<string,Credential>(),codes=new Map<string,{role:Role;expires:number}>(),connections=new Map<string,Connection>();
  const studioCode=randomBytes(32).toString('hex');codes.set(studioCode,{role:'studio',expires:Date.now()+300000});
  let ownershipTail:Promise<unknown>=Promise.resolve();
  function ownership<T>(fn:()=>Promise<T>){const next=ownershipTail.then(fn,fn);ownershipTail=next.catch(()=>{});return next;}
  let outputOwner:OutputOwner|null=null,ownerSocket:Connection|null=null,pendingRelease:{id:string;clientId:string;resolve:()=>void}|null=null;
  const origins=new Set(['http://127.0.0.1:3001','http://localhost:5173']);
  let closing=false;
  function auth(request:any,role?:Role){const token=request.headers.authorization?.replace(/^Bearer /,'');const credential=tokens.get(token);if(!credential||credential.expires<=Date.now())throw new RuntimeError('unauthenticated',401);if(role&&credential.role!==role)throw new RuntimeError('forbidden',403);return credential;}
  function requestId(request:any){return uuid.parse(request.headers['idempotency-key']);}
  function send(conn:Connection,type:string,payload:object,requestId?:string){if(conn.socket.readyState!==1)return;if(conn.socket.bufferedAmount>262144){conn.socket.close(1008,'backpressure');return;}conn.socket.send(serialize({protocolVersion:1,messageId:randomUUID(),connectionId:conn.id,sessionId:conn.sessionId,sequence:(++conn.sent).toString(),type,...(requestId?{requestId}:{}),payload}));}
  async function snapshot(conn:Connection){const session=await store.currentSession(),s=await store.state();
    send(conn,'session.snapshot',{status:session?.status??'waiting',stateVersion:s.version,generationEpoch:s.generationEpoch,outputEpoch:session?.output_epoch??'0',outputOwnerClientId:outputOwner?.clientId??null,ready:{text:true,voice:false}});
    if(conn.credential.role==='studio'){const activity=await store.activity();const relationships=(await store.db.pool.query('SELECT r.*,i.display_name FROM relationships r JOIN identities i ON i.id=r.identity_id WHERE character_id=$1 ORDER BY i.display_name',[store.characterId])).rows;const activeResponse=(await store.db.pool.query("SELECT id,plan,status FROM response_runs WHERE character_id=$1 AND status IN ('planned','generating','synthesizing','delivering')",[store.characterId])).rows[0]??null;send(conn,'state.snapshot',{activeResponse,computedAt:new Date(store.clock()).toISOString(),stateVersion:s.version,generationEpoch:s.generationEpoch,state:{...decay(s.body,store.clock()),expression:expression(decay(s.body,store.clock()),store.clock())},activity,relationships});}
    else send(conn,'expression.set',{stateVersion:s.version,generationEpoch:s.generationEpoch,expression:expression(decay(s.body,store.clock()),store.clock()).kind,intensity:1,transitionMs:200});
  }
  const coordinator=new Coordinator(store,provider,{
    owner:()=>outputOwner&&ownerSocket?.socket.readyState===1?outputOwner:null,
    changed:async()=>{for(const conn of connections.values())if(conn.sessionId)await snapshot(conn);},
    sendOwner:(type,payload)=>{if(ownerSocket)send(ownerSocket,type,payload);},
    inputStatus:(eventId,status)=>{for(const conn of connections.values())if(conn.credential.role==='studio')send(conn,'input.status',{eventId,status});},
    failure:code=>{for(const conn of connections.values())send(conn,'runtime.status',{status:'degraded',code});},
  },appraiser);
  app.addHook('onRequest',async(request,reply)=>{
    const path=request.url.split('?')[0];reply.header('Cache-Control','no-store');
    if(path.startsWith('/api/')||path==='/health/ready'){
      let safeGet=false;
      if(request.method==='GET'&&!request.headers.origin&&request.headers['sec-fetch-site']==='same-origin') {try{safeGet=origins.has(new URL(request.headers.referer??'').origin);}catch{}}
      if(!origins.has(request.headers.origin??'')&&!safeGet)throw new RuntimeError('forbidden_origin',403);
      if(request.url.includes('accessToken=')||request.url.includes('token='))throw new RuntimeError('invalid_message',400);
      if(['POST','PUT','PATCH'].includes(request.method)&&!request.headers['content-type']?.startsWith('application/json'))throw new RuntimeError('invalid_message',400);
    }
  });
  app.setErrorHandler((error,request,reply)=>{const code=error instanceof RuntimeError?error.code:error instanceof z.ZodError?'invalid_message':(error as any).statusCode===413?'payload_too_large':'db_unavailable';reply.code(error instanceof RuntimeError?error.httpStatus:error instanceof z.ZodError?400:(error as any).statusCode===413?413:503).send({error:{code,message:code,requestId:typeof request.headers['idempotency-key']==='string'?request.headers['idempotency-key']:null,retryable:code==='db_unavailable'}});});
  app.get('/health/live',async()=>({data:{alive:true}}));
  app.get('/health/ready',async req=>{auth(req,'studio');return {data:{database:store.db.healthy?'ready':'unavailable',appraisal:{provider:appraiser.name,model:appraiser.model,...appraiser.readiness()},llm:provider.name==='synthetic-fixture'?'synthetic_test_only':provider.readiness?.().status??'not_verified',llmDetails:provider.readiness?.()??null,stt:options.localProbes?.stt?'probe_verified_production_disabled':'not_configured',tts:options.localProbes?.syntheticTts?'synthetic_probe_verified_voice_preset_missing':'voice_preset_missing',stage:!!ownerSocket?.ready}};});
  app.post('/api/auth/exchange',async req=>{const input=z.object({code:z.string().length(64),clientInstanceId:uuid}).strict().parse(req.body);const code=codes.get(input.code);if(!code||code.expires<=Date.now())throw new RuntimeError('unauthenticated',401);codes.delete(input.code);const accessToken=randomBytes(32).toString('hex'),expires=Date.now()+8*3600000;tokens.set(accessToken,{role:code.role,clientId:input.clientInstanceId,expires});return {data:{accessToken,role:code.role,expiresAt:new Date(expires).toISOString()}};});
  app.post('/api/stage-pairings',async req=>{auth(req,'studio');const code=randomBytes(32).toString('hex');codes.set(code,{role:'stage',expires:Date.now()+300000});return {data:{code,expiresAt:new Date(Date.now()+300000).toISOString()}};});
  app.get('/api/stages',async req=>{auth(req,'studio');return {data:[...connections.values()].filter(x=>x.credential.role==='stage').map(x=>({clientId:x.clientId,ready:x.ready,owner:outputOwner?.clientId===x.clientId,connected:x.socket.readyState===1}))};});
  app.get('/api/sessions/current',async req=>{auth(req);const s=await store.currentSession();return {data:s?{id:s.id,status:s.status,characterId:s.character_id,configVersion:s.config_version}:null};});
  app.post('/api/sessions',async req=>{auth(req,'studio');const body=z.object({sessionId:uuid,characterId:uuid,configVersion:counter}).strict().parse(req.body);if(body.characterId!==store.characterId)throw new RuntimeError('forbidden',403);const data=await coordinator.control(()=>store.startSession(body.sessionId,requestId(req),body.configVersion));return {data};});
  app.post('/api/sessions/:id/stop',async req=>{auth(req,'studio');const id=uuid.parse((req.params as any).id);z.object({reason:z.literal('operator_stop')}).strict().parse(req.body);await coordinator.cancelAll(id,'session_ended');const data=await coordinator.control(()=>store.stopSession(id,requestId(req)));outputOwner=null;ownerSocket=null;for(const conn of connections.values())send(conn,'session.ended',{status:'ended',reason:'operator_stop'});return {data};});
  app.get('/api/problems',async req=>{auth(req,'studio');return {data:await store.problems()};});
  app.get('/api/characters/:id/state',async req=>{auth(req,'studio');if((req.params as any).id!==store.characterId)throw new RuntimeError('forbidden',403);return {data:await store.state()};});
  app.get('/api/identities',async req=>{auth(req,'studio');return {data:(await store.db.pool.query('SELECT id,display_name FROM identities ORDER BY display_name')).rows};});
  app.get('/api/sessions/:id/timeline',async req=>{auth(req,'studio');const id=uuid.parse((req.params as any).id);return {data:await store.timeline(id,z.coerce.number().int().min(1).max(100).optional().parse((req.query as any).limit)??50)};});
  app.get('/api/characters/:id/memories',async req=>{auth(req,'studio');if((req.params as any).id!==store.characterId)throw new RuntimeError('forbidden',403);return {data:await store.memories()};});
  app.get('/api/commands/:id',async req=>{auth(req,'studio');return {data:await store.command(uuid.parse((req.params as any).id))};});
  async function mutateSource(req:any,memory:boolean,content?:string,sourceIds?:string[]) {
    auth(req,'studio');const key=requestId(req),id=uuid.parse(req.params.id);
    const expected=content===undefined?counter.parse(String(req.headers['if-match']??'').replace(/^"|"$/g,'')):counter.parse(req.body.expectedVersion);
    const record=(await store.db.pool.query(memory?'SELECT content_version AS version,status FROM memories WHERE id=$1 AND character_id=$2':'SELECT revision AS version,data_status AS status FROM events WHERE id=$1 AND character_id=$2',[id,store.characterId])).rows[0];
    if(!record)throw new RuntimeError(memory?'memory_not_found':'event_not_found',404);
    if(record.version!==expected||record.status!=='active')throw new RuntimeError('revision_conflict');
    if(content!==undefined){const actual=(await store.db.pool.query("SELECT ms.event_id FROM memory_sources ms JOIN events e ON e.id=ms.event_id WHERE ms.memory_id=$1 AND ms.character_id=$2 AND e.data_status='active' AND e.revision=ms.event_revision",[id,store.characterId])).rows.map(x=>x.event_id).sort();if(JSON.stringify(actual)!==JSON.stringify([...(sourceIds??[])].sort()))throw new RuntimeError('invalid_memory_source');}
    const session=await store.currentSession();if(session)await coordinator.cancelAll(session.id,'source_invalidated');
    const result=await coordinator.control(()=>memory?store.editMemory(id,expected,key,content):store.deleteEvent(id,expected,key));
    await coordinator.sink.changed();return {data:result};
  }
  app.post('/api/memories/:id/corrections',async req=>{const body=z.object({expectedVersion:counter,content:z.string().trim().min(1).max(500),sourceEventIds:z.array(uuid).min(1).max(20)}).strict().parse(req.body);return mutateSource(req,true,body.content,body.sourceEventIds);});
  app.delete('/api/memories/:id',async req=>mutateSource(req,true));
  app.delete('/api/events/:id',async req=>mutateSource(req,false));
  app.get('/api/characters/:id/agendas',async req=>{auth(req,'studio');if((req.params as any).id!==store.characterId)throw new RuntimeError('forbidden',403);return {data:(await store.db.pool.query('SELECT id,status,activity_run_id FROM agendas WHERE character_id=$1 ORDER BY created_at DESC LIMIT 50',[store.characterId])).rows};});
  app.post('/api/sessions/:id/activities',async req=>{auth(req,'studio');const sessionId=uuid.parse((req.params as any).id),body=z.object({problemId:z.string().min(1).max(80)}).strict().parse(req.body);const data=await coordinator.control(()=>store.startActivity(sessionId,requestId(req),body.problemId));void coordinator.solve(sessionId,data.activityId);return {data};});
  app.post('/api/activities/:id/hints',async req=>{auth(req,'studio');const session=await store.currentSession();if(!session)throw new RuntimeError('session_closed');const activityId=uuid.parse((req.params as any).id),body=z.object({hintId:z.string().min(1).max(80),identityId:uuid}).strict().parse(req.body);const data=await coordinator.control(()=>store.hint(session.id,requestId(req),activityId,body.hintId,body.identityId));void coordinator.solve(session.id,activityId);return {data};});
  for(const action of ['retry','end','resume'] as const)app.post(`/api/activities/:id/${action}`,async req=>{auth(req,'studio');z.object({}).strict().parse(req.body);const session=await store.currentSession();if(!session)throw new RuntimeError('session_closed');const id=uuid.parse((req.params as any).id);const data=await coordinator.control(()=>store.activityCommand(session.id,requestId(req),id,action));if(action!=='end')void coordinator.solve(session.id,id);return {data};});
  app.post('/api/sessions/:id/agenda-answer',async req=>{auth(req,'studio');const id=uuid.parse((req.params as any).id),body=z.object({accept:z.boolean()}).strict().parse(req.body);const data=await coordinator.control(()=>store.answerAgenda(id,requestId(req),body.accept));if(body.accept)void coordinator.solve(id,data.activityId);return {data};});
  app.post('/api/sessions/:id/output-owner',async req=>ownership(async()=>{auth(req,'studio');const sessionId=uuid.parse((req.params as any).id),body=z.object({stageClientId:uuid,previousStageClosed:z.boolean()}).strict().parse(req.body);const next=connections.get(body.stageClientId);if(!next||next.credential.role!=='stage'||!next.ready||next.sessionId!==sessionId)throw new RuntimeError('stage_unavailable');
    if(outputOwner&&outputOwner.clientId!==body.stageClientId){if(!body.previousStageClosed){if(!ownerSocket||ownerSocket.socket.readyState!==1)throw new RuntimeError('previous_output_unconfirmed');const stopId=randomUUID();const stopped=new Promise<void>(resolve=>{pendingRelease={id:stopId,clientId:outputOwner!.clientId,resolve};});send(ownerSocket,'output.revoke',{outputEpoch:outputOwner.outputEpoch,stopRequestId:stopId,reason:'owner_change'});let timer:ReturnType<typeof setTimeout>;try{await Promise.race([stopped,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new RuntimeError('previous_output_unconfirmed')),2000);})]);}finally{clearTimeout(timer!);pendingRelease=null;}}await coordinator.cancelAll(sessionId,'owner_change');await coordinator.control(()=>store.cancel(sessionId,randomUUID(),'owner_change'));}
    const result=await coordinator.control(()=>store.grantOwner(sessionId,requestId(req),body.stageClientId));outputOwner={clientId:body.stageClientId,outputEpoch:result.outputEpoch};ownerSocket=next;const state=await store.state();send(next,'output.granted',{clientId:body.stageClientId,outputEpoch:result.outputEpoch,generationEpoch:state.generationEpoch});return {data:result};}));
  await app.register(websocket,{options:{maxPayload:65536}});
  app.get('/ws/control',{websocket:true,preValidation:async req=>{if(!origins.has(req.headers.origin??''))throw new RuntimeError('forbidden_origin',403);}},(socket,request)=>{
    let conn:Connection|null=null;const authTimer=setTimeout(()=>socket.close(1008,'auth_timeout'),5000);let authPending=false;
    socket.on('message',raw=>{
      if(Buffer.byteLength(raw as any)>65536){socket.close(1009,'payload_too_large');return;}
      let value:any;try{value=JSON.parse(raw.toString());}catch{socket.close(1007,'invalid_message');return;}
      if(!conn){if(authPending){socket.close(1008,'unauthenticated');return;}authPending=true;
        try{const first=authSchema.parse(value),credential=tokens.get(first.accessToken);if(!credential||credential.expires<=Date.now()||credential.clientId!==first.clientInstanceId||connections.has(credential.clientId))throw new RuntimeError('unauthenticated',401);
          clearTimeout(authTimer);conn={socket,credential,id:randomUUID(),clientId:credential.clientId,sent:0n,received:0n,sessionId:null,ready:false,queued:0,queuedBytes:0,lastHeartbeat:Date.now(),pending:Promise.resolve(),rate:{at:Date.now(),count:0}};connections.set(conn.clientId,conn);const current=conn;void store.currentSession().then(s=>send(current,'connection.welcome',{serverInstanceId:instanceId,role:credential.role,activeSessionId:s?.id??null,heartbeatMs:1000}));
        }catch{socket.close(1008,'unauthenticated');}return;
      }
      const current=conn;current.queued++;current.queuedBytes+=Buffer.byteLength(raw as any);if(current.queued>100||current.queuedBytes>262144){socket.close(1008,'backpressure');return;}current.pending=current.pending.then(async()=>{
        try{if(socket.readyState!==1)return;const envelope=envelopeSchema.parse(value);if(envelope.connectionId!==current.id||BigInt(envelope.sequence)!==current.received+1n)throw new RuntimeError('invalid_sequence',400);current.received++;
          if(!(envelope.type in messageSchemas))throw new RuntimeError('invalid_message',400);const payload=(messageSchemas as any)[envelope.type].parse(envelope.payload);
          if(envelope.type==='heartbeat.pong'){current.lastHeartbeat=Date.now();return;}
          if(envelope.type==='heartbeat.ping'){send(current,'heartbeat.pong',payload);return;}
          if(envelope.type==='session.subscribe'){const active=await store.currentSession();if(payload.sessionId!==null&&payload.sessionId!==active?.id)throw new RuntimeError('session_closed');current.sessionId=payload.sessionId;await snapshot(current);return;}
          if(envelope.sessionId!==current.sessionId||!current.sessionId)throw new RuntimeError('session_closed');
          const stageTypes=['stage.ready','caption.shown','caption.finished','output.released'];if(stageTypes.includes(envelope.type)&&current.credential.role!=='stage'||!stageTypes.includes(envelope.type)&&current.credential.role!=='studio')throw new RuntimeError('forbidden',403);
          if(envelope.type==='stage.ready'){current.ready=payload.supportsExpressions.includes('neutral');return;}
          if(envelope.type==='output.released'){if(!pendingRelease||pendingRelease.clientId!==current.clientId||pendingRelease.id!==payload.stopRequestId||outputOwner?.outputEpoch.toString()!==payload.outputEpoch)throw new RuntimeError('stale_epoch');pendingRelease.resolve();return;}
          if(!envelope.requestId)throw new RuntimeError('invalid_message',400);let result;
          if(envelope.type==='chat.submit'){if(Date.now()-current.rate.at>=1000)current.rate={at:Date.now(),count:0};if(++current.rate.count>50)throw new RuntimeError('rate_limited',429);result=await coordinator.chat(current.sessionId,envelope.requestId,payload);}
          else if(envelope.type==='response.stop')result=await coordinator.cancel(current.sessionId,envelope.requestId,payload.responseId);
          else {if(outputOwner?.clientId!==current.clientId)throw new RuntimeError('forbidden',403);result=await coordinator.control(()=>store.report(current.sessionId!,envelope.requestId!,envelope.type as any,payload,current.clientId));if(envelope.type==='caption.finished')await coordinator.delivered();}
          send(current,'command.result',{requestId:envelope.requestId,...result},envelope.requestId);
        }catch(e){const code=e instanceof RuntimeError?e.code:'invalid_message';if(['forbidden','invalid_sequence','invalid_message'].includes(code)){socket.close(1008,code);return;}send(current,'command.result',{requestId:value.requestId,status:'rejected',error:{code}},value.requestId);}
      }).finally(()=>{current.queued--;current.queuedBytes-=Buffer.byteLength(raw as any);}).catch(()=>socket.close(1011,'server_error'));
    });
    socket.on('close',()=>{clearTimeout(authTimer);if(conn){connections.delete(conn.clientId);if(ownerSocket===conn){ownerSocket=null;if(!closing)void store.cancel(conn.sessionId!,randomUUID(),'stage_disconnected').catch(()=>{});}}});
  });
  const heartbeat=setInterval(()=>{for(const conn of connections.values()){if(conn.credential.expires<=Date.now()||Date.now()-conn.lastHeartbeat>5000){conn.socket.close(1008,'heartbeat_timeout');continue;}send(conn,'heartbeat.ping',{nonce:randomUUID(),lastSequence:conn.received});}},1000);
  if(options.serveStatic!==false){const root=fileURLToPath(new URL('../../../studio/dist/',import.meta.url));if(existsSync(root)){await app.register(staticPlugin,{root,prefix:'/'});app.get('/studio',async(_req,reply)=>reply.sendFile('index.html'));app.get('/stage',async(_req,reply)=>reply.sendFile('index.html'));}}
  if(options.timer!==false)coordinator.start();
  app.addHook('onClose',async()=>{closing=true;clearInterval(heartbeat);await coordinator.stop();for(const conn of connections.values())conn.socket.close(1000,'server_shutdown');});
  return {app,coordinator,studioCode,instanceId};
}
