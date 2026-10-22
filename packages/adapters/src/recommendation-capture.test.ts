import {it,expect} from 'vitest';
import {buildAnnotatedDialogueRequest,decodeAnnotatedDialogueOutput} from './recommendation-capture.ts';
import {confirmDeliveredRecommendation,episodeAffectSource,type DeliveredRecommendation} from '../../contracts/src/outcomes.ts';
import {initialState,dialoguePlan} from '../../character-core/src/index.ts';
import {affectId,affectScope,affectNow} from '../../../evals/affect-fixture.ts';

const sentence='오늘은 합성 영화 별의 강을 추천해.';
const annotation={kind:'movie' as const,title:'별의 강',sentenceIndex:0,quote:sentence};
const plan=dialoguePlan(initialState(affectNow),'question',affectId(1));
function delivered():DeliveredRecommendation{return {id:affectId(30),scope:{...affectScope},responseId:affectId(31),responseRevision:'1',status:'completed',expectedSegments:2,segments:[{id:affectId(32),index:0,text:sentence,shownAt:affectNow,finishedAt:affectNow+100},{id:affectId(33),index:1,text:'잔잔한 분위기야.',shownAt:affectNow+110,finishedAt:affectNow+200}],annotation:{...annotation},sourceRefs:[{sourceId:affectId(10),revision:'1'}]};}
it('OA01: annotations refer to spoken sentences, not the private content draft',()=>{
  const request=buildAnnotatedDialogueRequest(plan,{},'synthetic',{promptVariant:'conversation-history-v1'});
  const parsed=decodeAnnotatedDialogueOutput(request,JSON.stringify({content:'잔잔한 영화를 추천한다.',sentences:[sentence],recommendations:[annotation]}),2);
  expect(parsed).toEqual({sentences:[sentence],recommendations:[annotation],annotationStatus:'candidate'});
  const bad=decodeAnnotatedDialogueOutput(request,JSON.stringify({content:'별의 강을 추천해.',sentences:['오늘은 추천할 게 없어.'],recommendations:[{...annotation,quote:'별의 강을 추천해.'}]}),2);
  expect(bad).toMatchObject({sentences:['오늘은 추천할 게 없어.'],recommendations:[],annotationStatus:'invalid'});
});
it.each([undefined,{},[{...annotation,sentenceIndex:1}],[{...annotation,quote:'원문과 다른 추천'}],[annotation,annotation]])('OA01: malformed annotation preserves valid dialogue (%j)',recommendations=>{
  const request=buildAnnotatedDialogueRequest(plan,{},'synthetic');
  expect(decodeAnnotatedDialogueOutput(request,JSON.stringify({sentences:[sentence],recommendations}),2)).toEqual({sentences:[sentence],recommendations:[],annotationStatus:'invalid'});
});
it('a valid empty annotation is not a capture failure; legacy formats are explicitly unsupported',()=>{
  const request=buildAnnotatedDialogueRequest(plan,{},'synthetic');
  expect(decodeAnnotatedDialogueOutput(request,JSON.stringify({sentences:['안녕.'],recommendations:[]}),2).annotationStatus).toBe('none');
  expect(()=>buildAnnotatedDialogueRequest(plan,{},'synthetic',{evidenceBound:true})).toThrow('recommendation_capture_unsupported');
});
it('OA01: confirmation waits for every shown/finished segment and records exact delivered span',()=>{
  const input=delivered(),episode=confirmDeliveredRecommendation(input)!;
  expect(episode.deliveredAt).toBe(affectNow+200);expect(episode.text.slice(episode.span.start,episode.span.end)).toBe(sentence);
  expect(episodeAffectSource(episode)).toMatchObject({kind:'episode',delivered:true,truth:'unresolved',scope:affectScope});
  expect(confirmDeliveredRecommendation({...input,segments:[...input.segments].reverse()})).toEqual(episode);
  input.segments=[input.segments[0]!,{...input.segments[1]!,finishedAt:null}];expect(confirmDeliveredRecommendation(input)).toBeNull();
});
it.each(['cancelled','failed','delivering'] as const)('OA01: %s cannot create an action episode even if stale ACKs exist',status=>{
  expect(confirmDeliveredRecommendation({...delivered(),status})).toBeNull();
});
it('OA01: rejects missing/duplicate segments, invalid clocks and altered speech; an unchecked title is stored but never read',()=>{
  const input=delivered();
  for(const segments of [[input.segments[0]!],[input.segments[0]!,input.segments[0]!],[input.segments[0]!,{...input.segments[1]!,shownAt:null}],[input.segments[0]!,{...input.segments[1]!,finishedAt:0}],[{...input.segments[0]!,text:'다른 문장'},input.segments[1]!]])expect(confirmDeliveredRecommendation({...input,segments})).toBeNull();
  // The title is not checked; only the verbatim quote proves delivery, and the
  // interpreter reads the delivered text, never the title.
  const labelled=confirmDeliveredRecommendation({...input,annotation:{...annotation,title:'요약한 이름'}})!;
  expect(labelled.title).toBe('요약한 이름');expect(JSON.stringify(episodeAffectSource(labelled))).not.toContain('요약한 이름');
  expect(confirmDeliveredRecommendation({...input,annotation:{...annotation,quote:'대사에 없는 구절'}})).toBeNull();
});
it('a direction with a non-verbatim title is captured when its quote is verbatim; the capture prompt names more than suggestions',()=>{
  const request=buildAnnotatedDialogueRequest(plan,{},'synthetic',{promptVariant:'conversation-history-v1'}),said='먼저 겉면의 잠금장치를 오른쪽으로 돌려.';
  const direction={kind:'방법',title:'잠금장치 돌리기',sentenceIndex:0,quote:said};
  expect(decodeAnnotatedDialogueOutput(request,JSON.stringify({content:'여는 순서를 알려 준다.',sentences:[said],recommendations:[direction]}),2)).toEqual({sentences:[said],recommendations:[direction],annotationStatus:'candidate'});
  expect(request.messages[0]!.content).toContain('방법이나 순서를 알려 준 것');expect(request.messages[0]!.content).toContain('물어본 설명이나 답');
});
