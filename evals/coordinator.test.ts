import {beforeAll,beforeEach,afterAll,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {testDatabase,reset,observed,fixtureProvider,mockJevAppraiser,IDENTITY_IDS} from './helpers.ts';
import {Store} from '../packages/database/src/store.ts';
import {jevEvidenceVerifier} from '../packages/adapters/src/appraisal-evidence.ts';
import {Coordinator,type Sink} from '../apps/runtime/src/coordinator/index.ts';
import {mapJevResponse} from '../packages/adapters/src/jev.ts';
import {recordedJevResponse} from './jev-fixture.ts';
import {RuntimeError} from '../packages/contracts/src/domain.ts';
import type {AppraisalProvider} from '../packages/adapters/src/appraisal.ts';
import {OllamaProvider} from '../packages/adapters/src/ollama.ts';
import {decay} from '../packages/character-core/src/index.ts';
let db:Awaited<ReturnType<typeof testDatabase>>,store:Store,coordinator:Coordinator;
it('SP03 controlled hidden plan reaches Stage without the internal embarrassed expression',async()=>{
 const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());const clientId=randomUUID(),owner=await store.grantOwner(sessionId,randomUUID(),clientId),send=vi.fn();
 const run=await store.startActivity(sessionId,randomUUID(),'sequence-v1'),state=await store.state(),activity=await store.activity();
 const wrong=await store.submitCandidate(sessionId,run.activityId,'46',{generationEpoch:state.generationEpoch,activityVersion:BigInt(activity.version)});expect(wrong.response).toBeTruthy();
 // Explicit controlled performance only; use the real Store's wrong-answer state and response.
 const response=wrong.response!;await db.pool.query("UPDATE response_runs SET plan=jsonb_set(plan,'{speechStyle}',$1::jsonb) WHERE id=$2",[JSON.stringify({register:'casual',positiveTone:'neutral'}),response.id]);
 const before=(await store.state()).body;
 const co=new Coordinator(store,fixtureProvider,{owner:()=>({clientId,outputEpoch:owner.outputEpoch}),sendOwner:send,inputStatus:()=>{},changed:async()=>{},failure:()=>{}},mockJevAppraiser());
 try{await co.dispatch(response.id);expect(send).toHaveBeenCalledWith('response.start',expect.objectContaining({responseId:response.id,expression:'neutral'}));expect((await store.state()).body).toEqual(before);expect(before.expression.kind).toBe('embarrassed');await finish(sessionId,clientId);}finally{await co.stop();}
});
it.each(['delete','cancel','recover'] as const)('A02-4: %s during fitting prevents generation and Stage dispatch',async action=>{
 let sessionId=randomUUID();await store.startSession(sessionId,randomUUID());const clientId=randomUUID(),owner=await store.grantOwner(sessionId,randomUUID(),clientId);const send=vi.fn(),dialogue=vi.fn(fixtureProvider.dialogue);let entered=false,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 const co=new Coordinator(store,{...fixtureProvider,dialogue,fitConversation:async(plan,context)=>{entered=true;await gate;return fixtureProvider.fitConversation(plan,context);}},{owner:()=>({clientId,outputEpoch:owner.outputEpoch}),sendOwner:send,inputStatus:()=>{},changed:async()=>{},failure:()=>{}},mockJevAppraiser());
 try{const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId:IDENTITY_IDS[0],text:'합성 질문'});await co.drain();await vi.waitFor(()=>expect(entered).toBe(true));const r=(await db.pool.query("SELECT id FROM response_runs WHERE status='planned'")).rows[0];
  if(action==='delete')await store.deleteEvent(accepted.eventId,'1',randomUUID());else if(action==='cancel')await co.cancel(sessionId,randomUUID(),r.id);else await store.recover();
  release();await co.stop();expect(dialogue).toHaveBeenCalledTimes(0);expect(send.mock.calls.filter(([type])=>['response.start','speech.segment','response.sealed'].includes(type))).toEqual([]);expect(await store.busy()).toBe(false);
 }finally{release();await co.stop();}
});
it.each(['input_too_long','tokenizer_unavailable','invalid_conversation'])('A02-3: fit error %s releases busy without an intentional reason and accepts the next input',async code=>{
 const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());const clientId=randomUUID(),owner=await store.grantOwner(sessionId,randomUUID(),clientId),send=vi.fn(),failure=vi.fn();let attempts=0;
 const co=new Coordinator(store,{...fixtureProvider,fitConversation:async(plan,context)=>{if(!attempts++){if(code==='invalid_conversation')return {conversation:{...context.conversation!,identityId:IDENTITY_IDS[1]},inputTokens:50};throw new RuntimeError(code);}return fixtureProvider.fitConversation(plan,context);}},{owner:()=>({clientId,outputEpoch:owner.outputEpoch}),sendOwner:send,inputStatus:()=>{},changed:async()=>{},failure},mockJevAppraiser());
 try{await store.acceptChat(sessionId,randomUUID(),{identityId:IDENTITY_IDS[0],text:'합성 질문'});await co.drain();await vi.waitFor(()=>expect(failure).toHaveBeenCalledWith(code));expect(await store.busy()).toBe(false);expect((await store.state()).body.turn.recentSilences).toEqual([]);expect(send.mock.calls.filter(([type])=>type==='speech.segment')).toEqual([]);
  await store.acceptChat(sessionId,randomUUID(),{identityId:IDENTITY_IDS[0],text:'다음 합성 질문'});await co.drain();await vi.waitFor(()=>expect(send).toHaveBeenCalledWith('speech.segment',expect.anything()));await finish(sessionId,clientId);expect(await store.busy()).toBe(false);
 }finally{await co.stop();}
});
beforeAll(async()=>{db=await testDatabase();});beforeEach(async()=>{await reset(db);store=new Store(db,undefined,undefined,jevEvidenceVerifier);});afterAll(async()=>{await db?.close();});
it('ER08 fixture: zero-stimulus praise reaches captions after cooldown without increasing affect',async()=>{
 let now=Date.now();store=new Store(db,undefined,()=>now,jevEvidenceVerifier);
 const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
 const clientId=randomUUID(),owner=await store.grantOwner(sessionId,randomUUID(),clientId);
 const send=vi.fn(),failure=vi.fn(),dialogue=vi.fn(fixtureProvider.dialogue);
 // Zero strength fixes zero affect independently of the new gradual budget recovery.
 let zeroStrength=false;const baseAppraiser=mockJevAppraiser();
 const co=new Coordinator(store,{...fixtureProvider,dialogue},{owner:()=>({clientId,outputEpoch:owner.outputEpoch}),changed:async()=>{},sendOwner:send,inputStatus:()=>{},failure},{...baseAppraiser,evaluate:async(event,context)=>{const result=await baseAppraiser.evaluate(event,context);return zeroStrength?{...result,appraisal:{...result.appraisal,strength:0}}:result;}});
 const praiseInput=async()=>{await store.acceptChat(sessionId,randomUUID(),{identityId:IDENTITY_IDS[0],text:'합성 칭찬'});await co.drain();};
 const delivered=async(count:number)=>{
  await vi.waitFor(()=>expect(send.mock.calls.filter(([type])=>type==='speech.segment')).toHaveLength(count));
  await finish(sessionId,clientId);expect(await store.busy()).toBe(false);
 };
 try{
  for(let i=0;i<3;i++){if(i)now+=15000;await praiseInput();await delivered(i+1);}
  zeroStrength=true;const before=(await store.state()).body;now+=15000;
  await praiseInput();await delivered(4);
  const state=(await store.state()).body;
  expect(state.affect).toEqual(decay(before,now).affect);expect(state.mood).toEqual(decay(before,now).mood);
  expect(state.turn.acknowledgements[`${IDENTITY_IDS[0]}:praise`]).toBe(now);
  now+=14999;await praiseInput();expect(dialogue).toHaveBeenCalledTimes(4);expect(await store.busy()).toBe(false);
  now+=1;await praiseInput();await delivered(5);
  expect(dialogue).toHaveBeenCalledTimes(5);expect(failure).not.toHaveBeenCalled();
  const evidence=(await db.pool.query("SELECT applied FROM relationship_evidence WHERE kind='praise' ORDER BY order_version")).rows;
  expect(evidence).toHaveLength(6);expect(evidence.slice(3).map(r=>r.applied.stimulus)).toEqual([0,0,0]);expect(evidence.slice(3).map(r=>r.applied.affect.stimulus)).toEqual([0,0,0]);
  const responses=(await db.pool.query('SELECT status,plan FROM response_runs')).rows;
  expect(responses).toHaveLength(5);expect(responses.every(r=>r.status==='completed'&&r.plan.purpose==='praise')).toBe(true);
 }finally{await co.stop();}
});
it('invalid Korean dialogue fails without caption and releases busy state for the next input',async()=>{
 const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());const clientId=randomUUID(),owner=await store.grantOwner(sessionId,randomUUID(),clientId);
 let calls=0;const local=new OllamaProvider('qwen2.5:7b',{count:async()=>10,countText:async()=>10},undefined,async()=>new Response(JSON.stringify({message:{content:JSON.stringify({sentences:[++calls===1?'정답이 맞았네,谢谢！':'합성 응답이야.']})},done:true})+'\n',{headers:{'content-type':'application/x-ndjson'}}));
 const send=vi.fn(),failure=vi.fn();const co=new Coordinator(store,{...fixtureProvider,dialogue:(plan,context)=>local.dialogue(plan,context)},{owner:()=>({clientId,outputEpoch:owner.outputEpoch}),changed:async()=>{},sendOwner:send,inputStatus:()=>{},failure},mockJevAppraiser());
 try{
  await store.acceptChat(sessionId,randomUUID(),{identityId:IDENTITY_IDS[0],text:'합성 질문'});await co.drain();
  await vi.waitFor(async()=>expect((await db.pool.query('SELECT status,cancel_reason FROM response_runs')).rows[0]).toMatchObject({status:'failed',cancel_reason:'invalid_output'}));
  expect(send).not.toHaveBeenCalled();expect(failure).toHaveBeenCalledWith('invalid_output');expect(await store.busy()).toBe(false);
  await store.acceptChat(sessionId,randomUUID(),{identityId:IDENTITY_IDS[0],text:'다음 합성 질문'});await co.drain();
  await vi.waitFor(()=>expect(send).toHaveBeenCalledWith('speech.segment',expect.objectContaining({text:'합성 응답이야.'})));
  await finish(sessionId,clientId);expect(await store.busy()).toBe(false);
 }finally{await co.stop();}
});
async function appraisalSetup(evaluate:AppraisalProvider['evaluate']){
 const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId:IDENTITY_IDS[0],text:'합성 칭찬'});
 const fallback=vi.fn(async()=>{throw new Error('forbidden_ollama_appraisal');}),send=vi.fn(),fail=vi.fn();
 const appraiser:AppraisalProvider={...mockJevAppraiser(),evaluate};
 const legacyProvider={...fixtureProvider,appraise:fallback};const co=new Coordinator(store,legacyProvider,{owner:()=>null,changed:async()=>{},sendOwner:send,inputStatus:()=>{},failure:fail},appraiser);
 return {co,sessionId,accepted,fallback,send,fail};
}
it('JR04 only separate appraiser is used; uncertain praise has no affect or affinity delta',async()=>{
 const t=await appraisalSetup(async event=>mapJevResponse(recordedJevResponse('praise','character',3,0,0.79),event.id));
 try{await t.co.drain();expect(t.fallback).not.toHaveBeenCalled();expect(t.send).not.toHaveBeenCalled();const state=await store.state();expect(state.body.affect.joy.value).toBe(0);expect(state.body.affect.frustration.value).toBe(0);expect((await db.pool.query('SELECT affinity,verified_problem_count FROM relationships')).rows[0]).toMatchObject({affinity:0.5,verified_problem_count:0});expect((await db.pool.query("SELECT count(*) FROM relationship_evidence WHERE kind<>'first_observed'")).rows[0].count).toBe('0');}finally{await t.co.stop();}
});
it.each(['jev_auth_failed','jev_rate_limited','jev_unavailable','jev_timeout'])('JR06 %s records neutral without fallback',async code=>{
 const t=await appraisalSetup(async()=>{throw new RuntimeError(code,503);});try{await t.co.drain();expect(t.fallback).not.toHaveBeenCalled();expect(t.send).not.toHaveBeenCalled();expect((await db.pool.query('SELECT failure_code,result,provider_result FROM appraisals')).rows[0]).toMatchObject({failure_code:code,result:{uncertain:true,strength:0,hostility:0},provider_result:null});expect((await store.state()).body.affect.joy.value).toBe(0);}finally{await t.co.stop();}
});
it.each(['session_end','delete','cancel'])('JR06 late appraisal after %s cannot commit or display',async reason=>{
 let resolve!:()=>void,entered!:()=>void;const started=new Promise<void>(r=>{entered=r;}),pending=new Promise<void>(r=>{resolve=r;});
 const t=await appraisalSetup(async event=>{entered();await pending;return mapJevResponse(recordedJevResponse('praise','character',3),event.id);});
 const draining=t.co.drain();await started;
 try{if(reason==='session_end')await store.stopSession(t.sessionId,randomUUID());else if(reason==='cancel')await store.cancel(t.sessionId,randomUUID(),'fixture_cancel');else{const revision=(await db.pool.query('SELECT revision FROM events WHERE id=$1',[t.accepted.eventId])).rows[0].revision;await store.deleteEvent(t.accepted.eventId,revision,randomUUID());}
 resolve();await draining;expect(t.fallback).not.toHaveBeenCalled();expect(t.send).not.toHaveBeenCalled();expect((await db.pool.query('SELECT count(*) FROM appraisals')).rows[0].count).toBe('0');expect((await store.state()).body.affect.joy.value).toBe(0);
 }finally{resolve();await draining;await t.co.stop();}
});
async function setup(answers:(string|null)[]){const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());await observed(store,sessionId);const clientId=randomUUID(),owner=await store.grantOwner(sessionId,randomUUID(),clientId);let calls=0;const sink:Sink={owner:()=>({clientId,outputEpoch:owner.outputEpoch}),changed:async()=>{},sendOwner:()=>{},inputStatus:()=>{},failure:()=>{}};coordinator=new Coordinator(store,fixtureProvider,sink,mockJevAppraiser(),{solve:async id=>{const answer=answers[calls++]??null;return {activity_id:id,candidate_answer:answer,needs_hint:answer===null};}});const run=await store.startActivity(sessionId,randomUUID(),'sequence-v1');return {sessionId,clientId,run,calls:()=>calls};}
async function finish(sessionId:string,clientId:string){for(let i=0;i<200;i++){const rows=(await db.pool.query("SELECT ss.*,r.generation_epoch FROM speech_segments ss JOIN response_runs r ON r.id=ss.response_id WHERE r.status='delivering' ORDER BY ss.segment_index")).rows;if(rows.length){for(const s of rows){const body={responseId:s.response_id,segmentId:s.id,generationEpoch:s.generation_epoch,outputEpoch:s.output_epoch};await store.report(sessionId,randomUUID(),'caption.shown',body,clientId);await store.report(sessionId,randomUUID(),'caption.finished',body,clientId);}return;}await new Promise(r=>setTimeout(r,5));}throw new Error('no committed speech');}
it('fixture: hint during existing speech resumes solving only after caption completion',async()=>{const t=await setup([null,'47']);try{await coordinator.solve(t.sessionId,t.run.activityId);await store.hint(t.sessionId,randomUUID(),t.run.activityId,'sequence-h1',IDENTITY_IDS[0]);await coordinator.solve(t.sessionId,t.run.activityId);expect(t.calls()).toBe(1);await finish(t.sessionId,t.clientId);await coordinator.tick();expect(t.calls()).toBe(2);expect((await db.pool.query('SELECT status FROM activity_runs')).rows[0].status).toBe('solved');}finally{await coordinator.stop();}});
it('fixture: incorrect result waits for speech, hint resumes next attempt, explicit retry unpauses no-candidate',async()=>{const t=await setup(['46',null,'47']);try{await coordinator.solve(t.sessionId,t.run.activityId);expect(t.calls()).toBe(1);await coordinator.tick();expect(t.calls()).toBe(1);await finish(t.sessionId,t.clientId);await coordinator.tick();expect((await store.activity()).status).toBe('awaiting_hint');await store.hint(t.sessionId,randomUUID(),t.run.activityId,'sequence-h1',IDENTITY_IDS[0]);await coordinator.solve(t.sessionId,t.run.activityId);expect(t.calls()).toBe(1);await finish(t.sessionId,t.clientId);await coordinator.tick();expect(t.calls()).toBe(2);await coordinator.tick();expect(t.calls()).toBe(2);await store.activityCommand(t.sessionId,randomUUID(),t.run.activityId,'retry');await coordinator.tick();expect(t.calls()).toBe(3);expect((await db.pool.query('SELECT status,auto_attempts_used,auto_attempts_granted FROM activity_runs')).rows[0]).toMatchObject({status:'solved',auto_attempts_used:2,auto_attempts_granted:4});}finally{await coordinator.stop();}});
