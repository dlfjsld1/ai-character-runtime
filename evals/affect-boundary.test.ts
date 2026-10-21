import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {validateAffectSuites,materializeAffectCase,checkAffectCandidate} from './affect-cases.ts';
import {StructuredEventInterpreter,buildEventInterpretationRequest} from '../packages/adapters/src/event-interpreter.ts';
import {appendEventAffect} from '../packages/character-core/src/public.ts';

const read=(name:string)=>JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`,import.meta.url),'utf8'));
const suite=validateAffectSuites(read('affect-dev-v3'),read('affect-confirm-v3')).dev;
const captured=read('affect-boundary-regression-v3');
it.each(['D02','D06','D10'])('%s captured failure remains a failure; no silent repair or rubric relaxation',async id=>{
  const row=captured.cases.find((row:any)=>row.id===id),item=suite.cases.find(item=>item.id===id)!;
  expect(materializeAffectCase(suite,item)).toEqual(row.request);
  const result=await new StructuredEventInterpreter(async()=>row.recorded).interpret(row.request);
  const checks=checkAffectCandidate(item,row.request,result);
  expect(checks.status).toBe('FAIL');
  expect(checks.failures).toContain(id==='D02'?'outcome.use':id==='D06'?'episode.polarity':'invalid_output');
});
it('D10 loses candidate IDs/text before generation while its own current report remains visible',()=>{
  const {request}=captured.cases.find((row:any)=>row.id==='D10');
  const built=buildEventInterpretationRequest(request),visible=JSON.parse(built.messages[1]!.content);
  expect(visible.experience.status).toBe('ambiguous');
  expect(visible.sources.some((s:any)=>s.kind==='episode')).toBe(false);
  expect(visible.sources.find((s:any)=>s.id===request.eventId)).toEqual(request.sources.find((s:any)=>s.id===request.eventId));
  const wire=JSON.stringify(built);
  for(const source of request.sources.filter((s:any)=>s.kind==='episode')){expect(wire).not.toContain(source.id);expect(wire).not.toContain(source.text);}
});
it('an authored same-concern two-fact D06 contrast preserves both channels, never asserting provider improvement',async()=>{
  const row=captured.cases.find((row:any)=>row.id==='D06'),meaning=structuredClone(row.recorded);
  const first=meaning.appraisals[0];first.evidence[0].quote='네가 권한 웃음 정거장은 재밌었어.';first.congruence=.6;
  const second=structuredClone(first);second.evidence[0].quote='그런데 길어서 약속에 늦었어.';second.congruence=-.6;
  meaning.appraisals=[first,second];
  const result=await new StructuredEventInterpreter(async()=>meaning).interpret(row.request);
  const item=suite.cases.find(item=>item.id==='D06')!;
  expect(checkAffectCandidate(item,row.request,result)).toMatchObject({status:'REVIEW_REQUIRED',failures:[]});
  const projection=appendEventAffect([],row.request,meaning,row.request.eventId).snapshot;
  expect(projection.levels.positive).toBeGreaterThan(0);expect(projection.levels.negative).toBeGreaterThan(0);
});
