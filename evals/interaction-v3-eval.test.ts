import {expect,it} from 'vitest';
import {decisionContextHash} from '../packages/adapters/src/openai-conversation.ts';
import {mapInteractionResponse} from '../packages/adapters/src/openai-interaction.ts';
import {INTERACTION_V3_VERSION,interactionV3EvidenceVerifier} from '../packages/adapters/src/openai-interaction-v3.ts';
import {assessInteraction} from './interaction-eval.ts';
import {interactionFixture} from './interaction-fixture.ts';
import {prepareInteractionV3Cases} from './interaction-v3-eval.ts';

it('freezes six development and twelve untouched historical confirmation inputs without provider calls',()=>{
 const prepared=prepareInteractionV3Cases();expect(prepared.cases.map(c=>c.id)).toEqual([...Array.from({length:6},(_,i)=>`D${String(i+1).padStart(2,'0')}`),...Array.from({length:12},(_,i)=>`HA${String(i+1).padStart(2,'0')}`)]);
 expect(prepared.cases.every(c=>c.request.questions.length===9&&JSON.parse(c.request.input).current.text===c.text)).toBe(true);
 for(const c of prepared.cases){
  const f=c.expected.facts,values={speech_form:f.speechAct,ask_silence_reason:f.acts.ask_silence_reason==='yes'?1:0,listen_request:f.acts.listen_request==='yes'?1:0,apology:f.acts.apology==='yes'?1:0,clarify_target:f.acts.clarify_target==='yes'?1:0,repairs_candidate:f.repairTarget==='candidate'?1:f.repairTarget==='unknown'&&c.input.context.repairCandidate? .5:0,direct_attack:f.directAttack==='yes'?1:0,direct_praise:f.directPraise==='yes'?1:0};
  const raw=interactionFixture(values,c.expected.affect.kind?[0,0,1,0]:[1,0,0,0]);
  const mapped=mapInteractionResponse(raw,c.input.event.id,0,INTERACTION_V3_VERSION);
  mapped.metadata.providerResult={version:4,provider:'openai-decisions',mappingVersion:INTERACTION_V3_VERSION,eventId:c.input.event.id,identityId:c.input.event.identityId,eventRevision:'1',contextHash:decisionContextHash(c.input.context),payload:mapped.metadata.providerResult};
  expect(assessInteraction(mapped,c.input,c.expected,interactionV3EvidenceVerifier).pass,c.id).toBe(true);
 }
});
