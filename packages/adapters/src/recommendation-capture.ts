import {z} from 'zod';
import {recommendationAnnotationSchema,type DialogueTurn} from '../../contracts/src/outcomes.ts';
import type {DialogueContext} from '../../contracts/src/ai-ports.ts';
import type {Plan} from '../../contracts/src/domain.ts';
import {buildDialogueRequest,decodeDialogueOutput,type DialoguePromptOptions} from './dialogue-request.ts';

export function buildAnnotatedDialogueRequest(plan:Plan,context:DialogueContext,model:string,options?:DialoguePromptOptions){
  const base=buildDialogueRequest(plan,context,model,options);
  if(base.legacy)throw new Error('recommendation_capture_unsupported');
  const recommendations=z.array(recommendationAnnotationSchema).max(1);
  const format=structuredClone(base.format) as {properties:Record<string,unknown>;required:string[]};
  format.properties.recommendations=z.toJSONSchema(recommendations);format.required.push('recommendations');
  const messages=base.messages.map(m=>({...m}));
  messages[0]!.content+='\n출력 JSON에 recommendations 배열도 포함해. 이번 대사에서 내가 실제로 권하는 영화가 있으면 최대1개, 없으면 빈 배열이야. 인용·사용자 추천·가정·부정·단순 언급은 내 추천이 아니야. kind는 movie, title은 대사에 쓴 제목 그대로, sentenceIndex는 sentences의 0부터 시작하는 위치, quote는 추천한 대사의 원문 구절이야. quote에는 제목이 포함돼야 해. 과거 추천을 새 행동으로 기록하지 마. 내부 content 초안은 근거가 아니야.';
  return {base,messages,format};
}
export function decodeAnnotatedDialogueOutput(request:ReturnType<typeof buildAnnotatedDialogueRequest>,text:string,maxSentences:number):DialogueTurn{
  let output:Record<string,unknown>;
  try{output=JSON.parse(text);}catch{return {sentences:decodeDialogueOutput(request.base,text,maxSentences),recommendations:[],annotationStatus:'invalid'};}
  // Keep valid spoken text even when the optional capture is malformed.
  const {recommendations,...spoken}=output;
  const sentences=decodeDialogueOutput(request.base,JSON.stringify(spoken),maxSentences);
  const parsed=z.array(recommendationAnnotationSchema).max(1).safeParse(recommendations);
  if(!parsed.success)return {sentences,recommendations:[],annotationStatus:'invalid'};
  for(const a of parsed.data){
    const sentence=sentences[a.sentenceIndex];
    if(!sentence||!a.quote.includes(a.title)||!sentence.includes(a.quote)||sentence.indexOf(a.quote)!==sentence.lastIndexOf(a.quote))return {sentences,recommendations:[],annotationStatus:'invalid'};
  }
  return {sentences,recommendations:parsed.data,annotationStatus:parsed.data.length?'candidate':'none'};
}
