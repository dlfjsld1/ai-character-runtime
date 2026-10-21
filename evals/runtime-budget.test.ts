import {afterAll,afterEach,beforeAll,beforeEach,expect,it,vi} from 'vitest';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {testDatabase,reset,observed,IDENTITY_IDS} from './helpers.ts';
import {Store} from '../packages/database/src/store.ts';
import {Coordinator} from '../apps/runtime/src/coordinator/index.ts';
import {createProviders} from '../apps/runtime/src/providers.ts';
import {parseConfig} from '../packages/contracts/src/local-config.ts';
import {interactionFixture} from './interaction-fixture.ts';

let db:Awaited<ReturnType<typeof testDatabase>>;
beforeAll(async()=>{db=await testDatabase();});beforeEach(async()=>{await reset(db);});
afterEach(()=>vi.unstubAllGlobals());afterAll(async()=>{await db?.close();});
it('normal registry and Store reuse one full count between fitting and Stage dispatch',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'prepared-dispatch-')),path=join(dir,'ledger.json'),requests:{url:string;body:any}[]=[];
 const fetcher=vi.fn(async(url:string|URL|Request,init?:RequestInit)=>{
  const body=JSON.parse(String(init?.body));requests.push({url:String(url),body});
  if(String(url).endsWith('/decisions'))return Response.json(interactionFixture({speech_act:'question'},[1,0,0,0]));
  if(String(url).endsWith('/input_tokens'))return Response.json({input_tokens:100});
  if(String(url)==='https://api.openai.com/v1/responses')return Response.json({status:'completed',model:'gpt-6-sol',usage:{input_tokens:100,output_tokens:25,input_tokens_details:{cached_tokens:0}},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({content:'수요일이야.',sentences:['수요일이야.']})}]}]});
  throw Error('unexpected_endpoint');
 });vi.stubGlobal('fetch',fetcher);
 const p=createProviders(parseConfig({LOCAL_ONLY:'false',ALLOW_PAID_PROVIDERS:'true',APPRAISAL_PROVIDER:'openai-decisions-v4',APPRAISAL_MODEL:'gpt-6-luna',DIALOGUE_PROVIDER:'openai',DIALOGUE_MODEL:'gpt-6-sol',DIALOGUE_API_KEY:'synthetic',DIALOGUE_BUDGET_PATH:path,DIALOGUE_BUDGET_USD:'1',OPENAI_MAX_DECISION_CALLS:'1',OPENAI_MAX_DIALOGUE_CALLS:'1',OPENAI_BUDGET_AUTHORIZATION:'offline count reuse regression'}),{});
 const session=randomUUID(),store=new Store(db,undefined,undefined,p.evidenceVerifier);await store.startSession(session,randomUUID());await observed(store,session);
 const clientId=randomUUID(),owner=await store.grantOwner(session,randomUUID(),clientId),send=vi.fn(),failure=vi.fn();
 const co=new Coordinator(store,p.dialogue,{owner:()=>({clientId,outputEpoch:owner.outputEpoch}),changed:async()=>{},sendOwner:send,inputStatus:()=>{},failure},p.appraiser);
 try{
  await store.acceptChat(session,randomUUID(),{identityId:IDENTITY_IDS[0],text:'모임은 수요일이야. 모임 요일이 언제야?'});await co.drain();
  await vi.waitFor(()=>expect(send).toHaveBeenCalledWith('response.sealed',expect.anything()));expect(failure).not.toHaveBeenCalled();
  const counts=requests.filter(r=>r.url.endsWith('/input_tokens')),generated=requests.filter(r=>r.url.endsWith('/responses'));expect(generated).toHaveLength(1);
  const {model,input,reasoning,text}=generated[0]!.body;
  expect(counts.filter(r=>r.body.text).map(r=>r.body)).toEqual([{model,input,reasoning,text}]);
  // observed() supplies a prior greeting: history still needs its separate 768-token check.
  expect(counts.filter(r=>!r.body.text)).toHaveLength(1);expect(counts[0]!.body.input).toContain('안녕');
  expect(send).toHaveBeenCalledWith('speech.segment',expect.objectContaining({text:'수요일이야.'}));
  const segments=(await db.pool.query('SELECT * FROM speech_segments ORDER BY segment_index')).rows;expect(segments).toHaveLength(1);
  const start=send.mock.calls.find(([type])=>type==='response.start')![1];
  for(const s of segments)for(const report of ['caption.shown','caption.finished'] as const)await store.report(session,randomUUID(),report,{responseId:s.response_id,segmentId:s.id,generationEpoch:String(start.generationEpoch),outputEpoch:String(owner.outputEpoch)},clientId);
  // The fixture greeting fails this verifier, so it gets an ordinary reply that the helper fails.
  expect((await db.pool.query('SELECT status FROM response_runs')).rows.map(r=>r.status).sort()).toEqual(['completed','failed']);expect(await store.busy()).toBe(false);
  expect(JSON.parse(readFileSync(path,'utf8')).entries.map((e:any)=>e.kind)).toEqual(['decision','count','count','dialogue']);
 }finally{await co.stop();rmSync(dir,{recursive:true,force:true});}
});
it.each(['decision','dialogue'] as const)('real Store preserves role boundaries when %s quota is exhausted',async exhausted=>{
 const dir=mkdtempSync(join(tmpdir(),'role-boundary-')),path=join(dir,'ledger.json');
 const prior={id:randomUUID(),kind:exhausted,status:'completed',usd:.001,...(exhausted==='decision'?{model:'gpt-6-luna',inputUsdPerMillion:.1}:{})};
 writeFileSync(path,JSON.stringify({version:1,model:'gpt-6-sol',limitUsd:1,entries:[prior]}));
 const fetcher=vi.fn(async(url:string|URL|Request)=>{if(!String(url).endsWith('/decisions'))throw Error('generation_or_count_forbidden');return Response.json(interactionFixture({listen_request:1,direct_attack:1},[0,0,1,0]));});vi.stubGlobal('fetch',fetcher);
 const p=createProviders(parseConfig({LOCAL_ONLY:'false',ALLOW_PAID_PROVIDERS:'true',APPRAISAL_PROVIDER:'openai-decisions-v3',APPRAISAL_MODEL:'gpt-6-luna',DIALOGUE_PROVIDER:'openai',DIALOGUE_MODEL:'gpt-6-sol',DIALOGUE_API_KEY:'synthetic',DIALOGUE_BUDGET_PATH:path,DIALOGUE_BUDGET_USD:'1',OPENAI_MAX_DECISION_CALLS:'1',OPENAI_MAX_DIALOGUE_CALLS:'1',OPENAI_BUDGET_AUTHORIZATION:'offline regression synthetic ledger'}),{});
 const session=randomUUID(),initial=new Store(db);await initial.startSession(session,randomUUID());await observed(initial,session);
 const store=new Store(db,undefined,undefined,p.evidenceVerifier),send=vi.fn(),failure=vi.fn();
 const co=new Coordinator(store,p.dialogue,{owner:()=>null,changed:async()=>{},sendOwner:send,inputStatus:()=>{},failure},p.appraiser);
 try{
  const input=await store.acceptChat(session,randomUUID(),{identityId:IDENTITY_IDS[0],text:'너 정말 쓸모없어. 지금은 답하지 말고 들어줘.'});await co.drain();
  const a=(await db.pool.query('SELECT failure_code,provider,prompt_version,context_refs FROM appraisals WHERE event_id=$1',[input.eventId])).rows[0],state=(await store.state()).body;
  await vi.waitFor(async()=>expect(await store.busy()).toBe(false));expect(send).not.toHaveBeenCalled();
  expect((await db.pool.query('SELECT attention_status FROM events WHERE id=$1',[input.eventId])).rows[0].attention_status).toBe('observed');
  const after=JSON.parse(readFileSync(path,'utf8'));expect(after.entries[0]).toEqual(prior);
  // An exhausted decision quota still gets an ordinary reply, without social affect or silence;
  // only the dialogue role may spend for it.
  if(exhausted==='decision'){expect(fetcher.mock.calls.some(c=>String(c[0]).endsWith('/decisions'))).toBe(false);expect(a.failure_code).toBe('decision_attempt_limit');expect(state.affect.frustration.value).toBe(0);expect(state.turn.recentSilences).toEqual([]);expect(after.entries.filter((e:{kind:string})=>e.kind==='decision')).toEqual([prior]);
   expect((await db.pool.query("SELECT r.plan->>'purpose' AS purpose FROM response_runs r JOIN events p ON p.id=r.trigger_event_id WHERE p.parent_event_id=$1",[input.eventId])).rows.map(r=>r.purpose)).toEqual(['other']);}
  else{expect(fetcher).toHaveBeenCalledOnce();expect(a.failure_code).toBeNull();expect(a.context_refs.length).toBeGreaterThan(1);expect(state.affect.frustration.value).toBeGreaterThan(0);expect(state.turn.recentSilences[0]?.eventId).toBe(input.eventId);expect(after.entries.at(-1)).toMatchObject({kind:'decision',status:'completed'});expect(failure).not.toHaveBeenCalled();}
 }finally{await co.stop();}
});
