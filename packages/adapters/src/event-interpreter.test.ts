import {it,expect,vi} from 'vitest';
import {StructuredEventInterpreter,type EventInterpretationTransport} from './event-interpreter.ts';
import {affectId,affectNow,affectRequest,affectMeaning,affectSource} from '../../../evals/affect-fixture.ts';

it('diagnostics distinguish JSON, schema and provenance failures without exposing output or exception text',async()=>{
  const badQuote=affectMeaning();badQuote.appraisals[0]!.evidence[0]!.quote='private missing quote';
  for(const [output,expected] of [['{private broken JSON',{stage:'json',code:'invalid_json'}],[{secret:'private invalid object'},{stage:'schema',code:'invalid_schema'}],[badQuote,{stage:'provenance',code:'affect_quote_not_in_snapshot'}]] as const){
    const diagnostic=vi.fn(),transport=vi.fn(async()=>output);
    const result=await new StructuredEventInterpreter(transport,diagnostic).interpret(affectRequest());
    expect(result).toMatchObject({status:'unavailable',reason:'invalid_output'});expect(diagnostic).toHaveBeenCalledWith(expected);expect(JSON.stringify(diagnostic.mock.calls)).not.toContain('private');expect(transport).toHaveBeenCalledTimes(1);
  }
});

it('OA16: the same instructions/schema handle arbitrary natural-language personas without case identifiers',async()=>{
  const calls:Parameters<EventInterpretationTransport>[0][]=[];
  const transport=vi.fn(async(request:Parameters<EventInterpretationTransport>[0])=>{calls.push(request);return affectMeaning(JSON.parse(request.messages[1]!.content));});
  const interpreter=new StructuredEventInterpreter(transport),first=affectRequest(),second=affectRequest();
  second.sources[1]!.text='한 설명에만 매이지 않고 다른 관점도 찾아보길 좋아한다.';
  const a=await interpreter.interpret(first),b=await interpreter.interpret(second);
  expect(a.status).toBe('interpreted');expect(b.status).toBe('interpreted');
  expect(calls[0]!.messages[0]).toEqual(calls[1]!.messages[0]);expect(calls[0]!.schema).toEqual(calls[1]!.schema);
  expect(calls[1]!.messages[0]!.content).not.toContain(second.sources[1]!.text);
  expect(transport).toHaveBeenCalledTimes(2);
  // Injected meaning proves the boundary only; it does not score an LLM's reading.
});
it.each(['bad_quote','revision','foreign_target','unconfigured_concern','missing_current','forged_field','duplicate_concern','invented_expectation'])('OA10: rejects %s instead of turning invalid output into a genuine feeling',async kind=>{
  const request=affectRequest(),output:any=affectMeaning(request),a=output.appraisals[0];
  if(kind==='bad_quote')a.evidence[0].quote='원문에 없는 문장';
  if(kind==='revision')a.evidence[0].revision='2';
  if(kind==='foreign_target')a.targetId=affectId(99);
  if(kind==='unconfigured_concern')a.concern.source={...a.evidence[0]};
  if(kind==='missing_current')a.evidence=[a.concern.source];
  if(kind==='forged_field')a.emotionDelta=.5;
  if(kind==='duplicate_concern')output.appraisals.push(structuredClone(a));
  if(kind==='invented_expectation'){a.expectedness=0;a.expectation={...a.evidence[0]};}
  const result=await new StructuredEventInterpreter(async()=>output).interpret(request);
  expect(result).toMatchObject({status:'unavailable',reason:'invalid_output'});
});
it.each(['scope','config','future','undelivered','duplicate','state_without_refs'])('OA10: invalid %s is rejected before transport',async kind=>{
  const request=affectRequest();
  if(kind==='scope')request.sources[0]!.scope.ownerId=affectId(99);
  if(kind==='config')request.sources[1]!.revision='2';
  if(kind==='future')request.sources[0]!.at=request.now+1;
  if(kind==='undelivered')request.sources.push({...affectSource(7,'episode','전달되지 않은 추천'),delivered:false});
  if(kind==='duplicate')request.sources.push({...request.sources[0]!});
  if(kind==='state_without_refs')request.currentAffect.negative=.5;
  const transport=vi.fn();expect(await new StructuredEventInterpreter(transport).interpret(request)).toMatchObject({status:'unavailable',reason:'invalid_input'});expect(transport).not.toHaveBeenCalled();
});
it('OA02/03: outcome linkage requires a delivered, complete candidate and cited source',async()=>{
  const request=affectRequest();request.eventKind='reported_outcome';request.experience.status='found';
  request.sources.push(affectSource(7,'episode','이 영화를 추천해.',affectNow-1000));
  const output=affectMeaning(request);output.appraisals[0]!.episodeId=affectId(7);output.appraisals[0]!.evidence.push({sourceId:affectId(7),revision:'1',quote:'이 영화를 추천해.'});output.outcome={episodeId:affectId(7),use:'used',result:'favorable',evidence:[...output.appraisals[0]!.evidence]};
  const interpreter=new StructuredEventInterpreter(async()=>output);
  expect((await interpreter.interpret(request)).status).toBe('interpreted');
  for(const status of ['empty','ambiguous','stale','unavailable'] as const){request.experience.status=status;expect(await interpreter.interpret(request)).toMatchObject({status:'unavailable',reason:'invalid_output'});}
  request.experience.status='found';output.appraisals[0]!.evidence.pop();expect((await interpreter.interpret(request)).status).toBe('unavailable');
});
it('OA03: uncertainty is a valid interpretation and source unavailability is not invented history',async()=>{
  const request=affectRequest();request.eventKind='reported_outcome';request.experience.status='unavailable';
  const result=await new StructuredEventInterpreter(async()=>({status:'uncertain',outcome:null,appraisals:[]})).interpret(request);
  expect(result).toMatchObject({status:'interpreted',interpretation:{status:'uncertain',appraisals:[]}});
});
it('OA10: an outcome on the input route still needs the actual delivered episode citation',async()=>{
  const request=affectRequest();request.experience.status='found';request.sources.push(affectSource(7,'episode','이 영화를 추천해.',affectNow-1000));
  const output=affectMeaning(request);output.appraisals[0]!.episodeId=affectId(7);output.outcome={episodeId:affectId(7),use:'used',result:'favorable',evidence:[...output.appraisals[0]!.evidence]};
  expect(await new StructuredEventInterpreter(async()=>output).interpret(request)).toMatchObject({status:'unavailable',reason:'invalid_output'});
});
it('OA04: otherwise identical historical assertions preserve who actually said them',async()=>{
  const first=affectRequest();first.actors.push({id:affectId(5),label:'민수'});
  first.sources.push({...affectSource(7,'input','공은 다섯 개야.',affectNow-1000),speakerId:affectId(1)});
  const second=structuredClone(first);second.sources.at(-1)!.speakerId=affectId(5);
  const calls:Parameters<EventInterpretationTransport>[0][]=[],transport=async(request:Parameters<EventInterpretationTransport>[0])=>{calls.push(request);return affectMeaning(JSON.parse(request.messages[1]!.content));};
  const interpreter=new StructuredEventInterpreter(transport);
  expect((await interpreter.interpret(first)).status).toBe('interpreted');expect((await interpreter.interpret(second)).status).toBe('interpreted');
  const a=JSON.parse(calls[0]!.messages[1]!.content),b=JSON.parse(calls[1]!.messages[1]!.content);
  expect(a.sources.at(-1).speakerId).not.toBe(b.sources.at(-1).speakerId);
});
it('transport and JSON failures make one attempt, never claim intentional silence or manufacture evidence',async()=>{
  for(const transport of [vi.fn(async()=>{throw new Error('provider error');}),vi.fn(async()=>'{not json}')]){
    const result=await new StructuredEventInterpreter(transport).interpret(affectRequest());
    expect(result.status).toBe('unavailable');expect(result).not.toHaveProperty('interpretation');expect(result).not.toHaveProperty('participation');expect(transport).toHaveBeenCalledTimes(1);
  }
});
