import type {AppraisalEvent,AppraisalContext,AppraisalEvidenceVerifier} from '../../contracts/src/ai-ports.ts';
import {isInteractionEvidence} from '../../contracts/src/conversation.ts';
import {PRESSURE_VERSION,PRESSURE_QUESTION,OpenAIInteractionCandidate,buildInteractionRequest,createInteractionEvidenceVerifier,mapInteractionResponse} from './openai-interaction.ts';
import {INTERACTION_V3_QUESTIONS} from './openai-interaction-v3.ts';
export const INTERACTION_V5_VERSION=PRESSURE_VERSION;
export const INTERACTION_V5_QUESTIONS=[...INTERACTION_V3_QUESTIONS.map(q=>q.name==='ask_silence_reason'?{...q,instructions:q.instructions+' A command to answer, or a challenge asking whether it will answer, does not itself ask for the reason for past silence. Only count a request to explain that reason.'}:q),PRESSURE_QUESTION];
const ordinal=createInteractionEvidenceVerifier(INTERACTION_V5_VERSION);
export const interactionV5EvidenceVerifier:AppraisalEvidenceVerifier={...ordinal,
 verifyAffect(appraisal,metadata,event){
  const affect=ordinal.verifyAffect!(appraisal,metadata,event);if(affect)return affect;
  const e=ordinal.verifyConversation!(appraisal,metadata,event);
  if(isInteractionEvidence(e)&&e.directPraise==='yes'&&e.directAttack==='no')return {kind:'praise',strength:1,basis:'confirmed_event_baseline'};
 }
};
export class OpenAIInteractionV5Candidate extends OpenAIInteractionCandidate{
 override readonly promptVersion=INTERACTION_V5_VERSION;
 protected override buildRequest(event:AppraisalEvent,context:AppraisalContext){return buildInteractionRequest(event,context,INTERACTION_V5_QUESTIONS);}
 protected override mapResponse(raw:unknown,eventId:string,latencyMs:number){return mapInteractionResponse(raw,eventId,latencyMs,INTERACTION_V5_VERSION);}
}
