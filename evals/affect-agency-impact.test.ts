import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {it,expect} from 'vitest';
import {validateAffectSuites,checkAffectCandidate} from './affect-cases.ts';
import {StructuredEventInterpreter} from '../packages/adapters/src/event-interpreter.ts';
import {eventInterpretationSchema,validateEventInterpretation,type EventInterpretation,type EventInterpretationRequest} from '../packages/contracts/src/affect-appraisal.ts';
import {appendEventAffect} from '../packages/character-core/src/event-affect.ts';

const read=(name:string)=>JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`,import.meta.url),'utf8'));
const suite=validateAffectSuites(read('affect-dev-v3'),read('affect-confirm-v3')).dev;
const captured=read('affect-diagnostic-regression-v1');
const row=(id:string)=>captured.cases.find((r:any)=>r.id===id);
function scene(){
  const stored=row('D02');
  return {item:suite.cases.find(c=>c.id==='D02')!,request:structuredClone(stored.request) as EventInterpretationRequest,
    meaning:JSON.parse(stored.raw) as EventInterpretation};
}
const result=(interpretation:EventInterpretation)=>({status:'interpreted' as const,interpretation,promptVersion:'captured-or-authored-contrast'});

it.each(['D02','D09'])('%s retains the exact captured output and original frozen verdict',async id=>{
  const stored=row(id);
  expect(createHash('sha256').update(stored.raw).digest('hex')).toBe(stored.rawSha256);
  const interpreted=await new StructuredEventInterpreter(async()=>stored.raw).interpret(stored.request);
  expect(checkAffectCandidate(suite.cases.find(c=>c.id===id)!,stored.request,interpreted)).toMatchObject(stored.originalChecks);
});

it('D02 separates a no-drive agency mismatch without changing FAIL or discarding metadata',()=>{
  const {item,request,meaning}=scene(),before=JSON.stringify(meaning);
  const checks=checkAffectCandidate(item,request,result(meaning));
  expect(checks).toMatchObject({status:'FAIL',failures:['input.agency'],agencyImpact:{version:'agency-impact-v1',policyVersion:'event-affect-v3-dev1',findings:[{
    scope:'input',appraisalIndex:2,agency:'self',impact:'no_current_drive',isolatedLevels:{positive:0,negative:0,activation:0},
  }]}});
  expect(JSON.stringify(meaning)).toBe(before);
  const full=appendEventAffect([],request,meaning,request.eventId).snapshot;
  const contrast=structuredClone(meaning);contrast.appraisals.splice(2,1);
  expect(appendEventAffect([],request,contrast,request.eventId).snapshot).toEqual(full);
  expect(full.contributions.every(c=>c.episodeId===null)).toBe(true);
});

it.each([-0.5,0.5,-Number.EPSILON])('nonzero congruence %s still flags attributed affect, even when tiny',congruence=>{
  const {item,request,meaning}=scene();meaning.appraisals[2]!.congruence=congruence;
  const checks=checkAffectCandidate(item,request,result(meaning));
  expect(checks.status).toBe('FAIL');expect(checks.failures).toContain('input.agency');
  expect(checks).toMatchObject({agencyImpact:{findings:[{appraisalIndex:2,impact:'current_drive'}]}});
});

it.each([0,1])('zero valence with prior expectedness %s uses Core activation rather than a congruence-only shortcut',expectedness=>{
  const {item,request,meaning}=scene();
  const expectation={...request.sources[0]!,id:'91000000-0000-4000-8000-000000000099',kind:'expectation' as const,text:'아직 보지 않을 것으로 예상했다.',at:request.now-1000};
  request.sources.push(expectation);
  meaning.appraisals[2]!.expectedness=expectedness;
  meaning.appraisals[2]!.expectation={sourceId:expectation.id,revision:expectation.revision,quote:expectation.text};
  const checks=checkAffectCandidate(item,request,result(meaning));
  expect(checks.status).toBe('FAIL');
  expect(checks).toMatchObject({agencyImpact:{findings:[{impact:expectedness===0?'current_drive':'no_current_drive'}]}});
});

it('zero relevance does not erase an agency metadata failure',()=>{
  const {item,request,meaning}=scene();meaning.appraisals[2]!.congruence=-1;meaning.appraisals[2]!.relevance=0;
  expect(checkAffectCandidate(item,request,result(meaning))).toMatchObject({status:'FAIL',failures:['input.agency'],agencyImpact:{findings:[{impact:'no_current_drive'}]}});
});

it('D09 rejects the raw malformed reference and also a well-formed but unknown UUID',()=>{
  const stored=row('D09'),raw=JSON.parse(stored.raw),before=JSON.stringify(raw);
  const parsed=eventInterpretationSchema.safeParse(raw);expect(parsed.success).toBe(false);
  if(parsed.success)throw new Error('unexpected_valid_reference');
  expect(parsed.error.issues.map(i=>({path:i.path,code:i.code}))).toEqual([{path:['appraisals',0,'concern','source','sourceId'],code:'invalid_format'}]);
  expect(()=>validateEventInterpretation(raw,stored.request)).toThrow();
  expect(JSON.stringify(raw)).toBe(before);
  const contrast=structuredClone(raw);contrast.appraisals[0].concern.source.sourceId='91000000-0000-4000-8000-000000000099';
  expect(()=>validateEventInterpretation(contrast,stored.request)).toThrow('affect_quote_not_in_snapshot');
});
