import {it,expect} from 'vitest';
import {mapJevResponse,JEV_QUESTIONS,JEV_THRESHOLD} from '../packages/adapters/src/jev.ts';
import {recordedJevResponse} from './jev-fixture.ts';
import {S1_QUESTIONS,assessS1} from './jev-s1-candidate.ts';
import {conservativePraiseDiagnostic} from './jev-s1-diagnostic.ts';
const id='10000000-0000-4000-8000-000000000010';
it('keeps parser confidence and unrelated questions unchanged',()=>{
  expect(JEV_THRESHOLD).toBe(.8);
  for(const key of ['act','goal_relation','hostility'] as const)expect(S1_QUESTIONS[key]).toBe(JEV_QUESTIONS[key]);
  expect(S1_QUESTIONS.strength.criteria).toEqual(JEV_QUESTIONS.strength.criteria);
  expect(S1_QUESTIONS.target).not.toBe(JEV_QUESTIONS.target);
});
it('requires actual Core affect for praise, not a raw praise label',()=>{
  const rubric={target:['character'],act:['praise'],gate:'praise' as const};
  expect(assessS1(mapJevResponse(recordedJevResponse('praise','character',3),id),rubric).pass).toBe(true);
  const low=recordedJevResponse('praise','character',3);low.answers.strength.confidence=.79;
  expect(assessS1(mapJevResponse(low,id),rubric)).toMatchObject({pass:false,personalStimulus:0});
});
it('requires correct target as well as no personal effect for protected cases',()=>{
  const rubric={target:['other'],act:['praise'],gate:'protected' as const};
  expect(assessS1(mapJevResponse(recordedJevResponse('praise','other',3),id),rubric).pass).toBe(true);
  expect(assessS1(mapJevResponse(recordedJevResponse('praise','character',3,.0,.7),id),rubric).pass).toBe(false);
});
it('diagnoses adjacent positive intensity while preserving the actual uncertain result',()=>{
  const raw=recordedJevResponse('praise','character',3);raw.answers.strength={...raw.answers.strength,score:2.65,confidence:.65,probabilities:{'0':0,'1':0,'2':.35,'3':.65}};
  const evaluation=mapJevResponse(raw,id),before=structuredClone(evaluation);
  expect(conservativePraiseDiagnostic(evaluation)).toEqual({strength:2,reason:'proposed_lower_bound'});
  expect(evaluation).toEqual(before);expect(evaluation.appraisal.strength).toBe(0);
  expect(conservativePraiseDiagnostic(mapJevResponse(recordedJevResponse('praise','character',3),id))).toEqual({strength:3,reason:'already_confident_unchanged'});
});
it('does not rescue ambiguity about target or whether any intensity exists',()=>{
  const target=recordedJevResponse('praise','character',3);target.answers.target.confidence=.7;
  expect(conservativePraiseDiagnostic(mapJevResponse(target,id)).strength).toBe(0);
  const absent=recordedJevResponse('praise','character',3);absent.answers.strength={...absent.answers.strength,score:1.53,confidence:.51,probabilities:{'0':.49,'1':0,'2':0,'3':.51}};
  expect(conservativePraiseDiagnostic(mapJevResponse(absent,id)).strength).toBe(0);
  expect(conservativePraiseDiagnostic(mapJevResponse(recordedJevResponse('praise','quoted',3),id)).strength).toBe(0);
});
