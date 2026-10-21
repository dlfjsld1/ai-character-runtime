import type {EventInterpretationRequest,EventInterpretation,EventAppraisal,AffectSource} from '../packages/contracts/src/affect-appraisal.ts';
export const affectId=(n:number)=>`90000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const affectNow=1700000000000;
export const affectScope={ownerId:affectId(1),characterId:affectId(2)};
export function affectSource(n:number,kind:AffectSource['kind'],text:string,at=affectNow):AffectSource{
  return {id:affectId(n),revision:'1',kind,scope:{...affectScope},text,at,speakerId:kind==='input'?affectScope.ownerId:kind==='episode'||kind==='response'?affectScope.characterId:null,delivered:kind==='episode'||kind==='response',truth:'unresolved'};
}
export function affectRequest(n=10,at=affectNow):EventInterpretationRequest{
  return {scope:{...affectScope},eventId:affectId(n),eventRevision:'1',configVersion:'1',eventKind:'input',now:at,
    sources:[affectSource(n,'input','부탁한 준비는 마쳤지만 마감 시간은 지키지 못했어.',at),affectSource(3,'persona','맡은 일을 끝내는 것을 중요하게 여긴다.',affectNow-10000),affectSource(4,'goal','약속한 시간을 지킨다.',affectNow-10000)],
    speakerId:affectId(1),actors:[{id:affectId(1),label:'사용자'},{id:affectId(2),label:'캐릭터'}],experience:{status:'empty',revision:'1',truncated:false},currentAffect:{positive:0,negative:0,activation:0},stateSourceRefs:[]};
}
export function affectMeaning(request=affectRequest(),patch:Partial<EventAppraisal>={}):EventInterpretation{
  const current=request.sources.find(s=>s.id===request.eventId)!,persona=request.sources.find(s=>s.kind==='persona')!;
  return {status:'appraised',outcome:null,appraisals:[{episodeId:null,
    concern:{source:{sourceId:persona.id,revision:persona.revision,quote:persona.text}},evidence:[{sourceId:current.id,revision:current.revision,quote:current.text}],
    actorId:affectId(1),targetId:affectId(2),stance:'reports',relevance:1,importance:.8,congruence:1,certainty:1,agency:'other',controllability:null,expectedness:null,expectation:null,...patch,
  }]};
}
