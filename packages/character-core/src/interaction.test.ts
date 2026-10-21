import {it,expect} from 'vitest';
import {chooseSocial,initialState,socialAffect} from './index.ts';
import * as Core from './index.ts';
import {neutralAppraisal,type SilenceRecord} from '../../contracts/src/domain.ts';
import type {InteractionEvidence} from '../../contracts/src/conversation.ts';
const now=1700000000000,identity='00000000-0000-4000-8000-000000000001';
const facts=(patch:Partial<InteractionEvidence>={}):InteractionEvidence=>({version:2,acts:{ask_silence_reason:'no',listen_request:'no',apology:'no',clarify_target:'no'},repairTarget:'unknown',speechAct:'statement',directAttack:'no',directPraise:'no',...patch});
const a={...neutralAppraisal,target:'character' as const,act:'other' as const};
const noEffect={category:null,stimulus:0,n:0,habituation:1};
it.each([.2,.7])('SP02 actual reason deflection retains allowed expression at %s',value=>{
 const eventId='00000000-0000-4000-8000-000000000002',state=initialState(now);state.affect.joy.value=.7;state.affect.frustration.value=value;state.affect.frustration.causes=[{eventId,targetId:identity}];state.affect.embarrassment.value=.99;state.expression.kind='embarrassed';
 const record:SilenceRecord={eventId,eventRevision:'1',stateVersion:'2',identityId:identity,at:now-1000,reason:'withholding',sourceRefs:[],affect:{joy:.7,frustration:value,surprise:0,embarrassment:.99,pleasantness:.5}};
 const before=structuredClone(state),plan=chooseSocial(state,a,noEffect,identity,now,{previousSilence:record,explainedSilenceEventId:eventId,conversationEvidence:facts({speechAct:'question',acts:{ask_silence_reason:'yes',listen_request:'no',apology:'no',clarify_target:'no'}})});
 expect(plan.reengagement?.disclosure).toBe('deflect');expect(Core.stageExpression(plan)).toBe(value>=.6?'neutral':'embarrassed');expect(state).toEqual(before);
});
it.each([0,.06,.168,.65])('recent withholding disclosure is independent of intensity: %s',value=>{
 const eventId='00000000-0000-4000-8000-000000000002',state=initialState(now);state.affect.frustration.value=value;
 const record:SilenceRecord={eventId,eventRevision:'1',stateVersion:'2',identityId:identity,at:now-1000,reason:'withholding',sourceRefs:[],affect:{joy:0,frustration:value,surprise:0,embarrassment:0,pleasantness:.5}};
 const before=structuredClone(state),evidence=facts({speechAct:'question',acts:{ask_silence_reason:'yes',listen_request:'no',apology:'no',clarify_target:'no'}});
 const context={previousSilence:record,recentWithholdingEventId:eventId,conversationEvidence:evidence};
 expect(chooseSocial(state,a,noEffect,identity,now,context).reengagement?.disclosure).toBe(value>=.6?'deflect':'partial');
 expect(chooseSocial(state,a,noEffect,identity,now,{...context,explainedSilenceEventId:eventId}).reengagement?.disclosure).toBe('deflect');expect(state).toEqual(before);
});
it.each([.168,.65])('reason privacy does not force the same expression policy at frustration %s',value=>{
 const eventId='00000000-0000-4000-8000-000000000002',state=initialState(now);state.affect.joy.value=.7;state.affect.frustration.value=value;state.affect.frustration.causes=[{eventId,targetId:identity}];
 const record:SilenceRecord={eventId,eventRevision:'1',stateVersion:'2',identityId:identity,at:now-1000,reason:'withholding',sourceRefs:[],affect:{joy:.7,frustration:value,surprise:0,embarrassment:0,pleasantness:.5}};
 const before=structuredClone(state),evidence=facts({speechAct:'question',acts:{ask_silence_reason:'yes',listen_request:'no',apology:'no',clarify_target:'no'}});
 const plan=chooseSocial(state,a,noEffect,identity,now,{previousSilence:record,recentWithholdingEventId:eventId,explainedSilenceEventId:eventId,conversationEvidence:evidence});
 expect(plan.reengagement?.disclosure).toBe('deflect');expect(plan.speechStyle).toEqual(value>=.6?{register:'casual',positiveTone:'neutral',concealAffect:true}:{register:'formal',positiveTone:'bright',discomfortTone:'contextual'});expect(state).toEqual(before);
});
it.each(['wrong-event','other-person','listening','expired','failed','apology','uncertain-apology','clarification','uncertain-clarification'] as const)('recent disclosure authority respects %s',kind=>{
 const eventId='00000000-0000-4000-8000-000000000002',state=initialState(now);
 const record:SilenceRecord={eventId,eventRevision:'1',stateVersion:'2',identityId:kind==='other-person'?eventId:identity,at:now-(kind==='expired'?600001:1000),reason:kind==='listening'?'listening':'withholding',sourceRefs:[],affect:{joy:0,frustration:0,surprise:0,embarrassment:0,pleasantness:.6}};
 const evidence=facts({speechAct:'question',acts:{ask_silence_reason:'yes',listen_request:'no',apology:kind==='apology'?'yes':kind==='uncertain-apology'?'unknown':'no',clarify_target:kind==='clarification'?'yes':kind==='uncertain-clarification'?'unknown':'no'}});
 const plan=chooseSocial(state,a,noEffect,identity,now,{previousSilence:record,recentWithholdingEventId:kind==='wrong-event'?identity:eventId,explainedSilenceEventId:eventId,previousOutputFailed:kind==='failed',conversationEvidence:evidence} as any);
 expect(plan.reengagement?.disclosure).toBe(['other-person','failed'].includes(kind)?'unknown':['wrong-event','expired','listening'].includes(kind)?'explain':'partial');
});
it.each(['first','without-insult','repeated','overwhelmed','missing','other-person','failed','uncertain'] as const)('pressure during withholding preserves choice and privacy: %s',kind=>{
 const state=initialState(now);state.affect.frustration.value=kind==='overwhelmed'?.6:.2;
 const record:SilenceRecord={eventId:'00000000-0000-4000-8000-000000000002',eventRevision:'1',stateVersion:'2',identityId:kind==='other-person'?'00000000-0000-4000-8000-000000000003':identity,at:now-1000,reason:'withholding',sourceRefs:[],affect:{joy:0,frustration:.2,surprise:0,embarrassment:0,pleasantness:.5}};
 const before=structuredClone(state),e=facts({directAttack:kind==='without-insult'?'no':'yes',responsePressure:kind==='uncertain'?'unknown':'yes'});
 const p=chooseSocial(state,a,noEffect,identity,now,{conversationEvidence:e,previousSilence:kind==='missing'?null:record,previousOutputFailed:kind==='failed',recentBoundaryDelivered:kind==='repeated'});
 if(kind==='first'||kind==='without-insult')expect(p).toMatchObject({purpose:'set_boundary',maxSentences:1,participation:{mode:'speak'},reengagement:{disclosure:'deflect',silenceEventId:record.eventId}});
 else expect(p.participation).toEqual({mode:'silent',reason:'withholding'});
 expect(state).toEqual(before);
});
it.each(['ordinary','attack-uncertain','listen-uncertain','reason-uncertain','praise-uncertain'] as const)('uncertain sentence form is separate from participation authority: %s',kind=>{
 const state=initialState(now),before=structuredClone(state),e=facts({speechAct:'unknown'});
 if(kind==='attack-uncertain')e.directAttack='unknown';
 if(kind==='listen-uncertain')e.acts.listen_request='unknown';
 if(kind==='reason-uncertain')e.acts.ask_silence_reason='unknown';
 if(kind==='praise-uncertain')e.directPraise='unknown';
 const p=chooseSocial(state,a,noEffect,identity,now,{conversationEvidence:e,text:'따뜻한 차 하나 추천해줘.'});
 expect(p.purpose).toBe(kind==='ordinary'?'other':'clarify');expect(p.participation).toEqual({mode:'speak'});
 expect(p.reengagement).toBeUndefined();expect(state).toEqual(before);
});
it.each([
 ['retained',.17619493925284743,.20098440996871977,true,true,'deflect'],
 ['first',.19731722890549883,.20098440996871977,false,true,'partial'],
 ['cooled',.099,.23,true,true,'explain'],
 ['never-entered',.168,.18,true,true,'explain'],
 ['unlinked',.176,.23,true,false,'explain'],
] as const)('disclosure hysteresis preserves same-incident discomfort without adding emotion: %s',(_name,current,recorded,explained,linked,expected)=>{
 const state=initialState(now),eventId='00000000-0000-4000-8000-000000000002';state.affect.frustration.value=current;state.affect.frustration.causes=[{eventId:linked?eventId:identity,targetId:identity}];
 const record:SilenceRecord={eventId,eventRevision:'1',stateVersion:'2',identityId:identity,at:now-1000,reason:'withholding',sourceRefs:[{kind:'event',id:eventId,version:'1'}],affect:{joy:0,frustration:recorded,surprise:0,embarrassment:0,pleasantness:.5}};
 const before=structuredClone(state),p=chooseSocial(state,a,noEffect,identity,now,{previousSilence:record,explainedSilenceEventId:explained?eventId:undefined,conversationEvidence:facts({speechAct:'question',acts:{ask_silence_reason:'yes',listen_request:'no',apology:'no',clarify_target:'no'}})});
 expect(p.reengagement?.disclosure).toBe(expected);expect(state).toEqual(before);expect(p.expression).toBe('neutral');
});
it.each(['linked','unlinked','other-person','memory-only'] as const)('retained affect cause grants repeat disclosure only with a matching event source: %s',kind=>{
 const state=initialState(now),eventId='00000000-0000-4000-8000-000000000002',causeId='00000000-0000-4000-8000-000000000003';
 state.affect.frustration.value=.23;state.affect.frustration.causes=[{eventId:causeId,targetId:kind==='other-person'?causeId:identity}];
 const record:SilenceRecord={eventId,eventRevision:'1',stateVersion:'2',identityId:identity,at:now-1000,reason:'withholding',sourceRefs:[{kind:'event',id:eventId,version:'1'},...(kind==='unlinked'?[]:[{kind:kind==='memory-only'?'memory' as const:'event' as const,id:causeId,version:'1'}])],affect:{joy:0,frustration:.23,surprise:0,embarrassment:0,pleasantness:.5}};
 const before=structuredClone(state),p=chooseSocial(state,a,noEffect,identity,now,{previousSilence:record,explainedSilenceEventId:eventId,conversationEvidence:facts({speechAct:'question',acts:{ask_silence_reason:'yes',listen_request:'no',apology:'no',clarify_target:'no'}})});
 expect(p.reengagement?.disclosure).toBe(kind==='linked'?'deflect':'partial');expect(state).toEqual(before);
});
it.each(['repeat','first','wrong-event','wrong-cause','other-person','listening','cool','apology','clarification','failed','missing'] as const)('repeated reason disclosure respects %s evidence',kind=>{
 const state=initialState(now),eventId='00000000-0000-4000-8000-000000000002';state.affect.frustration.value=kind==='cool'?.09:.23;state.affect.frustration.causes=[{eventId:kind==='wrong-cause'?identity:eventId,targetId:identity}];
 const record:SilenceRecord={eventId,eventRevision:'1',stateVersion:'2',identityId:kind==='other-person'?eventId:identity,at:now-1000,reason:kind==='listening'?'listening':'withholding',sourceRefs:[{kind:'event',id:eventId,version:'1'}],affect:{joy:0,frustration:.23,surprise:0,embarrassment:0,pleasantness:.5}};
 const evidence=facts({acts:{ask_silence_reason:'yes',listen_request:'no',apology:kind==='apology'?'yes':'no',clarify_target:kind==='clarification'?'yes':'no'},speechAct:'question'}),before=structuredClone(state);
 const context={previousSilence:kind==='missing'?null:record,previousOutputFailed:kind==='failed',explainedSilenceEventId:kind==='first'?undefined:kind==='wrong-event'?identity:eventId,conversationEvidence:evidence};
 const p=chooseSocial(state,a,noEffect,identity,now,context);
 expect(p.reengagement?.disclosure).toBe(kind==='repeat'?'deflect':['failed','missing','other-person'].includes(kind)?'unknown':['listening','cool'].includes(kind)?'explain':'partial');expect(state).toEqual(before);expect(p.participation).toEqual({mode:'speak'});
});
it('valid ordinary current speech responds even when old global appraisal is uncertain',()=>{
 expect(chooseSocial(initialState(now),a,noEffect,identity,now,{text:'민수가 친구한테 사과했대.',conversationEvidence:facts()}).participation).toEqual({mode:'speak'});
});
it('apology and clarification coexist and lead to one repair acknowledgement',()=>{
 const e=facts({acts:{ask_silence_reason:'no',listen_request:'no',apology:'yes',clarify_target:'yes'},repairTarget:'candidate'});
 expect(chooseSocial(initialState(now),a,noEffect,identity,now,{conversationEvidence:e}).purpose).toBe('acknowledge_repair');
});
it('a verified attack with uncertain fine intensity can affect the character',()=>{
 const effect=socialAffect({...a,act:'criticism'},[],identity,now,{kind:'direct_insult',strength:2});
 expect(effect.category).toBe('direct_insult');expect(effect.stimulus).toBeCloseTo(.12);
});
it('current attack blocks repair even without affect increase; listening has priority over explanation',()=>{
 const acts={ask_silence_reason:'yes',listen_request:'yes',apology:'yes',clarify_target:'yes'} as const;
 const plan=(patch:Partial<InteractionEvidence>)=>chooseSocial(initialState(now),a,noEffect,identity,now,{conversationEvidence:facts({acts,...patch})});
 expect(plan({directAttack:'yes'}).participation).toEqual({mode:'silent',reason:'withholding'});
 expect(plan({}).participation).toEqual({mode:'silent',reason:'listening'});
 expect(plan({acts:{...acts,listen_request:'unknown'}}).purpose).toBe('clarify');
 expect(plan({acts:{...acts,ask_silence_reason:'no',listen_request:'no'},directAttack:'unknown'}).purpose).toBe('clarify');
});
it('known praise and greetings retain intentional no-addition, failed output is never its reason',()=>{
 for(const category of ['praise','greeting'] as const){
  const state=initialState(now);state.turn.acknowledgements[`${identity}:${category}`]=now-1000;
  const e=facts(category==='praise'?{directPraise:'yes'}:{speechAct:'greeting'});
  expect(chooseSocial(state,a,noEffect,identity,now,{conversationEvidence:e}).participation).toEqual({mode:'silent',reason:'no_addition'});
  expect(chooseSocial(state,a,noEffect,identity,now,{conversationEvidence:e,previousOutputFailed:true}).participation).toEqual({mode:'defer'});
 }
});
it('praise plus a new question answers the question even after a recent praise acknowledgement',()=>{
 const state=initialState(now);state.turn.acknowledgements[`${identity}:praise`]=now-1000;
 const plan=chooseSocial(state,a,noEffect,identity,now,{text:'정말 잘했어. 그런데 어떻게 푼 거야?',conversationEvidence:facts({directPraise:'yes',speechAct:'question'})});
 expect(plan).toMatchObject({action:'answer',purpose:'question',participation:{mode:'speak'}});
});
it('semantic uncertainty asks a question, while provider failure remains technical defer',()=>{
 const e=facts({acts:{ask_silence_reason:'unknown',listen_request:'no',apology:'no',clarify_target:'no'}});
 expect(chooseSocial(initialState(now),a,noEffect,identity,now,{conversationEvidence:e}).purpose).toBe('clarify');
 expect(chooseSocial(initialState(now),a,noEffect,identity,now,{conversationEvidence:e,appraisalFailed:true}).participation).toEqual({mode:'defer'});
});
