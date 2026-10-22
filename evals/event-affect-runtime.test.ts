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
  // The character's actor label is its stored name, not a fixed word.
  await db.pool.query('UPDATE characters SET display_name=$2 WHERE id=$1',[CHARACTER_ID,'미르']);
  expect((await store.affectRequest(selected))!.actors).toContainEqual({id:CHARACTER_ID,label:'미르'});
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
it('dialogue context carries the persona of the response config version, and none when that version has none',async()=>{
  const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
  const first=await commit(await turn(sessionId,'안녕.'),()=>undefined);
  expect((await store.responseContext(first.response!.id)).context.persona).toEqual(PERSONA_V1.map(text=>({kind:'persona',text})));
  await store.failResponse(first.response!.id,'fixture_no_stage');
  await db.pool.query('DELETE FROM character_persona_values WHERE character_id=$1',[CHARACTER_ID]);
  const selected=await turn(sessionId,'뭐 해?'),second=await store.commitAppraisal(selected,{...question,evidence_refs:[selected.event.id]},{provider:'synthetic-fixture',model:'recorded'},[]);
  expect((await store.responseContext(second.response!.id)).context).not.toHaveProperty('persona');
});

// O2 slice 2: a suggestion the character made becomes an episode only after full delivery.
async function suggest(sessionId:string,text:string,sentences:string[],annotation:{kind:string;title:string;sentenceIndex:number;quote:string}|null){
  const selected=await turn(sessionId,text),result=await store.commitAppraisal(selected,{...question,evidence_refs:[selected.event.id]},{provider:'synthetic-fixture',model:'recorded'},[]);
  const clientId=randomUUID(),owner=await store.grantOwner(sessionId,randomUUID(),clientId);
  const generated=(await store.generated(result.response!.id,sentences,{clientId,outputEpoch:owner.outputEpoch},undefined,{sentences,recommendations:annotation?[annotation]:[],annotationStatus:annotation?'candidate':'none'}))!;
  const ack=async(index:number,type:'caption.shown'|'caption.finished'='caption.finished',requestId=randomUUID())=>{const s=generated.segments[index]!,payload={responseId:result.response!.id,segmentId:s.id,generationEpoch:generated.response.generation_epoch,outputEpoch:String(owner.outputEpoch)};if(type==='caption.finished')await store.report(sessionId,randomUUID(),'caption.shown',payload,clientId);return store.report(sessionId,requestId,type,payload,clientId);};
  return {selected,response:result.response!,generated,ack};
}
const episodes=async()=>(await db.pool.query('SELECT id,status,episode FROM action_episodes ORDER BY created_at')).rows;
const pasta={kind:'음식',title:'토마토 파스타',sentenceIndex:1,quote:'토마토 파스타 어때'};
it('S2-01 a suggestion is a candidate until every segment finishes, then one active episode the interpreter reads',async()=>{
  const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
  const s=await suggest(sessionId,'저녁 뭐 먹을까?',['저녁이라면 따뜻한 게 좋겠다.','토마토 파스타 어때?'],pasta);
  expect((await episodes()).map(e=>e.status)).toEqual(['candidate']);
  await s.ack(0);expect((await episodes())[0].status).toBe('candidate');
  const requestId=randomUUID();await s.ack(1,'caption.finished',requestId);
  const [active]=await episodes();expect(active).toMatchObject({status:'active',episode:{kind:'음식',title:'토마토 파스타',responseId:s.response.id,text:'토마토 파스타 어때?'}});
  await s.ack(1,'caption.finished',requestId);expect(await episodes()).toEqual([active]);
  now+=60000;const request=(await store.affectRequest(await turn(sessionId,'파스타 먹어 봤는데 별로였어.')))!;
  expect(request.experience).toEqual({status:'found',revision:'1',truncated:false});
  expect(request.sources.filter(x=>x.kind==='episode')).toEqual([expect.objectContaining({id:active.id,kind:'episode',text:'토마토 파스타 어때?',delivered:true,speakerId:CHARACTER_ID})]);
});
it('S2-02 no suggestion, an unverifiable quote, a failed or a partly delivered reply never becomes an episode',async()=>{
  const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
  const none=await suggest(sessionId,'안녕.',['안녕, 반가워.'],null);await none.ack(0);
  const bad=await suggest(sessionId,'뭐 볼까?',['영화 하나 볼래?','별의 강 어때?'],{kind:'영화',title:'없는 제목',sentenceIndex:1,quote:'없는 제목 어때'});await bad.ack(0);await bad.ack(1);
  const failed=await suggest(sessionId,'뭐 읽을까?',['요즘은 짧은 책이 좋겠다.','작은 아씨들 어때?'],{kind:'책',title:'작은 아씨들',sentenceIndex:1,quote:'작은 아씨들 어때'});await failed.ack(0);await store.failResponse(failed.response.id,'fixture');
  expect((await episodes()).map(e=>e.status)).toEqual(['rejected','candidate']);
  const request=(await store.affectRequest(await turn(sessionId,'그 책 별로였어.')))!;expect(request.experience.status).toBe('empty');expect(request.sources.some(x=>x.kind==='episode')).toBe(false);
});
it('S2-03 deleting the asking input deletes the episode, the affect record that read it and its untargeted causes',async()=>{
  const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
  const s=await suggest(sessionId,'저녁 뭐 먹을까?',['저녁이라면 따뜻한 게 좋겠다.','토마토 파스타 어때?'],pasta);await s.ack(0);await s.ack(1);
  now+=60000;const later=await turn(sessionId,'파스타 먹어 봤는데 별로였어.');
  // The record depends on every source it read, including the episode, without quoting it.
  const result=await commit(later,r=>{expect(r.sources.some(x=>x.kind==='episode')).toBe(true);return meaning(r,2,{congruence:-.7,agency:'self',actorId:r.scope.characterId,targetId:user});});
  expect((await effects(later.event.id)).eventAffect).toMatchObject({status:'applied'});expect((await store.state()).body.affect.embarrassment.causes).toContainEqual({eventId:later.event.id,targetId:null});
  await store.failResponse(result.response!.id,'fixture_no_stage');
  await store.deleteEvent(s.selected.event.id,'1',randomUUID());
  expect((await episodes()).map(e=>e.status)).toEqual(['deleted']);
  expect((await records()).find(r=>r.event_id===later.event.id)?.status).toBe('deleted');
  expect((await store.state()).body.affect.embarrassment.causes.some(c=>c.eventId===later.event.id)).toBe(false);
});
it('S2-04 an episode deleted after the interpreter read it makes the result stale',async()=>{
  const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
  const s=await suggest(sessionId,'저녁 뭐 먹을까?',['저녁이라면 따뜻한 게 좋겠다.','토마토 파스타 어때?'],pasta);await s.ack(0);await s.ack(1);
  now+=60000;const later=await turn(sessionId,'파스타 별로였어.'),request=(await store.affectRequest(later))!;
  await db.pool.query("UPDATE action_episodes SET status='deleted',episode=NULL,closed_at=now()");
  await store.commitAppraisal(later,{...question,evidence_refs:[later.event.id]},{provider:'synthetic-fixture',model:'recorded'},[],meaning(request,0,{congruence:-.5}));
  expect((await effects(later.event.id)).eventAffect).toMatchObject({status:'stale'});
});
it('S2-05 more than five recent episodes is a truncated read',async()=>{
  const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
  for(let i=0;i<6;i++){const s=await suggest(sessionId,`추천 ${i}`,['하나 골라 볼게.',`메뉴${i} 어때?`],{kind:'음식',title:`메뉴${i}`,sentenceIndex:1,quote:`메뉴${i} 어때`});await s.ack(0);await s.ack(1);}
  const request=(await store.affectRequest(await turn(sessionId,'그거 별로였어.')))!;
  expect(request.experience).toMatchObject({status:'found',truncated:true});expect(request.sources.filter(x=>x.kind==='episode').map(x=>x.text)).toEqual(['메뉴1 어때?','메뉴2 어때?','메뉴3 어때?','메뉴4 어때?','메뉴5 어때?']);
});
it('S2-06 Coordinator generates through generateTurn and hands its suggestion to the Store as a candidate',async()=>{
  const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
  const clientId=randomUUID(),owner=await store.grantOwner(sessionId,randomUUID(),clientId);
  const sentences=['저녁이라면 따뜻한 게 좋겠다.','토마토 파스타 어때?'];
  const provider={...fixtureProvider,generateTurn:async()=>({sentences,recommendations:[pasta],annotationStatus:'candidate' as const})};
  const sink={owner:()=>({clientId,outputEpoch:owner.outputEpoch}),sendOwner:()=>{},inputStatus:()=>{},changed:async()=>{},failure:()=>{}};
  const co=new Coordinator(store,provider,sink,mockJevAppraiser());
  try{await co.chat(sessionId,randomUUID(),{identityId:user,text:'저녁 뭐 먹을까?'});
    for(let i=0;i<200&&!(await episodes()).length;i++)await new Promise(r=>setTimeout(r,20));
    expect((await episodes()).map(e=>e.status)).toEqual(['candidate']);
    expect((await db.pool.query('SELECT text FROM speech_segments ORDER BY segment_index')).rows.map(r=>r.text)).toEqual(sentences);
  }finally{await co.stop();}
});
// A synthetic answer that links the current input to one read episode.
function linked(request:EventInterpretationRequest,title:string,result:'favorable'|'unfavorable',patch:Partial<EventAppraisal>,extra:{sourceId:string;revision:string;quote:string}[]=[]):EventAffectAttempt{
  const episode=request.sources.find(s=>s.kind==='episode'&&s.text.includes(title))!,input=request.sources.find(s=>s.id===request.eventId)!;
  const evidence=[{sourceId:input.id,revision:input.revision,quote:input.text},{sourceId:episode.id,revision:episode.revision,quote:episode.text},...extra];
  const base=meaning(request,2,{episodeId:episode.id,evidence,actorId:request.scope.characterId,targetId:user,...patch});
  if(base.result.status==='interpreted')base.result.interpretation.outcome={episodeId:episode.id,use:'used',result,evidence};
  return base;
}
it('S2-07 a reported good result of my suggestion is joy linked to that episode, not only a bad one',async()=>{
  const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
  const s=await suggest(sessionId,'저녁 뭐 먹을까?',['저녁이라면 따뜻한 게 좋겠다.','토마토 파스타 어때?'],pasta);await s.ack(0);await s.ack(1);
  now+=60000;const later=await turn(sessionId,'네가 골라 준 파스타 먹었는데 정말 맛있었어.');
  await commit(later,r=>linked(r,'토마토 파스타','favorable',{congruence:.8,agency:'self'}));
  const effect=(await effects(later.event.id)).eventAffect;expect(effect).toMatchObject({status:'applied'});
  expect(effect.stimuli.joy).toBeGreaterThan(0);expect(effect.stimuli.embarrassment).toBe(0);
  const [record]=(await db.pool.query('SELECT record FROM affective_appraisals WHERE event_id=$1',[later.event.id])).rows;
  expect(record.record.interpretation.outcome).toMatchObject({use:'used',result:'favorable'});
});
it('S2-08 a truncated read still links one of the newest suggestions',async()=>{
  const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
  for(let i=0;i<6;i++){const s=await suggest(sessionId,`추천 ${i}`,['하나 골라 볼게.',`메뉴${i} 어때?`],{kind:'음식',title:`메뉴${i}`,sentenceIndex:1,quote:`메뉴${i} 어때`});await s.ack(0);await s.ack(1);}
  const later=await turn(sessionId,'메뉴5 먹었는데 별로였어.');
  await commit(later,r=>{expect(r.experience.truncated).toBe(true);return linked(r,'메뉴5','unfavorable',{congruence:-.6,agency:'self'});});
  expect((await effects(later.event.id)).eventAffect).toMatchObject({status:'applied'});
  expect((await store.state()).body.affect.embarrassment.causes).toContainEqual({eventId:later.event.id,targetId:null});
});
it('S2-09 an unresolved reference asks which one and records no affect; the answer then links once',async()=>{
  const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
  const s=await suggest(sessionId,'저녁 뭐 먹을까?',['저녁이라면 따뜻한 게 좋겠다.','토마토 파스타 어때?'],pasta);await s.ack(0);await s.ack(1);
  now+=60000;const vague=await turn(sessionId,'네가 추천한 거 먹어 봤는데 별로였어.');
  const result=await commit(vague,request=>{const input=request.sources.find(x=>x.id===request.eventId)!;
    return {request,promptVersion:'synthetic',latencyMs:1,result:{status:'interpreted',promptVersion:'synthetic',interpretation:{status:'uncertain',outcome:null,appraisals:[]},unresolvedReference:{sourceId:input.id,revision:input.revision,quote:'네가 추천한 거'}}};},
    {...question,act:'criticism'});
  expect((await effects(vague.event.id)).eventAffect).toEqual({promptVersion:'synthetic',latencyMs:1,status:'withheld',reason:'unresolved_reference'});
  expect(result.response!.plan).toMatchObject({action:'ask',purpose:'clarify',reference:'unresolved_suggestion'});
  expect(await records()).toEqual([]);expect((await store.state()).body.affect.embarrassment.value).toBe(0);
  await store.failResponse(result.response!.id,'fixture_no_stage');
  // The clarifying answer can cite the earlier report, which the request still carries.
  now+=5000;const answer=await turn(sessionId,'토마토 파스타 말이야.');
  await commit(answer,r=>{const earlier=r.sources.find(x=>x.id===vague.event.id);expect(earlier?.text).toBe('네가 추천한 거 먹어 봤는데 별로였어.');
    return linked(r,'토마토 파스타','unfavorable',{congruence:-.6,agency:'self'},[{sourceId:earlier!.id,revision:earlier!.revision,quote:'별로였어'}]);});
  expect((await effects(answer.event.id)).eventAffect).toMatchObject({status:'applied'});
  expect((await records()).map(r=>r.event_id)).toEqual([answer.event.id]);
  expect((await store.state()).body.affect.embarrassment.causes.filter(c=>c.targetId===null).map(c=>c.eventId)).toEqual([answer.event.id]);
});
const unresolved=(quote:string)=>(request:EventInterpretationRequest):EventAffectAttempt=>{const input=request.sources.find(x=>x.id===request.eventId)!;
  return {request,promptVersion:'synthetic',latencyMs:1,result:{status:'interpreted',promptVersion:'synthetic',interpretation:{status:'uncertain',outcome:null,appraisals:[]},unresolvedReference:{sourceId:input.id,revision:input.revision,quote}}};};
async function deliver(sessionId:string,responseId:string,sentences:string[]){
  const clientId=randomUUID(),owner=await store.grantOwner(sessionId,randomUUID(),clientId);
  const generated=(await store.generated(responseId,sentences,{clientId,outputEpoch:owner.outputEpoch}))!;
  for(const s of generated.segments){const payload={responseId,segmentId:s.id,generationEpoch:generated.response.generation_epoch,outputEpoch:String(owner.outputEpoch)};
    await store.report(sessionId,randomUUID(),'caption.shown',payload,clientId);await store.report(sessionId,randomUUID(),'caption.finished',payload,clientId);}
}
it('S2-10 after asking, the answer reads older suggestions beyond the newest five; a second unresolved turn is not asked again',async()=>{
  const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
  for(let i=0;i<7;i++){const s=await suggest(sessionId,`추천 ${i}`,['하나 골라 볼게.',`메뉴${i} 어때?`],{kind:'음식',title:`메뉴${i}`,sentenceIndex:1,quote:`메뉴${i} 어때`});await s.ack(0);await s.ack(1);}
  const vague=await turn(sessionId,'예전에 네가 추천한 거 별로였어.');
  const asked=await commit(vague,r=>{expect(r.sources.filter(x=>x.kind==='episode')).toHaveLength(5);return unresolved('네가 추천한 거')(r);},{...question,act:'criticism'});
  expect(asked.response!.plan).toMatchObject({purpose:'clarify',reference:'unresolved_suggestion'});
  await deliver(sessionId,asked.response!.id,['어떤 거 말하는 거야?']);
  const answer=await turn(sessionId,'메뉴0 말이야.');
  const linkedTurn=await commit(answer,r=>{expect(r.sources.filter(x=>x.kind==='episode').map(x=>x.text)).toContain('메뉴0 어때?');expect(r.experience.truncated).toBe(false);
    return linked(r,'메뉴0','unfavorable',{congruence:-.6,agency:'self'});});
  expect((await effects(answer.event.id)).eventAffect).toMatchObject({status:'applied'});
  await deliver(sessionId,linkedTurn.response!.id,['그랬구나, 아쉽다.']);
  // A reply that asked was delivered just before: still unresolved means answer normally, not ask again.
  const again=await turn(sessionId,'예전에 네가 추천한 거 또 별로였어.');
  const asked2=await commit(again,unresolved('네가 추천한 거'),{...question,act:'criticism'});
  expect(asked2.response!.plan.reference).toBe('unresolved_suggestion');
  await deliver(sessionId,asked2.response!.id,['어떤 거 말하는 거야?']);
  const third=await turn(sessionId,'음 기억이 안 나.');
  const plain=await commit(third,unresolved('기억이 안 나'),{...question,act:'other'});
  expect(plain.response!.plan.purpose).not.toBe('clarify');expect(plain.response!.plan.reference).toBeUndefined();
  expect((await effects(third.event.id)).eventAffect).toMatchObject({status:'withheld'});
});
