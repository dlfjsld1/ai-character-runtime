import {it,expect} from 'vitest';
import {prepareAppraisalProbe} from './appraisal-probe.ts';
import {prepareOutcomeProbe} from './outcome-probe.ts';
import {createEventReferenceCodec} from './event-reference-codec.ts';
import {affectRequest,affectSource,affectNow,affectId} from '../../../evals/affect-fixture.ts';
import type {EventInterpretation} from '../../contracts/src/affect-appraisal.ts';

function scene(){const input=affectRequest();input.experience.status='found';input.sources.push(affectSource(20,'episode','추천 r1 '+affectId(1),affectNow-1000));
  const outcome:NonNullable<EventInterpretation['outcome']>={episodeId:affectId(20),use:'used',result:'favorable',evidence:[input.sources[0]!,input.sources.at(-1)!].map(s=>({sourceId:s.id,revision:s.revision,quote:s.text}))};
  return {input,outcome};}
function reply(prepared:ReturnType<typeof prepareAppraisalProbe>,episode=true){const {input,fixedOutcome}=JSON.parse(prepared.request.messages[1]!.content),q=(s:any)=>({sourceId:s.id,revision:s.revision,quote:s.text});
  return {status:'appraised',appraisals:[{episodeId:episode?fixedOutcome.episodeId:null,concern:{source:q(input.sources.find((s:any)=>s.kind==='persona'))},
    evidence:[q(input.sources.find((s:any)=>s.id===input.eventId)),...(episode?[q(input.sources.find((s:any)=>s.id===fixedOutcome.episodeId))]:[])],
    actorId:input.speakerId,targetId:input.scope.characterId,stance:'reports',relevance:1,importance:.8,congruence:.6,certainty:1,agency:'other',controllability:null,expectedness:null,expectation:null}]};}
it('remaps fixed facts into the full-context codec without rewriting prose or the first-stage wire',()=>{
  const {input,outcome}=scene(),before=prepareOutcomeProbe(input),firstCodec=createEventReferenceCodec({...input,sources:input.sources.filter(s=>!['persona','goal'].includes(s.kind))});
  const prepared=prepareAppraisalProbe(input,outcome),wire=JSON.parse(prepared.request.messages[1]!.content);
  expect(firstCodec.encodeOutcome(outcome)!.episodeId).not.toBe(wire.fixedOutcome.episodeId);
  expect(wire.fixedOutcome.evidence.at(-1).quote).toBe(input.sources.at(-1)!.text);
  expect(prepared.decode(reply(prepared)).outcome).toEqual(outcome);expect(prepareOutcomeProbe(input).request).toEqual(before.request);
  outcome.evidence[0]!.quote='changed';input.sources[0]!.text='changed';prepared.fixedOutcome!.result='unfavorable';prepared.originalInput.sources[0]!.text='changed';
  expect(prepared.decode(reply(prepared)).outcome!.result).toBe('favorable');
});
it.each(['not_used','hypothetical','unknown','pending','result_unknown','null'] as const)('narrows %s to input affect and rejects episode appraisals',kind=>{
  const {input,outcome}=scene();if(kind==='pending')outcome.result='pending';else if(kind==='result_unknown')outcome.result='unknown';else if(kind!=='null'){outcome.use=kind;outcome.result='pending';}
  const p=prepareAppraisalProbe(input,kind==='null'?null:outcome),good=reply(p,false);
  expect((p.request.schema.properties.appraisals as any).items.properties.episodeId).toEqual({type:'null'});
  const wire=JSON.parse(p.request.messages[1]!.content).input,items=(p.request.schema.properties.appraisals as any).items;
  expect(items.properties.evidence.items.properties.sourceId.enum).toEqual(wire.sources.filter((s:any)=>s.kind!=='episode').map((s:any)=>s.id));
  expect(p.decode(good).appraisals[0]!.episodeId).toBeNull();good.appraisals[0]!.episodeId='r6';expect(()=>p.decode(good)).toThrow('appraisal_probe_invalid_output');
});
it('offers disjoint input/selected-episode evidence branches without deleting readable context',()=>{
  const {input,outcome}=scene();input.sources.push(affectSource(21,'episode','별도 추천',affectNow-500));
  const codec=createEventReferenceCodec(input),p=prepareAppraisalProbe(input,outcome),view=JSON.parse(p.request.messages[1]!.content);
  expect(view.input).toEqual(codec.wireInput);expect(view.fixedOutcome).toEqual(codec.encodeOutcome(outcome));
  const branches=(p.request.schema.properties.appraisals as any).items.anyOf;
  expect(branches).toHaveLength(2);
  const normal=view.input.sources.filter((s:any)=>s.kind!=='episode').map((s:any)=>s.id);
  expect(branches[0].properties.episodeId).toEqual({type:'null'});
  expect(branches[0].properties.evidence.items.properties.sourceId.enum).toEqual(normal);
  expect(branches[1].properties.episodeId.enum).toEqual([view.fixedOutcome.episodeId]);
  expect(branches[1].properties.evidence.items.properties.sourceId.enum).toEqual([...normal,view.fixedOutcome.episodeId]);
  for(const branch of branches){expect(branch.additionalProperties).toBe(false);expect(branch.properties.evidence.minItems).toBe(1);expect(branch.properties.evidence.maxItems).toBe(8);}
  expect(p.decode(reply(p,false)).appraisals[0]!.episodeId).toBeNull();expect(p.decode(reply(p)).appraisals[0]!.episodeId).toBe(outcome.episodeId);
  const bad:any=reply(p),other=view.input.sources.find((s:any)=>s.kind==='episode'&&s.id!==view.fixedOutcome.episodeId);
  bad.appraisals[0].evidence.push({sourceId:other.id,revision:other.revision,quote:other.text});expect(()=>p.decode(bad)).toThrow();
});
it('keeps zero concerns empty without empty enums',()=>{
  const {input,outcome}=scene();input.sources=input.sources.filter(s=>s.kind!=='persona'&&s.kind!=='goal');
  const p=prepareAppraisalProbe(input,outcome);expect(p.request.schema.properties.appraisals.maxItems).toBe(0);
  expect(JSON.stringify(p.request.schema)).not.toContain('"enum":[]');expect(p.decode({status:'irrelevant',appraisals:[]}).outcome).toEqual(outcome);
});
it.each(['outcome','extra','wrong_episode','revision','quote','expectation','scope','duplicate','status'])('rejects %s output without changing facts',kind=>{
  const {input,outcome}=scene(),p=prepareAppraisalProbe(input,outcome),raw:any=reply(p);
  if(kind==='outcome')raw.outcome=null;if(kind==='extra')raw.secret=true;if(kind==='wrong_episode')raw.appraisals[0].episodeId='r999';
  if(kind==='revision')raw.appraisals[0].evidence[0].revision='2';if(kind==='quote')raw.appraisals[0].evidence[0].quote='invented';
  if(kind==='expectation')raw.appraisals[0].expectedness=.8;if(kind==='scope')raw.appraisals[0].episodeId=null;
  if(kind==='duplicate')raw.appraisals.push(structuredClone(raw.appraisals[0]));if(kind==='status')raw.status='irrelevant';
  expect(()=>p.decode(raw)).toThrow('appraisal_probe_invalid_output');
});
it.each(['snapshot','revision','episode','search','extra'])('rejects an invalid fixed %s before transport',kind=>{
  const {input,outcome}=scene();if(kind==='snapshot')input.sources[0]!.text='different input';if(kind==='revision')outcome.evidence[0]!.revision='2';
  if(kind==='episode')outcome.episodeId=affectId(21);if(kind==='search')input.experience.status='ambiguous';if(kind==='extra')(outcome as any).status='extra';
  expect(()=>prepareAppraisalProbe(input,outcome)).toThrow();
});
it('keeps both observations of one concern instead of cancelling them',()=>{
  const {input,outcome}=scene();input.sources[0]!.text='도움이 됐어. 부담도 컸어.';outcome.evidence[0]!.quote=input.sources[0]!.text;outcome.result='mixed';
  const p=prepareAppraisalProbe(input,outcome),raw=reply(p),negative=structuredClone(raw.appraisals[0]!);
  raw.appraisals[0]!.evidence[0]!.quote='도움이 됐어.';negative.evidence[0]!.quote='부담도 컸어.';negative.congruence=-.6;raw.appraisals.push(negative);
  expect(p.decode(raw).appraisals.map(a=>a.congruence)).toEqual([.6,-.6]);
});
