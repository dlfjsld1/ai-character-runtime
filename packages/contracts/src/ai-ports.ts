import type { Appraisal, Candidate, Plan, SilenceRecord, AffectEvidence } from './domain.ts';
import type { AppraisalEvaluation, AppraisalMetadata } from './appraisal.ts';
import type {ConversationSnapshot,ConversationContext,ConversationEvidence} from './conversation.ts';

export type Message={role:'system'|'user'|'assistant';content:string};
export interface TokenCounter { count(messages:Message[]):Promise<number>; countText(text:string):Promise<number> }
export type DialogueSource={readonly id?:string;readonly revision?:string;readonly identity_id?:string|null;readonly payload?:Readonly<Record<string,unknown>>};
export type DialogueMemory={readonly id?:string;readonly content?:string|null;readonly content_version?:string;readonly facts?:Readonly<Record<string,unknown>>|null;readonly participants?:readonly string[]|null};
export type DialogueContext={
  readonly conversation?:ConversationSnapshot;
  readonly currentInput?:DialogueSource|null;
  readonly sources?:readonly DialogueSource[];
  readonly memories?:readonly DialogueMemory[];
  readonly identities?:readonly {readonly id:string;readonly displayName:string}[];
  readonly silence?:Readonly<SilenceRecord>|null;
  readonly emotion?:Readonly<Partial<SilenceRecord['affect']>>;
};
export interface DialogueGenerator {
  readonly name:string;readonly model:string;counter:TokenCounter;
  ready?():Promise<unknown>;
  readiness?():{status:string;inferenceVerified:boolean;preparationError:string|null};
  fitConversation(plan:Plan,context:DialogueContext):Promise<{conversation:ConversationSnapshot|undefined;inputTokens:number}>;
  dialogue(plan:Plan,context:DialogueContext):Promise<string[]>;
}
export interface ActivitySolver { solve(activityId:string,context:object):Promise<Candidate> }
export type AppraisalEvent={id:string;text:string;identityId:string;revision?:string};
export type PraiseSource={eventId:string;revision:string;text:string};
export type RecentPraise={asOf:number;complete:boolean;items:readonly PraiseSource[]};
export type AppraisalContext={activity?:unknown;recentPraise?:RecentPraise;conversation?:ConversationSnapshot;conversationContext?:ConversationContext};
export type PraiseGroupSource={eventId:string;revision:string;groupId:string|null};
export type RepetitionEvidence={concrete:boolean;comparisons:readonly {eventId:string;revision:string;relation:'same'|'distinct'|'unknown'}[]};
export type AppraisalReadiness={status:'blocked'|'configured'|'ready'|'unavailable';inferenceVerified:boolean;errorCode:string|null};
export interface AppraisalProvider {
  readonly name:string;readonly model:string;readonly promptVersion:string;
  readiness():AppraisalReadiness;
  evaluate(event:AppraisalEvent,context:AppraisalContext):Promise<AppraisalEvaluation>;
}
export type ParticipationEvidence={target:'character';act:Appraisal['act'];acknowledgePraise?:true};
export type EvidenceEvent={eventId:string;identityId:string;eventRevision?:string;recentPraise?:RecentPraise;conversationContext?:ConversationContext};
export interface AppraisalEvidenceVerifier {
  // Strict adapters distinguish invalid provenance from valid but uncertain semantics.
  validate?(appraisal:Appraisal,metadata:AppraisalMetadata,event:EvidenceEvent):boolean;
  verifyConversation?(appraisal:Appraisal,metadata:AppraisalMetadata,event:EvidenceEvent):ConversationEvidence|undefined;
  verify(appraisal:Appraisal,metadata:AppraisalMetadata,event:EvidenceEvent):ParticipationEvidence|undefined;
  verifyAffect?(appraisal:Appraisal,metadata:AppraisalMetadata,event:EvidenceEvent):AffectEvidence|undefined;
  verifyRepetition?(appraisal:Appraisal,metadata:AppraisalMetadata,event:EvidenceEvent):RepetitionEvidence|undefined;
}
// Compatibility for existing evaluation fixtures; runtime consumers use separate roles.
export interface Provider extends DialogueGenerator,ActivitySolver {
  readonly appraisalPromptVersion?:string;
  appraise(event:AppraisalEvent,context:object):Promise<Appraisal>;
}
