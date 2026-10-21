import {it,expect} from 'vitest';
import {control} from './conversation-actions-probe.ts';
import {boundInteraction,interactionFixture} from './interaction-fixture.ts';
import {assessInteraction,historicalOutcomes,prepareInteractionCases,type InteractionExpectation} from './interaction-eval.ts';
import {chooseSocial,initialState} from '../packages/character-core/src/index.ts';
import {neutralAppraisal} from '../packages/contracts/src/domain.ts';
const scene={id:'synthetic',text:'민수가 친구에게 왜 말 안 하냐고 물었대.',context:'none',allowedActs:[],policy:'normal'};
const ordinary:InteractionExpectation={facts:{version:2,acts:{ask_silence_reason:'no',listen_request:'no',apology:'no',clarify_target:'no'},repairTarget:'unknown',speechAct:'statement',directAttack:'no',directPraise:'no'},outcomes:['response'],purpose:'other',affect:{kind:null,min:0,max:0},repair:'forbidden'};
it('known ordinary speech succeeds without affect; missing or uncertain semantics cannot pass as normal conversation',()=>{
 const c=control(scene),good=boundInteraction(interactionFixture(),c.event.id,c.context);expect(assessInteraction(good,c,ordinary).pass).toBe(true);
 const ambiguous=assessInteraction(boundInteraction(interactionFixture({ask_silence_reason:.5}),c.event.id,c.context),c,ordinary);expect(ambiguous.outcome).toBe('clarification');expect(ambiguous.checks.protection).toBe(true);expect(ambiguous.checks.engagement).toBe(false);expect(ambiguous.pass).toBe(false);
 // A failed provider still gets an ordinary reply, but unverified meaning never passes.
 good.metadata.failureCode='synthetic_timeout';const failed=assessInteraction(good,c,ordinary);expect(failed.outcome).toBe('response');expect(failed.checks.meaning).toBe(false);expect(failed.pass).toBe(false);
});
it('intentional silence is a positive outcome only when expected, not a blanket response requirement',()=>{
 const c=control(scene),value=boundInteraction(interactionFixture({listen_request:1}),c.event.id,c.context),expected={...ordinary,facts:{...ordinary.facts,acts:{...ordinary.facts.acts,listen_request:'yes' as const}},outcomes:['intentional_silence' as const],purpose:'intentional_silence',silenceReason:'listening' as const};
 expect(assessInteraction(value,c,expected)).toMatchObject({pass:true,outcome:'intentional_silence'});expect(assessInteraction(value,c,ordinary).pass).toBe(false);
});
it('independent meaning and affect must pass even when protection and participation pass',()=>{
 const c=control(scene),value=boundInteraction(interactionFixture(),c.event.id,c.context),result=assessInteraction(value,c,{...ordinary,facts:{...ordinary.facts,directPraise:'yes'},affect:{kind:'praise',min:.1,max:.18}});
 expect(result.checks).toEqual({meaning:false,affect:false,protection:true,engagement:true});expect(result.pass).toBe(false);
});
it('a mixed apology and fresh attack stays protective when incident linkage is below the frozen threshold',()=>{
 const c=prepareInteractionCases().cases.find(c=>c.id==='I11')!;
 const raw=interactionFixture({apology:1,repairs_candidate:.91,direct_attack:1},[.01,.01,.06,.92]);
 const result=assessInteraction(boundInteraction(raw,c.input.event.id,c.input.context),c.input,c.expected);
 expect(result.facts?.repairTarget).toBe('unknown');
 expect(result.checks).toEqual({meaning:false,affect:true,protection:true,engagement:true});
 expect(result).toMatchObject({outcome:'intentional_silence',repairAmount:0,effect:{category:'direct_insult',stimulus:.12},plan:{participation:{mode:'silent',reason:'withholding'}}});
 const linked=assessInteraction(boundInteraction(interactionFixture({apology:1,repairs_candidate:.95,direct_attack:1},[.01,.01,.06,.92]),c.input.event.id,c.input.context),c.input,c.expected);
 expect(linked.repairAmount).toBe(0);
 expect(linked.plan.participation).toEqual({mode:'silent',reason:'withholding'});
});
it('historical defer accepted by no-special-action scorer is no longer conversation success',()=>{
 // Historical rows carry the defer plans of their time; current Core no longer defers on failure.
 const c=control(scene),plan={...chooseSocial(initialState(c.now),neutralAppraisal,{category:null,stimulus:0,n:0,habituation:1},c.event.identityId,c.now,{appraisalFailed:true}),participation:{mode:'defer' as const}},rows=[{id:'old-defer',functionalPass:true,plan,expectation:{policy:'normal'}}];
 expect(historicalOutcomes(rows)).toMatchObject({originalPass:1,outcomeAwarePass:0,deferredOriginalPass:['old-defer']});expect(rows[0]!.functionalPass).toBe(true);
});
it('prepared diagnostics preserve exact expectations and source context without running a provider',()=>{
 const prepared=prepareInteractionCases();expect(prepared.providerCalls).toBe(0);expect(prepared.cases).toHaveLength(12);
 for(const c of prepared.cases){
  const f=c.expected.facts,values={speech_form:f.speechAct,ask_silence_reason:f.acts.ask_silence_reason==='yes'?1:0,listen_request:f.acts.listen_request==='yes'?1:0,apology:f.acts.apology==='yes'?1:0,clarify_target:f.acts.clarify_target==='yes'?1:0,repairs_candidate:f.repairTarget==='candidate'?1:0,direct_attack:f.directAttack==='yes'?1:0,direct_praise:f.directPraise==='yes'?1:0};
  // Injected answers check evaluator feasibility, not Korean interpretation.
  const v=boundInteraction(interactionFixture(values,c.expected.affect.kind?[0,0,1,0]:[1,0,0,0]),c.input.event.id,c.input.context);expect(assessInteraction(v,c.input,c.expected).pass,c.id).toBe(true);
  if(c.input.context.repairCandidate)expect(JSON.parse(c.request.input).history[0].content).toBe(c.input.context.repairCandidate.text);
 }
});
