import {beforeAll,beforeEach,afterAll,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {testDatabase,reset,fixtureProvider,IDENTITY_IDS} from './helpers.ts';
import {Store} from '../packages/database/src/store.ts';
import {jevEvidenceVerifier} from '../packages/adapters/src/appraisal-evidence.ts';
import {Coordinator} from '../apps/runtime/src/coordinator/index.ts';
import {neutralAppraisal,type Appraisal,type SilenceRecord} from '../packages/contracts/src/domain.ts';
import {decay} from '../packages/character-core/src/index.ts';
import {mockJevAppraiser,recordedJevResponse} from './jev-fixture.ts';
import {mapJevResponse} from '../packages/adapters/src/jev.ts';
import type {JevEvaluation as AppraisalEvaluation} from '../packages/adapters/src/jev.ts';
let db:Awaited<ReturnType<typeof testDatabase>>,store:Store,now:number,sessionId:string;
const appraisal=(act:Appraisal['act']='question',hostility=0):Appraisal=>({...neutralAppraisal,target:'character',act,strength:3,hostility,uncertain:false});
beforeAll(async()=>{db=await testDatabase();});
beforeEach(async()=>{now=Date.now();await reset(db,now);store=new Store(db,undefined,()=>now,jevEvidenceVerifier);sessionId=randomUUID();await store.startSession(sessionId,randomUUID());});
afterAll(async()=>{await db?.close();});
async function input(text:string,a=appraisal(),identityId=IDENTITY_IDS[0],failureCode?:string){
 const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId,text});const selected=(await store.select(accepted.eventId))!;
 return {...await store.commitAppraisal(selected,{...a,evidence_refs:[accepted.eventId]},{provider:'synthetic-fixture',model:'recorded-v1',failureCode}),accepted,selected};
}
async function silence(){return input('너 정말 최악이야.',appraisal('criticism',3));}
async function complete(responseId:string,text='합성 응답이야.'){
 const clientId=randomUUID(),owner=await store.grantOwner(sessionId,randomUUID(),clientId);
 const generated=(await store.generated(responseId,[text],{clientId,outputEpoch:owner.outputEpoch}))!;
 for(const segment of generated.segments){const payload={responseId,segmentId:segment.id,generationEpoch:generated.response.generation_epoch,outputEpoch:String(owner.outputEpoch)};await store.report(sessionId,randomUUID(),'caption.shown',payload,clientId);await store.report(sessionId,randomUUID(),'caption.finished',payload,clientId);}
}
it('ER09/10/12: committed intentional silence has no output; reapproach and new topic preserve decayed emotion through Stage ACKs',async()=>{
 const clientId=randomUUID(),owner=await store.grantOwner(sessionId,randomUUID(),clientId),send=vi.fn(),status=vi.fn(),dialogue=vi.fn(fixtureProvider.dialogue);
 const co=new Coordinator(store,{...fixtureProvider,dialogue},{owner:()=>({clientId,outputEpoch:owner.outputEpoch}),sendOwner:send,inputStatus:status,changed:async()=>{},failure:()=>{}},{...mockJevAppraiser(),evaluate:async e=>({appraisal:{...appraisal(e.text.includes('최악')?'criticism':'question',e.text.includes('최악')?3:0),evidence_refs:[e.id]},metadata:{provider:'synthetic-fixture',model:'recorded-v1'}})});
 const submit=async(text:string)=>{await store.acceptChat(sessionId,randomUUID(),{identityId:IDENTITY_IDS[0],text});await co.drain();};
 try{
  await submit('너 정말 최악이야.');const silent=await store.state();
  expect(silent.body.turn.recentSilences).toHaveLength(1);expect(silent.body.turn.recentSilences[0]).toMatchObject({reason:'withholding',identityId:IDENTITY_IDS[0],stateVersion:String(silent.version)});
  expect(silent.body.affect.frustration.value).toBeGreaterThan(0);expect(dialogue).not.toHaveBeenCalled();expect(send).not.toHaveBeenCalled();expect(await store.busy()).toBe(false);
  expect((await db.pool.query('SELECT count(*) FROM response_runs')).rows[0].count).toBe('0');expect((await db.pool.query('SELECT count(*) FROM speech_segments')).rows[0].count).toBe('0');expect(status).toHaveBeenCalledWith(expect.any(String),'observed');
  for(const text of ['왜 말 안 해?','저녁으로 따뜻한 음식 하나 추천해줘.']){
   const before=(await store.state()).body;now+=1000;await submit(text);
   await vi.waitFor(async()=>expect((await db.pool.query("SELECT count(*) FROM response_runs WHERE status='delivering'")).rows[0].count).toBe('1'));
   const context=dialogue.mock.calls.at(-1)![1] as any;expect(context.emotion.frustration).toBeCloseTo(decay(before,now).affect.frustration.value,12);
   if(text.startsWith('왜')){expect(context.silence.reason).toBe('withholding');expect(dialogue.mock.calls.at(-1)![0].reengagement?.silenceEventId).toBe(silent.body.turn.recentSilences[0].eventId);}
   const segments=(await db.pool.query("SELECT ss.*,r.generation_epoch FROM speech_segments ss JOIN response_runs r ON r.id=ss.response_id WHERE r.status='delivering'")).rows;
   for(const segment of segments){const payload={responseId:segment.response_id,segmentId:segment.id,generationEpoch:segment.generation_epoch,outputEpoch:segment.output_epoch};await store.report(sessionId,randomUUID(),'caption.shown',payload,clientId);await store.report(sessionId,randomUUID(),'caption.finished',payload,clientId);}
   const after=(await store.state()).body;expect(after.affect).toEqual(decay(before,now).affect);expect(after.mood).toEqual(decay(before,now).mood);expect(await store.busy()).toBe(false);
  }
 }finally{await co.stop();}
});
it('ER11: old snapshot defaults empty; silence survives restart/session and deduplicated commit',async()=>{
 await db.pool.query("UPDATE character_state SET body=body #- '{turn,recentSilences}'");expect((await store.state()).body.turn.recentSilences).toEqual([]);
 const first=await silence(),before=await store.state();expect(before.body.turn.recentSilences).toHaveLength(1);
 expect((await store.commitAppraisal(first.selected,appraisal('criticism',3),{provider:'synthetic-fixture',model:'recorded-v1'})).response).toBeNull();expect((await store.state()).version).toBe(before.version);
 now+=10000;await store.recover();sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
 const recovered=await store.state();expect(recovered.body.turn.recentSilences).toEqual(before.body.turn.recentSilences);expect(recovered.body.affect).toEqual(decay(before.body,now).affect);
 const next=await input('왜 말 안 해?');expect(next.response?.plan.reengagement?.silenceEventId).toBe(first.accepted.eventId);expect((await db.pool.query('SELECT count(*) FROM response_runs')).rows[0].count).toBe('1');
});
it('ER10/12: a deliberately concealed outward reply does not recover the stored emotion',async()=>{
 await silence();await db.pool.query("UPDATE character_state SET body=jsonb_set(body,'{affect,frustration,value}','0.7'::jsonb)");
 const before=(await store.state()).body;now++;
 const why=await input('왜 말 안 해?');expect(why.response?.plan.reengagement?.disclosure).toBe('deflect');
 await complete(why.response!.id,'괜찮아, 다른 얘기 하자.');
 const after=(await store.state()).body;expect(after.affect).toEqual(decay(before,now).affect);expect(after.mood).toEqual(decay(before,now).mood);expect(after.turn.recentSilences).toEqual(before.turn.recentSilences);
});
it('ER10/11: reasons are identity scoped and failed/uncertain processing is not a fabricated intentional silence',async()=>{
 await silence();const second=await input('왜 말 안 해?',appraisal(),IDENTITY_IDS[1]);expect(second.response?.plan.reengagement).toEqual({silenceEventId:null,disclosure:'unknown'});expect((await store.responseContext(second.response!.id)).context.silence).toBeNull();await store.failResponse(second.response!.id,'fixture');
 now+=1;const broken=await input('고장 사례',neutralAppraisal,IDENTITY_IDS[0],'jev_unavailable');expect(broken.response?.plan.purpose).toBe('other');await store.failResponse(broken.response!.id,'fixture');
 expect((await store.state()).body.turn.recentSilences).toHaveLength(1);
 const next=await input('왜 말 안 해?');expect(next.response?.plan.reengagement).toEqual({silenceEventId:null,disclosure:'unknown'});expect((await store.responseContext(next.response!.id)).context.silence).toBeNull();
});
it('ER11: a redacted cancelled response still prevents attributing its missing output to an older silence',async()=>{
 await silence();now++;const question=await input('다른 질문이야.');await store.deleteEvent(question.accepted.eventId,'1',randomUUID());
 expect((await store.state()).body.turn.recentSilences).toHaveLength(1);
 const why=await input('왜 말 안 해?');expect(why.response?.plan.reengagement).toEqual({silenceEventId:null,disclosure:'unknown'});
});
it('ER11: repeat silence depends on the earlier acknowledged input and is invalidated with that source',async()=>{
 const first=await input('안녕.',appraisal('greeting'));await complete(first.response!.id);now++;
 const repeat=await input('안녕.',appraisal('greeting'));expect(repeat.response).toBeNull();
 const record=(await store.state()).body.turn.recentSilences[0];expect(record.reason).toBe('no_addition');expect(record.sourceRefs).toContainEqual({kind:'event',id:first.accepted.eventId,version:'1'});
 const before=(await store.state()).body;await store.deleteEvent(first.accepted.eventId,'1',randomUUID());expect((await store.state()).body.turn.recentSilences).toEqual([]);expect((await store.state()).body.mood).toEqual(before.mood);
});
it('ER11/12: deleting a reason source redacts state/transitions/context and active output without resetting emotion',async()=>{
 const first=await silence();now+=1000;const next=await input('왜 말 안 해?');const id=next.response!.id;
 expect((await store.responseContext(id)).context.silence?.eventId).toBe(first.accepted.eventId);
 expect((await db.pool.query('SELECT count(*) FROM response_sources WHERE response_id=$1 AND event_id=$2',[id,first.accepted.eventId])).rows[0].count).toBe('1');
 const before=(await store.state()).body;await store.deleteEvent(first.accepted.eventId,'1',randomUUID());
 expect((await store.state()).body.turn.recentSilences).toEqual([]);expect((await store.state()).body.affect.frustration.value).toBe(before.affect.frustration.value);
 expect((await db.pool.query('SELECT status,plan FROM response_runs WHERE id=$1',[id])).rows[0]).toMatchObject({status:'cancelled',plan:null});
 expect((await store.responseContext(id)).context.silence).toBeNull();expect((await db.pool.query("SELECT count(*) FROM transitions WHERE effects->'silence'->>'eventId'=$1",[first.accepted.eventId])).rows[0].count).toBe('0');
 expect(await store.generated(id,['늦은 응답'],null)).toBeNull();
});
it.each(['correct','delete'])('ER11: referenced memory %s scrubs historical reason even after bounded state replacement',async mode=>{
 await silence();const record=(await store.state()).body.turn.recentSilences[0],memoryId=randomUUID();
 await db.pool.query("INSERT INTO memories(id,character_id,session_id,memory_key,kind,status,content_version,fact_kind,visibility,content,facts,occurred_at,updated_at) VALUES($1,$2,$3,$5,'delivered_proposal','active',1,'observed','test_public','합성 근거','{}',$4,$4)",[memoryId,store.characterId,sessionId,new Date(now),memoryId]);
 const withMemory:SilenceRecord={...record,sourceRefs:[...record.sourceRefs,{kind:'memory',id:memoryId,version:'1'}]};
 await db.pool.query("UPDATE character_state SET body=jsonb_set(body,'{turn,recentSilences}',$1::jsonb)",[JSON.stringify([withMemory])]);
 await db.pool.query("UPDATE transitions SET effects=jsonb_set(effects,'{silence}',$1::jsonb) WHERE state_version=$2",[JSON.stringify(withMemory),record.stateVersion]);
 const response=(await input('왜 말 안 해?')).response!;expect((await store.responseContext(response.id)).context.silence?.sourceRefs).toContainEqual({kind:'memory',id:memoryId,version:'1'});
 // A later silence replaces the current record, but must not orphan sensitive history.
 await store.failResponse(response.id,'fixture');now+=1;await input('그냥 들어줘.',appraisal('other'));
 const before=(await store.state()).body;await store.editMemory(memoryId,'1',randomUUID(),mode==='correct'?'수정한 합성 근거':undefined);
 expect((await store.state()).body.turn.recentSilences[0].eventId).not.toBe(record.eventId);expect((await store.state()).body.affect).toEqual(before.affect);
 expect((await db.pool.query('SELECT plan FROM response_runs WHERE id=$1',[response.id])).rows[0].plan).toBeNull();
 expect((await db.pool.query('SELECT effects FROM transitions WHERE state_version=$1',[record.stateVersion])).rows[0].effects).toBeNull();
});
it('ER11: same identity replaces one record, keeps other identity, and discards oldest above twenty',async()=>{
 for(let i=0;i<21;i++){const identity=randomUUID();await db.pool.query("INSERT INTO identities(id,platform,platform_subject_id,display_name) VALUES($1,'local_test',$2,'합성')",[identity,identity]);now++;await input('그냥 들어줘.',appraisal('other'),identity);}
 const records=(await store.state()).body.turn.recentSilences;expect(records).toHaveLength(20);const identity=records[0].identityId,old=records[0].eventId;now++;await input('그냥 들어줘.',appraisal('other'),identity);
 const latest=(await store.state()).body.turn.recentSilences;expect(latest).toHaveLength(20);expect(latest.filter(x=>x.identityId===identity)).toHaveLength(1);expect(latest.some(x=>x.eventId===old)).toBe(false);
});

// Reconstructed from the six live probes recorded on 2026-10-11 (J05/J06).
// This is offline parser/Store regression evidence, not another provider evaluation.
function liveParticipationResult(kind:'listening'|'why',eventId:string){
 const raw=recordedJevResponse(kind==='listening'?'other':'question');
 if(kind==='listening'){
  raw.usage={input_tokens:1341,output_tokens:219};
  raw.answers.target={...raw.answers.target,confidence:.84,probabilities:{character:.87,activity:.1,other:0,quoted:0,unknown:.03}};
  raw.answers.act={...raw.answers.act,confidence:.96,probabilities:{...raw.answers.act.probabilities,other:.96,decline:.02,unknown:.02}};
  raw.answers.goal_relation={...raw.answers.goal_relation,confidence:.97,probabilities:{helps:0,blocks:.02,unrelated:.98,unknown:0}};
  raw.answers.strength={...raw.answers.strength,score:.67,confidence:.34,probabilities:{'0':.53,'1':.29,'2':.17,'3':.01}};
  raw.answers.hostility={...raw.answers.hostility,score:.27,confidence:.74,probabilities:{'0':.74,'1':.26,'2':0,'3':0}};
 }else{
  raw.usage={input_tokens:1331,output_tokens:219};
  raw.answers.target={...raw.answers.target,confidence:.97,probabilities:{character:.98,activity:.02,other:0,quoted:0,unknown:0}};
  raw.answers.act={...raw.answers.act,confidence:.91,probabilities:{...raw.answers.act.probabilities,question:.92,criticism:.07,teasing:.01}};
  raw.answers.goal_relation={...raw.answers.goal_relation,confidence:1};
  raw.answers.strength={...raw.answers.strength,score:1.29,confidence:.23,probabilities:{'0':.19,'1':.36,'2':.42,'3':.03}};
  raw.answers.hostility={...raw.answers.hostility,score:.77,confidence:.75,probabilities:{'0':.24,'1':.75,'2':.01,'3':0}};
 }
 const result=mapJevResponse(raw,eventId);
 // Preserve the actual historical v4 provenance of these recorded responses.
 result.metadata.promptVersion='jev-appraisal-v4';result.metadata.providerResult.mappingVersion='jev-appraisal-v4';return result;
}
async function liveParticipationInput(kind:'listening'|'why',identityId=IDENTITY_IDS[0],adjust?:(evaluation:AppraisalEvaluation)=>void){
 const text=kind==='listening'?'지금은 대답하지 말고 그냥 들어줘.':'왜 말 안 해?';
 const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId,text}),selected=(await store.select(accepted.eventId))!;
 const evaluation=liveParticipationResult(kind,accepted.eventId);adjust?.(evaluation);
 return {...await store.commitAppraisal(selected,evaluation.appraisal,evaluation.metadata),accepted,evaluation};
}
it('live J05: verified conversational evidence records listening with no output and no affect stimulus',async()=>{
 const before=(await store.state()).body,result=await liveParticipationInput('listening');
 expect(result.response).toBeNull();const state=await store.state(),record=state.body.turn.recentSilences[0];
 expect(record).toMatchObject({eventId:result.accepted.eventId,eventRevision:'1',identityId:IDENTITY_IDS[0],reason:'listening',sourceRefs:[{kind:'event',id:result.accepted.eventId,version:'1'}]});
 expect(state.body.affect).toEqual(before.affect);expect(state.body.mood).toEqual(before.mood);
 const saved=(await db.pool.query('SELECT result,provider_result FROM appraisals WHERE event_id=$1',[result.accepted.eventId])).rows[0];
 expect(saved.result).toMatchObject({uncertain:true,strength:0,hostility:0});expect(saved.provider_result).toEqual(result.evaluation.metadata.providerResult);
 expect((await db.pool.query('SELECT effects FROM transitions WHERE state_version=$1',[state.version.toString()])).rows[0].effects).toMatchObject({stimulus:0,category:null,participation:{mode:'silent',reason:'listening'}});
 expect((await db.pool.query('SELECT count(*) FROM response_runs')).rows[0].count).toBe('0');expect((await db.pool.query('SELECT count(*) FROM speech_segments')).rows[0].count).toBe('0');expect(await store.busy()).toBe(false);
});
it('live J06: reengagement uses its valid reason and preserves emotion through Stage ACK and topic change',async()=>{
 const first=await silence(),before=(await store.state()).body;now+=1000;
 const result=await liveParticipationInput('why');
 expect(result.response?.plan).toMatchObject({purpose:'reengage',reengagement:{silenceEventId:first.accepted.eventId,disclosure:'explain'}});
 expect((await store.responseContext(result.response!.id)).context.silence?.eventId).toBe(first.accepted.eventId);
 expect((await store.state()).body.affect).toEqual(decay(before,now).affect);expect((await store.state()).body.mood).toEqual(decay(before,now).mood);
 await complete(result.response!.id,'그때는 조금 불편해서 말하고 싶지 않았어.');
 now+=1000;const topic=await input('저녁으로 따뜻한 음식 하나 추천해줘.');await complete(topic.response!.id,'따뜻한 국수는 어때?');
 const after=(await store.state()).body;expect(after.affect).toEqual(decay(before,now).affect);expect(after.mood).toEqual(decay(before,now).mood);expect(after.turn.recentSilences).toEqual(before.turn.recentSilences);
 expect(result.evaluation.appraisal).toMatchObject({uncertain:true,strength:0,hostility:0});
});
it.each(['missing','other_identity','failed_output','invalidated_source'] as const)('live J06: %s reason cannot be invented or reused',async condition=>{
 let identityId=IDENTITY_IDS[0];
 if(condition!=='missing'){
  const first=await silence();now++;
  if(condition==='other_identity')identityId=IDENTITY_IDS[1];
  if(condition==='failed_output'){const response=(await input('다른 질문이야.')).response!;await store.failResponse(response.id,'fixture');}
  if(condition==='invalidated_source')await store.deleteEvent(first.accepted.eventId,'1',randomUUID());
 }
 const before=(await store.state()).body,result=await liveParticipationInput('why',identityId);
 expect(result.response?.plan).toMatchObject({purpose:'reengage',reengagement:{silenceEventId:null,disclosure:'unknown'}});
 expect((await store.responseContext(result.response!.id)).context.silence).toBeNull();expect((await store.state()).body.affect).toEqual(decay(before,now).affect);expect((await store.state()).body.mood).toEqual(decay(before,now).mood);
});
it('Jev target/act confidence at the unchanged .8 threshold permits only the explicit listening act',async()=>{
 const result=await liveParticipationInput('listening',IDENTITY_IDS[0],e=>{e.metadata.providerResult!.answers.target.confidence=.8;e.metadata.providerResult!.answers.act.confidence=.8;});
 expect(result.response).toBeNull();expect((await store.state()).body.turn.recentSilences[0].reason).toBe('listening');expect(result.evaluation.appraisal).toMatchObject({uncertain:true,strength:0,hostility:0});
});
it('Jev participation evidence rejects low confidence, ties, mismatches, unknown/quoted targets, failures and invalid raw metadata',async()=>{
 const changeChoice=(evaluation:AppraisalEvaluation,key:'target'|'act',choice:string)=>{const answer=evaluation.metadata.providerResult!.answers[key];answer.choice=choice;answer.confidence=.95;answer.probabilities=Object.fromEntries(Object.keys(answer.probabilities).map(name=>[name,name===choice?1:0]));};
 const cases:{name:string;adjust:(evaluation:AppraisalEvaluation)=>void}[]=[
  {name:'target below threshold',adjust:e=>{e.metadata.providerResult!.answers.target.confidence=.7999;}},
  {name:'act below threshold',adjust:e=>{e.metadata.providerResult!.answers.act.confidence=.7999;}},
  {name:'target tie',adjust:e=>{e.metadata.providerResult!.answers.target.probabilities={character:.5,activity:.5,other:0,quoted:0,unknown:0};}},
  {name:'act tie',adjust:e=>{e.metadata.providerResult!.answers.act.probabilities={...e.metadata.providerResult!.answers.act.probabilities,other:.5,question:.5,decline:0,unknown:0};}},
  {name:'target mismatch',adjust:e=>changeChoice(e,'target','quoted')},
  {name:'act mismatch',adjust:e=>changeChoice(e,'act','question')},
  ...(['quoted','other','unknown'] as const).map(target=>({name:`${target} target`,adjust:(e:AppraisalEvaluation)=>{e.appraisal.target=target;changeChoice(e,'target',target);}})),
  {name:'unknown act',adjust:e=>{e.appraisal.act='unknown';changeChoice(e,'act','unknown');}},
  {name:'failed provider',adjust:e=>{e.metadata.failureCode='jev_unavailable';}},
  {name:'different provider',adjust:e=>{e.metadata.provider='jev-mock';}},
  {name:'different model',adjust:e=>{e.metadata.model='unverified-model';}},
  {name:'missing raw usage',adjust:e=>{delete e.metadata.usage;}},
  {name:'missing raw result',adjust:e=>{Reflect.deleteProperty(e.metadata,'providerResult');}},
  {name:'different prompt version',adjust:e=>{e.metadata.promptVersion='unverified-version';}},
  {name:'different event reference',adjust:e=>{e.appraisal.evidence_refs=[randomUUID()];}},
  {name:'malformed score',adjust:e=>{e.metadata.providerResult!.answers.strength.score=3;}},
  {name:'malformed probabilities',adjust:e=>{e.metadata.providerResult!.answers.target.probabilities.character=.1;}},
 ];
 for(const item of cases){
  const result=await liveParticipationInput('listening',IDENTITY_IDS[0],item.adjust);
  // Unsupported evidence never grants the listening silence or affect. Invalid,
  // failed or merely uncertain provider output all get an ordinary reply.
  expect((await store.state()).body.turn.recentSilences,item.name).toEqual([]);
  const effects=(await db.pool.query('SELECT effects FROM transitions WHERE state_version=$1',[(await store.state()).version.toString()])).rows[0].effects;
  expect(effects,item.name).toMatchObject({stimulus:0,category:null});
  expect(effects.participation,item.name).toEqual({mode:'speak'});expect(result.response?.plan.purpose,item.name).toBe('other');await store.failResponse(result.response!.id,'fixture_no_stage');
 }
});
