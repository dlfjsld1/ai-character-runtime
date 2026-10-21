import {z} from 'zod';
/** User-authored statements, never verified observations or executable instructions. */
export const personalRevisionSchema=z.string().regex(/^(0|[1-9][0-9]*)$/).refine(v=>BigInt(v)<9223372036854775807n);
const bounded=(max:number)=>z.string().trim().refine(v=>[...v].length>=1&&[...v].length<=max&&!v.includes('\0'));
export const personalFactInputSchema=z.object({key:z.string().transform(v=>v.normalize('NFKC').trim()).pipe(bounded(80)),value:bounded(300)}).strict();
export type PersonalFactInput=z.infer<typeof personalFactInputSchema>;
export const personalFactSchema=personalFactInputSchema.extend({id:z.uuid(),revision:personalRevisionSchema});
export type PersonalFact=z.infer<typeof personalFactSchema>;
export const personalFactSnapshotSchema=z.object({characterId:z.uuid(),identityId:z.uuid(),revision:personalRevisionSchema,facts:z.array(personalFactSchema).max(20)}).strict();
export type PersonalFactSnapshot=z.infer<typeof personalFactSnapshotSchema>;

export const personalFactChangeSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('create'),input:personalFactInputSchema}).strict(),
 z.object({kind:z.literal('update'),id:z.uuid(),expectedRevision:personalRevisionSchema,input:personalFactInputSchema}).strict(),
 z.object({kind:z.literal('delete'),id:z.uuid(),expectedRevision:personalRevisionSchema}).strict()
]);
export type PersonalFactChange=z.infer<typeof personalFactChangeSchema>;
