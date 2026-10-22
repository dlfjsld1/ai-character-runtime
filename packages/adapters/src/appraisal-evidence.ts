import {appraisalSchema,type Appraisal,type AffectEvidence} from '../../contracts/src/domain.ts';
import {evidenceEnvelopeSchema,type AppraisalMetadata} from '../../contracts/src/appraisal.ts';
import type {AppraisalEvidenceVerifier,EvidenceEvent} from '../../contracts/src/ai-ports.ts';
import {mapJevResponse,mapJevConversationResponse,conversationContextHash,JEV_CONVERSATION_VERSION,JEV_VERSION,JEV_THRESHOLD,JEV_REPETITION_VERSION,JEV_REPETITION_V8_VERSION,JEV_REPETITION_V9_VERSION,validateRepetitionAnswers,validateRepetitionV8Answers,repetitionV8Relation,repetitionV9Relation} from './jev.ts';
import {providerResultSchema} from './jev-schema.ts';
function verifiedEvidence(appraisal:Appraisal,metadata:AppraisalMetadata,event:EvidenceEvent){
  if(metadata.provider!=='jev'||metadata.failureCode!==undefined||!metadata.providerResult)return;
  let raw=metadata.providerResult,revisionBound=false;
  if('version' in raw){
    const envelope=evidenceEnvelopeSchema.safeParse(raw);if(!envelope.success)return;
    const value=envelope.data;
    if(value.provider!==metadata.provider||value.mappingVersion!==metadata.promptVersion||value.eventId!==event.eventId||value.identityId!==event.identityId)return;
    if(value.version>=2){if(('eventRevision' in value?value.eventRevision:undefined)!==event.eventRevision)return;revisionBound=true;}
    if(value.version===4&&(!event.conversationContext||event.conversationContext.identityId!==event.identityId||event.conversationContext.history.cutoffEventId!==event.eventId||value.contextHash!==conversationContextHash(event.conversationContext)))return;
    raw=value.payload;
  }
  const stored=providerResultSchema.safeParse(raw);if(!stored.success)return;
  const version=stored.data.mappingVersion;
  if(metadata.promptVersion!==version||!['jev-appraisal-v4',JEV_VERSION,JEV_REPETITION_VERSION,JEV_REPETITION_V8_VERSION,JEV_REPETITION_V9_VERSION,JEV_CONVERSATION_VERSION].includes(version))return;
  // v4 retains only its old participation authority. New authority requires a
  // current revision-bound envelope, not relabelled legacy raw.
  if(version!=='jev-appraisal-v4'&&!revisionBound)return;
  try{
    const verified=mapJevResponse({model:metadata.model,answers:stored.data.answers,usage:metadata.usage},event.eventId);
    if(JSON.stringify(appraisalSchema.parse(appraisal))!==JSON.stringify(verified.appraisal))return;
    if(JSON.stringify(stored.data.gateReasons)!==JSON.stringify(verified.metadata.providerResult.gateReasons))return;
    if(appraisal.target!=='character'||appraisal.act==='unknown'||!appraisal.evidence_refs.includes(event.eventId))return;
    const answers=verified.metadata.providerResult.answers;
    for(const key of ['target','act'] as const)if(!confident(answers[key]))return;
    return {answers,current:version!== 'jev-appraisal-v4'};
  }catch{return;}
}
function confident(answer:{confidence:number;probabilities:Record<string,number>}){
  const values=Object.values(answer.probabilities),max=Math.max(...values);
  return answer.confidence>=JEV_THRESHOLD&&values.filter(value=>value===max).length===1;
}
export const jevEvidenceVerifier:AppraisalEvidenceVerifier={
  verifyConversation(appraisal,metadata,event){
    if(metadata.provider!=='jev'||metadata.failureCode||metadata.promptVersion!==JEV_CONVERSATION_VERSION||!event.conversationContext||event.conversationContext.identityId!==event.identityId||event.conversationContext.history.cutoffEventId!==event.eventId)return;
    const envelope=evidenceEnvelopeSchema.safeParse(metadata.providerResult);if(!envelope.success||envelope.data.version!==4)return;
    const e=envelope.data;
    if(e.provider!=='jev'||e.mappingVersion!==JEV_CONVERSATION_VERSION||e.eventId!==event.eventId||e.identityId!==event.identityId||e.eventRevision!==event.eventRevision||e.contextHash!==conversationContextHash(event.conversationContext))return;
    const stored=providerResultSchema.safeParse(e.payload);if(!stored.success||stored.data.mappingVersion!==JEV_CONVERSATION_VERSION||!stored.data.conversation)return;
    try{
      const mapped=mapJevConversationResponse({model:metadata.model,answers:{...stored.data.answers,...stored.data.conversation},usage:metadata.usage},event.eventId);
      if(JSON.stringify(appraisalSchema.parse(appraisal))!==JSON.stringify(mapped.appraisal)||JSON.stringify(stored.data.gateReasons)!==JSON.stringify(mapped.metadata.providerResult.gateReasons))return;
      // The request fixes addressee=character, so the utterance is addressed to
      // this character by construction. appraisal.target is what the utterance
      // evaluates; it differs from the addressee in a target clarification and
      // does not gate the conversational act. The act's own confidence does.
      if(!appraisal.evidence_refs.includes(event.eventId))return;
      const {conversation_act,repair_target}=stored.data.conversation;
      if(!confident(conversation_act))return;
      const act=conversation_act.choice as import('../../contracts/src/conversation.ts').LegacyConversationEvidence['act'];
      const repairTarget=confident(repair_target)&&repair_target.choice==='candidate'&&event.conversationContext.repairCandidate?'candidate':confident(repair_target)&&repair_target.choice==='other'?'other':'unknown';
      return {act,repairTarget};
    }catch{return;}
  },
  verifyRepetition(appraisal,metadata,event){
    if(![JEV_REPETITION_VERSION,JEV_REPETITION_V8_VERSION,JEV_REPETITION_V9_VERSION].includes(metadata.promptVersion??'')||appraisal.act!=='praise'||!verifiedEvidence(appraisal,metadata,event))return;
    const envelope=evidenceEnvelopeSchema.safeParse(metadata.providerResult),snapshot=event.recentPraise;
    if(!envelope.success||envelope.data.version!==3||!snapshot?.complete||!envelope.data.comparison.complete)return;
    const expected={asOf:snapshot.asOf,complete:true,sources:snapshot.items.map(({eventId,revision})=>({eventId,revision}))};
    if(JSON.stringify(envelope.data.comparison)!==JSON.stringify(expected)||new Set(snapshot.items.map(i=>i.eventId)).size!==snapshot.items.length)return;
    const stored=providerResultSchema.safeParse(envelope.data.payload);if(!stored.success)return;
    try{
      if(metadata.promptVersion===JEV_REPETITION_V8_VERSION||metadata.promptVersion===JEV_REPETITION_V9_VERSION){
        const v9=metadata.promptVersion===JEV_REPETITION_V9_VERSION;
        const raw=validateRepetitionV8Answers(v9?stored.data.repetitionV9:stored.data.repetitionV8,snapshot.items.length);
        return {concrete:confident(raw.concrete)&&raw.concrete.choice==='yes',comparisons:raw.comparisons.map((pair,i)=>({eventId:snapshot.items[i]!.eventId,revision:snapshot.items[i]!.revision,relation:(v9?repetitionV9Relation:repetitionV8Relation)(pair)}))};
      }
      const raw=validateRepetitionAnswers(stored.data.repetition,snapshot.items.length);
      const concrete=confident(raw.concrete)&&raw.concrete.choice==='yes';
      return {concrete,comparisons:raw.comparisons.map((answer,i)=>({eventId:snapshot.items[i]!.eventId,revision:snapshot.items[i]!.revision,relation:confident(answer)?answer.choice as 'same'|'distinct'|'unknown':'unknown'}))};
    }catch{return;}
  },
  verify(appraisal,metadata,event){
    const evidence=verifiedEvidence(appraisal,metadata,event);if(!evidence)return;
    return {target:'character',act:appraisal.act,...(evidence.current&&appraisal.act==='praise'?{acknowledgePraise:true as const}:{})};
  },
  verifyAffect(appraisal,metadata,event):AffectEvidence|undefined{
    if(!appraisal.uncertain||appraisal.act!=='praise')return;
    const evidence=verifiedEvidence(appraisal,metadata,event);if(!evidence?.current)return;
    const {answers}=evidence;
    for(const key of ['goal_relation','hostility'] as const)if(!confident(answers[key]))return;
    if(answers.hostility.probabilities['0']!==Math.max(...Object.values(answers.hostility.probabilities)))return;
    // Conservative ordinal lower bound, not provider confidence or calibrated
    // psychological intensity. Strict appraisal and raw remain untouched.
    const p=answers.strength.probabilities,total=Object.values(p).reduce((sum,value)=>sum+value,0);
    for(const level of [3,2,1] as const){
      const tail=Object.entries(p).reduce((sum,[key,value])=>sum+(Number(key)>=level?value:0),0)/total;
      if(tail>=.95)return {kind:'praise',strength:level};
    }
  },
};
export function readJevEvidence(raw:Record<string,unknown>){return providerResultSchema.parse('version' in raw?evidenceEnvelopeSchema.parse(raw).payload:raw);}
