import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {validateEventInterpretation} from '../../contracts/src/affect-appraisal.ts';
import {appendEventAffect,projectEventAffect,removeEventAffectSources} from './public.ts';
import {affectRequest,affectMeaning,affectSource,affectId,affectNow} from '../../../evals/affect-fixture.ts';

function scene(){
  const request=affectRequest();request.eventKind='reported_outcome';request.experience.status='found';
  request.sources[0]!.text='친구가 권한 것은 별로였어. 네가 권한 것은 아직 안 써 봤어.';
  request.sources.push(affectSource(7,'episode','이것을 써 보길 추천해.',affectNow-1000));
  const quote=(index:number)=>{const s=request.sources[index]!;return {sourceId:s.id,revision:s.revision,quote:s.text};};
  const base=affectMeaning(request,{congruence:-.6});
  const {episodeId:_legacy,...rest}=base as any;
  const meaning:any={...rest,outcome:{episodeId:affectId(7),use:'not_used',result:'pending',evidence:[quote(0),quote(3)]},appraisals:[{...base.appraisals[0],episodeId:null,agency:'other'}]};
  return {request,meaning,quote};
}
it('own non-use outcome and current-input concern coexist without attributing negative affect to that episode',()=>{
  const {request,meaning}=scene();expect(validateEventInterpretation(meaning,request)).toEqual(meaning);
  const result=appendEventAffect([],request,meaning,affectId(8));
  expect(result.snapshot.levels.negative).toBeGreaterThan(0);
  expect(result.snapshot.contributions).toHaveLength(1);expect(result.snapshot.contributions[0]).toMatchObject({episodeId:null});
  expect(result.records[0]!.interpretation.outcome).toMatchObject({use:'not_used',result:'pending'});
});
it('outcome confirmation can be stored with no affect, and input affect does not need an episode',()=>{
  const {request,meaning}=scene();meaning.status='irrelevant';meaning.appraisals=[];
  expect(appendEventAffect([],request,meaning,affectId(8)).snapshot.contributions).toEqual([]);
  const input=scene();input.meaning.outcome=null;
  expect(appendEventAffect([],input.request,input.meaning,affectId(8)).snapshot.contributions[0]).toMatchObject({episodeId:null});
});
it.each(['unobserved','wrong_episode','missing_quote','input_episode_quote','missing_outcome_quote','legacy_root'])('rejects cross-scope attribution: %s',kind=>{
  const {request,meaning,quote}=scene();
  if(kind==='unobserved')meaning.appraisals[0].episodeId=affectId(7);
  if(kind==='wrong_episode'){meaning.outcome.use='used';meaning.outcome.result='unfavorable';meaning.appraisals[0].episodeId=affectId(99);}
  if(kind==='missing_quote'){meaning.outcome.use='used';meaning.outcome.result='unfavorable';meaning.appraisals[0].episodeId=affectId(7);}
  if(kind==='input_episode_quote')meaning.appraisals[0].evidence.push(quote(3));
  if(kind==='missing_outcome_quote')meaning.outcome.evidence.pop();
  if(kind==='legacy_root')meaning.episodeId=affectId(7);
  expect(()=>validateEventInterpretation(meaning,request)).toThrow();
});
it('actual use with an external cause stays episode-bound; input empathy has separate saturation and attribution',()=>{
  const {request,meaning,quote}=scene();request.sources[0]!.text='네가 권한 것을 사용했는데 정전 때문에 멈췄어. 친구도 따로 힘든 일이 생겼대.';
  meaning.outcome={episodeId:affectId(7),use:'used',result:'unfavorable',evidence:[quote(0),quote(3)]};
  const a=meaning.appraisals[0];a.evidence=[quote(0)];a.episodeId=null;
  meaning.appraisals.push({...structuredClone(a),episodeId:affectId(7),agency:'external',evidence:[quote(0),quote(3)]});
  const result=appendEventAffect([],request,meaning,affectId(8));
  expect(result.snapshot.contributions.map(c=>c.episodeId)).toEqual([null,affectId(7)]);
  expect(result.snapshot.contributions[0]!.levels).toEqual(result.snapshot.contributions[1]!.levels);
  expect(projectEventAffect(JSON.parse(JSON.stringify(result.records)),affectNow)).toEqual(result.snapshot);
  expect(removeEventAffectSources(result.records,new Set([request.eventId]))).toEqual([]);
});
it('recorded D02 stays invalid; an explicitly authored scoped contrast preserves empathy without self-failure',()=>{
  const fixture=JSON.parse(readFileSync(new URL('../../../evals/fixtures/affect-scope-regression-v3.json',import.meta.url),'utf8'));
  expect(()=>validateEventInterpretation(fixture.recordedV2,fixture.request)).toThrow();
  const result=appendEventAffect([],fixture.request,fixture.authoredV3,affectId(8));
  expect(result.snapshot.levels.negative).toBeGreaterThan(0);
  expect(result.snapshot.contributions.every(c=>c.episodeId===null)).toBe(true);
  expect(result.records[0]!.interpretation.outcome).toMatchObject({use:'not_used',result:'pending'});
});
it.each(['empty','ambiguous','stale','unavailable','truncated'] as const)('input affect survives %s retrieval while outcome association is blocked',status=>{
  const {request,meaning}=scene();
  if(status==='truncated')request.experience.truncated=true;else request.experience.status=status;
  expect(()=>validateEventInterpretation(meaning,request)).toThrow('affect_episode_not_available');
  meaning.outcome=null;
  expect(appendEventAffect([],request,meaning,affectId(8)).snapshot.contributions[0]).toMatchObject({episodeId:null});
});
it('repeated input concern cannot habituate a later episode result with the same host cause id',()=>{
  const first=scene();first.meaning.outcome=null;
  const one=appendEventAffect([],first.request,first.meaning,affectId(8));
  const next=scene();next.request.now+=1000;next.request.eventId=affectId(11);next.request.sources[0]!.id=next.request.eventId;next.request.sources[0]!.at=next.request.now;
  next.meaning.outcome={episodeId:affectId(7),use:'used',result:'unfavorable',evidence:[next.quote(0),next.quote(3)]};
  next.meaning.appraisals[0].episodeId=affectId(7);next.meaning.appraisals[0].evidence=[next.quote(0),next.quote(3)];
  const followed=appendEventAffect(one.records,next.request,next.meaning,affectId(8)),fresh=appendEventAffect([],next.request,next.meaning,affectId(8));
  expect(followed.snapshot.contributions.at(-1)).toEqual(fresh.snapshot.contributions[0]);
  expect(followed.snapshot.contributions.map(c=>c.episodeId)).toEqual([null,affectId(7)]);
});
