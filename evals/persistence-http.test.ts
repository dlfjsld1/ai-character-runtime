import {beforeAll,beforeEach,afterEach,afterAll,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {testDatabase,reset,fixtureProvider,mockJevAppraiser,IDENTITY_IDS,CHARACTER_ID} from './helpers.ts';
import {Store} from '../packages/database/src/store.ts';
import {createServer} from '../apps/runtime/src/http/server.ts';
let db:Awaited<ReturnType<typeof testDatabase>>,store:Store,runtime:Awaited<ReturnType<typeof createServer>>,studioToken:string,stageToken:string,sessionId:string;
const origin='http://127.0.0.1:3001',operator=IDENTITY_IDS[3],input={key:'음료 선호',value:'보리차'};
beforeAll(async()=>{db=await testDatabase();});
beforeEach(async()=>{
 await reset(db);store=new Store(db);runtime=await createServer(store,fixtureProvider,mockJevAppraiser(),{serveStatic:false,timer:false});
 studioToken=(await request('/api/auth/exchange','POST',{code:runtime.studioCode,clientInstanceId:randomUUID()})).json().data.accessToken;
 const code=(await request('/api/stage-pairings','POST',{})).json().data.code;
 stageToken=(await request('/api/auth/exchange','POST',{code,clientInstanceId:randomUUID()})).json().data.accessToken;
 sessionId=randomUUID();expect((await request('/api/sessions','POST',{sessionId,characterId:CHARACTER_ID,configVersion:'1'})).statusCode).toBe(200);
});
afterEach(async()=>{await runtime?.app.close();});afterAll(async()=>{await db?.close();});
function request(path:string,method='GET',body?:object,headers:Record<string,string>={}){return runtime.app.inject({method:method as 'GET'|'POST'|'PATCH'|'DELETE',url:path,headers:{origin,authorization:`Bearer ${studioToken??''}`,...(body?{'content-type':'application/json'}:{}),'idempotency-key':randomUUID(),...headers},...(body?{payload:body}:{})});}
const path=()=>`/api/sessions/${sessionId}/personal-facts`;
async function save(){const r=await request(path(),'POST',input);expect(r.statusCode).toBe(200);return r.json().data;}
it('P04 single-operator discovery and CRUD bind the server owner without a client identity selector',async()=>{
 expect((await request('/api/identities')).json().data.map((r:any)=>r.id)).toEqual([operator]);
 const fact=await save(),snapshot=(await request(path())).json().data;
 expect(snapshot).toMatchObject({identityId:operator,revision:'1',facts:[{id:fact.id,...input}]});
 for(const identityId of [operator,IDENTITY_IDS[0]])expect((await request(path(),'POST',{...input,identityId})).statusCode).toBe(400);
 expect((await request(`${path()}?identityId=${IDENTITY_IDS[0]}`)).statusCode).toBe(400);
 expect((await store.personalFacts(sessionId,IDENTITY_IDS[0])).facts).toEqual([]);
});
it.each(['GET','POST','PATCH','DELETE'])('P04 %s rejects untrusted origins, missing credentials and Stage role',async method=>{
 const fact=await save(),url=method==='PATCH'||method==='DELETE'?`${path()}/${fact.id}`:path(),body=method==='POST'||method==='PATCH'?input:undefined;
 for(const [headers,status] of [[{origin:'https://untrusted.invalid'},403],[{authorization:''},401],[{authorization:`Bearer ${stageToken}`},403]] as const){const result=await request(url,method,body,{'if-match':'"1"',...headers});expect(result.statusCode).toBe(status);expect(result.body).not.toContain('보리차');}
 expect((await store.personalFacts(sessionId,operator)).revision).toBe('1');
});
it('P06 requires idempotency and CAS, returns normalized conflicts, and never revives a tombstone',async()=>{
 expect((await request(path(),'POST',input,{'idempotency-key':''})).statusCode).toBe(400);
 const key=randomUUID(),created=await request(path(),'POST',input,{'idempotency-key':key}),fact=created.json().data;
 expect((await request(path(),'POST',input,{'idempotency-key':key})).json().data).toEqual(fact);
 expect((await request(path(),'POST',{...input,value:'녹차'},{'idempotency-key':key})).json().error.code).toBe('idempotency_conflict');
 expect((await request(`${path()}/${fact.id}`,'PATCH',{...input,value:'루이보스차'})).statusCode).toBe(400);
 expect((await request(`${path()}/${fact.id}`,'PATCH',{...input,value:'루이보스차'},{'if-match':'"1"'})).json().data.revision).toBe('2');
 expect((await request(`${path()}/${fact.id}`,'DELETE',undefined,{'if-match':'"1"'})).json().error.code).toBe('personal_fact_revision_conflict');
 expect((await request(`${path()}/${fact.id}`,'DELETE',undefined,{'if-match':'"2"'})).statusCode).toBe(200);
 expect((await request(path(),'POST',input,{'idempotency-key':key})).json().data).toEqual(fact);
 expect((await request(path())).json().data.facts).toEqual([]);
});
it('P04 persistent documents reject forged owner on write, read and delete; omitted owner binds operator',async()=>{
 const url=`/api/sessions/${sessionId}/knowledge`,document={title:'합성 자료',body:'필터는 6개월마다 교체한다.',retention:'persistent'};
 expect((await request(url,'POST',{...document,identityId:IDENTITY_IDS[0]})).statusCode).toBe(403);
 const saved=await request(url,'POST',document);expect(saved.statusCode).toBe(200);const id=saved.json().data.documentId;
 expect((await request(`${url}?identityId=${IDENTITY_IDS[0]}`)).statusCode).toBe(403);
 expect((await request(`${url}/${id}?identityId=${IDENTITY_IDS[0]}`,'DELETE',undefined,{'if-match':'"1"'})).statusCode).toBe(403);
 expect((await request(url)).json().data).toHaveLength(1);
});
it('P04 refuses an ended meeting and does not accept another owner fact ID',async()=>{
 const other=await store.mutatePersonalFact(sessionId,IDENTITY_IDS[0],randomUUID(),{kind:'create',input});
 expect((await request(`${path()}/${other.result.id}`,'DELETE',undefined,{'if-match':'"1"'})).statusCode).toBe(404);
 await store.stopSession(sessionId,randomUUID());expect((await request(path())).json().error.code).toBe('session_closed');
 expect((await request(path(),'POST',input)).json().error.code).toBe('session_closed');
});
it('P05/P10 storage failure reports no success or plaintext; the next request can commit',async()=>{
 const spy=vi.spyOn(store,'mutatePersonalFact').mockRejectedValueOnce(new Error('synthetic database failure'));
 const result=await request(path(),'POST',input);expect(result.statusCode).toBe(503);expect(result.json()).toMatchObject({error:{code:'db_unavailable'}});expect(result.body).not.toContain('보리차');
 expect((await request(path())).json().data.facts).toEqual([]);await save();spy.mockRestore();
});
