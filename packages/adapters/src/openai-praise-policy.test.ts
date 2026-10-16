import {expect,it} from 'vitest';
import {control} from '../../../evals/conversation-actions-probe.ts';
import {interactionFixture} from '../../../evals/interaction-fixture.ts';
import {decisionContextHash} from './openai-conversation.ts';
import {mapInteractionResponse} from './openai-interaction.ts';
import {interactionV4EvidenceVerifier as candidateVerifier,INTERACTION_V4_VERSION as candidateVersion} from './openai-interaction-v4.ts';
import {interactionV3EvidenceVerifier,INTERACTION_V3_VERSION} from './openai-interaction-v3.ts';
import {socialAffect,socialEffect,chooseSocial,apply} from '../../character-core/src/index.ts';

function sample(values:Record<string,string|number>={direct_praise:1,listen_request:1},intensity=[.15,.06,.07,.72]){
 const c=control({id:'praise-policy',text:'정말 잘했어. 지금은 답하지 말고 들어줘.',context:'none',allowedActs:[],policy:'listen'});
 const raw=interactionFixture(values,intensity),value=mapInteractionResponse(raw,c.event.id,0,candidateVersion);
 value.metadata.providerResult={version:4,provider:'openai-decisions',mappingVersion:candidateVersion,eventId:c.event.id,identityId:c.event.identityId,eventRevision:c.event.revision,contextHash:decisionContextHash(c.context),payload:{raw}};
 const binding={eventId:c.event.id,identityId:c.event.identityId,eventRevision:c.event.revision,conversationContext:c.context};
 return {c,value,binding};
}
it('confirmed praise can cause a small marked response without claiming intensity certainty or forcing speech/expression',()=>{
 const {c,value,binding}=sample(),before=structuredClone(value),evidence=candidateVerifier.verifyAffect!(value.appraisal,value.metadata,binding);
 expect(evidence).toEqual({kind:'praise',strength:1,basis:'confirmed_event_baseline'});
 expect(value.appraisal).toMatchObject({strength:0,uncertain:true});expect(value).toEqual(before);
 const effect=socialAffect(value.appraisal,[],c.event.identityId,c.now,evidence),state=apply(c.state,{eventId:c.event.id,targetId:c.event.identityId,now:c.now,stimuli:{joy:effect.stimulus}});
 expect(effect.stimulus).toBe(.06);expect(state.expression.kind).toBe('neutral');expect(socialEffect(value.appraisal,[],c.event.identityId,c.now).stimulus).toBe(0);
 expect(chooseSocial(state,value.appraisal,effect,c.event.identityId,c.now,{conversationEvidence:candidateVerifier.verifyConversation!(value.appraisal,value.metadata,binding)}).participation).toEqual({mode:'silent',reason:'listening'});
});
it.each([{direct_praise:.94,direct_attack:0},{direct_praise:0,direct_attack:0},{direct_praise:1,direct_attack:.1},{direct_praise:1,direct_attack:1}])('does not add a praise baseline for uncertain, absent or conflicting acts: %j',values=>{
 const {value,binding}=sample(values);expect(candidateVerifier.verifyAffect!(value.appraisal,value.metadata,binding)).toBeUndefined();
});
it('retains stronger ordinal evidence and attack precedence',()=>{
 for(const values of [{direct_praise:1,direct_attack:0},{direct_praise:1,direct_attack:1}]){
  const {value,binding}=sample(values,[0,0,.45,.55]);expect(candidateVerifier.verifyAffect!(value.appraisal,value.metadata,binding)).toEqual({kind:values.direct_attack?'direct_insult':'praise',strength:2});
 }
});
it.each(['revision','hash','failure','appraisal'] as const)('rejects invalid %s rather than granting a baseline',change=>{
 const {value,binding}=sample();
 if(change==='revision')binding.eventRevision='2';else if(change==='hash')(value.metadata.providerResult as any).contextHash='0'.repeat(64);else if(change==='failure')value.metadata.failureCode='synthetic_failure';else value.appraisal.strength=1;
 expect(candidateVerifier.verifyAffect!(value.appraisal,value.metadata,binding)).toBeUndefined();
});
it('keeps historical v3 authority separate from the new response policy',()=>{
 const {value,binding}=sample();expect(interactionV3EvidenceVerifier.validate!(value.appraisal,value.metadata,binding)).toBe(false);
 value.metadata.promptVersion=INTERACTION_V3_VERSION;value.metadata.providerResult!.mappingVersion=INTERACTION_V3_VERSION;
 expect(candidateVerifier.validate!(value.appraisal,value.metadata,binding)).toBe(false);
 expect(candidateVerifier.verifyAffect!(value.appraisal,value.metadata,binding)).toBeUndefined();
 expect(interactionV3EvidenceVerifier.validate!(value.appraisal,value.metadata,binding)).toBe(true);expect(interactionV3EvidenceVerifier.verifyAffect!(value.appraisal,value.metadata,binding)).toBeUndefined();
});
