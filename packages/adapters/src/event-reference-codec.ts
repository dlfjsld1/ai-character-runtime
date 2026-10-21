import {z} from 'zod';
import {affectQuoteSchema,eventInterpretationSchema,eligibleAffectEpisodes,validateAffectRequest,validateEventInterpretation,type EventInterpretationRequest} from '../../contracts/src/affect-appraisal.ts';

export const eventWireFormatSchema=z.enum(['uuid-v3','refs-v1']);
export type EventWireFormat=z.infer<typeof eventWireFormatSchema>;
export const EVENT_REFERENCE_CODEC_VERSION='event-refs-v1';

// Only these typed paths carry identifiers. Prose, quotes and revisions never
// pass through this mapper, even when they contain a UUID or a reference label.
function mapRequestIds(request:EventInterpretationRequest,map:(id:string)=>string):EventInterpretationRequest{
  const scope=(value:EventInterpretationRequest['scope'])=>({ownerId:map(value.ownerId),characterId:map(value.characterId)});
  return {...request,scope:scope(request.scope),eventId:map(request.eventId),speakerId:map(request.speakerId),
    sources:request.sources.map(s=>({...s,scope:scope(s.scope),id:map(s.id),speakerId:s.speakerId===null?null:map(s.speakerId)})),
    actors:request.actors.map(a=>({...a,id:map(a.id)})),stateSourceRefs:request.stateSourceRefs.map(r=>({...r,sourceId:map(r.sourceId)}))};
}

export function createEventReferenceCodec(input:EventInterpretationRequest){
  const snapshot=validateAffectRequest(input),eligible=eligibleAffectEpisodes(snapshot),allowed=new Set(eligible.map(s=>s.id));
  const visible={...snapshot,sources:snapshot.sources.filter(s=>s.kind!=='episode'||allowed.has(s.id))};
  const ids=new Set<string>();mapRequestIds(visible,id=>{ids.add(id);return id;});
  const entries=[...ids].sort().map((id,i)=>[id,`r${i+1}`] as const),forward=new Map<string,string>(entries),reverse=new Map<string,string>(entries.map(([id,ref])=>[ref,id]));
  const encode=(id:string)=>{const ref=forward.get(id);if(!ref)throw new Error('affect_reference_unknown');return ref;};
  const restore=(ref:string)=>{const id=reverse.get(ref);if(!id)throw new Error('affect_reference_unknown');return id;};
  const enumFor=(values:string[])=>z.enum([...new Set(values.map(encode))] as [string,...string[]]);
  const quoteFor=(values:string[])=>affectQuoteSchema.extend({sourceId:enumFor(values)});
  const current=snapshot.sources.find(s=>s.id===snapshot.eventId)!;
  const concernIds=visible.sources.filter(s=>s.kind==='persona'||s.kind==='goal').map(s=>s.id);
  const expectationIds=visible.sources.filter(s=>(s.kind==='expectation'||s.kind==='response')&&s.at<current.at).map(s=>s.id);
  const episodeIds=eligible.map(s=>s.id),evidenceQuote=quoteFor(visible.sources.map(s=>s.id));
  // With no concern the array must be empty; the item remains a valid shape,
  // rather than an empty enum or a newly nullable required concern.
  const concernQuote=concernIds.length?quoteFor(concernIds):affectQuoteSchema.extend({sourceId:z.string().min(1)});
  const appraisal=eventInterpretationSchema.shape.appraisals.element.extend({
    episodeId:episodeIds.length?enumFor(episodeIds).nullable():z.null(),
    concern:z.object({source:concernQuote}).strict(),evidence:z.array(evidenceQuote).min(1).max(8),
    actorId:enumFor([...snapshot.actors.map(a=>a.id),snapshot.scope.characterId]).nullable(),
    targetId:enumFor([...snapshot.actors.map(a=>a.id),snapshot.scope.characterId]).nullable(),
    expectation:expectationIds.length?quoteFor(expectationIds).nullable():z.null(),
    expectedness:expectationIds.length?eventInterpretationSchema.shape.appraisals.element.shape.expectedness:z.null(),
  });
  const outcome=episodeIds.length?eventInterpretationSchema.shape.outcome.unwrap().extend({
    episodeId:enumFor(episodeIds),evidence:z.array(evidenceQuote).min(2).max(8),
    use:eventInterpretationSchema.shape.outcome.unwrap().shape.use.describe('선택한 자기 episode의 사용 여부다. 현재 근거가 실제 사용을 보고할 때 used, 미사용이면 not_used, 가정이면 hypothetical, 불명확하면 unknown. 타인의 사용을 복사하지 않는다. 사용 여부와 결과 대기는 별개다.'),
  }).nullable():z.null();
  const wireSchema=eventInterpretationSchema.safeExtend({outcome,appraisals:z.array(appraisal).max(concernIds.length?8:0)});
  const quote=(q:z.infer<typeof evidenceQuote>)=>({...q,sourceId:restore(q.sourceId)});
  const nullable=(ref:string|null)=>ref===null?null:restore(ref);
  return {wireInput:mapRequestIds(visible,encode),schema:z.toJSONSchema(wireSchema),encodeOutcome(outcome:unknown){
    const checked=validateEventInterpretation({status:'uncertain',outcome,appraisals:[]},snapshot).outcome;
    return checked===null?null:{...checked,episodeId:encode(checked.episodeId),
      evidence:checked.evidence.map(q=>({...q,sourceId:encode(q.sourceId)}))};
  },decode(output:unknown){
    const parsed=wireSchema.parse(output);
    const restored={...parsed,outcome:parsed.outcome===null?null:{...parsed.outcome,episodeId:restore(parsed.outcome.episodeId),evidence:parsed.outcome.evidence.map(quote)},
      appraisals:parsed.appraisals.map(a=>({...a,episodeId:nullable(a.episodeId),concern:{source:quote(a.concern.source)},evidence:a.evidence.map(quote),
        actorId:nullable(a.actorId),targetId:nullable(a.targetId),expectation:a.expectation===null?null:quote(a.expectation)}))};
    return validateEventInterpretation(restored,snapshot);
  }};
}
