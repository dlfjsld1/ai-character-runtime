import type {EventInterpretation,EventInterpretationRequest} from '../packages/contracts/src/affect-appraisal.ts';

// Authored transport fixture, not a semantic oracle. Works with the identifiers
// actually present in the wire input. No provider output is repaired here.
export function authoredReferenceReply(input:EventInterpretationRequest):EventInterpretation{
  const current=input.sources.find(s=>s.id===input.eventId)!,concern=input.sources.find(s=>s.kind==='persona'||s.kind==='goal');
  const episode=input.experience.status==='found'&&!input.experience.truncated?input.sources.find(s=>s.kind==='episode'&&s.at<=current.at):undefined;
  const quote=(s:typeof current)=>({sourceId:s.id,revision:s.revision,quote:s.text});
  return {status:concern?'appraised':'uncertain',outcome:episode?{episodeId:episode.id,use:'used',result:'pending',evidence:[quote(current),quote(episode)]}:null,
    appraisals:concern?[{episodeId:null,concern:{source:quote(concern)},evidence:[quote(current)],actorId:input.scope.characterId,targetId:input.speakerId,
      stance:'reports',relevance:.5,importance:.5,certainty:.5,congruence:.25,agency:'unknown',controllability:null,expectedness:null,expectation:null}]:[]};
}
