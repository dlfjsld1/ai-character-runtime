import { z } from 'zod';
import { appraisalSchema } from './domain.ts';
export const usageSchema = z.object({input_tokens:z.number().int().nonnegative(),output_tokens:z.number().int().nonnegative()}).strict();
const evidenceEnvelopeV1=z.object({version:z.literal(1),provider:z.string().min(1),mappingVersion:z.string().min(1),eventId:z.uuid(),identityId:z.uuid(),payload:z.record(z.string(),z.unknown())}).strict();
const sourceRevision=z.string().regex(/^[1-9]\d*$/);
export const comparisonSchema=z.object({asOf:z.number().int().nonnegative(),complete:z.boolean(),sources:z.array(z.object({eventId:z.uuid(),revision:sourceRevision}).strict()).max(8)}).strict();
const evidenceEnvelopeV2=evidenceEnvelopeV1.extend({version:z.literal(2),eventRevision:sourceRevision}).strict();
export const evidenceEnvelopeSchema=z.discriminatedUnion('version',[evidenceEnvelopeV1,evidenceEnvelopeV2,evidenceEnvelopeV2.extend({version:z.literal(3),comparison:comparisonSchema}).strict(),evidenceEnvelopeV2.extend({version:z.literal(4),contextHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict()]);
// Raw evidence is stored opaquely. Only a registered strict verifier can grant participation.
const storedEvidenceSchema=z.record(z.string(),z.unknown());
export const appraisalMetadataSchema = z.object({provider:z.string().min(1),model:z.string().min(1),promptVersion:z.string().optional(),failureCode:z.string().optional(),latencyMs:z.number().int().nonnegative().optional(),usage:usageSchema.optional(),providerResult:storedEvidenceSchema.optional()}).strict();
export const appraisalEvaluationSchema = z.object({appraisal:appraisalSchema,metadata:appraisalMetadataSchema}).strict();
export type AppraisalMetadata = z.infer<typeof appraisalMetadataSchema>;
export type AppraisalEvaluation = z.infer<typeof appraisalEvaluationSchema>;
