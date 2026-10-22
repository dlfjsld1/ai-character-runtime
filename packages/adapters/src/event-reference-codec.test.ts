import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createEventReferenceCodec} from './event-reference-codec.ts';
import {StructuredEventInterpreter,buildEventInterpretationRequest} from './event-interpreter.ts';
import {affectRequest,affectSource,affectId,affectNow} from '../../../evals/affect-fixture.ts';
import {authoredReferenceReply} from '../../../evals/affect-reference-fixture.ts';
import {validateAffectSuites,affectHash} from '../../../evals/affect-cases.ts';
import {materializeAffectDiagnostic} from '../../../evals/affect-diagnostic.ts';
import {deepseekPayload} from './deepseek.ts';
import {appendEventAffect} from '../../character-core/src/event-affect.ts';

function scene(){const request=affectRequest();request.experience.status='found';request.sources.push(affectSource(7,'episode','추천을 전달했다.',affectNow-1000));return request;}
const quote=(s:{id:string;revision:string;text:string})=>({sourceId:s.id,revision:s.revision,quote:s.text});
it('C2 encodeOutcome validates the snapshot and only remaps identifier fields',()=>{
  const input=scene();input.sources[0]!.text+=' r1 '+input.scope.ownerId;
  const codec=createEventReferenceCodec(input),outcome={episodeId:input.sources.at(-1)!.id,use:'used' as const,result:'mixed' as const,evidence:[quote(input.sources[0]!),quote(input.sources.at(-1)!)]};
  const wire=codec.encodeOutcome(outcome)!;expect(wire.evidence[0]!.quote).toBe(outcome.evidence[0]!.quote);expect(wire.evidence[0]!.revision).toBe('1');
  expect(codec.decode({status:'uncertain',outcome:wire,appraisals:[]}).outcome).toEqual(outcome);expect(codec.encodeOutcome(null)).toBeNull();
  expect(()=>codec.encodeOutcome({...outcome,evidence:[{...outcome.evidence[0]!,revision:'2'},outcome.evidence[1]!]})).toThrow();
});
it('keeps the frozen UUID diagnostic request hash and defaults while refs is an explicit instance choice',()=>{
  const read=(name:string)=>JSON.parse(readFileSync(new URL(`../../../evals/fixtures/${name}.json`,import.meta.url),'utf8'));
  const suite=validateAffectSuites(read('affect-dev-v3'),read('affect-confirm-v3')).dev;
  const rows=materializeAffectDiagnostic(suite,read('affect-diagnostic-v1'));
  const bodies=rows.map(r=>{
    const a=buildEventInterpretationRequest(r.request),b=buildEventInterpretationRequest(r.request,'uuid-v3');expect(a).toEqual(b);
    expect(buildEventInterpretationRequest(r.request,'refs-v1').promptVersion).toBe('event-interpretation-v3-refs1');
    expect(buildEventInterpretationRequest(r.request)).toEqual(a);return JSON.stringify(deepseekPayload(a,2048));
  });
  expect(affectHash(bodies.sort())).toBe('23268ba53b10308d72e34c10f24dcbfa5bd4cab266fc5e9f95763aebe25bae4b');
});
it('deterministically roundtrips nonempty output without replacing identifier-like prose',()=>{
  const request=scene();request.sources[0]!.text+=' r1 '+request.scope.ownerId;
  request.sources.push(affectSource(8,'claim','검증된 추가 근거',affectNow-1000));
  const before=JSON.stringify(request),codec=createEventReferenceCodec(request),wire=codec.wireInput,reply=authoredReferenceReply(wire),meaning=authoredReferenceReply(request);
  reply.appraisals[0]!.evidence.push(quote(wire.sources.at(-1)!));meaning.appraisals[0]!.evidence.push(quote(request.sources.at(-1)!));
  expect(wire.sources[0]!.text).toBe(request.sources[0]!.text);expect(codec.decode(reply)).toEqual(meaning);
  expect(appendEventAffect([],request,codec.decode(reply),request.eventId).snapshot).toEqual(appendEventAffect([],request,meaning,request.eventId).snapshot);
  expect(JSON.stringify(createEventReferenceCodec(request).wireInput)).toBe(JSON.stringify(wire));
  expect(JSON.stringify(createEventReferenceCodec(request).schema)).toBe(JSON.stringify(codec.schema));expect(JSON.stringify(request)).toBe(before);
});
it('preserves mixed observations of the same concern and their Core contributions',()=>{
  const request=scene();request.sources[0]!.text='재밌었어. 늦었어.';
  const codec=createEventReferenceCodec(request),wire=codec.wireInput;
  const mixed=(input:typeof request)=>{const m=authoredReferenceReply(input);m.outcome!.result='mixed';const a=m.appraisals[0]!;a.episodeId=m.outcome!.episodeId;
    a.evidence=[{...quote(input.sources[0]!),quote:'재밌었어.'},quote(input.sources[3]!)];a.congruence=.7;
    m.appraisals.push({...structuredClone(a),congruence:-.6,evidence:[{...quote(input.sources[0]!),quote:'늦었어.'},quote(input.sources[3]!)]});return m;};
  const decoded=codec.decode(mixed(wire));expect(decoded).toEqual(mixed(request));
  const levels=appendEventAffect([],request,decoded,request.eventId).snapshot.levels;expect(levels.positive).toBeGreaterThan(0);expect(levels.negative).toBeGreaterThan(0);
});
it.each(['unknown','space','case','uuid','claim_concern','owner_actor','wrong_revision','invented_quote','extra_field','cross_episode'])('rejects %s without repairing output',kind=>{
  const request=scene();request.scope.ownerId=affectId(50);for(const s of request.sources)s.scope={...request.scope};
  request.sources.push(affectSource(8,'claim','追加',affectNow-1000));request.sources.at(-1)!.scope={...request.scope};
  const codec=createEventReferenceCodec(request),wire=codec.wireInput,reply:any=authoredReferenceReply(wire),a=reply.appraisals[0];
  if(kind==='unknown')a.concern.source.sourceId='r999';if(kind==='space')a.concern.source.sourceId+=' ';
  if(kind==='case')a.concern.source.sourceId=a.concern.source.sourceId.toUpperCase();if(kind==='uuid')a.concern.source.sourceId=request.sources[1]!.id;
  if(kind==='claim_concern')a.concern.source=quote(wire.sources.at(-1)!);if(kind==='owner_actor')a.actorId=wire.scope.ownerId;
  if(kind==='wrong_revision')a.evidence[0].revision='2';if(kind==='invented_quote')a.evidence[0].quote='없는 근거';
  if(kind==='extra_field')a.unknown='no';if(kind==='cross_episode')a.evidence.push(quote(wire.sources[3]!));
  const before=JSON.stringify(reply);expect(()=>codec.decode(reply)).toThrow();expect(JSON.stringify(reply)).toBe(before);
});
it('allows character outside actors and nullable actors but never state-only citation authority',()=>{
  const request=scene();request.actors=request.actors.filter(a=>a.id!==request.scope.characterId);
  request.stateSourceRefs=[{sourceId:affectId(90),revision:'1'},{sourceId:affectId(90),revision:'2'}];request.currentAffect.positive=.2;
  const codec=createEventReferenceCodec(request),wire=codec.wireInput,reply=authoredReferenceReply(wire);
  expect(wire.stateSourceRefs).toEqual([{sourceId:wire.stateSourceRefs[0]!.sourceId,revision:'1'},{sourceId:wire.stateSourceRefs[0]!.sourceId,revision:'2'}]);
  expect(codec.decode(reply).appraisals[0]!.actorId).toBe(request.scope.characterId);
  reply.appraisals[0]!.actorId=null;reply.appraisals[0]!.targetId=null;expect(codec.decode(reply).appraisals[0]!.actorId).toBe(null);
  for(const kind of ['evidence','concern','episode']){const bad=structuredClone(reply),a=bad.appraisals[0]!,id=wire.stateSourceRefs[0]!.sourceId;
    if(kind==='evidence')a.evidence[0]!.sourceId=id;if(kind==='concern')a.concern.source.sourceId=id;if(kind==='episode')bad.outcome!.episodeId=id;
    expect(()=>codec.decode(bad)).toThrow();}
});
it.each(['empty','ambiguous','stale','unavailable'])('%s candidates have no authority while input appraisal survives',status=>{
  const request=scene();request.experience.status=status as 'empty';
  const codec=createEventReferenceCodec(request),reply=authoredReferenceReply(codec.wireInput);
  expect(codec.wireInput.sources.some(s=>s.kind==='episode')).toBe(false);expect(codec.decode(reply).appraisals).toHaveLength(1);
  const bad={...reply,outcome:{episodeId:codec.wireInput.eventId,use:'used',result:'pending',evidence:[]}};expect(()=>codec.decode(bad)).toThrow();
});
it.each([false,true])('handles no concern/expectation with episode=%s without empty enums or nullable concern',withEpisode=>{
  const request=withEpisode?scene():affectRequest();request.sources=request.sources.filter(s=>s.kind==='input'||s.kind==='episode');
  const codec=createEventReferenceCodec(request),reply=authoredReferenceReply(codec.wireInput);
  expect(JSON.stringify(codec.schema)).not.toContain('"enum":[]');expect(codec.decode(reply)).toEqual(authoredReferenceReply(request));
  expect(()=>codec.decode({...reply,status:'appraised'})).toThrow();
});
it('requires a prior expectation/response and preserves expectedness with its exact quote',()=>{
  const request=scene();request.sources.push(affectSource(9,'response','以前の期待',affectNow-500));
  const codec=createEventReferenceCodec(request),reply=authoredReferenceReply(codec.wireInput),a=reply.appraisals[0]!;
  a.expectedness=0;a.expectation=quote(codec.wireInput.sources.at(-1)!);expect(codec.decode(reply).appraisals[0]!.expectation!.sourceId).toBe(affectId(9));
  a.expectation=quote(codec.wireInput.sources[0]!);expect(()=>codec.decode(reply)).toThrow();
  const noPrior=createEventReferenceCodec(scene()),bad=authoredReferenceReply(noPrior.wireInput);bad.appraisals[0]!.expectedness=0;expect(()=>noPrior.decode(bad)).toThrow();
});
it('binds snapshots to each pending request across reverse completion and caller mutation',async()=>{
  const first=affectRequest(10),second=affectRequest(11);second.sources[0]!.text='별도 입력';
  const before=[structuredClone(first),structuredClone(second)],pending:{reply:unknown;finish:(value:unknown)=>void}[]=[];
  const interpreter=new StructuredEventInterpreter(request=>new Promise(resolve=>pending.push({reply:authoredReferenceReply(JSON.parse(request.messages[1]!.content)),finish:resolve})),undefined,'refs-v1');
  const a=interpreter.interpret(first),b=interpreter.interpret(second);first.sources[0]!.text='호출 뒤 변경';second.sources[0]!.text='또 변경';
  pending[1]!.finish(pending[1]!.reply);pending[0]!.finish(pending[0]!.reply);
  expect(await a).toMatchObject({status:'interpreted',interpretation:authoredReferenceReply(before[0]!)});
  expect(await b).toMatchObject({status:'interpreted',interpretation:authoredReferenceReply(before[1]!)});
});
