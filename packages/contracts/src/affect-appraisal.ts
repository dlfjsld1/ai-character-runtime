import {z} from 'zod';

const unit=z.number().finite().min(0).max(1);
const revision=z.string().regex(/^[1-9]\d*$/);
const instant=z.number().finite().nonnegative();
export const affectScopeSchema=z.object({ownerId:z.uuid(),characterId:z.uuid()}).strict();
export const affectLevelsSchema=z.object({positive:unit,negative:unit,activation:unit}).strict();
export type AffectLevels=z.infer<typeof affectLevelsSchema>;
export const affectSourceSchema=z.object({
  id:z.uuid(),revision,kind:z.enum(['input','persona','goal','episode','expectation','claim','response']),
  scope:affectScopeSchema,text:z.string().min(1).max(8000),at:instant,speakerId:z.uuid().nullable(),
  // Host facts describe provenance, not the model's certainty about its reading.
  delivered:z.boolean(),truth:z.enum(['supported','contradicted','unresolved']),
}).strict();
export type AffectSource=z.infer<typeof affectSourceSchema>;
export const affectReferenceSchema=z.object({sourceId:z.uuid(),revision}).strict();
export const affectQuoteSchema=affectReferenceSchema.extend({quote:z.string().min(1).max(2000)}).strict();
export type AffectQuote=z.infer<typeof affectQuoteSchema>;
export const personaValueSchema=z.object({source:affectQuoteSchema}).strict();
export type PersonaValue=z.infer<typeof personaValueSchema>;

// These are shared appraisal axes, not names of situations or personality types.
export const eventAppraisalSchema=z.object({
  // null is current-input affect, not an implicit link to a retrieved episode.
  episodeId:z.uuid().nullable(),
  concern:personaValueSchema,evidence:z.array(affectQuoteSchema).min(1).max(8),
  actorId:z.uuid().nullable(),targetId:z.uuid().nullable(),stance:z.enum(['endorses','reports','quotes','questions','corrects','unclear']),
  relevance:unit,importance:unit,congruence:z.number().finite().min(-1).max(1),
  certainty:unit,agency:z.enum(['self','other','external','unknown']),
  controllability:unit.nullable(),expectedness:unit.nullable(),
  expectation:affectQuoteSchema.nullable(),
}).strict();
export type EventAppraisal=z.infer<typeof eventAppraisalSchema>;
export const eventInterpretationSchema=z.object({
  status:z.enum(['appraised','irrelevant','uncertain']),
  outcome:z.object({episodeId:z.uuid(),use:z.enum(['used','not_used','hypothetical','unknown']),result:z.enum(['favorable','unfavorable','mixed','pending','unknown']),evidence:z.array(affectQuoteSchema).min(2).max(8)}).strict().nullable(),
  appraisals:z.array(eventAppraisalSchema).max(8),
}).strict().superRefine((value,context)=>{
  if((value.status==='appraised')!==(value.appraisals.length>0))context.addIssue({code:'custom',message:'appraised requires evidence; abstention carries no appraisal'});
  if(value.outcome&&value.outcome.use!=='used'&&!['pending','unknown'].includes(value.outcome.result))context.addIssue({code:'custom',message:'an unobserved outcome cannot be a completed success or failure'});
  for(const appraisal of value.appraisals){
    if((appraisal.expectedness===null)!==(appraisal.expectation===null))context.addIssue({code:'custom',message:'expectedness requires prior expectation evidence'});
    if(appraisal.episodeId!==null&&(!value.outcome||appraisal.episodeId!==value.outcome.episodeId||value.outcome.use!=='used'||!['favorable','unfavorable','mixed'].includes(value.outcome.result)))context.addIssue({code:'custom',message:'episode affect requires the same observed action outcome'});
  }
});
export type EventInterpretation=z.infer<typeof eventInterpretationSchema>;
export const eventInterpretationRequestSchema=z.object({
  scope:affectScopeSchema,eventId:z.uuid(),eventRevision:revision,configVersion:revision,
  eventKind:z.enum(['input','reported_outcome']),now:instant,
  sources:z.array(affectSourceSchema).min(1).max(40),speakerId:z.uuid(),
  actors:z.array(z.object({id:z.uuid(),label:z.string().min(1).max(80)}).strict()).min(1).max(20),
  experience:z.object({status:z.enum(['found','empty','ambiguous','stale','unavailable']),revision,truncated:z.boolean()}).strict(),
  currentAffect:affectLevelsSchema,stateSourceRefs:z.array(affectReferenceSchema).max(100),
}).strict();
export type EventInterpretationRequest=z.infer<typeof eventInterpretationRequestSchema>;
export type EventInterpretationResult=
  | {status:'interpreted';interpretation:EventInterpretation;promptVersion:string}
  | {status:'unavailable';reason:'invalid_input'|'invalid_output'|'transport_failed';promptVersion:string};

export function sameAffectScope(a:z.infer<typeof affectScopeSchema>,b:z.infer<typeof affectScopeSchema>){return a.ownerId===b.ownerId&&a.characterId===b.characterId;}
export function validateAffectRequest(input:unknown):EventInterpretationRequest{
  const request=eventInterpretationRequestSchema.parse(input);
  if(new Set(request.sources.map(s=>s.id)).size!==request.sources.length)throw new Error('affect_duplicate_source');
  if(new Set(request.actors.map(a=>a.id)).size!==request.actors.length)throw new Error('affect_duplicate_actor');
  if(!request.actors.some(a=>a.id===request.speakerId))throw new Error('affect_speaker_unknown');
  if(Object.values(request.currentAffect).some(value=>value>0)&&!request.stateSourceRefs.length)throw new Error('affect_state_sources_missing');
  if(request.stateSourceRefs.some(ref=>ref.sourceId===request.eventId))throw new Error('affect_current_event_already_in_state');
  const current=request.sources.find(s=>s.id===request.eventId);
  if(!current||current.kind!=='input'||current.revision!==request.eventRevision||current.at>request.now||current.speakerId!==request.speakerId)throw new Error('affect_current_source_invalid');
  for(const source of request.sources){
    if(!sameAffectScope(source.scope,request.scope)||source.at>request.now)throw new Error('affect_source_scope_or_time');
    if(source.kind==='persona'&&source.revision!==request.configVersion)throw new Error('affect_persona_revision');
    if(source.speakerId!==null&&source.speakerId!==request.scope.characterId&&!request.actors.some(a=>a.id===source.speakerId))throw new Error('affect_source_speaker_unknown');
    if((source.kind==='episode'||source.kind==='response')&&!source.delivered)throw new Error('affect_undelivered_source');
    if((source.kind==='episode'||source.kind==='response')&&source.speakerId!==request.scope.characterId)throw new Error('affect_delivery_speaker_invalid');
  }
  return request;
}

// Called with a validated request. Retrieval candidates are not authority to
// confirm an episode when the snapshot is ambiguous or incomplete.
export function eligibleAffectEpisodes(request:EventInterpretationRequest):AffectSource[]{
  const current=request.sources.find(source=>source.id===request.eventId);
  if(!current||request.experience.status!=='found'||request.experience.truncated)return [];
  return request.sources.filter(source=>source.kind==='episode'&&source.delivered&&source.at<=current.at);
}

// Mechanical acceptance is not proof of semantic correctness. Quality evals
// must independently assess quotation meaning, attribution and relevance.
export function validateEventInterpretation(input:unknown,rawRequest:EventInterpretationRequest):EventInterpretation{
  const request=validateAffectRequest(rawRequest),result=eventInterpretationSchema.parse(input);
  const current=request.sources.find(s=>s.id===request.eventId)!;
  const resolve=(quote:AffectQuote)=>{
    const source=request.sources.find(s=>s.id===quote.sourceId&&s.revision===quote.revision);
    if(!source||!source.text.includes(quote.quote))throw new Error('affect_quote_not_in_snapshot');
    return source;
  };
  if(result.outcome){
    const episode=eligibleAffectEpisodes(request).find(source=>source.id===result.outcome!.episodeId);
    if(!episode)throw new Error('affect_episode_not_available');
    for(const evidence of result.outcome.evidence)resolve(evidence);
    if(!result.outcome.evidence.some(q=>q.sourceId===current.id)||!result.outcome.evidence.some(q=>q.sourceId===episode.id))throw new Error('affect_outcome_missing_evidence');
  }
  const concerns=new Set<string>();
  for(const appraisal of result.appraisals){
    const concern=resolve(appraisal.concern.source);
    if(!['persona','goal'].includes(concern.kind))throw new Error('affect_concern_not_configured');
    // One concern can respond differently to separate current observations.
    // Reordering/repeating quotes or adding old context cannot duplicate one.
    const currentEvidence=[...new Set(appraisal.evidence.filter(q=>q.sourceId===current.id)
      .map(q=>JSON.stringify([q.sourceId,q.revision,q.quote])))].sort();
    const configured=appraisal.concern.source;
    const key=JSON.stringify([appraisal.episodeId,[configured.sourceId,configured.revision,configured.quote],currentEvidence]);
    if(concerns.has(key))throw new Error('affect_duplicate_concern');concerns.add(key);
    for(const actor of [appraisal.actorId,appraisal.targetId])if(actor!==null&&actor!==request.scope.characterId&&!request.actors.some(a=>a.id===actor))throw new Error('affect_target_unknown');
    if(!appraisal.evidence.some(q=>q.sourceId===request.eventId))throw new Error('affect_missing_current_evidence');
    for(const evidence of appraisal.evidence){
      const source=resolve(evidence);
      if(source.kind==='episode'&&source.id!==appraisal.episodeId)throw new Error('affect_cross_scope_episode_evidence');
    }
    if(appraisal.episodeId&&!appraisal.evidence.some(q=>q.sourceId===appraisal.episodeId))throw new Error('affect_missing_episode_evidence');
    if(appraisal.expectation){
      const prior=resolve(appraisal.expectation);
      if(!['expectation','response'].includes(prior.kind)||prior.at>=current.at)throw new Error('affect_expectation_not_prior');
    }
  }
  return result;
}

export const eventAffectRecordSchema=z.object({
  scope:affectScopeSchema,eventId:z.uuid(),eventRevision:revision,configVersion:revision,
  policyVersion:z.string().min(1),causeId:z.uuid(),at:instant,interpretation:eventInterpretationSchema,
  sourceRefs:z.array(affectReferenceSchema).min(1).max(140),
}).strict();
export type EventAffectRecord=z.infer<typeof eventAffectRecordSchema>;
export type EmotionContribution={eventId:string;causeId:string;episodeId:string|null;at:number;levels:AffectLevels};
export type EventAffectSnapshot={asOf:number;levels:AffectLevels;contributions:EmotionContribution[]};
