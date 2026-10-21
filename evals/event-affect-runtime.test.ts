import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {testDatabase,reset,IDENTITY_IDS,CHARACTER_ID,fixtureProvider,mockJevAppraiser} from './helpers.ts';
import {Coordinator} from '../apps/runtime/src/coordinator/index.ts';
import type {EventInterpreter} from '../packages/contracts/src/ai-ports.ts';
import {Store,type EventAffectAttempt} from '../packages/database/src/store.ts';
import {PERSONA_V1} from '../packages/database/src/seed.ts';
import {neutralAppraisal,type Appraisal} from '../packages/contracts/src/domain.ts';
import {validateAffectRequest,type EventAppraisal,type EventInterpretationRequest} from '../packages/contracts/src/affect-appraisal.ts';

let db:Awaited<ReturnType<typeof testDatabase>>,store:Store,now:number;
beforeAll(async()=>{db=await testDatabase();});
beforeEach(async()=>{now=Date.now();await reset(db,now);store=new Store(db,CHARACTER_ID,()=>now);});
afterAll(async()=>{await db?.close();});
const user=IDENTITY_IDS[0]!;
const question:Appraisal={...neutralAppraisal,target:'character',act:'question',uncertain:false,evidence_refs:[]};
async function turn(sessionId:string,text:string){
  now+=1000;const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId:user,text});
  const selected=await store.select(accepted.eventId);if(!selected)throw Error('no_selected');return selected;
}
// A synthetic, contract-valid interpreter answer quoting the live persona value.
function meaning(request:EventInterpretationRequest,persona:number,patch:Partial<EventAppraisal>):EventAffectAttempt{
  const value=request.sources.filter(s=>s.kind==='persona')[persona]!,input=request.sources.find(s=>s.id===request.eventId)!;
  return {request,promptVersion:'synthetic',latencyMs:1,result:{status:'interpreted',promptVersion:'synthetic',interpretation:{status:'appraised',outcome:null,appraisals:[{episodeId:null,
    concern:{source:{sourceId:value.id,revision:value.revision,quote:value.text}},evidence:[{sourceId:input.id,revision:input.revision,quote:input.text}],
    actorId:request.speakerId,targetId:request.scope.characterId,stance:'reports',relevance:1,importance:.9,congruence:.8,certainty:.9,agency:'other',controllability:null,expectedness:null,expectation:null,...patch}]}}};
}
async function commit(selected:NonNullable<Awaited<ReturnType<Store['select']>>>,affect:(r:EventInterpretationRequest)=>EventAffectAttempt|undefined,appraisal:Appraisal=question){
  const request=await store.affectRequest(selected);expect(request).not.toBeNull();
  return store.commitAppraisal(selected,{...appraisal,evidence_refs:[selected.event.id]},{provider:'synthetic-fixture',model:'recorded'},[],affect(request!));
}
const effects=async(eventId:string)=>(await db.pool.query("SELECT t.effects FROM transitions t JOIN events p ON p.id=t.source_event_id WHERE p.parent_event_id=$1 AND p.kind='appraisal.applied'",[eventId])).rows[0]?.effects;
const records=async()=>(await db.pool.query('SELECT event_id,status,stimuli FROM affective_appraisals ORDER BY created_at')).rows;

it('O2-01 builds a valid request from the selected input, live persona v1 and delivered context only',async()=>{
  const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
  const selected=await turn(sessionId,'새 퍼즐 규칙을 알려줄게.');const request=(await store.affectRequest(selected))!;
  expect(()=>validateAffectRequest(request)).not.toThrow();
  expect(request.sources.filter(s=>s.kind==='persona').map(s=>s.text)).toEqual([...PERSONA_V1]);
  expect(request.sources.filter(s=>s.kind==='persona').every(s=>s.revision==='1')).toBe(true);
  expect(request).toMatchObject({scope:{ownerId:user,characterId:CHARACTER_ID},eventId:selected.event.id,experience:{status:'empty'},currentAffect:{positive:0,negative:0,activation:0},stateSourceRefs:[]});
  await db.pool.query('DELETE FROM character_persona_values');expect(await store.affectRequest(selected)).toBeNull();
});

it('O2-02 positive meaning is stored once and raises joy in the same transition',async()=>{
  const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
  const selected=await turn(sessionId,'처음 보는 상자 퍼즐을 가져왔어.');const before=(await store.state()).body.affect.joy.value;
  const result=await commit(selected,r=>meaning(r,0,{congruence:.8}));
  expect(result.status).toBe('committed');expect(result.response).not.toBeNull();
  const state=(await store.state()).body;expect(state.affect.joy.value).toBeGreaterThan(before);
  expect(state.affect.joy.causes).toContainEqual({eventId:selected.event.id,targetId:null});
  expect((await effects(selected.event.id)).eventAffect).toMatchObject({status:'applied',interpretation:'appraised'});
  expect(await records()).toEqual([expect.objectContaining({event_id:selected.event.id,status:'active'})]);
  const sources=(await db.pool.query('SELECT event_id FROM response_sources WHERE response_id=$1',[result.response!.id])).rows.map(r=>r.event_id);
  expect(sources).toContain(selected.event.id);
});

it('O2-03 a justified correction of the character never becomes distance toward the user',async()=>{
  const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
  // An unconfirmed correction of the character's own claim is embarrassment too.
  for(const [agency,own,channel] of [['self',true,'embarrassment'],['other',false,'frustration'],['unknown',false,'frustration'],['unknown',true,'embarrassment']] as const){
    const selected=await turn(sessionId,`검증된 자료와 다르니 네 설명을 고쳐 줘 (${agency}).`);
    const result=await commit(selected,r=>meaning(r,2,{congruence:-.9,stance:'corrects',agency,actorId:own?r.scope.characterId:r.speakerId,targetId:own?r.speakerId:r.scope.characterId}));
    const state=(await store.state()).body;
    expect(state.affect[channel].causes).toContainEqual({eventId:selected.event.id,targetId:null});
    expect(state.affect.frustration.causes.some(c=>c.targetId===user)).toBe(false);
    expect(result.response!.plan.speechStyle).toMatchObject({register:'casual'});expect(result.response!.plan.speechStyle?.discomfortTone).toBeUndefined();
    await store.failResponse(result.response!.id,'fixture_no_stage');
  }
  expect((await store.state()).body.affect.embarrassment.value).toBeGreaterThan(0);
});

it('O2-04 interpreter failure or a stale snapshot leaves affect untouched and the turn still answers',async()=>{
  const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
  const failed=await turn(sessionId,'오늘 날씨 어때?');const before=(await store.state()).body.affect;
  const result=await commit(failed,()=>({request:null,promptVersion:'synthetic',latencyMs:0,result:{status:'unavailable',reason:'transport_failed',promptVersion:'synthetic'}}));
  expect(result.response).not.toBeNull();expect((await effects(failed.event.id)).eventAffect).toMatchObject({status:'unavailable',reason:'transport_failed'});
  expect((await store.state()).body.affect.joy.value).toBeLessThanOrEqual(before.joy.value);expect(await records()).toEqual([]);
  await store.failResponse(result.response!.id,'fixture_no_stage');
  const stale=await turn(sessionId,'새로운 이야기 하나 해 줄게.');
  const staleResult=await commit(stale,r=>{const a=meaning(r,0,{});a.request={...r,stateSourceRefs:[{sourceId:randomUUID(),revision:'1'}],currentAffect:{positive:.1,negative:0,activation:.1}};return a;});
  expect(staleResult.response).not.toBeNull();expect((await effects(stale.event.id)).eventAffect).toMatchObject({status:'stale'});expect(await records()).toEqual([]);
});

it('O2-05 a verified direct insult keeps its target; event affect does not double count that channel',async()=>{
  const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
  const selected=await turn(sessionId,'너 진짜 쓸모없다.');
  const insult:Appraisal={...neutralAppraisal,target:'character',act:'criticism',strength:3,hostility:2,uncertain:false,evidence_refs:[]};
  await commit(selected,r=>meaning(r,1,{congruence:-.9,agency:'other'}),insult);
  const state=(await store.state()).body,row=(await records())[0]!;
  expect(state.affect.frustration.causes).toContainEqual({eventId:selected.event.id,targetId:user});
  expect(state.affect.frustration.causes).not.toContainEqual({eventId:selected.event.id,targetId:null});
  expect(row.stimuli.frustration).toBe(0);
});

it('O2-06 deleting an input removes its record, dependent later records and untargeted causes',async()=>{
  const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
  const first=await turn(sessionId,'새 장난감 얘기 들어 볼래?');
  const r1=await commit(first,r=>meaning(r,0,{congruence:.8}));await store.failResponse(r1.response!.id,'fixture_no_stage');
  const second=await turn(sessionId,'그 장난감 정말 신기하더라.');
  const request=(await store.affectRequest(second))!;expect(request.stateSourceRefs).toEqual([{sourceId:first.event.id,revision:'1'}]);
  const r2=await store.commitAppraisal(second,{...question,evidence_refs:[second.event.id]},{provider:'synthetic-fixture',model:'recorded'},[],meaning(request,0,{congruence:.7}));
  await store.failResponse(r2.response!.id,'fixture_no_stage');
  expect((await records()).map(r=>r.status)).toEqual(['active','active']);
  const revision=(await db.pool.query('SELECT revision FROM events WHERE id=$1',[first.event.id])).rows[0].revision;
  await store.deleteEvent(first.event.id,revision,randomUUID());
  expect((await records()).map(r=>r.status)).toEqual(['deleted','deleted']);
  const state=(await store.state()).body;
  for(const id of [first.event.id,second.event.id])expect(state.affect.joy.causes.some(c=>c.eventId===id)).toBe(false);
  expect((await db.pool.query("SELECT count(*)::int AS n FROM affective_appraisals WHERE record IS NOT NULL OR stimuli IS NOT NULL")).rows[0].n).toBe(0);
});

it('O2-07 Coordinator runs the interpreter beside appraisal and commits its result; no interpreter means no record',async()=>{
  const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
  const seen:EventInterpreter['interpret'][]=[];
  const interpreter:EventInterpreter={promptVersion:'synthetic-coordinator',interpret:async request=>{seen.push(interpreter.interpret);const a=meaning(request,0,{congruence:.8});return a.result;}};
  const sink={owner:()=>null,sendOwner:()=>{},inputStatus:()=>{},changed:async()=>{},failure:()=>{}};
  const co=new Coordinator(store,fixtureProvider,sink,mockJevAppraiser(),undefined,undefined,interpreter);
  try{const accepted=await co.chat(sessionId,randomUUID(),{identityId:user,text:'새로 나온 보드게임 알아?'});
    for(let i=0;i<200&&!(await records()).length;i++)await new Promise(r=>setTimeout(r,20));
    expect(seen).toHaveLength(1);expect(await records()).toEqual([expect.objectContaining({event_id:accepted.eventId,status:'active'})]);
    expect((await effects(accepted.eventId)).eventAffect).toMatchObject({status:'applied',promptVersion:'synthetic-coordinator'});
  }finally{await co.stop();}
});
