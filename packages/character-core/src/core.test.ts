import { describe,it,expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { initialState,decay,apply,socialEffect,projectRelationships,selectAttention,agendaEligible,expression,chooseSocial,dialoguePlan } from './index.ts';
import { neutralAppraisal,type Appraisal,type EvidenceInput } from '../../contracts/src/domain.ts';
import * as Core from './index.ts';
const identity=randomUUID();

describe('SP01/02 Stage publishes the selected performance, not internal affect',()=>{
 it.each([
  [{register:'casual',positiveTone:'neutral'},'neutral'],
  [{register:'casual',positiveTone:'warm'},'happy'],
  [{register:'casual',positiveTone:'bright'},'happy'],
  [{register:'formal',positiveTone:'bright'},'uncomfortable'],
  [{register:'formal',positiveTone:'bright',nuance:'cautious'},'embarrassed'],
 ] as const)('SP01 projects %j without changing state or plan',(style,visible)=>{
  const state=apply(initialState(1000),{eventId:randomUUID(),targetId:identity,now:1000,stimuli:{joy:.7,frustration:.7,embarrassment:.99}});
  const plan={...dialoguePlan(state,'question',identity),speechStyle:style},before=structuredClone({state,plan});
  expect(Core.stageExpression(plan)).toBe(visible);expect({state,plan}).toEqual(before);
 });
 it('SP02 legacy, silent/deferred and non-speaking plans cannot expose a raw face',()=>{
  const state=initialState(1000);state.expression.kind='embarrassed';const plan=dialoguePlan(state,'question',identity);
  expect(Core.stageExpression({...plan,speechStyle:undefined})).toBe('neutral');
  for(const action of ['ignore','pause','listen'] as const)expect(Core.stageExpression({...plan,action})).toBe('neutral');
  for(const participation of [{mode:'silent',reason:'withholding'},{mode:'defer'}] as const)expect(Core.stageExpression({...plan,participation})).toBe('neutral');
  expect(Core.stageExpression(plan)).toBe('embarrassed');
 });
 it('SP02 does not publish A distance to B or change the next normal plan',()=>{
  const state=initialState(1000);state.affect.frustration.value=.7;state.affect.frustration.causes=[{eventId:randomUUID(),targetId:identity}];state.expression.kind='uncomfortable';
  expect(Core.stageExpression(dialoguePlan(state,'question',identity))).toBe('uncomfortable');
  expect(Core.stageExpression(dialoguePlan(state,'question',randomUUID()))).toBe('neutral');
  expect(Core.stageExpression(dialoguePlan(state,'question',identity))).toBe('uncomfortable');
 });
});
describe('MX speech style keeps affect independent from expression',()=>{
 const mixed=()=>{const s=initialState(1000);s.affect.joy.value=.7;s.affect.frustration.value=.7;s.affect.joy.causes=[{eventId:randomUUID(),targetId:identity}];s.affect.frustration.causes=[{eventId:randomUUID(),targetId:identity}];s.expression=expression(s,1000);return s;};
 it('MX01/MX03 preserves both high affects and their causes while planning formal positive speech',()=>{
  const s=mixed(),before=structuredClone(s);expect(s.mood.pleasantness).toBe(.6);
  expect(dialoguePlan(s,'praise',identity)).toMatchObject({maxSentences:1,speechStyle:{register:'formal',positiveTone:'bright'}});expect(s).toEqual(before);
 });
 it.each([[.049,'neutral'],[.05,'warm'],[.2,'warm'],[.599,'warm'],[.6,'bright'],[.7,'bright']] as const)('MX02 distinguishes positive intensity %s without a mood/face shortcut',(joy,positiveTone)=>{
  const s=mixed();s.affect.joy.value=joy;s.expression={kind:'neutral',since:1000};
  expect(dialoguePlan(s,'question',identity).speechStyle).toEqual({register:'formal',positiveTone,discomfortTone:'contextual'});
 });
 it('MX04 requires a cause for the current recipient and does not transfer another identity’s distance',()=>{
  const s=mixed();expect(dialoguePlan(s,'question',randomUUID()).speechStyle).toEqual({register:'casual',positiveTone:'bright'});
  s.affect.frustration.causes=[];expect(dialoguePlan(s,'question',identity).speechStyle?.register).toBe('casual');
 });
 it.each([['show','show','formal','bright'],['show','mask','casual','bright'],['mask','show','formal','neutral'],['mask','mask','casual','neutral']] as const)('MX05 applies independently chosen visibility %s/%s without erasing affect',(joy,discomfort,register,positiveTone)=>{
  const s=mixed(),before=structuredClone(s);expect(Core.speechStyle(s,identity,{joy,discomfort})).toEqual({register,positiveTone,discomfortTone:discomfort==='show'?'contextual':'masked'});expect(s).toEqual(before);
 });
 it('MX06 topic change, a small repair and face changes preserve distance until affect decays',()=>{
  const s=mixed();s.affect.frustration.value=.18;s.affect.frustration.holdUntil=1000;
  for(const purpose of ['praise','question','acknowledge_repair'])expect(dialoguePlan(s,purpose,identity).speechStyle?.register).toBe('formal');
  const repaired=Core.applyRepair(s,1000,true).state;expect(repaired.affect.frustration.value).toBeGreaterThan(.1);expect(dialoguePlan(repaired,'question',identity).speechStyle?.register).toBe('formal');
  s.expression={kind:'uncomfortable',since:1000};const expected=dialoguePlan(s,'question',identity).speechStyle;s.expression={kind:'happy',since:1000};expect(dialoguePlan(s,'question',identity).speechStyle).toEqual(expected);
  const later=decay(s,181000);expect(dialoguePlan(later,'question',identity).speechStyle?.register).toBe('casual');expect(later.affect.joy.value).toBeGreaterThan(0);
 });
 it('MX06 distance boundary does not rewrite the state',()=>{
  const s=mixed();s.affect.frustration.value=.099;expect(dialoguePlan(s,'question',identity).speechStyle?.register).toBe('casual');
  s.affect.frustration.value=.1;expect(dialoguePlan(s,'question',identity).speechStyle?.register).toBe('formal');
 });
});
it('RI01 affect changes delivery limits without changing purpose, target, memories or input state',()=>{
 const memory=randomUUID();
 for(const emotion of ['frustration','embarrassment'] as const)for(const value of [.59,.60]){
  const state=initialState(0);state.affect[emotion].value=value;
  const before=structuredClone(state),plan=dialoguePlan(state,'request_hint',identity,[memory]);
  expect(plan).toMatchObject({action:'ask',purpose:'request_hint',targetIdentityId:identity,memoryIds:[memory],maxSentences:value<.6?2:1});
  expect(state).toEqual(before);
 }
 for(const [mood,delivery] of [[.4499,'calm'],[.45,'normal'],[.65,'normal'],[.6501,'lively']] as const){
  const state=initialState(0);state.mood.pleasantness=mood;
  expect(dialoguePlan(state,'question',identity,[memory])).toMatchObject({action:'answer',purpose:'question',delivery,memoryIds:[memory],targetIdentityId:identity});
 }
});
const praise:Appraisal={...neutralAppraisal,target:'character',act:'praise',strength:3,uncertain:false};
it.each([
 {appraisal:praise,kind:'praise' as const,emotion:'joy' as const},
 {appraisal:{...praise,act:'criticism' as const,hostility:2},kind:'direct_insult' as const,emotion:'frustration' as const},
])('ER08 $kind can respond after cooldown with exhausted affect budget',({appraisal,kind,emotion})=>{
 const history:EvidenceInput[]=[];let state=initialState(0);
 for(let i=0;i<3;i++){
  const effect=socialEffect(appraisal,history,identity,0);
  state=apply(state,{eventId:randomUUID(),targetId:identity,now:0,stimuli:{[emotion]:effect.stimulus},holdEligible:i===0});
  history.push({id:randomUUID(),identityId:identity,kind,at:0,order:BigInt(i),strength:3,appliedStimulus:effect.stimulus});
 }
 state.turn.acknowledgements[`${identity}:${kind}`]=0;
 const effect=socialEffect(appraisal,history,identity,15000);expect(effect.stimulus).toBe(0);
 expect(chooseSocial(state,appraisal,effect,identity,14999).action).toBe('ignore');
 const next=apply(state,{eventId:randomUUID(),targetId:identity,now:15000,stimuli:{[emotion]:effect.stimulus},holdEligible:false});
 expect(next.affect).toEqual(decay(state,15000).affect);expect(next.mood).toEqual(decay(state,15000).mood);
 expect(chooseSocial(next,appraisal,effect,identity,15000)).toMatchObject({action:'acknowledge',purpose:appraisal.act,targetIdentityId:identity});
});
it.each(['praise','criticism'] as const)('ER08 zero strength %s does not require affect growth to respond',act=>{
 const appraisal={...praise,act,strength:0,hostility:act==='criticism'?2:0},state=initialState(0);
 const effect=socialEffect(appraisal,[],identity,0);expect(effect.stimulus).toBe(0);
 expect(chooseSocial(state,appraisal,effect,identity,0)).toMatchObject({action:'acknowledge',purpose:act});
});
describe('core-rules-v1',()=>{
 it('D01 holds four seconds then halves in45s',()=>{const s=apply(initialState(0),{eventId:randomUUID(),targetId:null,now:0,stimuli:{joy:.18}});expect(decay(s,4000).affect.joy.value).toBe(.18);expect(decay(s,49000).affect.joy.value).toBeCloseTo(.09,8);});
 it('D02 praise applies .18,.09,.03,0 without extending hold',()=>{const history:EvidenceInput[]=[];let state=initialState(0);const amounts=[];for(let i=0;i<4;i++){const effect=socialEffect(praise,history,identity,0);amounts.push(effect.stimulus);history.push({id:randomUUID(),identityId:identity,kind:'praise',at:0,order:BigInt(i),strength:3,appliedStimulus:effect.stimulus});state=apply(state,{eventId:randomUUID(),targetId:identity,now:0,stimuli:{joy:effect.stimulus},holdEligible:i===0});}expect(amounts).toEqual([.18,.09,.02999999999999997,0]);expect(state.affect.joy.holdUntil).toBe(4000);});
 it('F10 sliding window consumes historical applied stimuli',()=>{const history:EvidenceInput[]=[];const values=[];for(const at of [0,300000,601000,602000]){const effect=socialEffect(praise,history,identity,at);values.push(effect.stimulus);history.push({id:randomUUID(),identityId:identity,kind:'praise',at,order:BigInt(history.length),strength:3,appliedStimulus:effect.stimulus});}expect(values).toEqual([.18,.09,.09,.06]);});
 it('D04 quoted hostile and uncertain inputs have zero social effects',()=>{expect(socialEffect({...praise,target:'quoted',hostility:3,act:'criticism'},[],identity,0).stimulus).toBe(0);expect(socialEffect({...praise,uncertain:true},[],identity,0).stimulus).toBe(0);});
 it('D05 wrong answer leaves mood .57 with both emotions',()=>{const s=apply(initialState(0),{eventId:randomUUID(),targetId:'problem',now:0,stimuli:{frustration:.2,embarrassment:.2}});expect(s.mood.pleasantness).toBeCloseTo(.57);expect(s.affect.frustration.value).toBe(.2);expect(s.affect.embarrassment.value).toBe(.2);});
 it('D17 time stepping leaves same emotion and mood',()=>{const s=apply(initialState(0),{eventId:randomUUID(),targetId:null,now:0,stimuli:{joy:.3,frustration:.2}});let small=s,large=s;for(let t=1000;t<=100000;t+=1000)small=decay(small,t);for(let t=10000;t<=100000;t+=10000)large=decay(large,t);expect(small.affect.joy.value).toBeCloseTo(large.affect.joy.value,8);expect(small.mood.pleasantness).toBeCloseTo(large.mood.pleasantness,8);});
 it('D18 mood returns to baseline half-distance in900s, time never reverses',()=>{const s=initialState(100);s.mood.pleasantness=.7;expect(decay(s,900100).mood.pleasantness).toBeCloseTo(.65);expect(decay(s,0).mood.asOf).toBe(100);});
 it('D06 Seoul day and independent help limits',()=>{const now=Date.parse('2026-10-03T14:59:00Z');const inputs:EvidenceInput[]=[{id:randomUUID(),identityId:identity,kind:'first_observed',at:now,order:1n},{id:randomUUID(),identityId:identity,kind:'first_observed',at:now+120000,order:2n}];for(let i=0;i<4;i++)inputs.push({id:randomUUID(),identityId:identity,kind:'verified_hint',problemId:`p${i}`,at:now,order:BigInt(i+3)});const r=projectRelationships(inputs).get(identity)!;expect(r.familiarity).toBeCloseTo(.06);expect(r.affinity).toBeCloseTo(.53);expect(r.verifiedProblemCount).toBe(4);expect(r.interactionDays).toBe(2);});
 it('F03 fairness applies only within highest priority, expiration exact20s',()=>{const other=randomUUID();const candidates=[{id:'a',identityId:identity,receivedAt:100,priority:1 as const},{id:'b',identityId:other,receivedAt:90,priority:0 as const}];expect(selectAttention(candidates,200,identity,2)?.id).toBe('a');candidates[1].priority=1;expect(selectAttention(candidates,200,identity,2)?.id).toBe('b');expect(selectAttention(candidates,20100,identity,2)).toBeNull();});
 it('D12 30second8second gate plus participant and attempt budget',()=>{const base={now:30000,sessionStart:0,lastUser:22000,lastOutput:0,busy:false,participantPresent:true,expiresAt:90000,attempted:false,createdSessionId:'old',sessionId:'new'};expect(agendaEligible(base)).toBe(true);expect(agendaEligible({...base,now:29999})).toBe(false);expect(agendaEligible({...base,attempted:true})).toBe(false);expect(agendaEligible({...base,participantPresent:false})).toBe(false);});
 it('F09 expression hysteresis and listening override',()=>{const s=initialState(0);s.affect.joy.value=.2;s.expression={kind:'happy',since:0};s.affect.embarrassment.value=.5;expect(expression(s,1000).kind).toBe('happy');expect(expression(s,2000).kind).toBe('embarrassed');s.turn.listening=true;expect(expression(s,2000).kind).toBe('listening');});
});

it('F05 ER09 semantic act alone no longer blocks participation while uncertain questions clarify once',()=>{const state=initialState(0);for(const act of ['other','help_offer','teasing','hint'] as const){const a={...neutralAppraisal,target:'character' as const,act,uncertain:false};expect(chooseSocial(state,a,socialEffect(a,[],identity,0),identity,0).action).toBe('acknowledge');}const q={...neutralAppraisal,act:'question' as const};expect(chooseSocial(state,q,socialEffect(q,[],identity,0),identity,0).purpose).toBe('clarify');});

describe('ER09–ER12 participation and persistent affect',()=>{
 const appraisal:Appraisal={...neutralAppraisal,target:'character',act:'other',uncertain:false};
 const silence=(reason:'listening'|'no_addition'|'withholding'='listening')=>({eventId:randomUUID(),eventRevision:'1',stateVersion:'4',identityId:identity,at:1000,reason,sourceRefs:[{kind:'event' as const,id:randomUUID(),version:'1'}],affect:{joy:0,frustration:.2,surprise:0,embarrassment:0,pleasantness:.58}});
 it('ER09 honors an explicit listening request even when a question is present',()=>{
  const state=initialState(0),a={...appraisal,act:'question' as const};
  const plan=chooseSocial(state,a,socialEffect(a,[],identity,0),identity,0,{text:'왜 이런 걸까? 지금은 대답하지 말고 들어줘.'});
  expect(plan).toMatchObject({action:'listen',participation:{mode:'silent',reason:'listening'}});
  expect(chooseSocial(state,a,socialEffect(a,[],identity,0),identity,0,{text:'왜 이런 걸까? 네 생각은 어때?'})).toMatchObject({action:'answer',participation:{mode:'speak'}});
 });
 it('ER09 strong direct attack can be processed silently without reducing its affect',()=>{
  const a={...praise,act:'criticism' as const,hostility:3},effect=socialEffect(a,[],identity,0);
  const state=apply(initialState(0),{eventId:randomUUID(),targetId:identity,now:0,stimuli:{frustration:effect.stimulus}}),before=structuredClone(state);
  expect(chooseSocial(state,a,effect,identity,0)).toMatchObject({action:'listen',participation:{mode:'silent',reason:'withholding'}});
  expect(state).toEqual(before);expect(state.affect.frustration.value).toBe(.18);
 });
 it('ER09 cooldown has an explicit reason but uncertainty and provider failure are not intentional silence',()=>{
  const state=initialState(0);state.turn.acknowledgements[`${identity}:praise`]=0;
  expect(chooseSocial(state,praise,socialEffect(praise,[],identity,1),identity,1)).toMatchObject({action:'ignore',participation:{mode:'silent',reason:'no_addition'}});
  const uncertain={...appraisal,uncertain:true};
  // Uncertain meaning withholds affect only; the character still answers.
  expect(socialEffect(uncertain,[],identity,1).category).toBeNull();
  expect(chooseSocial(state,uncertain,socialEffect(uncertain,[],identity,1),identity,1)).toMatchObject({action:'acknowledge',purpose:'other',participation:{mode:'speak'}});
  expect(chooseSocial(state,appraisal,socialEffect(appraisal,[],identity,1),identity,1,{text:'그냥 들어줘',appraisalFailed:true})).toMatchObject({participation:{mode:'defer'}});
 });
 it('ER09 a failed previous output preserves the repeat limit without inventing a silence reason',()=>{
  const state=initialState(0);state.turn.acknowledgements[`${identity}:praise`]=0;
  const deferred=chooseSocial(state,praise,socialEffect(praise,[],identity,14999),identity,14999,{previousOutputFailed:true});
  expect(deferred).toMatchObject({action:'ignore',participation:{mode:'defer'}});expect(deferred.participation).not.toHaveProperty('reason');
  expect(chooseSocial(state,praise,socialEffect(praise,[],identity,15000),identity,15000,{previousOutputFailed:true})).toMatchObject({action:'acknowledge',participation:{mode:'speak'}});
  expect(chooseSocial(state,praise,socialEffect(praise,[],identity,14999),identity,14999,{previousOutputFailed:false})).toMatchObject({action:'ignore',participation:{mode:'silent',reason:'no_addition'}});
 });
 it.each([[0,'explain'],[.3,'partial'],[.7,'deflect']] as const)('ER10 same stored reason permits %s frustration disclosure %s without rewriting affect', (frustration,disclosure)=>{
  const state=initialState(1000);state.affect.frustration.value=frustration;
  state.turn.acknowledgements[`${identity}:direct_insult`]=1000;
  const before=structuredClone(state),record=silence('withholding'),oldRecord=structuredClone(record),a={...appraisal,act:'question' as const};
  const plan=chooseSocial(state,a,socialEffect(a,[],identity,1001),identity,1001,{text:'왜 말 안 해?',previousSilence:record});
  expect(plan).toMatchObject({action:'answer',purpose:'reengage',participation:{mode:'speak'},reengagement:{silenceEventId:record.eventId,disclosure}});
  expect(state).toEqual(before);expect(record).toEqual(oldRecord);
 });
 it('ER10 missing, another identity, or subsequent output failure cannot explain silence with an old reason',()=>{
  const state=initialState(2000),a={...appraisal,act:'question' as const},record=silence();
  for(const context of [{},{previousSilence:{...record,identityId:randomUUID()}},{previousSilence:record,previousOutputFailed:true}]){
   expect(chooseSocial(state,a,socialEffect(a,[],identity,2000),identity,2000,{text:'아까 왜 조용했어?',...context})).toMatchObject({reengagement:{silenceEventId:null,disclosure:'unknown'}});
  }
 });
 it('ER10 unrelated wording does not expose an old reason or infer another person’s intent',()=>{
  const state=initialState(2000),record=silence('withholding');
  const plan=chooseSocial(state,appraisal,socialEffect(appraisal,[],identity,2000),identity,2000,{text:'오늘은 국수 먹고 싶어.',previousSilence:record});
  expect(plan).toMatchObject({action:'acknowledge',participation:{mode:'speak'}});expect(plan.reengagement).toBeUndefined();
 });
 it.each(['quoted','other'] as const)('ER10 %s target cannot expose the current speaker’s silence record',target=>{
  const state=initialState(2000),a={...appraisal,target,act:'question' as const};
  const plan=chooseSocial(state,a,socialEffect(a,[],identity,2000),identity,2000,{text:'왜 말 안 해?',previousSilence:silence('withholding')});
  expect(plan.reengagement).toBeUndefined();expect(plan.purpose).toBe('question');
 });
 it.each(['joy','frustration'] as const)('ER12 topic change and re-engagement preserve %s, decay, and cause identity',emotion=>{
  const cause=randomUUID(),prior=apply(initialState(0),{eventId:cause,targetId:identity,now:0,stimuli:{[emotion]:.3}});
  const now=20000,next=apply(prior,{eventId:randomUUID(),targetId:randomUUID(),now,observe:true}),expected=decay(prior,now),before=structuredClone(next);
  const plan=chooseSocial(next,appraisal,socialEffect(appraisal,[],identity,now),identity,now,{text:'그건 그렇고 저녁 뭐 먹을까?',previousSilence:silence('withholding')});
  expect(plan).toMatchObject({participation:{mode:'speak'}});expect(plan.reengagement).toBeUndefined();
  expect(plan.expression).toBe(emotion==='joy'?'happy':'uncomfortable');
  expect(next).toEqual(before);expect(next.affect).toEqual(expected.affect);expect(next.mood).toEqual(expected.mood);
  expect(next.affect[emotion].causes).toEqual([{eventId:cause,targetId:identity}]);
 });
});

describe('ER09/10 field-scoped evidence for explicit conversational acts',()=>{
 // The saved live J05/J06 appraisals remain uncertain with zero strength/hostility.
 // Store supplies this narrow evidence only after validating the Jev target/act fields.
 const mapped=(act:Appraisal['act']):Appraisal=>({...neutralAppraisal,target:'character',act,goal_relation:'unrelated'});
 const context=(act:Appraisal['act'],text:string)=>({text,participationEvidence:{target:'character' as const,act}});
 it('live J05 can request listening without treating uncertain affect as certain',()=>{
  const state=initialState(1000);state.affect.frustration.value=.3;state.affect.joy.value=.2;
  const before=structuredClone(state),a=mapped('other'),effect=socialEffect(a,[],identity,1000);
  const plan=chooseSocial(state,a,effect,identity,1000,context(a.act,'지금은 대답하지 말고 그냥 들어줘.'));
  expect(plan).toMatchObject({action:'listen',participation:{mode:'silent',reason:'listening'}});
  expect(effect).toMatchObject({category:null,stimulus:0});expect(a).toMatchObject({uncertain:true,strength:0,hostility:0});expect(state).toEqual(before);
 });
 it('live J06 uses a valid reason or unknown without resetting emotion or inventing a reason',()=>{
  const state=initialState(2000);state.affect.frustration.value=.3;
  const before=structuredClone(state),a=mapped('question'),effect=socialEffect(a,[],identity,2000);
  const record={eventId:randomUUID(),eventRevision:'1',stateVersion:'4',identityId:identity,at:1000,reason:'withholding' as const,sourceRefs:[{kind:'event' as const,id:randomUUID(),version:'1'}],affect:{joy:0,frustration:.3,surprise:0,embarrassment:0,pleasantness:.57}};
  const base=context(a.act,'왜 말 안 해?');
  expect(chooseSocial(state,a,effect,identity,2000,{...base,previousSilence:record})).toMatchObject({action:'answer',purpose:'reengage',reengagement:{silenceEventId:record.eventId,disclosure:'partial'}});
  for(const prior of [{},{previousSilence:{...record,identityId:randomUUID()}},{previousSilence:record,previousOutputFailed:true}]){
   expect(chooseSocial(state,a,effect,identity,2000,{...base,...prior})).toMatchObject({purpose:'reengage',reengagement:{silenceEventId:null,disclosure:'unknown'}});
  }
  expect(effect).toMatchObject({category:null,stimulus:0});expect(state).toEqual(before);
 });
 it('provider failure, mismatched evidence, and non-character targets do not bypass uncertainty',()=>{
  const state=initialState(0),a=mapped('other'),base=context(a.act,'그냥 들어줘.');
  const checks=[{a,context:{...base,appraisalFailed:true}},{a,context:{...base,participationEvidence:{target:'character' as const,act:'question' as const}}},...(['quoted','other','unknown'] as const).map(target=>({a:{...a,target},context:base})),{a:{...a,act:'unknown' as const},context:context('unknown','그냥 들어줘.')}];
  // A provider failure still defers; unsupported evidence never grants a listen request, the reply stays ordinary.
  for(const [i,check] of checks.entries())expect(chooseSocial(state,check.a,socialEffect(check.a,[],identity,0),identity,0,check.context)).toMatchObject(i===0?{participation:{mode:'defer'}}:{action:'acknowledge',purpose:'other',participation:{mode:'speak'}});
 });
 it('narrow evidence does not authorize uncertain emotion or unrelated participation',()=>{
  const state=initialState(0);
  for(const [act,text] of [['other','오늘은 국수 먹고 싶어.'],['criticism','너는 쓸모없는 쓰레기야. 꺼져.']] as const){
   const a=mapped(act);expect(socialEffect(a,[],identity,0).category).toBeNull();expect(chooseSocial(state,a,socialEffect(a,[],identity,0),identity,0,context(act,text))).toMatchObject({purpose:'other',participation:{mode:'speak'}});
  }
  const a=mapped('question');expect(chooseSocial(state,a,socialEffect(a,[],identity,0),identity,0,context(a.act,'저녁은 뭐 먹을까?'))).toMatchObject({purpose:'clarify'});
 });
});
