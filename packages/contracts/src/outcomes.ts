import {z} from 'zod';
import {affectScopeSchema,affectReferenceSchema,type AffectSource} from './affect-appraisal.ts';

export const recommendationAnnotationSchema=z.object({
  kind:z.literal('movie'),title:z.string().trim().min(1).max(120),
  sentenceIndex:z.number().int().min(0).max(1),quote:z.string().min(1).max(120),
}).strict();
export type RecommendationAnnotation=z.infer<typeof recommendationAnnotationSchema>;
export type DialogueTurn={sentences:string[];recommendations:RecommendationAnnotation[];annotationStatus:'candidate'|'none'|'invalid'|'unsupported'};
export const actionEpisodeSchema=z.object({
  id:z.uuid(),revision:z.string().regex(/^[1-9]\d*$/),scope:affectScopeSchema,
  responseId:z.uuid(),responseRevision:z.string().regex(/^[1-9]\d*$/),segmentId:z.uuid(),
  kind:z.literal('movie'),title:z.string().min(1).max(120),text:z.string().min(1).max(120),
  span:z.object({start:z.number().int().nonnegative(),end:z.number().int().positive()}).strict(),
  deliveredAt:z.number().finite().nonnegative(),sourceRefs:z.array(affectReferenceSchema).min(1).max(40),
}).strict();
export type ActionEpisode=z.infer<typeof actionEpisodeSchema>;
export type ExperienceReadRequest={scope:z.infer<typeof affectScopeSchema>;at:number;limit:number;since:number};
export type ExperienceReadResult={
  status:'found'|'empty'|'ambiguous'|'stale'|'unavailable';revision:string;truncated:boolean;
  scope:z.infer<typeof affectScopeSchema>;since:number;until:number;episodes:ActionEpisode[];
};
export type DeliveredRecommendation={
  id:string;scope:z.infer<typeof affectScopeSchema>;responseId:string;responseRevision:string;
  status:'completed'|'delivering'|'cancelled'|'failed';expectedSegments:number;
  segments:readonly {id:string;index:number;text:string;shownAt:number|null;finishedAt:number|null}[];
  annotation:RecommendationAnnotation;sourceRefs:ActionEpisode['sourceRefs'];
};

// Store must supply locked, current response/segment rows. This predicate
// cannot verify a model's interpretation of quoted versus endorsed speech.
export function confirmDeliveredRecommendation(input:DeliveredRecommendation):ActionEpisode|null{
  const annotation=recommendationAnnotationSchema.safeParse(input.annotation);
  if(!annotation.success||input.status!=='completed'||!Number.isSafeInteger(input.expectedSegments)||input.expectedSegments<1||input.expectedSegments>2||input.segments.length!==input.expectedSegments)return null;
  const segments=[...input.segments].sort((a,b)=>a.index-b.index);
  if(new Set(segments.map(s=>s.id)).size!==segments.length||segments.some((s,i)=>s.index!==i||s.shownAt===null||s.finishedAt===null||!Number.isFinite(s.shownAt)||s.shownAt<0||!Number.isFinite(s.finishedAt)||s.finishedAt<s.shownAt))return null;
  const a=annotation.data,segment=segments[a.sentenceIndex];
  if(!segment||!a.quote.includes(a.title))return null;
  const start=segment.text.indexOf(a.quote);
  if(start<0||start!==segment.text.lastIndexOf(a.quote))return null;
  const parsed=actionEpisodeSchema.safeParse({id:input.id,revision:'1',scope:input.scope,responseId:input.responseId,responseRevision:input.responseRevision,segmentId:segment.id,kind:a.kind,title:a.title,text:segment.text,span:{start,end:start+a.quote.length},deliveredAt:Math.max(...segments.map(s=>s.finishedAt!)),sourceRefs:input.sourceRefs});
  return parsed.success?parsed.data:null;
}
export function episodeAffectSource(episode:ActionEpisode):AffectSource{
  const e=actionEpisodeSchema.parse(episode);
  return {id:e.id,revision:e.revision,scope:e.scope,kind:'episode',text:e.text,at:e.deliveredAt,speakerId:e.scope.characterId,delivered:true,truth:'unresolved'};
}
