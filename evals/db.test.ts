import { beforeAll,beforeEach,afterAll,it,expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { testDatabase,reset,observed,IDENTITY_IDS,CHARACTER_ID } from './helpers.ts';
import {Store} from '../packages/database/src/store.ts';
import {jevEvidenceVerifier} from '../packages/adapters/src/appraisal-evidence.ts';
import { migrate } from '../packages/database/src/migrate.ts';
import { seed } from '../packages/database/src/seed.ts';
import { initialState,dialoguePlan,speechStyle } from '../packages/character-core/src/index.ts';
import { neutralAppraisal,type Plan } from '../packages/contracts/src/domain.ts';
import { mapJevResponse } from '../packages/adapters/src/jev.ts';
import { recordedJevResponse } from './jev-fixture.ts';
import { OllamaProvider } from '../packages/adapters/src/ollama.ts';
import {semanticEvaluation,type ConversationAct} from './semantic-jev-fixture.ts';
import {dialogueContext,sharedExperience,assertStagePreparationReady} from './dialogue-context.ts';
let db:Awaited<ReturnType<typeof testDatabase>>,store:Store,now:number;
beforeAll(async()=>{db=await testDatabase();});
beforeEach(async()=>{now=Date.now();await reset(db,now);store=new Store(db,CHARACTER_ID,()=>now,jevEvidenceVerifier);});
afterAll(async()=>{await db?.close();});
async function session(){const id=randomUUID();await store.startSession(id,randomUUID());return id;}
it('AF03 Stage preflight preserves previous unfinished activity without preparation events',async()=>{
 const id=await session(),run=await store.startActivity(id,randomUUID(),'boxes-v1');await store.stopSession(id,randomUUID());
 const before=(await db.pool.query('SELECT count(*) FROM events')).rows[0].count;
 await expect(assertStagePreparationReady(store)).rejects.toThrow('stage_preparation_requires_no_active_activity');
 expect((await store.activity()).id).toBe(run.activityId);expect((await db.pool.query('SELECT count(*) FROM events')).rows[0].count).toBe(before);expect(await store.currentSession()).toBeNull();
});
it('AF03 Stage preparation succeeds when no unfinished activity exists',async()=>{
 await assertStagePreparationReady(store);const id=await session(),experience=await sharedExperience(store,id);await store.stopSession(id,randomUUID());
 expect(experience.hintEventId).toBeTruthy();expect(await store.activity()).toBeNull();expect((await store.memories()).some(m=>m.facts.result==='verified_help')).toBe(true);
});
it('AF04 swapped synthetic names and helper IDs preserve the actual helper',async()=>{
 const result=await dialogueContext(store,{id:'tell_b',plan:{action:'answer',purpose:'question',targetIdentityId:IDENTITY_IDS[0],expression:'neutral',maxSentences:2,delivery:'normal',memoryIds:[]},scenarioConfig:{helperIdentityId:IDENTITY_IDS[1],displayNames:[{identityId:IDENTITY_IDS[0],displayName:'B'},{identityId:IDENTITY_IDS[1],displayName:'A'}]},context:{sources:[{payload:{text:'A가 도운 일을 말해 줘.'}}]}});
 expect(result.context.memories.some(m=>m.facts.identityId===IDENTITY_IDS[1]&&m.facts.result==='verified_help')).toBe(true);expect(result.context.memories.some(m=>m.facts.identityId===IDENTITY_IDS[0])).toBe(false);
 expect(result.context.identities).toEqual([{id:IDENTITY_IDS[0],displayName:'B'},{id:IDENTITY_IDS[1],displayName:'A'}]);
});
it('AF04 non-seeded scenario identity is rejected before creating events',async()=>{
 const id=await session(),before=(await db.pool.query('SELECT count(*) FROM events')).rows[0].count;
 await expect(sharedExperience(store,id,randomUUID())).rejects.toThrow();expect((await db.pool.query('SELECT count(*) FROM events')).rows[0].count).toBe(before);
});
it('Q03 actual shared memory context resolves only referenced participants from the identity store',async()=>{
 const result=await dialogueContext(store,{id:'tell_b',plan:{action:'answer',purpose:'question',targetIdentityId:IDENTITY_IDS[1],expression:'neutral',maxSentences:2,delivery:'normal',memoryIds:[]},context:{sources:[{payload:{text:'A가 도운 일을 말해 줘.'}}]}});
 expect((result.context as any).identities).toEqual([{id:IDENTITY_IDS[0],displayName:'A'},{id:IDENTITY_IDS[1],displayName:'B'}]);
 expect(result.context.memories.some(m=>m.facts.identityId===IDENTITY_IDS[0])).toBe(true);
 expect(result.context.memories.some(m=>m.facts.result==='verified_help')).toBe(true);
 expect(result.context.memories.some(m=>m.facts.identityId===IDENTITY_IDS[1])).toBe(false);
});
it('Q03 duplicate display names retain distinct identities and cannot introduce unrelated participants',async()=>{
 await db.pool.query('UPDATE identities SET display_name=$1 WHERE id=ANY($2::uuid[])',['같은 이름',IDENTITY_IDS.slice(0,2)]);
 const result=await dialogueContext(store,{id:'tell_b',plan:{action:'answer',purpose:'question',targetIdentityId:IDENTITY_IDS[1],expression:'neutral',maxSentences:2,delivery:'normal',memoryIds:[]},context:{sources:[{payload:{text:'도움받은 일을 알려 줘.'}}]}});
 expect(result.context.identities).toEqual([{id:IDENTITY_IDS[0],displayName:'같은 이름'},{id:IDENTITY_IDS[1],displayName:'같은 이름'}]);
 expect(result.context.memories.every(m=>m.facts.identityId!==IDENTITY_IDS[1])).toBe(true);
});
it.each(['edited_memory','deleted_memory'])('Q03 %s uses current Store sources without recreating the helper',async id=>{
 const result=await dialogueContext(store,{id,plan:{action:'answer',purpose:'question',targetIdentityId:IDENTITY_IDS[0],expression:'neutral',maxSentences:2,delivery:'normal',memoryIds:[]},context:{sources:[{payload:{text:'지난 도움을 기억해?'}}]}});
 if(id==='edited_memory')expect(result.context.memories.some(m=>m.content==='등록된 힌트를 사용한 수열 문제의 정답을 확인했다.'&&String(m.content_version)==='2')).toBe(true);
 else expect(result.context.memories.some(m=>m.facts.identityId===IDENTITY_IDS[0])).toBe(false);
 expect(result.context.identities.some(i=>i.id===IDENTITY_IDS[2])).toBe(false);
 let request:any;
 const provider=new OllamaProvider('gemma4:12b-it-qat',{count:async()=>10,countText:async()=>10},undefined,async(_input,init)=>{request=JSON.parse(String(init?.body));return new Response('{"message":{"content":"기억을 확인할게."},"done":true,"prompt_eval_count":10}\n',{headers:{'content-type':'application/x-ndjson'}});},{evaluation:{model:'gemma4:12b-it-qat',seed:17,think:false,promptVariant:'grounded-v2'}});
 await provider.dialogue(result.plan,result.context);
 const body=JSON.parse(request.messages[1].content);
 expect(body.context).toEqual(result.context);
 if(id==='edited_memory'){
  const memory=result.context.memories.find(m=>m.content_version==='2')!;
  expect(body.memoryEvidence.find((e:any)=>e.memoryId===memory.id)).toMatchObject({contentVersion:'2',help:{status:'supported',helperIdentityId:IDENTITY_IDS[0]}});
 }else{
  expect(body.memoryEvidence.length).toBeGreaterThan(0);
  expect(body.memoryEvidence.every((e:any)=>e.help.status==='unknown'&&e.help.helperIdentityId===null)).toBe(true);
 }
});
it('Q03 deleted hint removes the only helper label from a B response context',async()=>{
 const result=await dialogueContext(store,{id:'deleted_memory',plan:{action:'answer',purpose:'question',targetIdentityId:IDENTITY_IDS[1],expression:'neutral',maxSentences:2,delivery:'normal',memoryIds:[]},context:{sources:[{payload:{text:'누가 힌트를 줬어?'}}]}});
 // Re-query after clearing the preparation response: no selected active helper memory remains.
 expect(result.context.memories.some(m=>m.facts.result==='verified_help')).toBe(false);
 expect(result.context.identities).toEqual([{id:IDENTITY_IDS[1],displayName:'B'}]);
});
it('RI03/D11 three wrong answers exhaust automatic attempts despite rising affect',async()=>{
 const id=await session(),run=await store.startActivity(id,randomUUID(),'sequence-v1');
 for(const answer of ['45','46','48']){
  const s=await store.state(),a=await store.activity(),result=await store.submitCandidate(id,run.activityId,answer,{generationEpoch:s.generationEpoch,activityVersion:BigInt(a.version)});
  expect(result.verdict).toBe('incorrect');expect(result.response).not.toBeNull();await store.failResponse(result.response!.id,'fixture_no_stage');
 }
 const s=await store.state(),a=await store.activity();expect(a.auto_attempts_used).toBe(3);expect(s.body.affect.frustration.value).toBeCloseTo(.6);
 await expect(store.submitCandidate(id,run.activityId,'47',{generationEpoch:s.generationEpoch,activityVersion:BigInt(a.version)})).rejects.toMatchObject({code:'attempt_budget_exhausted'});
 expect((await store.activity()).status).toBe('solving');expect((await store.state()).body.affect).toEqual(s.body.affect);
});
it('RI04 deleting an emotion source removes its cause but does not erase the emotion',async()=>{
 const id=await session(),eventId=await observed(store,id,IDENTITY_IDS[0],'praise'),before=(await store.state()).body.affect.joy;
 expect(before.causes.some(c=>c.eventId===eventId)).toBe(true);
 await store.deleteEvent(eventId,'1',randomUUID());const after=(await store.state()).body.affect.joy;
 expect(after.causes.some(c=>c.eventId===eventId)).toBe(false);expect(after.value).toBeCloseTo(before.value);
});
async function mixedStyleFixture(frustrationIdentityId=IDENTITY_IDS[0],joyIdentityId=IDENTITY_IDS[0]){
 const sourceSession=await session(),causes:{eventId:string;text:string}[]=[];
 for(const [identityId,act,text] of [[frustrationIdentityId,'criticism','거리 표현 근거가 된 합성 비난'],[joyIdentityId,'praise','긍정 표현 근거가 된 합성 칭찬']] as const){
  const input=await store.acceptChat(sourceSession,randomUUID(),{identityId,text}),selected=(await store.select(input.eventId))!;
  const result=await store.commitAppraisal(selected,{...neutralAppraisal,target:'character',act,strength:3,hostility:act==='criticism'?3:0,uncertain:false,evidence_refs:[input.eventId]},{provider:'synthetic-fixture',model:'recorded'});
  if(result.response)await store.failResponse(result.response.id,'fixture_no_stage');causes.push({eventId:input.eventId,text});
 }
 // The strong values are a controlled fixture, not evidence of natural reachability.
 const body=(await store.state()).body;body.affect.joy.value=.7;body.affect.frustration.value=.7;body.mood.pleasantness=.6;
 await db.pool.query('UPDATE character_state SET body=$2 WHERE character_id=$1',[CHARACTER_ID,body]);
 await store.stopSession(sourceSession,randomUUID());const id=await session();
 return {id,frustration:causes[0]!,joy:causes[1]!};
}
// A conversational act, when needed, is stated by the test as verified Jev evidence.
async function styleQuestion(id:string,identityId=IDENTITY_IDS[0],text='모임은 오후 3시야. 시간을 확인해 줘.',act?:ConversationAct){
 const input=await store.acceptChat(id,randomUUID(),{identityId,text}),selected=(await store.select(input.eventId))!;
 const semantic=act?await semanticEvaluation(selected,act):undefined;
 const result=semantic?await store.commitAppraisal(selected,semantic.appraisal,semantic.metadata):await store.commitAppraisal(selected,{...neutralAppraisal,target:'character',act:'question',uncertain:false,evidence_refs:[input.eventId]},{provider:'synthetic-fixture',model:'recorded'});
 expect(result.response).not.toBeNull();return {input,response:result.response!,selected};
}
async function deliverStyle(id:string,response:NonNullable<Awaited<ReturnType<Store['commitAppraisal']>>['response']>){
 const clientId=randomUUID(),owner=await store.grantOwner(id,randomUUID(),clientId);
 const output=(await store.generated(response.id,['확인했습니다.'],{clientId,outputEpoch:owner.outputEpoch}))!;
 for(const segment of output.segments){const report={responseId:response.id,segmentId:segment.id,generationEpoch:output.response.generation_epoch,outputEpoch:owner.outputEpoch.toString()};await store.report(id,randomUUID(),'caption.shown',report,clientId);await store.report(id,randomUUID(),'caption.finished',report,clientId);}
 now+=100;
}
// Only the expression intent is controlled here. Accepted causes, response
// provenance, completed delivery and invalidation run against the dedicated DB.
// This does not claim a model naturally selects sharpness or partial hiding.
async function contextualStyleResponse(id:string,intent:Parameters<typeof speechStyle>[2]={},identityId=IDENTITY_IDS[0]){
 return store.locked(async(c,s)=>{
  const trigger=await (store as any).event(c,id,'contextual.fixture',randomUUID(),{text:'합성 표현 계약 검사'},identityId);
  const plan:Plan={...dialoguePlan(s.body,'question',identityId),speechStyle:speechStyle(s.body,identityId,intent)};
  const response=await (store as any).response(c,s,id,trigger,plan) as NonNullable<Awaited<ReturnType<Store['commitAppraisal']>>['response']>|null;
  expect(response).not.toBeNull();return response!;
 });
}
async function contextualCauseRef(responseId:string,causeId:string){
 return (await db.pool.query('SELECT event_id,source_version FROM response_sources WHERE response_id=$1 AND event_id=$2',[responseId,causeId])).rows;
}
it.each(['partial','full'] as const)('CX-DB01 completed casual sharp survives %s hiding, restart and a new topic with the same cause',async mask=>{
 const setup=await mixedStyleFixture(),first=await contextualStyleResponse(setup.id,{discomfortTone:'sharp'});
 expect(first.plan.speechStyle).toEqual({register:'casual',positiveTone:'bright',discomfortTone:'sharp'});
 expect(await contextualCauseRef(first.id,setup.frustration.eventId)).toEqual([{event_id:setup.frustration.eventId,source_version:'1'}]);
 await deliverStyle(setup.id,first);store=new Store(db,CHARACTER_ID,()=>now,jevEvidenceVerifier);
 const hidden=await contextualStyleResponse(setup.id,mask==='full'?{joy:'mask',discomfort:'mask',embarrassment:'mask'}:{discomfort:'mask'});
 expect(hidden.plan.speechStyle).toEqual(mask==='full'?{register:'casual',positiveTone:'neutral',concealAffect:true}:{register:'casual',positiveTone:'bright',discomfortTone:'masked'});
 expect(await contextualCauseRef(hidden.id,setup.frustration.eventId)).toEqual([{event_id:setup.frustration.eventId,source_version:'1'}]);
 await deliverStyle(setup.id,hidden);
 const next=await contextualStyleResponse(setup.id);
 expect(next.plan.speechStyle).toEqual({register:'casual',positiveTone:'bright',discomfortTone:'contextual'});
 expect(await contextualCauseRef(next.id,setup.frustration.eventId)).toEqual([{event_id:setup.frustration.eventId,source_version:'1'}]);
 expect((await db.pool.query('SELECT status FROM response_runs WHERE id=ANY($1::uuid[])',[ [first.id,hidden.id] ])).rows.every(r=>r.status==='completed')).toBe(true);
});
it.each([
 {tone:'sharp',change:'deleted'},{tone:'sharp',change:'revised'},
 {tone:'partial',change:'deleted'},{tone:'partial',change:'revised'},
 {tone:'full',change:'deleted'},{tone:'full',change:'revised'},
] as const)('CX-DB02 $tone cause $change fences pending generation',async({tone,change})=>{
 const setup=await mixedStyleFixture();
 const current=await contextualStyleResponse(setup.id,tone==='sharp'?{discomfortTone:'sharp'}:tone==='partial'?{discomfort:'mask'}:{joy:'mask',discomfort:'mask',embarrassment:'mask'});
 expect(await contextualCauseRef(current.id,setup.frustration.eventId)).toEqual([{event_id:setup.frustration.eventId,source_version:'1'}]);
 const clientId=randomUUID(),owner=await store.grantOwner(setup.id,randomUUID(),clientId),epoch=(await store.state()).generationEpoch;
 if(change==='deleted'){
  const deletion=await store.deleteEvent(setup.frustration.eventId,'1',randomUUID());expect(deletion.cancelled).toContain(current.id);
  expect((await db.pool.query('SELECT status,plan,cancel_reason FROM response_runs WHERE id=$1',[current.id])).rows[0]).toEqual({status:'cancelled',plan:null,cancel_reason:'source_invalidated'});
 }else{
  // No event correction API exists; change only the synthetic source revision.
  await db.pool.query('UPDATE events SET revision=revision+1 WHERE id=$1',[setup.frustration.eventId]);
  expect((await store.state()).generationEpoch).toBe(epoch);
 }
 expect(await store.generated(current.id,['늦게 도착한 합성 문장.'],{clientId,outputEpoch:owner.outputEpoch})).toBeNull();
 expect((await db.pool.query('SELECT count(*) FROM speech_segments WHERE response_id=$1',[current.id])).rows[0].count).toBe('0');
 if(change==='deleted')expect(await store.busy()).toBe(false);
});
it.each(['failed','incomplete'] as const)('CX-DB03 %s casual delivery cannot establish register continuity',async mode=>{
 const setup=await mixedStyleFixture(),first=await contextualStyleResponse(setup.id,{discomfortTone:'sharp'});
 if(mode==='failed')await store.failResponse(first.id,'fixture_not_delivered');else{
  await deliverStyle(setup.id,first);
  // A completed status alone is insufficient: inspect actual delivery evidence.
  await db.pool.query("UPDATE speech_segments SET text_shown_at=NULL,delivery_status='not_sent' WHERE response_id=$1",[first.id]);
 }
 const next=await contextualStyleResponse(setup.id);expect(next.plan.speechStyle?.register).toBe('formal');
 expect(await contextualCauseRef(next.id,setup.frustration.eventId)).toHaveLength(1);
});
it('CX-DB03 another recipient does not inherit casual sharpness or its source',async()=>{
 const setup=await mixedStyleFixture(),first=await contextualStyleResponse(setup.id,{discomfortTone:'sharp'});await deliverStyle(setup.id,first);
 const other=await contextualStyleResponse(setup.id,{},IDENTITY_IDS[1]);
 expect(other.plan.speechStyle).toEqual({register:'casual',positiveTone:'bright'});
 expect(await contextualCauseRef(other.id,setup.frustration.eventId)).toEqual([]);await deliverStyle(setup.id,other);
 const returning=await contextualStyleResponse(setup.id);
 expect(returning.plan.speechStyle).toEqual({register:'casual',positiveTone:'bright',discomfortTone:'contextual'});
 expect(await contextualCauseRef(returning.id,setup.frustration.eventId)).toHaveLength(1);
});
it('RC05 delivered formal speech survives hiding, a Store restart and a new topic',async()=>{
 const setup=await mixedStyleFixture(),first=await styleQuestion(setup.id);await deliverStyle(setup.id,first.response);
 store=new Store(db,CHARACTER_ID,()=>now,jevEvidenceVerifier);
 const hidden=await styleQuestion(setup.id,IDENTITY_IDS[0],'왜 대답 안 해?','ask_silence_reason');
 expect(hidden.response.plan.speechStyle).toEqual({register:'formal',positiveTone:'neutral',concealAffect:true});await deliverStyle(setup.id,hidden.response);
 const body=(await store.state()).body;body.affect.frustration.value=.08;await db.pool.query('UPDATE character_state SET body=$2 WHERE character_id=$1',[CHARACTER_ID,body]);
 const topic=await styleQuestion(setup.id);expect(topic.response.plan.speechStyle?.register).toBe('formal');await deliverStyle(setup.id,topic.response);
 const b=await styleQuestion(setup.id,IDENTITY_IDS[1]);expect(b.response.plan.speechStyle?.register).toBe('casual');await deliverStyle(setup.id,b.response);
 expect((await styleQuestion(setup.id)).response.plan.speechStyle?.register).toBe('formal');
});
it.each(['failed','deleted','revised','recovered','new-session'] as const)('RC06 %s does not retain stale formality',async mode=>{
 const setup=await mixedStyleFixture(),first=await styleQuestion(setup.id);
 if(mode==='failed')await store.failResponse(first.response.id,'fixture_not_delivered');else await deliverStyle(setup.id,first.response);
 const body=(await store.state()).body;body.affect.frustration.value=mode==='recovered'?.049:.08;await db.pool.query('UPDATE character_state SET body=$2 WHERE character_id=$1',[CHARACTER_ID,body]);
 if(mode==='deleted')await store.deleteEvent(setup.frustration.eventId,'1',randomUUID());
 if(mode==='revised')await db.pool.query('UPDATE events SET revision=revision+1 WHERE id=$1',[setup.frustration.eventId]);
 let id=setup.id;if(mode==='new-session'){await store.stopSession(id,randomUUID());id=await session();}
 const next=await styleQuestion(id);expect(next.response.plan.speechStyle?.register).toBe('casual');
});
it('MX01/03/07 same-person mixed affect keeps formal positive tone and hides style-only cause text',async()=>{
 const setup=await mixedStyleFixture(),before=(await store.state()).body.affect,current=await styleQuestion(setup.id);
 expect(current.response.plan.speechStyle).toEqual({register:'formal',positiveTone:'bright',discomfortTone:'contextual'});expect(current.response.plan.maxSentences).toBe(1);
 expect((await store.state()).body.affect).toEqual(before);expect(current.selected.conversation.turns).toEqual([]);
 const sourceRows=(await db.pool.query('SELECT event_id,source_version FROM response_sources WHERE response_id=$1 AND event_id=ANY($2::uuid[])',[current.response.id,[setup.frustration.eventId,setup.joy.eventId]])).rows;
 expect(sourceRows).toHaveLength(2);expect(sourceRows.every(r=>r.source_version==='1')).toBe(true);
 const {context}=await store.responseContext(current.response.id);expect(context.currentInput?.id).toBe(current.input.eventId);
 expect(context.sources?.some(source=>[setup.frustration.eventId,setup.joy.eventId].includes(source.id!))).toBe(false);
 expect(JSON.stringify(context)).not.toContain(setup.frustration.text);expect(JSON.stringify(context)).not.toContain(setup.joy.text);
});
it('MX04 another recipient keeps positive tone without inheriting the first person distance',async()=>{
 const setup=await mixedStyleFixture(IDENTITY_IDS[0],IDENTITY_IDS[1]),before=(await store.state()).body.affect;
 const first=await styleQuestion(setup.id,IDENTITY_IDS[0]);expect(first.response.plan.speechStyle).toEqual({register:'formal',positiveTone:'bright',discomfortTone:'contextual'});expect((await store.state()).body.affect).toEqual(before);
 await store.failResponse(first.response.id,'fixture_no_stage');const current=await styleQuestion(setup.id,IDENTITY_IDS[1]);
 expect(current.response.plan.speechStyle).toEqual({register:'casual',positiveTone:'bright'});expect((await store.state()).body.affect).toEqual(before);
 const refs=(await db.pool.query('SELECT event_id FROM response_sources WHERE response_id=$1',[current.response.id])).rows.map(r=>r.event_id);
 expect(refs).toContain(setup.joy.eventId);expect(refs).not.toContain(setup.frustration.eventId);
 expect(JSON.stringify((await store.responseContext(current.response.id)).context)).not.toContain(setup.frustration.text);
});
it.each(['deleted','revised','forged-target','missing'] as const)('MX04/07 %s frustration cause cannot authorize formal speech',async mode=>{
 const setup=await mixedStyleFixture();
 if(mode==='deleted')await store.deleteEvent(setup.frustration.eventId,'1',randomUUID());
 else if(mode==='revised')await db.pool.query('UPDATE events SET revision=revision+1 WHERE id=$1',[setup.frustration.eventId]);
 else {const body=(await store.state()).body;if(mode==='forged-target')body.affect.frustration.causes[0]!.targetId=IDENTITY_IDS[1];else body.affect.frustration.causes[0]!.eventId=randomUUID();await db.pool.query('UPDATE character_state SET body=$2 WHERE character_id=$1',[CHARACTER_ID,body]);}
 const recipient=mode==='forged-target'?IDENTITY_IDS[1]:IDENTITY_IDS[0],current=await styleQuestion(setup.id,recipient);
 expect(current.response.plan.speechStyle).toEqual({register:'casual',positiveTone:'bright'});
 expect((await store.state()).body.affect.frustration.value).toBeCloseTo(.7);
 expect((await db.pool.query('SELECT 1 FROM response_sources WHERE response_id=$1 AND event_id=$2',[current.response.id,setup.frustration.eventId])).rowCount).toBe(0);
});
it.each(['frustration','joy'] as const)('MX07 deletion of a used %s style cause redacts the pending plan and blocks late output',async kind=>{
 const setup=await mixedStyleFixture(),current=await styleQuestion(setup.id),clientId=randomUUID(),owner=await store.grantOwner(setup.id,randomUUID(),clientId);
 const result=await store.deleteEvent(setup[kind].eventId,'1',randomUUID());
 expect(result.cancelled).toContain(current.response.id);
 expect((await db.pool.query('SELECT status,plan,cancel_reason FROM response_runs WHERE id=$1',[current.response.id])).rows[0]).toEqual({status:'cancelled',plan:null,cancel_reason:'source_invalidated'});
 expect(await store.generated(current.response.id,['오후 3시입니다.'],{clientId,outputEpoch:owner.outputEpoch})).toBeNull();expect(await store.busy()).toBe(false);
});
it.each(['frustration','joy'] as const)('MX07 changed %s style source fences late generation even without an epoch change',async kind=>{
 const setup=await mixedStyleFixture(),current=await styleQuestion(setup.id),clientId=randomUUID(),owner=await store.grantOwner(setup.id,randomUUID(),clientId),epoch=(await store.state()).generationEpoch;
 // No event correction API exists. Mutate only this synthetic source revision to test the read fence.
 await db.pool.query('UPDATE events SET revision=revision+1 WHERE id=$1',[setup[kind].eventId]);
 expect((await store.state()).generationEpoch).toBe(epoch);
 expect(await store.generated(current.response.id,['오래된 표현입니다.'],{clientId,outputEpoch:owner.outputEpoch})).toBeNull();
 expect((await db.pool.query('SELECT count(*) FROM speech_segments WHERE response_id=$1',[current.response.id])).rows[0].count).toBe('0');
});
it('MX07 a persisted legacy plan without speechStyle remains readable and deliverable',async()=>{
 const id=await session(),current=await styleQuestion(id),clientId=randomUUID(),owner=await store.grantOwner(id,randomUUID(),clientId);
 await db.pool.query("UPDATE response_runs SET plan=plan-'speechStyle' WHERE id=$1",[current.response.id]);
 expect((await store.responseContext(current.response.id)).response.plan.speechStyle).toBeUndefined();
 const output=await store.generated(current.response.id,['오후 3시야.'],{clientId,outputEpoch:owner.outputEpoch});expect(output?.segments).toHaveLength(1);expect(output?.response.plan.speechStyle).toBeUndefined();
});
async function activityStyleFixture(withHelper:boolean){
 const sourceSession=await session();if(withHelper)await observed(store,sourceSession);
 const run=await store.startActivity(sourceSession,randomUUID(),'sequence-v1');
 const hint=withHelper?await store.hint(sourceSession,randomUUID(),run.activityId,'sequence-h1',IDENTITY_IDS[0]):null;
 const state=await store.state(),activity=await store.activity(),result=await store.submitCandidate(sourceSession,run.activityId,'47',{generationEpoch:state.generationEpoch,activityVersion:BigInt(activity.version)});
 const context=(await store.responseContext(result.response!.id)).context;
 const judgement=context.sources!.find(s=>s.kind==='activity.answer_judged')!,submission=context.sources!.find(s=>s.kind==='activity.answer_submitted')!;
 expect(judgement.payload?.verdict).toBe('correct');expect(submission.payload?.candidateAnswer).toBe('47');
 expect((await store.state()).body.affect.joy.causes).toContainEqual({eventId:judgement.id,targetId:withHelper?IDENTITY_IDS[0]:'sequence-v1'});
 await store.failResponse(result.response!.id,'fixture_no_stage');await store.stopSession(sourceSession,randomUUID());
 return {id:await session(),judgementId:judgement.id!,submissionId:submission.id!,hintId:hint?.eventId};
}
it.each([false,true])('MX-A02 activity joy with helper=%s binds its source without retelling old activity',async withHelper=>{
 const setup=await activityStyleFixture(withHelper),current=await styleQuestion(setup.id);
 expect(current.response.plan.speechStyle).toMatchObject({positiveTone:'warm'});expect(current.response.plan.memoryIds).toEqual([]);
 const refs=(await db.pool.query('SELECT event_id,source_version FROM response_sources WHERE response_id=$1',[current.response.id])).rows;
 expect(refs).toContainEqual({event_id:setup.judgementId,source_version:'1'});
 if(setup.hintId)expect(refs).toContainEqual({event_id:setup.hintId,source_version:'1'});
 const context=(await store.responseContext(current.response.id)).context;
 expect(context.currentInput?.id).toBe(current.input.eventId);expect(context.sources?.some(source=>[setup.judgementId,setup.submissionId,setup.hintId].includes(source.id))).toBe(false);
 expect(JSON.stringify(context)).not.toContain('candidateAnswer');expect(JSON.stringify(context)).not.toContain('sequence-h1');
});
it.each([false,true])('MX-A02 revised activity joy source with helper=%s rejects late generation at the same epoch',async withHelper=>{
 const setup=await activityStyleFixture(withHelper),current=await styleQuestion(setup.id),clientId=randomUUID(),owner=await store.grantOwner(setup.id,randomUUID(),clientId),epoch=(await store.state()).generationEpoch;
 await db.pool.query('UPDATE events SET revision=revision+1 WHERE id=$1',[setup.judgementId]);
 expect((await store.state()).generationEpoch).toBe(epoch);expect(await store.generated(current.response.id,['오후 3시야.'],{clientId,outputEpoch:owner.outputEpoch})).toBeNull();
 expect((await db.pool.query('SELECT count(*) FROM speech_segments WHERE response_id=$1',[current.response.id])).rows[0].count).toBe('0');
});
it.each([false,true])('MX-A02 deleting activity joy with helper=%s reaches the dependent plan redaction',async withHelper=>{
 const setup=await activityStyleFixture(withHelper),current=await styleQuestion(setup.id),clientId=randomUUID(),owner=await store.grantOwner(setup.id,randomUUID(),clientId);
 const removed=await store.deleteEvent(setup.judgementId,'1',randomUUID());expect(removed.cancelled).toContain(current.response.id);
 expect((await db.pool.query('SELECT status,plan,cancel_reason FROM response_runs WHERE id=$1',[current.response.id])).rows[0]).toEqual({status:'cancelled',plan:null,cancel_reason:'source_invalidated'});
 expect(await store.generated(current.response.id,['오후 3시야.'],{clientId,outputEpoch:owner.outputEpoch})).toBeNull();expect(await store.busy()).toBe(false);
});
it('MX-A02 a changed helper source also fences the helper-linked joy response',async()=>{
 const setup=await activityStyleFixture(true),current=await styleQuestion(setup.id),clientId=randomUUID(),owner=await store.grantOwner(setup.id,randomUUID(),clientId);
 await db.pool.query('UPDATE events SET revision=revision+1 WHERE id=$1',[setup.hintId]);
 expect(await store.generated(current.response.id,['오후 3시야.'],{clientId,outputEpoch:owner.outputEpoch})).toBeNull();
});
it.each(['judgement-revision','hint-revision','forged-helper','redacted-transition'] as const)('MX-A02 %s does not bind an invalid activity provenance at planning time',async mode=>{
 const setup=await activityStyleFixture(true);
 if(mode==='judgement-revision'||mode==='hint-revision')await db.pool.query('UPDATE events SET revision=revision+1 WHERE id=$1',[mode==='judgement-revision'?setup.judgementId:setup.hintId]);
 else if(mode==='redacted-transition')await db.pool.query("UPDATE transitions SET replay_status='source_redacted' WHERE source_event_id=$1",[setup.judgementId]);
 else{const body=(await store.state()).body;body.affect.joy.causes=[{eventId:setup.judgementId,targetId:IDENTITY_IDS[1]}];await db.pool.query('UPDATE character_state SET body=$2 WHERE character_id=$1',[CHARACTER_ID,body]);}
 const current=await styleQuestion(setup.id),refs=(await db.pool.query('SELECT event_id FROM response_sources WHERE response_id=$1',[current.response.id])).rows.map(r=>r.event_id);
 expect(refs).not.toContain(setup.judgementId);expect(refs).not.toContain(setup.hintId);
});
it.each(['quoted','activity','other','unknown'])('RI02 %s criticism cannot become personal hostility or verified success',async target=>{
 const id=await session(),run=await store.startActivity(id,randomUUID(),'sequence-v1');
 const input=await store.acceptChat(id,randomUUID(),{identityId:IDENTITY_IDS[0],text:'대상 구분용 합성 입력'}),selected=(await store.select(input.eventId))!;
 const evaluation=mapJevResponse(recordedJevResponse('criticism',target,3,3),input.eventId);
 await store.commitAppraisal(selected,evaluation.appraisal,evaluation.metadata);
 expect((await store.state()).body.affect.frustration.value).toBe(0);
 expect((await db.pool.query('SELECT affinity,verified_problem_count FROM relationships')).rows[0]).toMatchObject({affinity:.5,verified_problem_count:0});
 expect((await db.pool.query("SELECT count(*) FROM relationship_evidence WHERE kind<>'first_observed'")).rows[0].count).toBe('0');
 expect((await store.activity()).id).toBe(run.activityId);expect((await store.activity()).status).toBe('solving');
});
it('RI04 delivered generated claims do not create help, success or new affect evidence',async()=>{
 const id=await session();await store.startActivity(id,randomUUID(),'sequence-v1');
 const clientId=randomUUID(),owner=await store.grantOwner(id,randomUUID(),clientId);
 const input=await store.acceptChat(id,randomUUID(),{identityId:IDENTITY_IDS[0],text:'지금 상태를 말해 줘.'}),selected=(await store.select(input.eventId))!;
 const evaluation=mapJevResponse(recordedJevResponse('question'),input.eventId),committed=await store.commitAppraisal(selected,evaluation.appraisal,evaluation.metadata);
 const before=(await store.state()).body.affect;
 const output=(await store.generated(committed.response!.id,['네 도움으로 정답을 맞혀서 정말 기뻐.'],{clientId,outputEpoch:owner.outputEpoch}))!;
 const body={responseId:output.response.id,segmentId:output.segments[0].id,generationEpoch:output.response.generation_epoch,outputEpoch:owner.outputEpoch.toString()};
 await store.report(id,randomUUID(),'caption.shown',body,clientId);await store.report(id,randomUUID(),'caption.finished',body,clientId);
 expect((await store.activity()).status).toBe('solving');expect((await store.state()).body.affect).toEqual(before);
 expect((await db.pool.query("SELECT count(*) FROM relationship_evidence WHERE kind='verified_hint'")).rows[0].count).toBe('0');
 expect((await db.pool.query("SELECT count(*) FROM activity_steps WHERE kind='answer_judged'")).rows[0].count).toBe('0');
 expect(await store.memories()).toEqual([]);
});
it('AR03 deleting old correct submission commits without reopening beside a newer activity',async()=>{
 const id=await session(),old=await store.startActivity(id,randomUUID(),'sequence-v1'),state=await store.state(),activity=await store.activity();const solved=await store.submitCandidate(id,old.activityId,'47',{generationEpoch:state.generationEpoch,activityVersion:BigInt(activity.version)});if(solved.response)await store.failResponse(solved.response.id,'synthetic_setup');
 const current=await store.startActivity(id,randomUUID(),'boxes-v1'),source=(await db.pool.query("SELECT e.id,e.revision FROM activity_steps st JOIN events e ON e.id=st.event_id WHERE st.activity_run_id=$1 AND st.kind='answer_submitted'",[old.activityId])).rows[0];
 await expect(store.deleteEvent(source.id,source.revision,randomUUID())).resolves.toMatchObject({status:'committed'});expect((await store.activity()).id).toBe(current.activityId);expect((await db.pool.query('SELECT status FROM activity_runs WHERE id=$1',[old.activityId])).rows[0].status).toBe('ended');expect((await db.pool.query('SELECT data_status FROM events WHERE id=$1',[source.id])).rows[0].data_status).toBe('deleted');
});
it('AR04 fresh same-day observation revives familiarity once after its sole source is deleted',async()=>{
 const id=await session(),first=await observed(store,id),source=(await db.pool.query('SELECT revision FROM events WHERE id=$1',[first])).rows[0];await store.deleteEvent(first,source.revision,randomUUID());expect((await db.pool.query('SELECT familiarity FROM relationships WHERE identity_id=$1',[IDENTITY_IDS[0]])).rows[0]?.familiarity??0).toBe(0);
 now+=1000;await observed(store,id);await observed(store,id);const evidence=(await db.pool.query("SELECT status,effective_at FROM relationship_evidence WHERE kind='first_observed' AND identity_id=$1",[IDENTITY_IDS[0]])).rows;expect(evidence).toHaveLength(1);expect(evidence[0].status).toBe('active');expect(evidence[0].effective_at.getTime()).toBe(now);expect((await db.pool.query('SELECT familiarity,interaction_days FROM relationships WHERE identity_id=$1',[IDENTITY_IDS[0]])).rows[0]).toMatchObject({familiarity:0.02,interaction_days:1});
});
it('AR05 corrected memory text/version reaches generation context; deleted text is excluded',async()=>{
 const id=await session(),run=await store.startActivity(id,randomUUID(),'sequence-v1'),s=await store.state(),a=await store.activity();const solved=await store.submitCandidate(id,run.activityId,'47',{generationEpoch:s.generationEpoch,activityVersion:BigInt(a.version)});if(solved.response)await store.failResponse(solved.response.id,'synthetic_setup');
 const memory=(await store.memories())[0];await store.editMemory(memory.id,memory.content_version,randomUUID(),'운영자가 고친 합성 기억');
 const accepted=await store.acceptChat(id,randomUUID(),{identityId:IDENTITY_IDS[0],text:'합성 기억 질문'}),selected=(await store.select(accepted.eventId))!;const appraisal={...neutralAppraisal,target:'character' as const,act:'question' as const,uncertain:false,evidence_refs:[accepted.eventId]};
 const committed=await store.commitAppraisal(selected,appraisal,{provider:'synthetic-fixture',model:'recorded'},[memory.id]),context=(await store.responseContext(committed.response!.id)).context;
 expect(context.memories[0]).toMatchObject({id:memory.id,content:'운영자가 고친 합성 기억',content_version:'2',facts:memory.facts});
 let request:any;const provider=new OllamaProvider('qwen2.5:7b',{count:async()=>10,countText:async()=>10},undefined,async(_url,options)=>{request=JSON.parse(options!.body as string);return new Response(JSON.stringify({message:{content:JSON.stringify({sentences:['합성 응답.']})},done:true})+'\n',{headers:{'content-type':'application/x-ndjson'}});});
 await provider.dialogue(committed.response!.plan,context);expect(JSON.parse(request.messages.at(-1).content).memories[0]).toMatchObject({content:'운영자가 고친 합성 기억',content_version:'2',facts:memory.facts});
 await store.editMemory(memory.id,'2',randomUUID());expect((await store.responseContext(committed.response!.id)).context.memories).toEqual([]);
});
it('JR05 typed Jev metadata is atomic, replay fenced, source deletion clears it',async()=>{
  const id=await session(),accepted=await store.acceptChat(id,randomUUID(),{identityId:IDENTITY_IDS[0],text:'합성 칭찬'}),selected=(await store.select(accepted.eventId))!;
  const evaluation=mapJevResponse(recordedJevResponse('praise','character',3),accepted.eventId,17);
  const first=await store.commitAppraisal(selected,evaluation.appraisal,evaluation.metadata);expect(first.status).toBe('committed');
  await store.commitAppraisal(selected,evaluation.appraisal,evaluation.metadata);
  const rows=(await db.pool.query('SELECT * FROM appraisals WHERE event_id=$1',[accepted.eventId])).rows;expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({provider:'jev',model:'jev-1.13.0',prompt_version:evaluation.metadata.promptVersion,latency_ms:17,usage:{input_tokens:123,output_tokens:0},provider_result:evaluation.metadata.providerResult});
  await store.deleteEvent(accepted.eventId,selected.revision.toString(),randomUUID());
  expect((await db.pool.query('SELECT result,provider_result,context_refs,status FROM appraisals WHERE event_id=$1',[accepted.eventId])).rows[0]).toEqual({result:null,provider_result:null,context_refs:[],status:'stale'});
});
it('JR05 old appraisal metadata remains nullable and restart preserves Jev result',async()=>{
  const id=await session();await observed(store,id);
  expect((await db.pool.query('SELECT provider_result FROM appraisals')).rows[0].provider_result).toBeNull();
  const accepted=await store.acceptChat(id,randomUUID(),{identityId:IDENTITY_IDS[1],text:'합성 칭찬'}),selected=(await store.select(accepted.eventId))!,evaluation=mapJevResponse(recordedJevResponse('praise','character',3),accepted.eventId);
  await store.commitAppraisal(selected,evaluation.appraisal,evaluation.metadata);await store.recover();
  expect((await db.pool.query('SELECT provider_result FROM appraisals WHERE event_id=$1',[accepted.eventId])).rows[0].provider_result).toEqual(evaluation.metadata.providerResult);
  expect((await db.pool.query('SELECT name FROM schema_migrations ORDER BY name')).rows.map(r=>r.name)).toEqual(['0001_m1.sql','0002_m2.sql','0003_jev_appraisal.sql','0004_conversation_context.sql','0005_knowledge.sql','0006_home_assistant_persistence.sql','0007_event_affect.sql']);
});
it('DB18 empty migration and seed repeat preserves identities and initial state',async()=>{await migrate(db);await seed(db);expect((await db.pool.query('SELECT count(*) FROM identities')).rows[0].count).toBe('4');expect((await store.state()).version).toBe(0n);});
it('DB01 concurrent duplicate key and collision are atomic without deadlock',async()=>{const id=await session(),key=randomUUID();const blocker=await db.pool.connect();await blocker.query('BEGIN');await blocker.query('SELECT * FROM sessions WHERE id=$1 FOR UPDATE',[id]);let release!:()=>void;const barrier=new Promise<void>(resolve=>{release=resolve;});const submit=async()=>{await barrier;return store.acceptChat(id,key,{identityId:IDENTITY_IDS[0],text:'합성 입력'});};const first=submit(),second=submit();release();await blocker.query('COMMIT');blocker.release();const results=await Promise.all([first,second]);expect(results.map(r=>r.status).sort()).toEqual(['committed','duplicate']);expect(results[0].eventId).toBe(results[1].eventId);await expect(store.acceptChat(id,key,{identityId:IDENTITY_IDS[0],text:'다른 입력'})).rejects.toMatchObject({code:'idempotency_conflict'});});
it('DB03 state/evidence mutations roll back on injected error',async()=>{const id=await session(),before=await store.state();await expect(store.locked(async(c)=>{await c.query('UPDATE character_state SET version=version+1 WHERE character_id=$1',[CHARACTER_ID]);await c.query("INSERT INTO relationships(character_id,identity_id,familiarity,affinity,interaction_days,verified_problem_count,verified_help_days,projection_version,updated_at) VALUES($1,$2,0.1,0.6,1,0,0,1,now())",[CHARACTER_ID,IDENTITY_IDS[0]]);throw new Error('synthetic rollback');})).rejects.toThrow('synthetic rollback');expect((await store.state()).version).toBe(before.version);expect((await db.pool.query('SELECT * FROM relationships')).rowCount).toBe(0);});
it('DB04 malformed nested state and cross-character/session links rejected',async()=>{const bad=initialState(now);(bad as any).turn={listening:'true',acknowledgements:{}};await expect(db.pool.query('UPDATE character_state SET body=$2 WHERE character_id=$1',[CHARACTER_ID,bad])).rejects.toMatchObject({code:'23514'});const id=await session();await expect(db.pool.query("INSERT INTO events(id,character_id,session_id,source_namespace,source_key,kind,occurred_at,received_at,attention_status,data_status,revision,schema_version,payload) VALUES($1,$2,$3,'x','x','x',now(),now(),'observed','active',1,1,'{}')",[randomUUID(),randomUUID(),id])).rejects.toMatchObject({code:'23503'});});
it('DB02/D03 separate attention/appraisal and duplicate adoption changes state once',async()=>{const id=await session(),accepted=await store.acceptChat(id,randomUUID(),{identityId:IDENTITY_IDS[0],text:'잘했어'}),selected=(await store.select(accepted.eventId))!;const result={...neutralAppraisal,target:'character' as const,act:'praise' as const,strength:3,uncertain:false,evidence_refs:[accepted.eventId]};await store.commitAppraisal(selected,result,{provider:'synthetic-fixture',model:'recorded'});const state=await store.state();await store.commitAppraisal(selected,result,{provider:'synthetic-fixture',model:'recorded'});expect((await store.state()).version).toBe(state.version);expect(state.body.affect.joy.value).toBeCloseTo(.18);expect((await db.pool.query("SELECT kind FROM events WHERE parent_event_id=$1 ORDER BY kind",[accepted.eventId])).rows.map(r=>r.kind)).toEqual(['appraisal.applied','attention.selected']);});
it('DB05/06 repetition and familiarity persist across restart and new sessions',async()=>{let id=await session();for(let i=0;i<4;i++)await observed(store,id,IDENTITY_IDS[0],'praise');expect((await store.state()).body.affect.joy.value).toBeCloseTo(.3);await store.recover();id=await session();await observed(store,id);const r=(await db.pool.query('SELECT * FROM relationships WHERE identity_id=$1',[IDENTITY_IDS[0]])).rows[0];expect(r.familiarity).toBeCloseTo(.02);expect(r.affinity).toBeCloseTo(.51);});
it('DB16 startup interrupts committed response and never resumes output',async()=>{const id=await session(),accepted=await store.acceptChat(id,randomUUID(),{identityId:IDENTITY_IDS[0],text:'안녕'}),selected=(await store.select(accepted.eventId))!;const result=await store.commitAppraisal(selected,{...neutralAppraisal,target:'character',act:'question',uncertain:false,evidence_refs:[accepted.eventId]},{provider:'synthetic-fixture',model:'recorded'});expect(result.response).not.toBeNull();await store.recover();expect((await store.currentSession())).toBeNull();expect((await db.pool.query('SELECT status FROM response_runs')).rows[0].status).toBe('interrupted');expect(await store.busy()).toBe(false);});
async function helped(){const id=await session();await observed(store,id);const started=await store.startActivity(id,randomUUID(),'sequence-v1');await store.hint(id,randomUUID(),started.activityId,'sequence-h1',IDENTITY_IDS[0]);const state=await store.state(),activity=await store.activity();await store.submitCandidate(id,started.activityId,'47',{generationEpoch:state.generationEpoch,activityVersion:BigInt(activity.version)});return {id,activityId:started.activityId};}
it('DB07 same problem on another run attaches independent group once',async()=>{await helped();const prior=(await db.pool.query("SELECT id FROM response_runs WHERE status='planned'")).rows[0];await store.failResponse(prior.id,'fixture_delivery_finished');const second=await store.startActivity((await store.currentSession()).id,randomUUID(),'sequence-v1');await store.hint((await store.currentSession()).id,randomUUID(),second.activityId,'sequence-h1',IDENTITY_IDS[0]);const a=await store.activity(),s=await store.state();await store.submitCandidate((await store.currentSession()).id,second.activityId,'47',{generationEpoch:s.generationEpoch,activityVersion:BigInt(a.version)});const re=(await db.pool.query("SELECT * FROM relationship_evidence WHERE kind='verified_hint'")).rows;expect(re).toHaveLength(1);const groups=(await db.pool.query('SELECT DISTINCT support_group FROM relationship_evidence_sources WHERE evidence_id=$1',[re[0].id])).rows;expect(groups).toHaveLength(2);expect((await db.pool.query('SELECT affinity FROM relationships WHERE identity_id=$1',[IDENTITY_IDS[0]])).rows[0].affinity).toBeCloseTo(.515);});
it('DB10/D15 memory tombstone survives consolidation and retains independent help',async()=>{const {id}=await helped();const memory=(await store.memories()).find(m=>m.facts.result==='verified_help')!;await store.editMemory(memory.id,memory.content_version,randomUUID());await store.stopSession(id,randomUUID());const task=await store.claimTask();expect(task).not.toBeNull();await store.finishTask(task!);expect((await db.pool.query('SELECT status,content,facts FROM memories WHERE id=$1',[memory.id])).rows[0]).toMatchObject({status:'deleted',content:null,facts:null});expect((await db.pool.query("SELECT * FROM relationship_evidence WHERE kind='verified_hint' AND status='active'")).rowCount).toBe(1);});
it('DB08 source deletion retains independent first-observed group',async()=>{const id=await session(),first=await observed(store,id),second=await observed(store,id);await store.deleteEvent(first,'1',randomUUID());expect((await db.pool.query('SELECT familiarity FROM relationships WHERE identity_id=$1',[IDENTITY_IDS[0]])).rows[0].familiarity).toBeCloseTo(.02);expect((await db.pool.query('SELECT payload FROM events WHERE id=$1',[first])).rows[0].payload).toBeNull();expect((await db.pool.query('SELECT data_status FROM events WHERE id=$1',[second])).rows[0].data_status).toBe('active');});
it('DB15 task lease token fences old completion',async()=>{const id=await session();await store.stopSession(id,randomUUID());const old=await store.claimTask();await db.pool.query("UPDATE tasks SET lease_until=now()-interval '1 second' WHERE id=$1",[old!.id]);expect(await store.claimTask()).toBeNull();await db.pool.query("UPDATE tasks SET available_at=now()-interval '1 second' WHERE id=$1",[old!.id]);const current=await store.claimTask();expect(await store.finishTask(old!)).toBe(false);expect(await store.finishTask(current!)).toBe(true);expect((await db.pool.query("SELECT count(*) FROM events WHERE kind='task.applied'")).rows[0].count).toBe('1');});
it('DB12/13/D12 resume offer is reserved once then offered only all captions shown',async()=>{const first=await session();await observed(store,first);const activity=await store.startActivity(first,randomUUID(),'boxes-v1');await store.stopSession(first,randomUUID());const next=await session();await observed(store,next);now+=31000;const response=await store.agenda(next,false);expect(response).not.toBeNull();expect((await db.pool.query('SELECT status FROM agendas')).rows[0].status).toBe('reserved');expect(await store.agenda(next,false)).toBeNull();const clientId=randomUUID(),owner=await store.grantOwner(next,randomUUID(),clientId);const generated=await store.generated(response!.id,['첫 문장.','두 번째 문장.'],{clientId,outputEpoch:owner.outputEpoch});const base={responseId:response!.id,generationEpoch:response!.generationEpoch.toString(),outputEpoch:owner.outputEpoch.toString()};await store.report(next,randomUUID(),'caption.shown',{...base,segmentId:generated!.segments[0].id},clientId);expect((await db.pool.query('SELECT status FROM agendas')).rows[0].status).toBe('reserved');const key=randomUUID(),payload={...base,segmentId:generated!.segments[1].id};await store.report(next,key,'caption.shown',payload,clientId);expect((await store.report(next,key,'caption.shown',payload,clientId)).status).toBe('duplicate');expect((await db.pool.query('SELECT status FROM agendas')).rows[0].status).toBe('offered');await store.answerAgenda(next,randomUUID(),true);expect((await store.activity()).id).toBe(activity.activityId);});
it('DB11 unrelated memory deletion cancels fenced active work without busy deadlock',async()=>{const helpedRun=await helped();const oldResponse=(await db.pool.query("SELECT id FROM response_runs WHERE status='planned'")).rows[0];await store.failResponse(oldResponse.id,'fixture');const memory=(await store.memories())[0];const id=helpedRun.id;const input=await store.acceptChat(id,randomUUID(),{identityId:IDENTITY_IDS[1],text:'합성 질문'}),selected=(await store.select(input.eventId))!;const result=await store.commitAppraisal(selected,{...neutralAppraisal,target:'character',act:'question',uncertain:false,evidence_refs:[input.eventId]},{provider:'synthetic-fixture',model:'recorded'});await store.editMemory(memory.id,memory.content_version,randomUUID());expect(await store.busy()).toBe(false);expect(await store.generated(result.response!.id,['늦은 합성 출력'],null)).toBeNull();});
it('D14 valid correct judgement remains solved after its used hint source deleted; budget stays consumed',async()=>{const {activityId}=await helped();const hint=(await db.pool.query("SELECT e.id,e.revision FROM activity_steps s JOIN events e ON e.id=s.event_id WHERE s.activity_run_id=$1 AND s.kind='hint_used'",[activityId])).rows[0];await store.deleteEvent(hint.id,hint.revision,randomUUID());const run=(await db.pool.query('SELECT * FROM activity_runs WHERE id=$1',[activityId])).rows[0];expect(run.status).toBe('solved');expect(run.hints_used).toBe(1);expect(run.auto_attempts_used).toBe(1);expect((await db.pool.query("SELECT count(*) FROM relationship_evidence WHERE kind='verified_hint' AND status='active'")).rows[0].count).toBe('0');});
it('AI07 stale solve needs_hint cannot mutate activity after cancellation',async()=>{const id=await session();const run=await store.startActivity(id,randomUUID(),'sequence-v1'),s=await store.state(),a=await store.activity();await store.cancel(id,randomUUID(),'fixture_cancel');await expect(store.needsHint(id,run.activityId,{generationEpoch:s.generationEpoch,activityVersion:BigInt(a.version)})).rejects.toMatchObject({code:'stale_result'});expect((await store.activity()).status).toBe('solving');});

it('DB15 task retry waits5/30seconds, renewal requires live token and third failure closes',async()=>{const id=await session();await store.stopSession(id,randomUUID());for(const attempt of [1,2,3]){const task=await store.claimTask();expect(task!.attempts).toBe(attempt);expect(await store.renewTask({...task,leaseToken:randomUUID()})).toBe(false);expect(await store.renewTask(task!)).toBe(true);expect(await store.failTask(task!,'fixture_failure')).toBe(true);const row=(await db.pool.query('SELECT *,extract(epoch FROM (available_at-now())) AS wait FROM tasks WHERE id=$1',[task!.id])).rows[0];expect(row.status).toBe(attempt===3?'failed':'pending');if(attempt<3){expect(Number(row.wait)).toBeGreaterThan(attempt===1?4:29);expect(await store.claimTask()).toBeNull();await db.pool.query("UPDATE tasks SET available_at=now()-interval '1 second' WHERE id=$1",[task!.id]);}}});
it('DB15 committed result_ready resumes after process boundary without recomputing or duplicate application',async()=>{const id=await session();await observed(store,id);await store.startActivity(id,randomUUID(),'boxes-v1');await store.stopSession(id,randomUUID());const task=await store.claimTask();expect(await store.prepareTask(task!)).toBe(true);const restarted=new Store(db,CHARACTER_ID,()=>now,jevEvidenceVerifier),ready=await restarted.claimTask();expect(ready!.status).toBe('result_ready');expect(ready!.attempts).toBe(1);expect(await restarted.finishTask(ready!)).toBe(true);expect(await restarted.finishTask(ready!)).toBe(false);expect((await db.pool.query("SELECT count(*) FROM events WHERE kind='task.applied'")).rows[0].count).toBe('1');});
it('DB15 result_ready source revision change discards stale result with bounded retry',async()=>{const id=await session(),input=await observed(store,id);await store.stopSession(id,randomUUID());const task=await store.claimTask();await store.prepareTask(task!);await store.deleteEvent(input,'1',randomUUID());expect(await store.applyTask(task!)).toBe(false);const row=(await db.pool.query('SELECT * FROM tasks WHERE id=$1',[task!.id])).rows[0];expect(row.status).toBe('pending');expect(row.last_error).toBe('stale_result');expect((await db.pool.query("SELECT count(*) FROM events WHERE kind='task.applied'")).rows[0].count).toBe('0');});
it('activity result/hint cannot create a second active response during existing speech',async()=>{const id=await session(),run=await store.startActivity(id,randomUUID(),'sequence-v1');const input=await store.acceptChat(id,randomUUID(),{identityId:IDENTITY_IDS[0],text:'합성 질문'}),selected=(await store.select(input.eventId))!;await store.commitAppraisal(selected,{...neutralAppraisal,target:'character',act:'question',uncertain:false,evidence_refs:[input.eventId]},{provider:'synthetic-fixture',model:'recorded'});const state=await store.state(),a=await store.activity(),expected={generationEpoch:state.generationEpoch,activityVersion:BigInt(a.version)};await expect(store.submitCandidate(id,run.activityId,'47',expected)).rejects.toMatchObject({code:'output_busy'});await expect(store.needsHint(id,run.activityId,expected)).rejects.toMatchObject({code:'output_busy'});expect((await store.activity()).auto_attempts_used).toBe(0);expect((await db.pool.query("SELECT count(*) FROM response_runs WHERE status='planned'")).rows[0].count).toBe('1');});
