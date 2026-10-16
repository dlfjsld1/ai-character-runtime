import {expect,it} from 'vitest';
import {control} from '../../../evals/conversation-actions-probe.ts';
import {pressureFixture,boundInteraction,interactionFixture} from '../../../evals/interaction-fixture.ts';
import {INTERACTION_V5_VERSION,INTERACTION_V5_QUESTIONS,interactionV5EvidenceVerifier} from './openai-interaction-v5.ts';
import {interactionV4EvidenceVerifier} from './openai-interaction-v4.ts';
import {mapInteractionResponse} from './openai-interaction.ts';
import {canAttemptRepair} from '../../contracts/src/conversation.ts';
import {createProviders} from '../../../apps/runtime/src/providers.ts';
import {parseConfig} from '../../contracts/src/local-config.ts';
const c=control({id:'PRESSURE',text:'대답해 대답 안 해?!',context:'W',allowedActs:[],policy:'attack'});
const event={eventId:c.event.id,identityId:c.event.identityId,eventRevision:'1',conversationContext:c.context};
it.each([0,.5,1])('v5 pressure=%s is source-bound and grants no affect or repair authority',probability=>{
 const v=boundInteraction(pressureFixture({response_pressure:probability,apology:1,repairs_candidate:1}),c.event.id,c.context,INTERACTION_V5_VERSION);
 expect(interactionV5EvidenceVerifier.validate!(v.appraisal,v.metadata,event)).toBe(true);
 const e=interactionV5EvidenceVerifier.verifyConversation!(v.appraisal,v.metadata,event)!;
 expect(e).toMatchObject({responsePressure:probability===1?'yes':probability===0?'no':'unknown'});
 expect(interactionV5EvidenceVerifier.verifyAffect!(v.appraisal,v.metadata,event)).toBeUndefined();
 expect(canAttemptRepair(e)).toBe(probability===0);
 expect(interactionV4EvidenceVerifier.validate!(v.appraisal,v.metadata,event)).toBe(false);
 expect(interactionV5EvidenceVerifier.validate!(v.appraisal,v.metadata,{...event,identityId:'00000000-0000-4000-8000-000000000099'})).toBe(false);
});
it('keeps old nine-question versions distinct; rejects missing/extra/duplicate pressure answers',()=>{
 expect(INTERACTION_V5_QUESTIONS).toHaveLength(10);
 const raw=pressureFixture();
 expect(()=>mapInteractionResponse(raw,c.event.id)).toThrow('interaction_invalid_output');
 expect(()=>mapInteractionResponse(interactionFixture(),c.event.id,0,INTERACTION_V5_VERSION)).toThrow('interaction_invalid_output');
 expect(()=>mapInteractionResponse({...raw,answers:[...raw.answers,raw.answers.at(-1)]},c.event.id,0,INTERACTION_V5_VERSION)).toThrow('interaction_invalid_output');
 const duplicate=structuredClone(raw);duplicate.answers[0]=duplicate.answers.at(-1)!;
 expect(()=>mapInteractionResponse(duplicate,c.event.id,0,INTERACTION_V5_VERSION)).toThrow('interaction_invalid_output');
});
it('v5 keeps independent attack and v4 weak praise affect paths',()=>{
 for(const [values,intensity,expected] of [[{response_pressure:1,direct_attack:1},[0,0,1,0],{kind:'direct_insult',strength:2}],[{direct_praise:1},[1,0,0,0],{kind:'praise',strength:1,basis:'confirmed_event_baseline'}]] as const){
  const v=boundInteraction(pressureFixture(values,[...intensity]),c.event.id,c.context,INTERACTION_V5_VERSION);
  expect(interactionV5EvidenceVerifier.verifyAffect!(v.appraisal,v.metadata,event)).toEqual(expected);
 }
});
it('registers v5 only with explicit paid provider configuration',()=>{
 expect(()=>parseConfig({APPRAISAL_PROVIDER:'openai-decisions-v5'})).toThrow();
 const p=createProviders(parseConfig({APPRAISAL_PROVIDER:'openai-decisions-v5',APPRAISAL_MODEL:'gpt-6-luna',LOCAL_ONLY:'false',ALLOW_PAID_PROVIDERS:'true',DIALOGUE_API_KEY:'synthetic',DIALOGUE_BUDGET_PATH:'synthetic-unused.json',DIALOGUE_BUDGET_USD:'1'}),{});
 expect(p.appraiser.promptVersion).toBe(INTERACTION_V5_VERSION);
});
