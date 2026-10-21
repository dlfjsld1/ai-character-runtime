import {it,expect} from 'vitest';
import {validateEventInterpretation,type AffectSource,type EventInterpretation} from '../../contracts/src/affect-appraisal.ts';
import {appendEventAffect,projectEventAffect} from './public.ts';
import {affectRequest,affectMeaning,affectSource,affectId,affectNow} from '../../../evals/affect-fixture.ts';

const quote=(source:AffectSource,text=source.text)=>({sourceId:source.id,revision:source.revision,quote:text});
function scene(){
  // An authored structural contrast using D06's facts, not repaired provider output.
  const request=affectRequest();request.eventKind='reported_outcome';request.experience.status='found';
  const current=request.sources[0]!,goal=request.sources[2]!;
  current.text='네가 권한 웃음 정거장은 재밌었어. 그런데 길어서 약속에 늦었어.';
  goal.text='재미있으면서 상영 시간이 짧은 영화를 찾는다.';
  const episode=affectSource(7,'episode','웃음 정거장을 추천해.',affectNow-1000);request.sources.push(episode);
  const positive=quote(current,'네가 권한 웃음 정거장은 재밌었어.'),negative=quote(current,'그런데 길어서 약속에 늦었어.');
  const base=affectMeaning(request,{episodeId:episode.id,concern:{source:quote(goal)},agency:'self',actorId:request.scope.characterId,targetId:request.speakerId}).appraisals[0]!;
  const meaning:EventInterpretation={status:'appraised',outcome:{episodeId:episode.id,use:'used',result:'mixed',evidence:[quote(current),quote(episode)]},
    appraisals:[{...structuredClone(base),congruence:.7,evidence:[positive,quote(episode)]},{...structuredClone(base),congruence:-.7,evidence:[negative,quote(episode)]}]};
  return {request,meaning,current,goal,episode,positive,negative};
}

it('authored D06 contrast preserves opposite observations of the same compound goal through projection and serialization',()=>{
  const {request,meaning}=scene();
  expect(meaning.appraisals[0]!.concern).toEqual(meaning.appraisals[1]!.concern);
  expect(validateEventInterpretation(meaning,request)).toEqual(meaning);
  const applied=appendEventAffect([],request,meaning,affectId(8));
  expect(applied.snapshot.levels.positive).toBeGreaterThan(0);expect(applied.snapshot.levels.negative).toBeGreaterThan(0);
  expect(applied.snapshot.contributions).toHaveLength(1);
  expect(applied.snapshot.contributions[0]!.episodeId).toBe(meaning.outcome!.episodeId);
  expect(projectEventAffect(JSON.parse(JSON.stringify(applied.records)),request.now)).toEqual(applied.snapshot);
});

it.each(['exact','property_order','evidence_order','repeated_evidence','historical_evidence'] as const)('rejects duplicated current observations despite %s changes',variation=>{
  const {request,meaning,positive,negative,episode}=scene();
  const first=meaning.appraisals[0]!;first.evidence=[positive,negative,quote(episode)];
  const duplicate=structuredClone(first);
  if(variation==='property_order'){
    duplicate.concern.source={quote:first.concern.source.quote,revision:first.concern.source.revision,sourceId:first.concern.source.sourceId};
    duplicate.evidence=duplicate.evidence.map(q=>({quote:q.quote,revision:q.revision,sourceId:q.sourceId}));
  }
  if(variation==='evidence_order')duplicate.evidence.reverse();
  if(variation==='repeated_evidence')duplicate.evidence.push(positive,negative);
  if(variation==='historical_evidence'){
    const previous=affectSource(9,'input','예전에는 재미있는 것을 골랐었지.',affectNow-2000);request.sources.push(previous);
    duplicate.evidence.push(quote(previous));
  }
  meaning.appraisals=[first,duplicate];
  expect(()=>validateEventInterpretation(meaning,request)).toThrow('affect_duplicate_concern');
});

it('one-sided and two positive observations do not acquire an invented negative channel',()=>{
  const {request,meaning}=scene();meaning.appraisals[1]!.congruence=.3;
  const bothPositive=appendEventAffect([],request,meaning,affectId(8)).snapshot;
  expect(bothPositive.levels.positive).toBeGreaterThan(0);expect(bothPositive.levels.negative).toBe(0);
  meaning.appraisals.pop();
  const oneSided=appendEventAffect([],request,meaning,affectId(8)).snapshot;
  expect(oneSided.levels.positive).toBeGreaterThan(0);expect(oneSided.levels.negative).toBe(0);
});

it('the same current observation and concern stay distinct between episode affect and input affect',()=>{
  const {request,meaning,positive}=scene();
  meaning.appraisals=[meaning.appraisals[0]!,{...structuredClone(meaning.appraisals[0]!),episodeId:null,evidence:[positive]}];
  const applied=appendEventAffect([],request,meaning,affectId(8));
  expect(applied.snapshot.contributions.map(c=>c.episodeId)).toEqual([meaning.outcome!.episodeId,null]);
  expect(applied.snapshot.contributions[0]!.levels).toEqual(applied.snapshot.contributions[1]!.levels);
});

it('a different event observation remains independent in a different delivered episode',()=>{
  const first=scene();first.meaning.appraisals.pop();
  const prior=appendEventAffect([],first.request,first.meaning,affectId(8));
  const next=scene();next.request.eventId=affectId(11);next.request.now+=1000;
  next.current.id=next.request.eventId;next.current.at=next.request.now;next.episode.id=affectId(12);
  next.meaning.outcome={episodeId:next.episode.id,use:'used',result:'mixed',evidence:[quote(next.current),quote(next.episode)]};
  next.meaning.appraisals=[{...next.meaning.appraisals[0]!,episodeId:next.episode.id,evidence:[quote(next.current,'네가 권한 웃음 정거장은 재밌었어.'),quote(next.episode)]}];
  const followed=appendEventAffect(prior.records,next.request,next.meaning,affectId(8));
  const fresh=appendEventAffect([],next.request,next.meaning,affectId(8));
  expect(followed.snapshot.contributions.at(-1)).toEqual(fresh.snapshot.contributions[0]);
  expect(followed.snapshot.contributions.map(c=>c.episodeId)).toEqual([first.episode.id,next.episode.id]);
});
