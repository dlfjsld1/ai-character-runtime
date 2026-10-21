import {readFileSync} from 'node:fs';
import {it,expect,vi} from 'vitest';
import {validateAffectSuites,materializeAffectCase,materializeContrast,checkAffectCandidate,affectHash,affectDevRequestHash,affectEvaluationVersion,affectEvaluationScope,type AffectSuite} from './affect-cases.ts';
import {StructuredEventInterpreter,buildEventInterpretationRequest,eventInterpretationInstructions} from '../packages/adapters/src/event-interpreter.ts';
import {validateAffectRequest,type EventAppraisal,type EventInterpretation,type EventInterpretationRequest} from '../packages/contracts/src/affect-appraisal.ts';
import {appendEventAffect} from '../packages/character-core/src/public.ts';

const read=(name:string)=>JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`,import.meta.url),'utf8'));
const rawDev=read('affect-dev-v3'),rawConfirm=read('affect-confirm-v3');
const suites=validateAffectSuites(rawDev,rawConfirm);
it('v3 is explicit and preserves every v2 model input, split and contrast without regrading historical results',()=>{
  const historical={dev:read('affect-dev-v2'),confirm:read('affect-confirm-v2')};
  expect(affectHash(historical.dev)).toBe('ea357e29f9c623f5823329e869ac216ef229a10a3c5d8291e61050e6230e19e1');
  expect(affectHash(historical.confirm)).toBe('c998020311de099781601bbc724389050008e0df7f9dbb7a2b29787fa2f10a1a');
  expect(()=>validateAffectSuites(historical.dev,historical.confirm)).toThrow();
  for(const split of ['dev','confirm'] as const){
    const previous=historical[split],current=suites[split];
    expect(current).toMatchObject({version:'affect-v3-dev1',evaluationVersion:affectEvaluationVersion,evaluationScope:affectEvaluationScope});
    expect(current.personas).toEqual(previous.personas);
    const withoutExpected=({expected,...item}:any)=>item;
    expect(current.cases.map(withoutExpected)).toEqual(previous.cases.map(withoutExpected));
    expect(current.contrasts.map(withoutExpected)).toEqual(previous.contrasts.map(withoutExpected));
    // Only the rubric is supplied from v3 to satisfy the current type. Source
    // facts and settings below come from the frozen v2 fixture.
    const sourceOnly={...previous,cases:previous.cases.map((item:any,i:number)=>({...item,expected:current.cases[i]!.expected})),
      contrasts:previous.contrasts.map((item:any,i:number)=>({...item,expected:current.contrasts[i]!.expected}))} as AffectSuite;
    for(const [i,item] of current.cases.entries())expect(materializeAffectCase(current,item)).toEqual(materializeAffectCase(sourceOnly,sourceOnly.cases[i]!));
    for(const [i,contrast] of current.contrasts.entries())expect(materializeContrast(current,contrast).request).toEqual(materializeContrast(sourceOnly,sourceOnly.contrasts[i]!).request);
  }
});
it('dev attempt identity is unaffected by confirm edits or case order and metadata',()=>{
  const rows=[{id:'D01',group:'dev',kind:'dialogue',body:{input:'개발'}},{id:'C01',group:'confirm',kind:'dialogue',body:{input:'확인'}}];
  const changed=[{...rows[1]!,body:{input:'새 확인'}},{...rows[0]!,id:'renamed'}];
  expect(affectDevRequestHash(changed)).toBe(affectDevRequestHash(rows));
  expect(affectDevRequestHash([{...rows[0]!,body:{input:'다른 개발'}}])).not.toBe(affectDevRequestHash(rows));
});
it('OA16/18: 48 main cases and four separate persona controls preserve splits and balance',()=>{
  expect(suites.dev.cases).toHaveLength(24);expect(suites.confirm.cases).toHaveLength(24);
  expect(suites.dev.contrasts.length+suites.confirm.contrasts.length).toBe(4);
  expect(new Set(suites.dev.cases.filter(c=>c.route==='value').map(c=>c.persona)).size).toBe(3);
  expect(new Set(suites.confirm.cases.filter(c=>c.route==='value').map(c=>c.persona)).size).toBe(3);
});
it.each(['count','balance','story','persona','duplicate'] as const)('OA16: rejects broken %s evidence',kind=>{
  const dev=structuredClone(rawDev),confirm=structuredClone(rawConfirm);
  if(kind==='count')dev.cases.pop();
  if(kind==='balance')dev.cases[0].clarity='abstain';
  if(kind==='story')confirm.cases[0].family=dev.cases[0].family;
  if(kind==='persona')for(const c of confirm.cases.filter((c:any)=>c.route==='value')){c.persona=dev.cases[12].persona;confirm.personas[c.persona]=dev.personas[c.persona];}
  if(kind==='duplicate')confirm.cases[0].id=dev.cases[0].id;
  expect(()=>validateAffectSuites(dev,confirm)).toThrow();
});
it('all fixtures use one prompt with host-derived candidate schemas and no rubric in model data',()=>{
  const schemas=new Map<string,string>();
  for(const suite of Object.values(suites))for(const item of suite.cases){
    const input=materializeAffectCase(suite,item),request=buildEventInterpretationRequest(input);
    expect(request.messages[0]!.content).toBe(eventInterpretationInstructions);
    const current=input.sources.find(s=>s.id===input.eventId)!;
    const eligible=input.sources.filter(s=>s.kind==='episode'&&s.delivered&&s.at<=current.at&&input.experience.status==='found'&&!input.experience.truncated).map(s=>s.id);
    expect(JSON.parse(request.messages[1]!.content)).toEqual({...input,sources:input.sources.filter(s=>s.kind!=='episode'||eligible.includes(s.id))});
    const encoded=request.messages[1]!.content;
    for(const hidden of [item.id,item.family,item.expected.notes,`"expected"`,`"split"`,`"clarity"`])expect(encoded).not.toContain(hidden);
    const authority=JSON.stringify(eligible),hash=affectHash(request.schema);
    if(schemas.has(authority))expect(hash).toBe(schemas.get(authority));else schemas.set(authority,hash);
  }
  expect(schemas.size).toBeGreaterThan(1);
});
it('persona controls change only the natural-language setting and preserve source facts/actors',()=>{
  for(const suite of Object.values(suites))for(const contrast of suite.contrasts){
    const base=materializeAffectCase(suite,suite.cases.find(c=>c.id===contrast.base)!),variant=materializeContrast(suite,contrast).request;
    expect(variant.sources.find(s=>s.kind==='persona')!.text).not.toBe(base.sources.find(s=>s.kind==='persona')!.text);
    const withoutPersona=(request:typeof base)=>({...request,sources:request.sources.filter(s=>s.kind!=='persona')});
    expect(withoutPersona(variant)).toEqual(withoutPersona(base));
  }
});
it('OA10: historical author identity and host truth remain distinct from model confidence',()=>{
  const item=structuredClone(suites.dev.cases.find(c=>c.id==='D17')!);
  item.history!.unshift({kind:'input',text:'공은 다섯 개야.',speaker:'other'});
  const request=materializeAffectCase(suites.dev,item);
  expect(request.sources.find(s=>s.text==='공은 다섯 개야.')!.speakerId).not.toBe(request.speakerId);
  expect(request.sources.find(s=>s.kind==='claim')!.truth).toBe('supported');
  expect(validateAffectRequest(request)).toEqual(request);
});
it('rehearsal is 48 mechanical calls to an injected mock; it cannot report semantic PASS',async()=>{
  const transport=vi.fn(async()=>({status:'uncertain',outcome:null,appraisals:[]}));
  const interpreter=new StructuredEventInterpreter(transport);
  for(const suite of Object.values(suites))for(const item of suite.cases){
    const request=materializeAffectCase(suite,item),result=await interpreter.interpret(request);
    expect(result.status).toBe('interpreted');
    if(result.status!=='interpreted')throw new Error('mock_failed');
    expect(appendEventAffect([],request,result.interpretation,request.eventId).snapshot.levels).toEqual({positive:0,negative:0,activation:0});
    expect(checkAffectCandidate(item,request,result).semanticReview).toBe('pending');
    expect(checkAffectCandidate(item,request,result).status).not.toBe('PASS');
  }
  expect(transport).toHaveBeenCalledTimes(48);
});
it('a same-polarity answer with the wrong actor fails before human semantic review',()=>{
  const item=suites.dev.cases.find(c=>c.id==='D14')!,request=materializeAffectCase(suites.dev,item),current=request.sources.find(s=>s.kind==='input')!,persona=request.sources.find(s=>s.kind==='persona')!;
  const quote=(source:typeof persona)=>({sourceId:source.id,revision:source.revision,quote:source.text});
  const result={status:'interpreted' as const,promptVersion:'synthetic',interpretation:{status:'appraised' as const,outcome:null,appraisals:[{episodeId:null,concern:{source:quote(persona)},evidence:[quote(current)],actorId:request.speakerId,targetId:null,stance:'reports' as const,relevance:1,importance:1,congruence:-1,certainty:1,agency:'other' as const,controllability:null,expectedness:null,expectation:null}]}};
  expect(checkAffectCandidate(item,request,result)).toMatchObject({status:'FAIL',failures:['input.actor'],semanticReview:'pending'});
});

function scopedCase(id:string){
  const suite=id.startsWith('C')?suites.confirm:suites.dev,item=suite.cases.find(item=>item.id===id)!;
  return {item,request:materializeAffectCase(suite,item)};
}
function inputAppraisal(request:EventInterpretationRequest,patch:Partial<EventAppraisal>={}):EventAppraisal{
  const current=request.sources.find(source=>source.id===request.eventId)!,persona=request.sources.find(source=>source.kind==='persona')!;
  const quote=(source:typeof current)=>({sourceId:source.id,revision:source.revision,quote:source.text});
  return {episodeId:null,concern:{source:quote(persona)},evidence:[quote(current)],actorId:request.speakerId,targetId:null,stance:'reports',
    relevance:1,importance:1,congruence:-1,certainty:1,agency:'other',controllability:null,expectedness:null,expectation:null,...patch};
}
function outcome(request:EventInterpretationRequest,use:'used'|'not_used'|'hypothetical'='not_used',result:'pending'|'unfavorable'|'mixed'='pending'):NonNullable<EventInterpretation['outcome']>{
  const episode=request.sources.find(source=>source.kind==='episode')!,current=request.sources.find(source=>source.id===request.eventId)!;
  return {episodeId:episode.id,use,result,evidence:[current,episode].map(source=>({sourceId:source.id,revision:source.revision,quote:source.text}))};
}
const interpreted=(interpretation:EventInterpretation)=>({status:'interpreted' as const,promptVersion:'synthetic-v3',interpretation});
it('D02 keeps identifiable own nonuse separate from input empathy and never emits semantic PASS',()=>{
  const {item,request}=scopedCase('D02'),meaning:EventInterpretation={status:'appraised',outcome:outcome(request),appraisals:[inputAppraisal(request)]};
  expect(checkAffectCandidate(item,request,interpreted(meaning))).toMatchObject({status:'REVIEW_REQUIRED',failures:[],
    evaluationVersion:affectEvaluationVersion,scopes:{outcome:'REVIEW_REQUIRED',episode:'REVIEW_REQUIRED',input:'REVIEW_REQUIRED'},semanticReview:'pending'});
  expect(checkAffectCandidate(item,request,interpreted({...meaning,status:'irrelevant',appraisals:[]}))).toMatchObject({status:'REVIEW_REQUIRED',failures:[]});
});
it('a historical global episode response is not automatically migrated into a v3 success',()=>{
  const {item,request}=scopedCase('D02'),appraisal=inputAppraisal(request);
  const oldAppraisal=Object.fromEntries(Object.entries(appraisal).filter(([field])=>field!=='episodeId'));
  const oldMeaning={status:'appraised',episodeId:request.sources.find(source=>source.kind==='episode')!.id,
    outcome:{use:'not_used',result:'pending'},appraisals:[oldAppraisal]} as unknown as EventInterpretation;
  expect(checkAffectCandidate(item,request,interpreted(oldMeaning))).toMatchObject({status:'FAIL',failures:['contract'],
    scopes:{outcome:'NOT_EVALUATED',episode:'NOT_EVALUATED',input:'NOT_EVALUATED'},semanticReview:'pending'});
});
it.each(['episode_appraisal','episode_quote','wrong_use','missing_outcome','self_blame'] as const)('D02 rejects %s without borrowing scope evidence',kind=>{
  const {item,request}=scopedCase('D02'),meaning:EventInterpretation={status:'appraised',outcome:outcome(request),appraisals:[inputAppraisal(request)]};
  if(kind==='episode_appraisal')meaning.appraisals[0]!.episodeId=meaning.outcome!.episodeId;
  if(kind==='episode_quote')meaning.appraisals[0]!.evidence.push(meaning.outcome!.evidence[1]!);
  if(kind==='wrong_use')meaning.outcome={...meaning.outcome!,use:'used',result:'unfavorable'};
  if(kind==='missing_outcome')meaning.outcome=null;
  if(kind==='self_blame')meaning.appraisals[0]!.agency='self';
  const check=checkAffectCandidate(item,request,interpreted(meaning));
  expect(check.status).toBe('FAIL');
  expect(check.failures).toContain(kind==='missing_outcome'?'outcome.missing':kind==='wrong_use'?'outcome.use':kind==='self_blame'?'input.agency':'contract');
});
it.each(['D09','C09','D12'])('%s keeps unobserved outcome confirmation with input-only anticipation',id=>{
  const {item,request}=scopedCase(id),use=id==='D12'?'hypothetical':'not_used';
  const meaning:EventInterpretation={status:'appraised',outcome:outcome(request,use),appraisals:[inputAppraisal(request,{congruence:id==='D09'?1:-1})]};
  expect(checkAffectCandidate(item,request,interpreted(meaning)).status).toBe('REVIEW_REQUIRED');
  meaning.outcome=null;
  expect(checkAffectCandidate(item,request,interpreted(meaning)).failures).toContain('outcome.missing');
});
it.each(['D10','D11','C10','C11'])('%s leaves unavailable episode unresolved while assessing the current report separately',id=>{
  const {item,request}=scopedCase(id),meaning:EventInterpretation={status:'appraised',outcome:null,appraisals:[inputAppraisal(request,{congruence:id==='C11'?1:-1})]};
  expect(checkAffectCandidate(item,request,interpreted(meaning))).toMatchObject({status:'REVIEW_REQUIRED',failures:[]});
});
it('fiction stays unobserved and cannot acquire a current negative appraisal from the quoted review',()=>{
  const {item,request}=scopedCase('C12');
  expect(checkAffectCandidate(item,request,interpreted({status:'irrelevant',outcome:null,appraisals:[]})).status).toBe('REVIEW_REQUIRED');
  expect(checkAffectCandidate(item,request,interpreted({status:'appraised',outcome:null,appraisals:[inputAppraisal(request)]})).failures).toContain('input.unexpected');
});
it('external interference can remain a used own episode while separate input affect has its own evidence',()=>{
  const {item,request}=scopedCase('D05'),own=outcome(request,'used','unfavorable');
  const meaning:EventInterpretation={status:'appraised',outcome:own,appraisals:[inputAppraisal(request,{episodeId:own.episodeId,agency:'external',evidence:own.evidence}),inputAppraisal(request,{congruence:1})]};
  expect(checkAffectCandidate(item,request,interpreted(meaning))).toMatchObject({status:'REVIEW_REQUIRED',failures:[]});
});
it('annotation eight and transfer twelve distinguish unsupported product paths from new-trait interpretation',()=>{
  const annotation=read('affect-annotation-v2'),transfer=read('affect-transfer-v2');
  expect(annotation.syntheticOnly).toBe(true);expect(transfer.syntheticOnly).toBe(true);
  expect(annotation.cases).toHaveLength(8);expect(transfer.cases).toHaveLength(12);
  for(const split of ['dev','confirm'])expect(annotation.cases.filter((c:any)=>c.split===split)).toHaveLength(4);
  const families=new Set(transfer.cases.map((c:any)=>c.family));expect(families.size).toBe(6);
  for(const family of families)expect(transfer.cases.filter((c:any)=>c.family===family)).toHaveLength(2);
  expect(transfer.cases.filter((c:any)=>c.path==='direct_input').map((c:any)=>c.id)).toEqual(['T07','T08','T11','T12']);
  expect(transfer.cases.find((c:any)=>c.id==='T12').persona).toContain('낭비');
});
