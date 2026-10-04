import { z } from 'zod';

export const appraisalSchema = z.object({
  target: z.enum(['character', 'activity', 'other', 'quoted', 'unknown']),
  act: z.enum(['greeting', 'question', 'praise', 'criticism', 'teasing', 'hint', 'help_offer', 'decline', 'other', 'unknown']),
  strength: z.number().int().min(0).max(3), hostility: z.number().int().min(0).max(3),
  goal_relation: z.enum(['helps', 'blocks', 'unrelated', 'unknown']),
  uncertain: z.boolean(), evidence_refs: z.array(z.uuid()).max(20),
}).strict();
export type Appraisal = z.infer<typeof appraisalSchema>;
export const neutralAppraisal: Appraisal = { target: 'unknown', act: 'unknown', strength: 0, hostility: 0, goal_relation: 'unknown', uncertain: true, evidence_refs: [] };
export const candidateSchema = z.object({ activity_id: z.uuid(), candidate_answer: z.string().trim().min(1).max(80).nullable(), needs_hint: z.boolean() }).strict().refine(x => !x.needs_hint || x.candidate_answer === null);
export type Candidate = z.infer<typeof candidateSchema>;
const instant = z.number().finite().nonnegative();
const affect = z.object({ value: z.number().finite().min(0).max(1), asOf: instant, holdUntil: instant, causes: z.array(z.object({ eventId: z.uuid(), targetId: z.string().nullable() }).strict()).max(20) }).strict();
export const expressionSchema = z.enum(['neutral', 'listening', 'happy', 'embarrassed', 'uncomfortable']);
export const stateSchema = z.object({
  affect: z.object({ joy: affect, frustration: affect, surprise: affect, embarrassment: affect }).strict(),
  mood: z.object({ pleasantness: z.number().finite().min(0).max(1), asOf: instant }).strict(),
  attention: z.object({ eventId: z.uuid().nullable(), lastIdentityId: z.uuid().nullable(), consecutive: z.number().int().nonnegative() }).strict(),
  workingMemoryEventIds: z.array(z.uuid()).max(20),
  expression: z.object({ kind: expressionSchema, since: instant }).strict(),
  turn: z.object({ listening: z.boolean(), acknowledgements: z.record(z.string(), instant) }).strict(),
}).strict();
export type State = z.infer<typeof stateSchema>;
export type Emotion = keyof State['affect'];
export type Plan = { action: 'listen'|'acknowledge'|'answer'|'ask'|'continue_activity'|'pause'|'ignore'; purpose: string; targetIdentityId: string|null; expression: z.infer<typeof expressionSchema>; maxSentences: 1|2; delivery: 'calm'|'normal'|'lively'; memoryIds: string[]; activityId?: string };
export type EvidenceInput = { id: string; identityId: string; kind: 'first_observed'|'praise'|'direct_insult'|'verified_hint'; at: number; order: bigint; problemId?: string; strength?: number; appliedStimulus?: number };
export type Relationship = { familiarity: number; affinity: number; interactionDays: number; verifiedProblemCount: number; verifiedHelpDays: number; lastHelpAt: number|null };
export const uuid = z.uuid();
export const counter = z.string().regex(/^(0|[1-9]\d*)$/);
export const chatSchema = z.object({ identityId: uuid, text: z.string().trim().refine(s => [...s].length >= 1 && [...s].length <= 1000 && Buffer.byteLength(s, 'utf8') <= 4096), replyToEventId: uuid.optional() }).strict();
export const envelopeSchema = z.object({ protocolVersion: z.literal(1), messageId: uuid, connectionId: uuid, sequence: counter, sessionId: uuid.nullable(), requestId: uuid.optional(), type: z.string().min(1), payload: z.unknown() }).strict();
export const authSchema = z.object({ protocolVersion: z.literal(1), type: z.literal('auth'), accessToken: z.string().min(32).max(128), clientInstanceId: uuid }).strict();
export const reportSchema = z.object({ responseId: uuid, segmentId: uuid, generationEpoch: counter, outputEpoch: counter }).strict();
export const messageSchemas = {
  'session.subscribe': z.object({ sessionId: uuid.nullable() }).strict(),
  'chat.submit': chatSchema,
  'stage.ready': z.object({ audioUnlocked: z.boolean(), avatarReady: z.boolean(), supportsExpressions: z.array(expressionSchema).max(5) }).strict(),
  'caption.shown': reportSchema, 'caption.finished': reportSchema,
  'response.stop': z.object({ responseId: uuid, reason: z.literal('operator_stop') }).strict(),
  'output.released': z.object({ outputEpoch: counter, stopRequestId: uuid }).strict(),
  'heartbeat.ping': z.object({ nonce: uuid, lastSequence: counter }).strict(),
  'heartbeat.pong': z.object({ nonce: uuid, lastSequence: counter }).strict(),
} as const;
export class RuntimeError extends Error {
  constructor(public code: string, public httpStatus = 409) { super(code); }
}
