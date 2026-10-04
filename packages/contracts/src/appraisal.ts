import { z } from 'zod';
import { appraisalSchema } from './domain.ts';

const probability = z.number().finite().min(0).max(1);
const distribution = z.record(z.string(), probability);
export const choiceAnswerSchema = z.object({type:z.literal('choice'),choice:z.string(),probabilities:distribution,confidence:probability}).strict();
export const scoreAnswerSchema = z.object({type:z.literal('score'),score:z.number().finite().min(0).max(3),legend:z.record(z.string(),z.string()),probabilities:distribution,confidence:probability}).strict();
export const jevAnswersSchema = z.object({target:choiceAnswerSchema,act:choiceAnswerSchema,goal_relation:choiceAnswerSchema,strength:scoreAnswerSchema,hostility:scoreAnswerSchema}).strict();
export const usageSchema = z.object({input_tokens:z.number().int().nonnegative(),output_tokens:z.number().int().nonnegative()}).strict();
export const providerResultSchema = z.object({answers:jevAnswersSchema,mappingVersion:z.literal('jev-appraisal-v1'),confidenceThreshold:z.literal(0.8),gateReasons:z.array(z.enum(['low_confidence','tied_probability','unknown_target','unknown_act']))}).strict();
export const appraisalMetadataSchema = z.object({provider:z.string().min(1),model:z.string().min(1),promptVersion:z.string().optional(),failureCode:z.string().optional(),latencyMs:z.number().int().nonnegative().optional(),usage:usageSchema.optional(),providerResult:providerResultSchema.optional()}).strict();
export const appraisalEvaluationSchema = z.object({appraisal:appraisalSchema,metadata:appraisalMetadataSchema}).strict();
export type AppraisalMetadata = z.infer<typeof appraisalMetadataSchema>;
export type AppraisalEvaluation = z.infer<typeof appraisalEvaluationSchema>;
export type JevAnswers = z.infer<typeof jevAnswersSchema>;
