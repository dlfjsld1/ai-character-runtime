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
  messages[0]!.content+='\n출력 JSON에 recommendations 배열도 포함해. 이번 대사에서 내가 상대에게 해 준 행동 중, 상대가 나중에 해 보거나 쓰거나 믿고 따른 뒤 결과를 말할 수 있는 것이 있으면 최대1개, 없으면 빈 배열이야. 무언가를 골라 권한 것, 방법이나 순서를 알려 준 것, 상대가 물어본 설명이나 답을 준 것이 여기에 들어가. 인사·공감·되묻기·거절, 상대가 한 말을 되풀이한 것, 남의 추천을 전한 것, 가정·부정·단순 언급은 아니야. kind는 그 행동이나 대상의 종류를 나타내는 짧은 명사, title은 대사 원문에서 핵심 이름이나 구절을 글자 그대로 복사한 연속된 부분(요약하거나 바꿔 쓰지 마), sentenceIndex는 sentences의 0부터 시작하는 위치, quote는 그 행동을 담은 대사의 원문 구절이야. 과거에 한 행동을 새 행동으로 기록하지 마. 내부 content 초안은 근거가 아니야.';
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
    // The verbatim quote is the delivery evidence. The prompt asks for a verbatim
    // title but it is not enforced: the title is stored and never read.
    if(!sentence||!sentence.includes(a.quote)||sentence.indexOf(a.quote)!==sentence.lastIndexOf(a.quote))return {sentences,recommendations:[],annotationStatus:'invalid'};
  }
  return {sentences,recommendations:parsed.data,annotationStatus:parsed.data.length?'candidate':'none'};
}
