import {z} from 'zod';
import {silenceRecordSchema} from './domain.ts';
const positive=z.string().regex(/^[1-9]\d*$/),counter=z.string().regex(/^(0|[1-9]\d*)$/);
export const conversationSourceSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('event'),id:z.uuid(),revision:positive}).strict(),
 z.object({kind:z.literal('response'),id:z.uuid(),generationEpoch:counter}).strict(),
]);
const turn=z.object({role:z.enum(['user','assistant']),text:z.string().min(1),source:conversationSourceSchema,order:positive}).strict();
const base={version:z.literal(1),sessionId:z.uuid(),identityId:z.uuid(),cutoffEventId:z.uuid(),truncated:z.boolean()};
function validTurns(turns:{role:string;source:{kind:string;id:string};order:string}[],cutoff:string){
 let users=0,previous=0n,last='assistant';const ids=new Set<string>();
 for(const t of turns){if(ids.has(t.source.id)||t.source.id===cutoff)return false;ids.add(t.source.id);
  if(t.role==='user'){if(t.source.kind!=='event'||BigInt(t.order)<=previous)return false;previous=BigInt(t.order);users++;}
  else if(t.source.kind!=='response'||last!=='user'||BigInt(t.order)!==previous)return false;
  last=t.role;
 }return users<=4;
}
export const conversationSnapshotSchema=z.object({...base,turns:z.array(turn).max(8)}).strict().refine(s=>validTurns(s.turns,s.cutoffEventId),'invalid_conversation_order');
export const conversationRefsSchema=z.object({...base,turns:z.array(turn.omit({text:true}).extend({textDigest:z.string().regex(/^[a-f0-9]{64}$/)})).max(8)}).strict().refine(s=>validTurns(s.turns,s.cutoffEventId),'invalid_conversation_order');
export type ConversationSnapshot=z.infer<typeof conversationSnapshotSchema>;
export type ConversationRefs=z.infer<typeof conversationRefsSchema>;
export const conversationContextSchema=z.object({version:z.literal(1),sessionId:z.uuid(),identityId:z.uuid(),asOf:z.number().int().nonnegative(),history:conversationSnapshotSchema,silence:silenceRecordSchema.nullable(),repairCandidate:z.object({eventId:z.uuid(),revision:positive,identityId:z.uuid(),sessionId:z.uuid(),at:z.number().int().nonnegative(),text:z.string().min(1).max(1000),used:z.boolean()}).strict().nullable()}).strict().refine(c=>c.history.sessionId===c.sessionId&&c.history.identityId===c.identityId&&(!c.silence||c.silence.identityId===c.identityId&&c.silence.at<=c.asOf)&&(!c.repairCandidate||c.repairCandidate.identityId===c.identityId&&c.repairCandidate.sessionId===c.sessionId&&c.repairCandidate.at<=c.asOf&&c.asOf-c.repairCandidate.at<=600000),'invalid_conversation_context');
export type ConversationContext=z.infer<typeof conversationContextSchema>;
export type LegacyConversationEvidence={act:'ordinary'|'ask_silence_reason'|'listen_request'|'apology'|'clarify_target'|'unknown';repairTarget:'candidate'|'other'|'unknown'};
const truth=z.enum(['yes','no','unknown']);
export const interactionEvidenceSchema=z.object({version:z.literal(2),acts:z.object({ask_silence_reason:truth,listen_request:truth,apology:truth,clarify_target:truth}).strict(),repairTarget:z.enum(['candidate','other','unknown']),speechAct:z.enum(['question','greeting','statement','unknown']),directAttack:truth,directPraise:truth,responsePressure:truth.optional()}).strict();
export type InteractionEvidence=z.infer<typeof interactionEvidenceSchema>;
export type ConversationEvidence=LegacyConversationEvidence|InteractionEvidence;
export function isInteractionEvidence(e:ConversationEvidence|undefined):e is InteractionEvidence{return !!e&&'version' in e&&e.version===2;}
export function hasConversationAct(e:ConversationEvidence|undefined,act:keyof InteractionEvidence['acts']){return !!e&&(isInteractionEvidence(e)?e.acts[act]==='yes':e.act===act);}
export function canAttemptRepair(e:ConversationEvidence|undefined){return !!e&&(hasConversationAct(e,'apology')||hasConversationAct(e,'clarify_target'))&&(!isInteractionEvidence(e)||e.directAttack==='no'&&(e.responsePressure===undefined||e.responsePressure==='no')&&e.acts.listen_request==='no'&&e.acts.ask_silence_reason==='no');}
export function conversationMessages(snapshot:ConversationSnapshot){return snapshot.turns.map(({role,text})=>({role,content:text}));}
export function dropOldestExchange(snapshot:ConversationSnapshot):ConversationSnapshot{
 const result=conversationSnapshotSchema.parse(snapshot);if(!result.turns.length)return result;
 result.turns.shift();if(result.turns[0]?.role==='assistant')result.turns.shift();result.truncated=true;return result;
}
export function isConversationSuffix(original:ConversationSnapshot,candidate:ConversationSnapshot):boolean{
 const parsed=conversationSnapshotSchema.safeParse(candidate);if(!parsed.success)return false;
 const normalized=conversationSnapshotSchema.parse(original);
 const {turns:next,truncated:nextTruncated}=parsed.data;
 if(normalized.version!==parsed.data.version||normalized.sessionId!==parsed.data.sessionId||normalized.identityId!==parsed.data.identityId||normalized.cutoffEventId!==parsed.data.cutoffEventId)return false;
 let current=normalized;
 for(;;){if(JSON.stringify(current.turns)===JSON.stringify(next))return current.truncated===nextTruncated;if(!current.turns.length)return false;current=dropOldestExchange(current);}
}
export async function budgetConversation(snapshot:ConversationSnapshot,count:(text:string)=>Promise<number>,limit=768):Promise<ConversationSnapshot>{
 const result=conversationSnapshotSchema.parse(snapshot);
 while(result.turns.length&&await count(JSON.stringify(conversationMessages(result)))>limit){const smaller=dropOldestExchange(result);result.turns=smaller.turns;result.truncated=smaller.truncated;}
 return result;
}

// Appraisal has its own bounded, provider-neutral input. It must not require the
// dialogue model or its paid tokenizer just to understand an incoming event.
// Dialogue still applies its exact 768-token history / 3328-token request limits.
export function budgetAppraisalConversation(snapshot:ConversationSnapshot):ConversationSnapshot{
 let result=conversationSnapshotSchema.parse(snapshot);
 while(result.turns.length&&new TextEncoder().encode(JSON.stringify(conversationMessages(result))).length>8192)result=dropOldestExchange(result);
 return result;
}
