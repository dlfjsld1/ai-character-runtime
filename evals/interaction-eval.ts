import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import type {AppraisalEvaluation} from '../packages/contracts/src/appraisal.ts';
import type {AppraisalEvidenceVerifier} from '../packages/contracts/src/ai-ports.ts';
import type {InteractionEvidence} from '../packages/contracts/src/conversation.ts';
import {canAttemptRepair} from '../packages/contracts/src/conversation.ts';
import type {Plan} from '../packages/contracts/src/domain.ts';
import {interactionEvidenceVerifier as defaultVerifier,buildInteractionRequest,INTERACTION_VERSION} from '../packages/adapters/src/openai-interaction.ts';
import {apply,applyRepair,chooseSocial,socialAffect} from '../packages/character-core/src/index.ts';
import {control} from './conversation-actions-probe.ts';
export type Outcome='response'|'clarification'|'intentional_silence'|'semantic_defer'|'technical_defer';
export function interactionOutcome(plan:Plan,technicalFailure=false):Outcome{
 if(plan.participation?.mode==='defer')return technicalFailure?'technical_defer':'semantic_defer';
 if(plan.participation?.mode==='silent')return 'intentional_silence';
 return plan.purpose==='clarify'?'clarification':'response';
}
export type InteractionExpectation={facts:InteractionEvidence;outcomes:Outcome[];purpose:string;silenceReason?:'listening'|'withholding'|'no_addition';affect:{kind:'praise'|'direct_insult'|null;min:number;max:number};repair:'required'|'forbidden'};
type DiagnosticCase={id:string;text:string;context:string;facts:Partial<Omit<InteractionEvidence,'acts'>>&{acts?:Partial<InteractionEvidence['acts']>};purpose:string;silenceReason?:InteractionExpectation['silenceReason'];affect?:InteractionExpectation['affect'];repair?:InteractionExpectation['repair']};
export function prepareInteractionCases(){
 const fixturePath='evals/fixtures/interaction-v2.json',fixture=JSON.parse(readFileSync(fixturePath,'utf8')) as {version:string;cases:DiagnosticCase[]};
 if(fixture.version!=='interaction-v2-dev12'||fixture.cases.length!==12||new Set(fixture.cases.map(c=>c.id)).size!==12)throw new Error('frozen_interaction_cases_required');
 const cases=fixture.cases.map(scene=>{
  const input=control({...scene,allowedActs:[],policy:'v2'}),candidate=input.context.repairCandidate;
  // Match the prior incident to actual ordered context instead of an empty history.
  if(candidate)input.context.history.turns=[{role:'user',text:candidate.text,source:{kind:'event',id:candidate.eventId,revision:candidate.revision},order:'1'}];
  const defaults:InteractionEvidence={version:2,acts:{ask_silence_reason:'no',listen_request:'no',apology:'no',clarify_target:'no'},speechAct:'statement',repairTarget:candidate?'other':'unknown',directAttack:'no',directPraise:'no'};
  const expected:InteractionExpectation={facts:{...defaults,...scene.facts,acts:{...defaults.acts,...scene.facts.acts}},outcomes:[scene.silenceReason?'intentional_silence':'response'],purpose:scene.purpose,...(scene.silenceReason?{silenceReason:scene.silenceReason}:{}),affect:scene.affect??{kind:null,min:0,max:0},repair:scene.repair??'forbidden'};
  return {id:scene.id,input,expected,request:buildInteractionRequest(input.event,{conversationContext:input.context})};
 });
 const sources=[fixturePath,'evals/interaction-eval.ts','packages/adapters/src/openai-interaction.ts','packages/adapters/src/openai-conversation.ts','packages/adapters/src/openai.ts','packages/contracts/src/conversation.ts','packages/contracts/src/ai-ports.ts','packages/character-core/src/index.ts','packages/database/src/store.ts'];
 return {version:INTERACTION_VERSION,scope:'prepared diagnostic requests only; no provider calls, no confirmation claims',providerCalls:0,sourceHashes:Object.fromEntries(sources.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),cases};
}
export function assessInteraction(value:AppraisalEvaluation,input:ReturnType<typeof control>,expected:InteractionExpectation,verifier:AppraisalEvidenceVerifier=defaultVerifier){
 const binding={eventId:input.event.id,identityId:input.event.identityId,eventRevision:input.event.revision,conversationContext:input.context},valid=verifier.validate!(value.appraisal,value.metadata,binding),facts=valid?verifier.verifyConversation!(value.appraisal,value.metadata,binding) as InteractionEvidence:undefined;
 const effect=valid?socialAffect(value.appraisal,[],input.event.identityId,input.now,verifier.verifyAffect!(value.appraisal,value.metadata,binding)):{category:null,stimulus:0,n:0,habituation:1};
 const after=apply(input.state,{eventId:input.event.id,targetId:input.event.identityId,now:input.now,stimuli:effect.category==='praise'?{joy:effect.stimulus}:effect.category==='direct_insult'?{frustration:effect.stimulus}:{}}),candidate=input.context.repairCandidate;
 const eligible=valid&&canAttemptRepair(facts)&&facts?.repairTarget==='candidate'&&!!candidate&&!candidate.used&&after.affect.frustration.causes.length>0&&after.affect.frustration.causes.every(c=>c.targetId===input.event.identityId)&&after.affect.frustration.causes.some(c=>c.eventId===candidate.eventId);
 const repaired=applyRepair(after,input.now,eligible),plan=chooseSocial(repaired.state,value.appraisal,effect,input.event.identityId,input.now,{text:input.event.text,previousSilence:input.context.silence,appraisalFailed:!valid,conversationEvidence:facts}),outcome=interactionOutcome(plan,!valid);
 const meaning=!!facts&&Object.entries(expected.facts).every(([key,v])=>key==='acts'?Object.entries(v).every(([act,truth])=>facts.acts[act as keyof typeof facts.acts]===truth):facts[key as keyof InteractionEvidence]===v);
 const checks={meaning,affect:effect.category===expected.affect.kind&&effect.stimulus>=expected.affect.min-1e-12&&effect.stimulus<=expected.affect.max+1e-12,protection:(expected.repair==='forbidden'?repaired.amount===0:repaired.amount>0&&repaired.amount<=.03&&repaired.amount<=after.affect.frustration.value*.1)&&(!expected.silenceReason||plan.participation?.mode==='silent'&&plan.participation.reason===expected.silenceReason),engagement:expected.outcomes.includes(outcome)&&plan.purpose===expected.purpose};
 return {checks,pass:Object.values(checks).every(Boolean),outcome,facts:facts??null,effect,repairAmount:repaired.amount,plan};
}
// Reinterpret outcome only. Old provider calls and their original scores remain immutable.
export function historicalOutcomes(rows:{id:string;functionalPass:boolean;plan:Plan;metadata?:{failureCode?:string};expectation:{policy:string}}[]){
 const items=rows.map(row=>{const outcome=interactionOutcome(row.plan,!!row.metadata?.failureCode),expected:Outcome=['listen','attack'].includes(row.expectation.policy)?'intentional_silence':'response';return {id:row.id,originalFunctionalPass:row.functionalPass,outcome,expected,outcomeAwarePass:row.functionalPass&&outcome===expected};});
 return {scope:'historical v1 outcome-only reanalysis, not v2 model quality',total:items.length,originalPass:items.filter(r=>r.originalFunctionalPass).length,outcomeAwarePass:items.filter(r=>r.outcomeAwarePass).length,deferredOriginalPass:items.filter(r=>r.originalFunctionalPass&&['semantic_defer','technical_defer'].includes(r.outcome)).map(r=>r.id),items};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);if(args.length!==2)throw new Error('usage: interaction-eval.ts historical-results.json output.json');
 const result=args[0]==='--prepare'?prepareInteractionCases():historicalOutcomes(JSON.parse(readFileSync(args[0]!,'utf8')).rows);writeFileSync(args[1]!,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify('cases' in result?{version:result.version,prepared:result.cases.length,providerCalls:0}:{...result,items:undefined}));
}
