import type {AppraisalEvent,AppraisalContext,AppraisalEvidenceVerifier} from '../../contracts/src/ai-ports.ts';
import {OpenAIInteractionCandidate,buildInteractionRequest,createInteractionEvidenceVerifier,mapInteractionResponse} from './openai-interaction.ts';
import {INTERACTION_V3_QUESTIONS} from './openai-interaction-v3.ts';
import {isInteractionEvidence} from '../../contracts/src/conversation.ts';

// The request is unchanged from v3. This version identifies a different product
// response policy, not a new model, calibrated probability or stronger raw score.
export const INTERACTION_V4_VERSION='openai-interaction-v4';
const ordinalVerifier=createInteractionEvidenceVerifier(INTERACTION_V4_VERSION);
export const interactionV4EvidenceVerifier:AppraisalEvidenceVerifier={
 ...ordinalVerifier,
 verifyAffect(appraisal,metadata,event){
  const ordinal=ordinalVerifier.verifyAffect!(appraisal,metadata,event);if(ordinal)return ordinal;
  const acts=ordinalVerifier.verifyConversation!(appraisal,metadata,event);
  if(acts&&isInteractionEvidence(acts)&&acts.directPraise==='yes'&&acts.directAttack==='no')return {kind:'praise',strength:1,basis:'confirmed_event_baseline'};
 },
};
export class OpenAIInteractionV4Candidate extends OpenAIInteractionCandidate{
 override readonly promptVersion=INTERACTION_V4_VERSION;
 protected override buildRequest(event:AppraisalEvent,context:AppraisalContext){return buildInteractionRequest(event,context,INTERACTION_V3_QUESTIONS);}
 protected override mapResponse(raw:unknown,eventId:string,latencyMs:number){return mapInteractionResponse(raw,eventId,latencyMs,INTERACTION_V4_VERSION);}
}
