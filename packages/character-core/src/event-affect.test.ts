import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {appendEventAffect,projectEventAffect,removeEventAffectSources,eventAffectPolicy} from './public.ts';
import type {EventAffectRecord} from './public.ts';
import {affectRequest,affectMeaning,affectSource,affectId,affectNow} from '../../../evals/affect-fixture.ts';

it('C2 continuity retains both channels across topic/reengagement, deduplicates, and retracts only dependent causes',()=>{
  const first=affectRequest();first.sources[0]!.text='도움은 됐어. 부담도 생겼어.';
  const mixed=affectMeaning(first),negative=structuredClone(mixed.appraisals[0]!);
  mixed.appraisals[0]!.evidence[0]!.quote='도움은 됐어.';negative.evidence[0]!.quote='부담도 생겼어.';negative.congruence=-1;mixed.appraisals.push(negative);
  const initial=appendEventAffect([],first,mixed,affectId(80));
  const independent=affectRequest(11,affectNow+1000);independent.sources[0]!.text='다른 약속도 잘 마쳤어.';
  let history=appendEventAffect(initial.records,independent,affectMeaning(independent),affectId(81)).records;
  for(const [id,text] of [[12,'다른 주제로 오늘 일정을 볼까?'],[13,'다시 이야기하자.']] as const){
    const request=affectRequest(id,affectNow+id*1000),before=projectEventAffect(history,request.now);request.sources[0]!.text=text;
    request.currentAffect=before.levels;request.stateSourceRefs=history.map(r=>({sourceId:r.eventId,revision:r.eventRevision}));
    const next=appendEventAffect(history,request,{status:'irrelevant',outcome:null,appraisals:[]},affectId(id+80));
    expect(next.snapshot).toEqual(before);expect(next.snapshot.levels.positive).toBeGreaterThan(0);expect(next.snapshot.levels.negative).toBeGreaterThan(0);history=next.records;
  }
  const frozen=structuredClone(history);
  for(let i=0;i<100;i++)history=appendEventAffect(history,{...first,now:affectNow+20000},mixed,affectId(99)).records;
  expect(history).toEqual(frozen);expect(projectEventAffect(history,affectNow+20000)).toEqual(projectEventAffect(frozen,affectNow+20000));
  const retained=removeEventAffectSources(history,new Set([first.eventId]));expect(retained.map(r=>r.eventId)).toEqual([independent.eventId]);
  expect(projectEventAffect(retained,affectNow+20000).levels.negative).toBe(0);expect(projectEventAffect(retained,affectNow+20000).levels.positive).toBeGreaterThan(0);
  const revised=structuredClone(first);revised.now=affectNow+20000;revised.eventRevision='2';revised.sources[0]!.revision='2';
  const correction=appendEventAffect(history,revised,{status:'irrelevant',outcome:null,appraisals:[]},affectId(80));
  expect(correction.status).toBe('revised');expect(correction.records.map(r=>r.eventId)).toEqual([independent.eventId,first.eventId]);
  expect(correction.snapshot.levels).toEqual(projectEventAffect(retained,revised.now).levels);
});

it('OA05: deterministic projection preserves inputs and does not invent interpersonal actions',()=>{
  const request=affectRequest(),meaning=affectMeaning(request),before=JSON.stringify({request,meaning});
  const result=appendEventAffect([],request,meaning,affectId(8));
  expect(result).toEqual(appendEventAffect([],request,meaning,affectId(8)));
  expect(result.snapshot.levels.positive).toBeGreaterThan(0);expect(result.snapshot.levels.negative).toBe(0);
  expect(JSON.stringify({request,meaning})).toBe(before);
  expect(result).not.toHaveProperty('speechStyle');expect(result).not.toHaveProperty('affinity');expect(result).not.toHaveProperty('participation');
});
it('OA06/17: opposite concerns coexist without cancellation or a forced emotional label',()=>{
  const request=affectRequest(),meaning=affectMeaning(request),goal=request.sources[2]!;
  meaning.appraisals.push({...meaning.appraisals[0]!,concern:{source:{sourceId:goal.id,revision:goal.revision,quote:goal.text}},congruence:-1});
  const result=appendEventAffect([],request,meaning,affectId(8));
  expect(result.snapshot.levels.positive).toBeGreaterThan(0);expect(result.snapshot.levels.negative).toBeGreaterThan(0);
  expect(result.records[0]!.interpretation.appraisals).toHaveLength(2);
});
it.each(['irrelevant','uncertain'] as const)('OA06: %s leaves affect unchanged and does not mean silence',status=>{
  const result=appendEventAffect([],affectRequest(),{status,outcome:null,appraisals:[]},affectId(8));
  expect(result.snapshot.levels).toEqual({positive:0,negative:0,activation:0});expect(result.snapshot.contributions).toEqual([]);
  expect(result).not.toHaveProperty('participation');
});
it('OA08: 100 redeliveries do not reset contribution time, renew intensity or mutate the journal',()=>{
  const request=affectRequest(),first=appendEventAffect([],request,affectMeaning(request),affectId(8));
  let records=first.records;
  for(let i=1;i<=100;i++){
    const next={...request,now:affectNow+i*1000};
    const replay=appendEventAffect(records,next,affectMeaning(next),affectId(9));
    expect(replay.status).toBe('duplicate');expect(replay.records).toEqual(first.records);records=replay.records;
  }
  const decayed=projectEventAffect(records,affectNow+eventAffectPolicy.halfLifeMs);
  expect(decayed.levels.positive).toBeCloseTo(first.snapshot.levels.positive/2,12);
});
it('OA08: new interactions habituate by cause, saturate, recover with time, and leave new causes responsive',()=>{
  let records:EventAffectRecord[]=[];
  for(let i=0;i<100;i++){
    const request=affectRequest(100+i,affectNow+i);
    records=appendEventAffect(records,request,affectMeaning(request),affectId(8)).records;
  }
  const saturated=projectEventAffect(records,affectNow+100);
  expect(saturated.levels.positive).toBeLessThanOrEqual(eventAffectPolicy.causeCap);
  expect(saturated.contributions[1]!.levels.positive).toBeLessThan(saturated.contributions[0]!.levels.positive);
  const fresh=affectRequest(300,affectNow+101),newCause=appendEventAffect(records,fresh,affectMeaning(fresh),affectId(9));
  expect(newCause.snapshot.contributions.at(-1)!.levels.positive).toBeCloseTo(saturated.contributions[0]!.levels.positive);
  const later=affectRequest(301,affectNow+20*eventAffectPolicy.habituationHalfLifeMs);
  const recovered=appendEventAffect(records,later,affectMeaning(later),affectId(8));
  expect(recovered.snapshot.contributions.at(-1)!.levels.positive).toBeGreaterThan(.25);
});
it('OA17: uncertainty attenuates a shared drive; surprise needs prior expectation and no sentiment sign',()=>{
  const request=affectRequest();request.sources.push(affectSource(30,'expectation','준비는 아직 절반 정도 됐을 거야.',affectNow-1000));
  const expectation={sourceId:affectId(30),revision:'1',quote:request.sources.at(-1)!.text};
  const surprised=appendEventAffect([],request,affectMeaning(request,{congruence:0,expectedness:0,expectation}),affectId(8));
  expect(surprised.snapshot.levels.positive+surprised.snapshot.levels.negative).toBe(0);expect(surprised.snapshot.levels.activation).toBeGreaterThan(0);
  const certain=appendEventAffect([],request,affectMeaning(request),affectId(8));
  const uncertain=appendEventAffect([],request,affectMeaning(request,{certainty:.2}),affectId(8));
  expect(uncertain.snapshot.levels.positive).toBeCloseTo(certain.snapshot.levels.positive*.2);
});
it('OA09: deletion invalidates even uncited input and affect dependencies transitively, leaving unrelated events',()=>{
  const first=affectRequest(),one=appendEventAffect([],first,affectMeaning(first),affectId(8));
  const second=affectRequest(11,affectNow+1000);second.sources.push({...first.sources[0]!});
  const two=appendEventAffect(one.records,second,affectMeaning(second),affectId(9));
  const third=affectRequest(12,affectNow+2000);third.currentAffect={...two.snapshot.levels};third.stateSourceRefs=[{sourceId:second.eventId,revision:'1'}];
  const three=appendEventAffect(two.records,third,affectMeaning(third),affectId(9));
  const independent=affectRequest(13,affectNow+3000),four=appendEventAffect(three.records,independent,affectMeaning(independent),affectId(9));
  const retained=removeEventAffectSources(four.records,new Set([first.eventId]));
  expect(retained.map(r=>r.eventId)).toEqual([independent.eventId]);
  expect(projectEventAffect(retained,independent.now)).toEqual(appendEventAffect([],independent,affectMeaning(independent),affectId(9)).snapshot);
});
it('OA09: a new source revision replaces its contribution and invalidates dependent evaluations',()=>{
  const request=affectRequest(),first=appendEventAffect([],request,affectMeaning(request),affectId(8));
  const dependent=affectRequest(11,affectNow+1);dependent.sources.push(request.sources[0]!);
  const second=appendEventAffect(first.records,dependent,affectMeaning(dependent),affectId(9));
  const revised=structuredClone(request);revised.eventRevision='2';revised.sources[0]!.revision='2';revised.now=dependent.now;
  const result=appendEventAffect(second.records,revised,affectMeaning(revised,{congruence:-1}),affectId(8));
  expect(result.status).toBe('revised');expect(result.records).toHaveLength(1);expect(result.snapshot.levels.positive).toBe(0);expect(result.snapshot.levels.negative).toBeGreaterThan(0);
});
it('OA09: a correction cannot reuse a descendant state that the correction itself invalidates',()=>{
  const first=affectRequest(),one=appendEventAffect([],first,affectMeaning(first),affectId(8));
  const second=affectRequest(11,affectNow+1000);second.sources.push(first.sources[0]!);
  const two=appendEventAffect(one.records,second,affectMeaning(second),affectId(9));
  const revised=structuredClone(first);revised.eventRevision='2';revised.sources[0]!.revision='2';revised.now=second.now;
  revised.currentAffect={...two.snapshot.levels};revised.stateSourceRefs=[{sourceId:second.eventId,revision:'1'}];
  expect(()=>appendEventAffect(two.records,revised,affectMeaning(revised,{congruence:-1}),affectId(8))).toThrow('affect_revision_requires_clean_context');
});
it('OA05/10: restart serialization preserves decay; invalid time, scope, policy and duplicate events are rejected',()=>{
  const request=affectRequest(),result=appendEventAffect([],request,affectMeaning(request),affectId(8));
  expect(projectEventAffect(JSON.parse(JSON.stringify(result.records)),affectNow+1234)).toEqual(projectEventAffect(result.records,affectNow+1234));
  expect(()=>projectEventAffect(result.records,affectNow-1)).toThrow('affect_clock_before_event');
  expect(()=>projectEventAffect(result.records,NaN)).toThrow();
  expect(()=>projectEventAffect(result.records,affectNow,{...eventAffectPolicy,version:'other'})).toThrow('affect_policy_mismatch');
  expect(()=>projectEventAffect([...result.records,...result.records],affectNow)).toThrow('affect_duplicate_event');
  const foreign=structuredClone(request);foreign.scope.ownerId=affectId(99);foreign.sources.forEach(s=>s.scope.ownerId=foreign.scope.ownerId);
  expect(()=>appendEventAffect(result.records,foreign,affectMeaning(foreign),affectId(8))).toThrow('affect_event_scope_mismatch');
});
it('OA15: public Core entry points contain no provider, database or network imports',()=>{
  for(const name of ['public.ts','event-affect.ts']){
    const code=readFileSync(new URL(name,import.meta.url),'utf8');
    expect(code).not.toMatch(/(?:from\s*|import\s*\()['"][^'"]*(?:adapters|database|node:|http)/);
    expect(code).not.toMatch(/\b(?:fetch|Date\.now|Math\.random)\s*\(/);
  }
});
