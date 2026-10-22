import {it,expect,vi} from 'vitest';
import {SplitEventInterpreter} from './split-event-interpreter.ts';
import {affectRequest,affectMeaning,affectSource,affectNow,affectId} from '../../../evals/affect-fixture.ts';
import {appendEventAffect,projectEventAffect} from '../../character-core/src/event-affect.ts';

it.each([0,1])('two independent injected implementations satisfy the same port (%s)',async variant=>{
  const input=affectRequest(),first=vi.fn(async()=>null),second=vi.fn(async(r:any,o:any)=>variant?JSON.parse(JSON.stringify({...affectMeaning(r),outcome:o})):{...affectMeaning(r),outcome:o});
  const p=new SplitEventInterpreter(first,second),result=await p.interpret(input);
  expect(result.status).toBe('interpreted');expect(first).toHaveBeenCalledTimes(1);expect(second).toHaveBeenCalledTimes(1);
  if(result.status==='interpreted')expect(appendEventAffect([],input,result.interpretation,input.eventId).snapshot.levels.positive).toBeGreaterThan(0);
});
it.each(['throw','invalid','mutate'])('first-stage %s cannot call stage two or apply Core',async kind=>{
  const input=affectRequest(),second=vi.fn(async(r:any)=>affectMeaning(r));
  const p=new SplitEventInterpreter(async r=>{if(kind==='throw')throw Error('private');if(kind==='mutate')r.sources[0]!.text='mutated';return {episodeId:affectId(99),use:'used',result:'favorable',evidence:[]} as any;},second);
  expect((await p.interpret(input)).status).toBe('unavailable');expect(second).not.toHaveBeenCalled();expect(input.sources[0]!.text).not.toBe('mutated');
});
it('copies snapshots between stages and rejects replacement of frozen outcome',async()=>{
  const input=affectRequest();input.experience.status='found';input.sources.push(affectSource(20,'episode','기존 제안',affectNow-1000));
  const outcome={episodeId:affectId(20),use:'used' as const,result:'favorable' as const,evidence:[input.sources[0]!,input.sources.at(-1)!].map(s=>({sourceId:s.id,revision:s.revision,quote:s.text}))};
  const original=structuredClone(input);
  const result=await new SplitEventInterpreter(async r=>{r.sources[1]!.text='mutated';return outcome;},async(r,o)=>{
    expect(r).toEqual(original);o!.result='unfavorable';return {...affectMeaning(r),outcome:o};
  }).interpret(input);
  expect(result).toMatchObject({status:'unavailable',reason:'invalid_output'});expect(input).toEqual(original);expect(outcome.result).toBe('favorable');
});
it.each(['throw','invalid'])('second-stage %s leaves an existing affect journal unchanged',async kind=>{
  const old=affectRequest(),history=appendEventAffect([],old,affectMeaning(old),old.eventId).records,before=structuredClone(history);
  const next=affectRequest(15,affectNow+1000),at=projectEventAffect(history,next.now);next.currentAffect=at.levels;next.stateSourceRefs=[{sourceId:old.eventId,revision:'1'}];
  const result=await new SplitEventInterpreter(async()=>null,async()=>{if(kind==='throw')throw Error('private');return {status:'appraised',outcome:null,appraisals:[]} as any;}).interpret(next);
  expect(result.status).toBe('unavailable');expect(history).toEqual(before);expect(projectEventAffect(history,next.now)).toEqual(at);
});
it('an unresolved reference skips the appraisal stage; it must quote the current input with no outcome',async()=>{
  const input=affectRequest(),current=input.sources[0]!,quote=current.text.slice(0,4),second=vi.fn(async(r:any,o:any)=>({...affectMeaning(r),outcome:o}));
  const reference={sourceId:current.id,revision:current.revision,quote};
  const result=await new SplitEventInterpreter(async()=>({outcome:null,unresolvedReference:reference}),second).interpret(input);
  expect(result).toEqual({status:'interpreted',interpretation:{status:'uncertain',outcome:null,appraisals:[]},promptVersion:'split-event-interpretation-v1',unresolvedReference:reference});
  expect(second).not.toHaveBeenCalled();
  for(const bad of [{...reference,quote:'입력에 없는 말'},{...reference,revision:'9'}])
    expect(await new SplitEventInterpreter(async()=>({outcome:null,unresolvedReference:bad}),second).interpret(input)).toMatchObject({status:'unavailable',reason:'invalid_output'});
  expect(second).not.toHaveBeenCalled();
});
