import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {prepareOutcomeProbe,prepareOutcomeReferenceProbe,OUTCOME_PROBE_TASK,OUTCOME_PROBE_VERSION,OUTCOME_REFERENCE_PROBE_VERSION} from './outcome-probe.ts';
import {createEventReferenceCodec} from './event-reference-codec.ts';
import {buildEventInterpretationRequest} from './event-interpreter.ts';
import {eventInterpretationSchema} from '../../contracts/src/affect-appraisal.ts';
import {affectRequest,affectSource,affectId,affectNow} from '../../../evals/affect-fixture.ts';
import {materializeOutcomeIsolation,authoredProbeOutcome} from '../../../evals/affect-outcome-probe.ts';

const authored=materializeOutcomeIsolation(JSON.parse(readFileSync(new URL('../../../evals/fixtures/affect-outcome-isolation-v1.json',import.meta.url),'utf8')));
const scene=()=>structuredClone(authored[0]!.request);
const expected={episode:0,use:'used' as const,result:'unfavorable' as const};
const view=(probe:ReturnType<typeof prepareOutcomeProbe>)=>JSON.parse(probe.request.messages[1]!.content);
const answer=(probe:ReturnType<typeof prepareOutcomeProbe>)=>authoredProbeOutcome(view(probe),expected);

it('isolates model facts without replacing or deleting original state/provenance or changing defaults',()=>{
  const input=scene();input.currentAffect.positive=.7;input.stateSourceRefs=[{sourceId:affectId(90),revision:'1'},{sourceId:affectId(90),revision:'2'}];
  input.sources.push(affectSource(40,'claim','현재 근거 자료',affectNow-1000),affectSource(41,'response','이전 전달 응답',affectNow-1000),affectSource(42,'expectation','과거 기대',affectNow-1000));
  const original=structuredClone(input),defaultBefore=buildEventInterpretationRequest(input),refsBefore=buildEventInterpretationRequest(input,'refs-v1');
  const probe=prepareOutcomeProbe(input),wire=view(probe);
  expect(Object.keys(wire)).toEqual(['scope','eventId','eventRevision','eventKind','now','speakerId','actors','experience','sources']);
  for(const field of ['configVersion','currentAffect','stateSourceRefs','expected','family'])expect(wire).not.toHaveProperty(field);
  expect(wire.sources.map((s:any)=>s.kind)).toEqual(['input','episode','claim','response','expectation']);
  for(const source of input.sources.filter(s=>s.kind==='persona'||s.kind==='goal'))expect(JSON.stringify(probe.request)).not.toContain(source.text);
  expect(probe.originalInput).toEqual(original);expect(input).toEqual(original);
  expect(probe.request.schema).toMatchObject({type:'object',required:['outcome'],additionalProperties:false});
  expect(Object.keys(probe.request.schema.properties)).toEqual(['outcome']);expect(JSON.stringify(probe.request.schema)).not.toContain('"$ref"');
  expect(probe.decode(answer(probe))).toMatchObject({taskKind:OUTCOME_PROBE_TASK,promptVersion:OUTCOME_PROBE_VERSION});
  expect(buildEventInterpretationRequest(input)).toEqual(defaultBefore);expect(buildEventInterpretationRequest(input,'refs-v1')).toEqual(refsBefore);
});
it.each(authored.map(row=>[row.item.id,row] as const))('%s authored contract contrast roundtrips without becoming an affect result',(_id,row)=>{
  const probe=prepareOutcomeProbe(row.request),wire=view(probe),reply=authoredProbeOutcome(wire,row.item.expected);
  const decoded=probe.decode(JSON.stringify(reply));expect(decoded.outcome).toEqual(authoredProbeOutcome(row.request,row.item.expected).outcome);
  expect(decoded).not.toHaveProperty('appraisals');expect(decoded).not.toHaveProperty('status');expect(eventInterpretationSchema.safeParse(decoded).success).toBe(false);
  expect(wire).not.toHaveProperty('expected');expect(wire).not.toHaveProperty('family');
});
it.each(['unknown','whitespace','case','direct_uuid','revision','quote','state_only','persona','missing_input','missing_episode','extra_outcome'])('rejects %s output without repair or partial acceptance',kind=>{
  const input=scene();input.stateSourceRefs=[{sourceId:affectId(90),revision:'1'}];input.currentAffect.negative=.4;
  const probe=prepareOutcomeProbe(input),reply=answer(probe),outcome=reply.outcome!;
  if(kind==='unknown')outcome.episodeId='r999';if(kind==='whitespace')outcome.episodeId+=' ';
  if(kind==='case')outcome.episodeId=outcome.episodeId.toUpperCase();if(kind==='direct_uuid')outcome.episodeId=input.sources.find(s=>s.kind==='episode')!.id;
  if(kind==='revision')outcome.evidence[0]!.revision='2';if(kind==='quote')outcome.evidence[0]!.quote='존재하지 않는 인용';
  if(kind==='state_only'){const candidate={...input,sources:input.sources.filter(s=>s.kind!=='persona'&&s.kind!=='goal')};outcome.evidence[0]!.sourceId=createEventReferenceCodec(candidate).wireInput.stateSourceRefs[0]!.sourceId;}
  if(kind==='persona')outcome.evidence[0]!.sourceId=input.sources.find(s=>s.kind==='persona')!.id;
  if(kind==='missing_input')outcome.evidence=[outcome.evidence[1]!,outcome.evidence[1]!];
  if(kind==='missing_episode')outcome.evidence=[outcome.evidence[0]!,outcome.evidence[0]!];
  if(kind==='extra_outcome')Object.assign(outcome,{appraisals:[]});
  const original=structuredClone(reply);expect(()=>probe.decode(reply)).toThrow('outcome_probe_invalid_output');expect(reply).toEqual(original);
});
it.each([{},undefined,{outcome:undefined},{outcome:null,appraisals:[]},{outcome:null,status:'uncertain'},'bad json'])('requires outcome only and rejects malformed envelope %#',reply=>{
  const probe=prepareOutcomeProbe(scene());expect(()=>probe.decode(reply)).toThrow('outcome_probe_invalid_output');
});
it.each(['not_used','hypothetical','unknown'] as const)('unobserved %s cannot acquire a completed favorable result',use=>{
  const probe=prepareOutcomeProbe(scene()),reply=answer(probe);reply.outcome!.use=use;reply.outcome!.result='favorable';
  expect(()=>probe.decode(reply)).toThrow('outcome_probe_invalid_output');reply.outcome!.result='pending';expect(probe.decode(reply).outcome?.use).toBe(use);
});
it.each(['empty','ambiguous','stale','unavailable','future'] as const)('%s episode has no model or output authority, but original is retained',status=>{
  const input=scene();
  if(status==='future'){input.now+=100;input.sources.find(s=>s.kind==='episode')!.at=input.sources[0]!.at+1;}
  else input.experience.status=status;
  const probe=prepareOutcomeProbe(input);expect(view(probe).sources.some((s:any)=>s.kind==='episode')).toBe(false);
  expect(probe.originalInput.sources.some(s=>s.kind==='episode')).toBe(true);expect(probe.decode({outcome:null}).outcome).toBe(null);
  expect(()=>probe.decode(answer(prepareOutcomeProbe(scene())))).toThrow('outcome_probe_invalid_output');
});
it('input-only request permits null without inventing an episode',()=>{
  const probe=prepareOutcomeProbe(affectRequest());expect(probe.decode({outcome:null}).outcome).toBe(null);
  expect(JSON.stringify(probe.request.schema)).not.toContain('"enum":[]');
});
it('keeps private snapshots across reverse completion and mutations of caller/public originals',async()=>{
  const first=scene(),second=scene();second.sources[0]!.text='다른 입력: 작업을 실행했고 결과가 나빴어.';
  const originals=[structuredClone(first),structuredClone(second)],a=prepareOutcomeProbe(first),b=prepareOutcomeProbe(second);
  const replies=[answer(a),answer(b)];let completeA!:(value:unknown)=>void,completeB!:(value:unknown)=>void;
  const pa=new Promise(resolve=>completeA=resolve).then(a.decode),pb=new Promise(resolve=>completeB=resolve).then(b.decode);
  first.sources[0]!.text='호출자 변경';second.sources[0]!.text='두번째 변경';a.originalInput.sources[0]!.text='공개 복사본 변경';
  completeB(replies[1]);completeA(replies[0]);
  expect((await pa).outcome).toEqual(authoredProbeOutcome(originals[0]!,expected).outcome);
  expect((await pb).outcome).toEqual(authoredProbeOutcome(originals[1]!,expected).outcome);
});
it('does not claim natural-language truth verification for a consistent wrong use judgment',()=>{
  const row=authored.find(r=>r.item.expected?.use==='not_used')!,probe=prepareOutcomeProbe(row.request);
  const wrong=authoredProbeOutcome(view(probe),row.item.expected);wrong.outcome!.use='used';wrong.outcome!.result='unfavorable';
  expect(probe.decode(wrong).outcome?.use).toBe('used');expect(row.item.expected?.use).toBe('not_used');
});
it('invalid input fails before preparing a request',()=>{
  const input=scene();input.sources[0]!.speakerId=null;expect(()=>prepareOutcomeProbe(input)).toThrow();
});
it('a truncated read keeps the newest episodes visible; older ones are left for an unresolved reference',()=>{
  const input=scene();input.experience.truncated=true;
  const probe=prepareOutcomeReferenceProbe(input),wire=JSON.parse(probe.request.messages[1]!.content);
  expect(wire.experience.truncated).toBe(true);expect(wire.sources.some((s:any)=>s.kind==='episode')).toBe(true);
  expect(probe.request.messages[0]!.content).toContain('experience.truncated=true');
  expect(probe.decode({...authoredProbeOutcome(wire,expected),unresolvedReference:null}).outcome?.result).toBe('unfavorable');
});
it('the runtime reference variant reports only a verbatim, unmatched reference in the current input',()=>{
  const input=scene(),current=input.sources.find(s=>s.id===input.eventId)!,probe=prepareOutcomeReferenceProbe(input);
  expect(probe.request.promptVersion).toBe(OUTCOME_REFERENCE_PROBE_VERSION);expect(probe.request.schema.required).toEqual(['outcome','unresolvedReference']);
  expect(probe.decode({outcome:null,unresolvedReference:null})).toEqual({outcome:null,unresolvedReference:null});
  const quote=current.text.slice(0,6);
  expect(probe.decode({outcome:null,unresolvedReference:{quote}})).toEqual({outcome:null,unresolvedReference:{sourceId:current.id,revision:current.revision,quote}});
  // Not in the current input, together with an identified outcome, or missing the field.
  expect(()=>probe.decode({outcome:null,unresolvedReference:{quote:'입력에 없는 말'}})).toThrow('outcome_probe_invalid_output');
  const reply=authoredProbeOutcome(JSON.parse(probe.request.messages[1]!.content),expected);
  expect(()=>probe.decode({...reply,unresolvedReference:{quote}})).toThrow('outcome_probe_invalid_output');
  expect(()=>probe.decode({outcome:null})).toThrow('outcome_probe_invalid_output');
  // The evaluation variant keeps its recorded request shape.
  expect(prepareOutcomeProbe(input).request.schema.required).toEqual(['outcome']);expect(prepareOutcomeProbe(input).request.promptVersion).toBe(OUTCOME_PROBE_VERSION);
});
