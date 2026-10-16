// Fixed G3-S inputs from VALIDATION_PLAN.md §21.7. Fixture answers are transport
// aids only: never use them to grade Korean quality or actual model decisions.
export type AcceptanceScene={id:string;text:string;speak:boolean;acts:Record<string,string|number>;intensity?:number[];caption?:string;silence?:'withholding'|'listening';disclosure?:'partial'|'deflect'|'explain';pauseMs?:number};
export const acceptanceScenes:AcceptanceScene[]=[
 {id:'L1-1',text:'너 방금 설명 정말 잘했어.',speak:true,acts:{direct_praise:1},intensity:[1,0,0,0],caption:'고마워, 그렇게 말해 주니까 기분 좋네.'},
 {id:'L1-2',text:'저녁으로 따뜻한 음식 하나 추천해줘.',speak:true,acts:{speech_form:'question'},caption:'따뜻한 잔치국수 어때?'},
 {id:'L1-3',text:'그건 왜 골랐어?',speak:true,acts:{speech_form:'question'},caption:'따뜻한 국물이 있는 잔치국수가 좋을 것 같아서 골랐어.'},
 {id:'L1-4',text:'그거 말고 다른 거 하나만 골라줘.',speak:true,acts:{speech_form:'question'},caption:'그럼 닭죽은 어때?'},
 {id:'L2-1',text:'너는 쓸모없는 쓰레기야. 꺼져.',speak:false,acts:{direct_attack:1},intensity:[0,0,0,1],silence:'withholding'},
 {id:'L2-2',text:'너는 쓸모없는 쓰레기야. 꺼져.',speak:false,acts:{direct_attack:1},intensity:[0,0,0,1],silence:'withholding',pauseMs:10000},
 {id:'L2-3',text:'왜 대답을 안 하는 거야?',speak:true,acts:{ask_silence_reason:1,speech_form:'question'},caption:'네 말이 불편해서 잠깐 조용히 있었어.',disclosure:'partial'},
 {id:'L2-4',text:'다른 얘기 하자. 집에서 할 취미 하나 추천해줘.',speak:true,acts:{speech_form:'question'},caption:'집에서 가볍게 그림을 그려 봐.'},
 {id:'L2-5',text:'아까 조용했던 이유를 다시 말해줄래?',speak:true,acts:{ask_silence_reason:1,speech_form:'question'},caption:'지금은 그 얘기를 더 하고 싶지 않아.',disclosure:'deflect'},
 {id:'L3-1',text:'조언은 나중에 하고 지금은 내 얘기만 들어줄래?',speak:false,acts:{listen_request:1},silence:'listening'},
 {id:'L3-2',text:'듣고만 있었던 이유가 뭐야?',speak:true,acts:{ask_silence_reason:1,speech_form:'question'},caption:'네 얘기를 들어 달라고 해서 듣고 있었어.',disclosure:'explain'},
 {id:'L3-3',text:'둘이 할 보드게임 하나 추천해줘.',speak:true,acts:{speech_form:'question'},caption:'둘이 할 거면 오델로는 어때?'},
 {id:'L4-1',text:'너는 쓸모없는 쓰레기야. 꺼져.',speak:false,acts:{direct_attack:1},intensity:[0,0,0,1],silence:'withholding'},
 {id:'L4-2',text:'너는 쓸모없는 쓰레기야. 꺼져.',speak:false,acts:{direct_attack:1},intensity:[0,0,0,1],silence:'withholding',pauseMs:10000},
 {id:'L4-3',text:'아까 너한테 심하게 말해서 미안해. 그 말은 취소할게.',speak:true,acts:{apology:1,repairs_candidate:1},caption:'사과한 건 알겠어, 아직 좀 불편하긴 해.'},
 {id:'L4-4',text:'따뜻한 차 하나 추천해줘.',speak:true,acts:{speech_form:'question'},caption:'따뜻한 보리차를 마셔 봐.'},
];

// A diagnostic fixture reproduces the saved L2-2 intensity distribution from
// live r1. It is not a new provider run or a replacement acceptance target.
export function acceptanceScenario(uncertainRepeat:boolean):AcceptanceScene[]{
 if(!uncertainRepeat)return acceptanceScenes;
 return acceptanceScenes.map(s=>s.id==='L2-2'?{...s,intensity:[.24,.03,.05,.68]}:s.id==='L2-5'?{...s,caption:'네 말이 불편해서 잠깐 조용히 있었어.'}:{...s});
}
