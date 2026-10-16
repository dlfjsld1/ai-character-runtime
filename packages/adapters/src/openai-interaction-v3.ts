import type {AppraisalEvent,AppraisalContext} from '../../contracts/src/ai-ports.ts';
import {INTERACTION_QUESTIONS,INTERACTION_SCOPE,OpenAIInteractionCandidate,buildInteractionRequest,createInteractionEvidenceVerifier,mapInteractionResponse,type Question} from './openai-interaction.ts';

export const INTERACTION_V3_VERSION='openai-interaction-v3';
const relation='Does the current speaker\'s own apology or target correction explicitly refer to the same earlier utterance in priorIncident? Judge reference only, not whether repair should be granted. A clear reference to an earlier insult can be true even when a fresh attack follows; classify that fresh attack independently. An apology about a different event is false. A vague apology without an identifiable reference is uncertain. A quoted or reported apology by someone else is false.';
export const INTERACTION_V3_QUESTIONS:Question[]=INTERACTION_QUESTIONS.map(q=>q.name==='repairs_candidate'?{...q,instructions:INTERACTION_SCOPE+' '+relation}:q);
export const interactionV3EvidenceVerifier=createInteractionEvidenceVerifier(INTERACTION_V3_VERSION);

export class OpenAIInteractionV3Candidate extends OpenAIInteractionCandidate{
 override readonly promptVersion=INTERACTION_V3_VERSION;
 protected override buildRequest(event:AppraisalEvent,context:AppraisalContext){return buildInteractionRequest(event,context,INTERACTION_V3_QUESTIONS);}
 protected override mapResponse(raw:unknown,eventId:string,latencyMs:number){return mapInteractionResponse(raw,eventId,latencyMs,INTERACTION_V3_VERSION);}
}
