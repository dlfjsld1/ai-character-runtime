import {z} from 'zod';
import {
  eventAffectRecordSchema,sameAffectScope,validateAffectRequest,validateEventInterpretation,
  type AffectLevels,type EventAffectRecord,type EventAffectSnapshot,type EventInterpretationRequest,
} from '../../contracts/src/affect-appraisal.ts';

export const eventAffectPolicySchema=z.object({
  version:z.string().min(1),gain:z.number().positive().max(1),
  causeCap:z.number().positive().max(1),totalCap:z.number().positive().max(1),
  halfLifeMs:z.number().finite().positive(),habituationHalfLifeMs:z.number().finite().positive(),
}).strict();
export type EventAffectPolicy=z.infer<typeof eventAffectPolicySchema>;
// Provisional global dynamics for O1; no event/trait-specific weights. Freeze
// after development evaluation, before reading confirm-set model results.
export const eventAffectPolicy:Readonly<EventAffectPolicy>=Object.freeze({version:'event-affect-v3-dev1',gain:.35,causeCap:.6,totalCap:.9,halfLifeMs:1200000,habituationHalfLifeMs:600000});
const channels=['positive','negative','activation'] as const;
const zero=():AffectLevels=>({positive:0,negative:0,activation:0});
const fade=(age:number,half:number)=>2**(-Math.max(0,age)/half);

function drive(record:EventAffectRecord,episodeId:string|null):AffectLevels{
  const levels=zero();
  for(const a of record.interpretation.appraisals){
    if(a.episodeId!==episodeId)continue;
    const weight=a.relevance*a.importance*a.certainty;
    levels.positive=Math.max(levels.positive,weight*Math.max(0,a.congruence));
    levels.negative=Math.max(levels.negative,weight*Math.max(0,-a.congruence));
    levels.activation=Math.max(levels.activation,weight*Math.max(Math.abs(a.congruence),a.expectedness===null?0:1-a.expectedness));
  }
  return levels;
}

export function projectEventAffect(rawRecords:readonly EventAffectRecord[],now:number,rawPolicy:EventAffectPolicy=eventAffectPolicy):EventAffectSnapshot{
  const policy=eventAffectPolicySchema.parse(rawPolicy);
  if(!Number.isFinite(now)||now<0)throw new Error('affect_clock_invalid');
  const records=rawRecords.map(r=>eventAffectRecordSchema.parse(r));
  const first=records[0];
  const events=new Set<string>();
  for(const record of records){
    if(events.has(record.eventId))throw new Error('affect_duplicate_event');events.add(record.eventId);
    if(record.at>now)throw new Error('affect_clock_before_event');
    if(record.policyVersion!==policy.version)throw new Error('affect_policy_mismatch');
    if(first&&(!sameAffectScope(first.scope,record.scope)||first.configVersion!==record.configVersion))throw new Error('affect_mixed_scope_or_config');
  }
  // Recompute from valid records. Removing a cause also removes its influence
  // on later saturation/habituation; no deleted residue in a global accumulator.
  const groups=new Map<string,{at:number;pressure:number;levels:AffectLevels}>();
  const contributions:EventAffectSnapshot['contributions']=[];
  for(const record of records.sort((a,b)=>a.at-b.at||a.eventId.localeCompare(b.eventId))){
    for(const episodeId of new Set(record.interpretation.appraisals.map(a=>a.episodeId))){
    const groupKey=JSON.stringify([record.causeId,episodeId]);
    const previous=groups.get(groupKey),elapsed=previous?record.at-previous.at:0;
    const pressure=previous?previous.pressure*fade(elapsed,policy.habituationHalfLifeMs):0;
    const existing=zero(),levels=zero(),stimulus=drive(record,episodeId);
    for(const channel of channels){
      existing[channel]=previous?previous.levels[channel]*fade(elapsed,policy.halfLifeMs):0;
      levels[channel]=Math.min(Math.max(0,policy.causeCap-existing[channel]),policy.gain*stimulus[channel]/(1+pressure));
    }
    if(channels.some(c=>levels[c]>0)){
      contributions.push({eventId:record.eventId,causeId:record.causeId,episodeId,at:record.at,levels});
      groups.set(groupKey,{at:record.at,pressure:pressure+1,levels:{positive:existing.positive+levels.positive,negative:existing.negative+levels.negative,activation:existing.activation+levels.activation}});
    }
    }
  }
  const levels=zero();
  for(const contribution of contributions)for(const channel of channels)levels[channel]+=contribution.levels[channel]*fade(now-contribution.at,policy.halfLifeMs);
  for(const channel of channels)levels[channel]=Math.min(policy.totalCap,Math.max(0,levels[channel]));
  return {asOf:now,levels,contributions};
}

export function appendEventAffect(history:readonly EventAffectRecord[],request:EventInterpretationRequest,interpretation:unknown,causeId:string,policy:EventAffectPolicy=eventAffectPolicy){
  const input=validateAffectRequest(request),meaning=validateEventInterpretation(interpretation,input);
  const current=input.sources.find(s=>s.id===input.eventId)!;
  // All material read by the interpreter is a dependency, not just the quotes
  // it chose to cite. This includes prior affect used to interpret a new event.
  const sourceRefs=[...new Map([...input.sources.map(s=>({sourceId:s.id,revision:s.revision})),...input.stateSourceRefs].map(ref=>[`${ref.sourceId}:${ref.revision}`,ref])).values()];
  const record=eventAffectRecordSchema.parse({scope:input.scope,eventId:input.eventId,eventRevision:input.eventRevision,configVersion:input.configVersion,policyVersion:policy.version,causeId,at:current.at,interpretation:meaning,sourceRefs});
  // Validate even the duplicate path: a foreign owner cannot reuse an event ID.
  projectEventAffect([...history.filter(r=>r.eventId!==record.eventId),record],input.now,policy);
  const previous=history.find(r=>r.eventId===record.eventId);
  if(previous&&(!sameAffectScope(previous.scope,record.scope)||previous.configVersion!==record.configVersion))throw new Error('affect_event_scope_mismatch');
  if(previous&&BigInt(previous.eventRevision)>=BigInt(record.eventRevision))return {status:'duplicate' as const,records:[...history],snapshot:projectEventAffect(history,input.now,policy)};
  const retained=previous?removeEventAffectSources(history,new Set([record.eventId])):[...history];
  if(previous){
    const kept=new Set(retained.map(r=>r.eventId)),removed=new Set(history.filter(r=>!kept.has(r.eventId)).map(r=>r.eventId));
    if(record.sourceRefs.some(ref=>ref.sourceId!==record.eventId&&removed.has(ref.sourceId)))throw new Error('affect_revision_requires_clean_context');
  }
  const records=[...retained,record];
  return {status:previous?'revised' as const:'applied' as const,records,snapshot:projectEventAffect(records,input.now,policy)};
}

// Maps one applied event's contribution onto the legacy State channels. This
// path never names the speaker as a target: interpersonal distance stays with
// the verified social act. A self-attributed conflict is embarrassment, not blame.
export function eventAffectStimuli(record:EventAffectRecord,snapshot:EventAffectSnapshot){
  const levels=zero();
  for(const c of snapshot.contributions)if(c.eventId===record.eventId)for(const channel of channels)levels[channel]+=c.levels[channel];
  const strongest=record.interpretation.appraisals.filter(a=>a.congruence<0)
    .sort((a,b)=>b.relevance*b.importance*b.certainty*-b.congruence-a.relevance*a.importance*a.certainty*-a.congruence)[0];
  // A correction of the character's own earlier explanation reads as
  // embarrassment even when the host cannot confirm it (2026-10-22 user
  // decision; a future persona setting may change this).
  const self=strongest?.agency==='self'||strongest?.agency==='unknown'&&strongest.stance==='corrects'&&strongest.actorId===record.scope.characterId;
  return {joy:levels.positive,frustration:self?0:levels.negative,embarrassment:self?levels.negative:0};
}

export function removeEventAffectSources(records:readonly EventAffectRecord[],sourceIds:ReadonlySet<string>):EventAffectRecord[]{
  const removed=new Set(sourceIds);
  let changed=true;
  while(changed){
    changed=false;
    for(const record of records)if(!removed.has(record.eventId)&&record.sourceRefs.some(ref=>removed.has(ref.sourceId))){removed.add(record.eventId);changed=true;}
  }
  return records.filter(record=>!removed.has(record.eventId));
}
