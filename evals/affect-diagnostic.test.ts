import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {materializeAffectDiagnostic} from './affect-diagnostic.ts';
import {validateAffectSuites,checkAffectCandidate} from './affect-cases.ts';
import {buildEventInterpretationRequest} from '../packages/adapters/src/event-interpreter.ts';
import type {EventInterpretationResult} from '../packages/contracts/src/affect-appraisal.ts';

const read=(name:string)=>JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`,import.meta.url),'utf8'));
const suite=validateAffectSuites(read('affect-dev-v3'),read('affect-confirm-v3')).dev,fixture=read('affect-diagnostic-v1');
it('diagnostic eight preserves six exposed inputs/rubrics, adds two counterexamples and never uses confirm',()=>{
  const before=JSON.stringify(suite),rows=materializeAffectDiagnostic(suite,fixture);
  expect(rows.map(row=>row.item.id)).toEqual(['D01','D02','D06','D09','D10','D12','P01','P02']);
  for(const row of rows.slice(0,6))expect(row.item).toEqual(suite.cases.find(item=>item.id===row.item.id));
  expect(JSON.stringify(suite)).toBe(before);
  for(const row of rows){
    const wire=JSON.stringify(buildEventInterpretationRequest(row.request));
    for(const hidden of [row.item.id,row.item.family,row.item.expected.notes,'"expected"','"split"'])expect(wire).not.toContain(hidden);
  }
});
it.each(['duplicate','missing','count'])('rejects %s diagnostic material before execution',kind=>{
  const bad=structuredClone(fixture);
  if(kind==='duplicate')bad.additional[0].id='D01';if(kind==='missing')bad.inherited[0]='C01';if(kind==='count')bad.inherited.pop();
  expect(()=>materializeAffectDiagnostic(suite,bad)).toThrow();
});
it.each(['P01','P02'])('%s distinguishes use from pending and omitted outcome without declaring semantic PASS',id=>{
  const {item,request}=materializeAffectDiagnostic(suite,fixture).find(row=>row.item.id===id)!;
  const current=request.sources.find(s=>s.id===request.eventId)!,episode=request.sources.find(s=>s.kind==='episode')!;
  const result:EventInterpretationResult={status:'interpreted',promptVersion:'authored',interpretation:{status:'uncertain',appraisals:[],outcome:{
    episodeId:episode.id,use:id==='P01'?'used':'not_used',result:'pending',evidence:[current,episode].map(s=>({sourceId:s.id,revision:s.revision,quote:s.text})),
  }}};
  expect(checkAffectCandidate(item,request,result)).toMatchObject({status:'REVIEW_REQUIRED',failures:[]});
  result.interpretation.outcome!.use=id==='P01'?'not_used':'used';
  expect(checkAffectCandidate(item,request,result).failures).toContain('outcome.use');
  result.interpretation.outcome=null;expect(checkAffectCandidate(item,request,result).failures).toContain('outcome.missing');
});
