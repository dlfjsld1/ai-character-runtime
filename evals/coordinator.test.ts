import {beforeAll,beforeEach,afterAll,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {testDatabase,reset,observed,fixtureProvider,mockJevAppraiser,IDENTITY_IDS} from './helpers.ts';
import {Store} from '../packages/database/src/store.ts';
import {Coordinator,type Sink} from '../apps/runtime/src/coordinator/index.ts';
import {mapJevResponse} from '../packages/adapters/src/jev.ts';
import {recordedJevResponse} from './jev-fixture.ts';
import {RuntimeError} from '../packages/contracts/src/domain.ts';
import type {AppraisalProvider} from '../packages/adapters/src/appraisal.ts';
let db:Awaited<ReturnType<typeof testDatabase>>,store:Store,coordinator:Coordinator;
beforeAll(async()=>{db=await testDatabase();});beforeEach(async()=>{await reset(db);store=new Store(db);});afterAll(async()=>{await db?.close();});
async function appraisalSetup(evaluate:AppraisalProvider['evaluate']){
 const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId:IDENTITY_IDS[0],text:'합성 칭찬'});
 const fallback=vi.fn(async()=>{throw new Error('forbidden_ollama_appraisal');}),send=vi.fn(),fail=vi.fn();
 const appraiser:AppraisalProvider={...mockJevAppraiser(),evaluate};
 const co=new Coordinator(store,{...fixtureProvider,appraise:fallback},{owner:()=>null,changed:async()=>{},sendOwner:send,inputStatus:()=>{},failure:fail},appraiser);
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
async function setup(answers:(string|null)[]){const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());await observed(store,sessionId);const clientId=randomUUID(),owner=await store.grantOwner(sessionId,randomUUID(),clientId);let calls=0;const sink:Sink={owner:()=>({clientId,outputEpoch:owner.outputEpoch}),changed:async()=>{},sendOwner:()=>{},inputStatus:()=>{},failure:()=>{}};coordinator=new Coordinator(store,{...fixtureProvider,solve:async id=>{const answer=answers[calls++]??null;return {activity_id:id,candidate_answer:answer,needs_hint:answer===null};}},sink,mockJevAppraiser());const run=await store.startActivity(sessionId,randomUUID(),'sequence-v1');return {sessionId,clientId,run,calls:()=>calls};}
async function finish(sessionId:string,clientId:string){for(let i=0;i<200;i++){const rows=(await db.pool.query("SELECT ss.*,r.generation_epoch FROM speech_segments ss JOIN response_runs r ON r.id=ss.response_id WHERE r.status='delivering' ORDER BY ss.segment_index")).rows;if(rows.length){for(const s of rows){const body={responseId:s.response_id,segmentId:s.id,generationEpoch:s.generation_epoch,outputEpoch:s.output_epoch};await store.report(sessionId,randomUUID(),'caption.shown',body,clientId);await store.report(sessionId,randomUUID(),'caption.finished',body,clientId);}return;}await new Promise(r=>setTimeout(r,5));}throw new Error('no committed speech');}
it('fixture: hint during existing speech resumes solving only after caption completion',async()=>{const t=await setup([null,'47']);try{await coordinator.solve(t.sessionId,t.run.activityId);await store.hint(t.sessionId,randomUUID(),t.run.activityId,'sequence-h1',IDENTITY_IDS[0]);await coordinator.solve(t.sessionId,t.run.activityId);expect(t.calls()).toBe(1);await finish(t.sessionId,t.clientId);await coordinator.tick();expect(t.calls()).toBe(2);expect((await db.pool.query('SELECT status FROM activity_runs')).rows[0].status).toBe('solved');}finally{await coordinator.stop();}});
it('fixture: incorrect result waits for speech, hint resumes next attempt, explicit retry unpauses no-candidate',async()=>{const t=await setup(['46',null,'47']);try{await coordinator.solve(t.sessionId,t.run.activityId);expect(t.calls()).toBe(1);await coordinator.tick();expect(t.calls()).toBe(1);await finish(t.sessionId,t.clientId);await coordinator.tick();expect((await store.activity()).status).toBe('awaiting_hint');await store.hint(t.sessionId,randomUUID(),t.run.activityId,'sequence-h1',IDENTITY_IDS[0]);await coordinator.solve(t.sessionId,t.run.activityId);expect(t.calls()).toBe(1);await finish(t.sessionId,t.clientId);await coordinator.tick();expect(t.calls()).toBe(2);await coordinator.tick();expect(t.calls()).toBe(2);await store.activityCommand(t.sessionId,randomUUID(),t.run.activityId,'retry');await coordinator.tick();expect(t.calls()).toBe(3);expect((await db.pool.query('SELECT status,auto_attempts_used,auto_attempts_granted FROM activity_runs')).rows[0]).toMatchObject({status:'solved',auto_attempts_used:2,auto_attempts_granted:4});}finally{await coordinator.stop();}});
