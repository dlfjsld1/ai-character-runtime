import {it,expect} from 'vitest';
import {buildEventInterpretationRequest,StructuredEventInterpreter} from './event-interpreter.ts';
import {affectRequest,affectMeaning,affectSource,affectId,affectNow} from '../../../evals/affect-fixture.ts';

function scene(){
  const request=affectRequest();request.experience.status='found';
  request.sources.push(affectSource(7,'episode','첫 추천을 전달했다.',affectNow-1000));
  request.sources.push(affectSource(8,'episode','둘째 추천을 전달했다.',affectNow-500));
  const meaning=affectMeaning(request),quote=(index:number)=>{const source=request.sources[index]!;return {sourceId:source.id,revision:source.revision,quote:source.text};};
  meaning.outcome={episodeId:affectId(7),use:'used',result:'favorable',evidence:[quote(0),quote(3)]};
  return {request,meaning};
}
it.each(['empty','ambiguous','stale','unavailable','truncated'] as const)('%s retrieval grants no episode authority, keeps input affect, and still rejects a guessed outcome',async status=>{
  const {request,meaning}=scene();
  if(status==='truncated')request.experience.truncated=true;else request.experience.status=status;
  const before=JSON.stringify(request),built=buildEventInterpretationRequest(request),visible=JSON.parse(built.messages[1]!.content),schema:any=built.schema;
  expect(visible.sources).toEqual(request.sources.filter(source=>source.kind!=='episode'));
  expect(visible.experience).toEqual(request.experience);expect(visible.currentAffect).toEqual(request.currentAffect);
  expect(schema.properties.outcome).toMatchObject({type:'null'});
  expect(schema.properties.appraisals.items.properties.episodeId).toMatchObject({type:'null'});
  expect(JSON.stringify(request)).toBe(before);
  const diagnostic:unknown[]=[];
  expect(await new StructuredEventInterpreter(async()=>meaning,d=>diagnostic.push(d)).interpret(request)).toMatchObject({status:'unavailable',reason:'invalid_output'});
  expect(diagnostic).toContainEqual({stage:'provenance',code:'affect_episode_not_available'});
  meaning.outcome=null;
  expect((await new StructuredEventInterpreter(async()=>meaning).interpret(request)).status).toBe('interpreted');
});
it('complete retrieval allows only eligible IDs and excludes an episode delivered after the input',async()=>{
  const {request,meaning}=scene();request.now+=1000;
  request.sources.push(affectSource(9,'episode','입력 뒤의 추천',affectNow+100));
  const built=buildEventInterpretationRequest(request),schema:any=built.schema,visible=JSON.parse(built.messages[1]!.content);
  expect(visible.sources.filter((s:any)=>s.kind==='episode').map((s:any)=>s.id)).toEqual([affectId(7),affectId(8)]);
  expect(schema.properties.outcome.anyOf[0].properties.episodeId.enum).toEqual([affectId(7),affectId(8)]);
  expect(schema.properties.appraisals.items.properties.episodeId.anyOf[0].enum).toEqual([affectId(7),affectId(8)]);
  expect((await new StructuredEventInterpreter(async()=>meaning).interpret(request)).status).toBe('interpreted');
  meaning.outcome!.episodeId=affectId(9);
  expect((await new StructuredEventInterpreter(async()=>meaning).interpret(request)).status).toBe('unavailable');
});
it('the allowed-ID schema does not turn an actually used but pending result into non-use',async()=>{
  const {request,meaning}=scene();request.sources[0]!.text='권한 방법을 써 봤어. 효과는 내일 알 수 있어.';
  meaning.outcome!.result='pending';meaning.outcome!.evidence[0]!.quote=request.sources[0]!.text;
  meaning.appraisals[0]!.evidence[0]!.quote=request.sources[0]!.text;
  const result=await new StructuredEventInterpreter(async()=>meaning).interpret(request);
  expect(result).toMatchObject({status:'interpreted',interpretation:{outcome:{use:'used',result:'pending'}}});
});
