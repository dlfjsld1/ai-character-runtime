import { stateSchema, type State, type Emotion, type Appraisal, type Plan, type EvidenceInput, type Relationship, type SilenceRecord, type AffectEvidence } from '../../contracts/src/domain.ts';
import type {PraiseGroupSource,RepetitionEvidence} from '../../contracts/src/ai-ports.ts';
import {isInteractionEvidence,hasConversationAct,canAttemptRepair} from '../../contracts/src/conversation.ts';

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const timing: Record<Emotion, {hold:number;half:number}> = {joy:{hold:4000,half:45000},frustration:{hold:6000,half:90000},surprise:{hold:1000,half:8000},embarrassment:{hold:3000,half:30000}};
export function initialState(now: number): State {
  const emotion = () => ({value:0,asOf:now,holdUntil:now,causes:[]});
  return {affect:{joy:emotion(),frustration:emotion(),surprise:emotion(),embarrassment:emotion()},mood:{pleasantness:.6,asOf:now},attention:{eventId:null,lastIdentityId:null,consecutive:0},workingMemoryEventIds:[],expression:{kind:'neutral',since:now},turn:{listening:false,acknowledgements:{},recentSilences:[]}};
}
export function decay(state: State, suppliedNow: number): State {
  const next = structuredClone(state);
  const now = Math.max(suppliedNow, state.mood.asOf, ...Object.values(state.affect).map(a => a.asOf));
  for (const key of Object.keys(next.affect) as Emotion[]) {
    const a = next.affect[key];
    a.value *= 2 ** (-Math.max(0, now - Math.max(a.asOf,a.holdUntil))/timing[key].half);
    a.asOf=now;
  }
  next.mood.pleasantness=.6+(state.mood.pleasantness-.6)*2**(-(now-state.mood.asOf)/900000);
  next.mood.asOf=now;
  return next;
}
export function expression(state: State, now: number): State['expression'] {
  if (state.turn.listening) return {kind:'listening',since:now};
  const scores={neutral:0,listening:0,embarrassed:.7*state.affect.embarrassment.value,uncomfortable:.5*state.affect.frustration.value,happy:.8*state.affect.joy.value};
  const winner=(['embarrassed','uncomfortable','happy'] as const).reduce((a,b)=>scores[b]>scores[a]?b:a,'embarrassed');
  const current=state.expression;
  if(current.kind==='neutral'||current.kind==='listening') return scores[winner]>=.1?{kind:winner,since:now}:{kind:'neutral',since:current.kind==='neutral'?current.since:now};
  if(scores[current.kind]<.05) return {kind:scores[winner]>=.1?winner:'neutral',since:now};
  return now-current.since>=2000&&scores[winner]>=scores[current.kind]+.03?{kind:winner,since:now}:current;
}
export function socialEffect(appraisal: Appraisal, history: EvidenceInput[], identityId: string, now: number) {
  const category:'praise'|'direct_insult'|null= !appraisal.uncertain&&appraisal.target==='character' ? appraisal.act==='praise'?'praise':appraisal.act==='criticism'&&appraisal.hostility>=2?'direct_insult':null:null;
  if(!category) return {category:null,stimulus:0,n:0,habituation:1};
  const window=history.filter(x=>x.relationshipEligible!==false&&x.identityId===identityId&&x.kind===category&&x.at>now-600000&&x.at<=now).sort((a,b)=>a.at-b.at||(a.order<b.order?-1:1));
  const cap=category==='praise'?.3:.24;
  const consumed=window.reduce((sum,e)=>sum+(e.appliedStimulus??0),0);
  const habituation=1/(1+window.length);
  return {category,stimulus:Math.min(.18*(appraisal.strength/3)*habituation,Math.max(0,cap-consumed)),n:window.length,habituation};
}
export function selectPraiseGroup(groups:readonly PraiseGroupSource[],evidence:RepetitionEvidence|undefined,complete:boolean):{kind:'new'}|{kind:'existing';groupId:string}|{kind:'fallback'}{
  const fallback={kind:'fallback'} as const;
  if(!complete||!evidence?.concrete||groups.length!==evidence.comparisons.length||new Set(groups.map(g=>g.eventId)).size!==groups.length)return fallback;
  const relations=new Map<string,Set<string>>();
  for(const [i,g] of groups.entries()){
    const comparison=evidence.comparisons[i];
    if(!g.groupId||comparison?.eventId!==g.eventId||comparison.revision!==g.revision||!['same','distinct'].includes(comparison.relation))return fallback;
    const values=relations.get(g.groupId)??new Set<string>();values.add(comparison.relation);relations.set(g.groupId,values);
  }
  if([...relations.values()].some(values=>values.size!==1))return fallback;
  const matches=[...relations].filter(([,values])=>values.has('same'));
  return matches.length>1?fallback:matches.length===1?{kind:'existing',groupId:matches[0]![0]}:{kind:'new'};
}
export function socialAffect(appraisal:Appraisal,history:EvidenceInput[],identityId:string,now:number,evidence?:AffectEvidence,groupId?:string):ReturnType<typeof socialEffect>{
  const boundedPraise=appraisal.uncertain&&appraisal.target==='character'&&appraisal.act==='praise'&&evidence?.kind==='praise'&&[1,2,3].includes(evidence.strength);
  const boundedAttack=appraisal.uncertain&&appraisal.target==='character'&&appraisal.act==='criticism'&&evidence?.kind==='direct_insult'&&[1,2,3].includes(evidence.strength);
  const category=boundedPraise?'praise':boundedAttack?'direct_insult':!appraisal.uncertain&&appraisal.target==='character'?appraisal.act==='praise'?'praise':appraisal.act==='criticism'&&appraisal.hostility>=2?'direct_insult':null:null;
  if(!category)return {category:null,stimulus:0,n:0,habituation:1};
  const window=history.filter(e=>e.identityId===identityId&&e.kind===category&&e.at>now-600000&&e.at<=now&&(category!=='praise'||!groupId||!e.affectGroupId||e.affectGroupId===groupId));
  // Affect pressure recovers with elapsed time; relationship replay stays on v1.
  let repetitions=0,consumed=0;
  for(const e of window){const weight=1-(now-e.at)/600000;repetitions+=weight;consumed+=weight*(e.affectStimulus??e.appliedStimulus??0);}
  const habituation=1/(1+repetitions),cap=category==='praise'?.3:.24;
  return {category,stimulus:Math.min(.18*(((boundedPraise||boundedAttack)?evidence!.strength:appraisal.strength)/3)*habituation,Math.max(0,cap-consumed)),n:window.length,habituation};
}
export function apply(state:State, input:{eventId:string;targetId:string|null;now:number;stimuli?:Partial<Record<Emotion,number>>;holdEligible?:boolean;observe?:boolean}):State {
  const next=decay(state,input.now); const now=next.mood.asOf;
  const s={joy:0,frustration:0,surprise:0,embarrassment:0,...input.stimuli};
  for(const key of Object.keys(s) as Emotion[]) {
    const a=next.affect[key],amount=s[key];
    if(amount>0) {
      a.value=clamp(a.value+amount);
      if(input.holdEligible!==false&&a.holdUntil<=now) a.holdUntil=now+timing[key].hold;
      a.causes=[...a.causes.filter(c=>c.eventId!==input.eventId),{eventId:input.eventId,targetId:input.targetId}].slice(-20);
    }
  }
  next.mood.pleasantness=clamp(next.mood.pleasantness+.1*(s.joy-s.frustration-.5*s.embarrassment));
  if(input.observe) next.workingMemoryEventIds=[...next.workingMemoryEventIds.filter(id=>id!==input.eventId),input.eventId].slice(-20);
  next.expression=expression(next,now);
  return stateSchema.parse(next);
}
// These are expression choices, never new affect or relationship evidence.
// Store validates cause provenance before persisting a styled response.
export function speechStyle(state:State,targetIdentityId:string|null,intent:{joy?:'show'|'mask';discomfort?:'show'|'mask';embarrassment?:'show'|'mask';discomfortTone?:'contextual'|'sharp'|'restrained'}={}):NonNullable<Plan['speechStyle']>{
  const related=targetIdentityId!==null&&state.affect.frustration.value>=.05&&state.affect.frustration.causes.some(c=>c.targetId===targetIdentityId);
  const distance=intent.discomfort!=='mask'&&related&&state.affect.frustration.value>=.1;
  const joy=intent.joy==='mask'?0:state.affect.joy.value;
  const concealed=intent.joy==='mask'&&intent.discomfort==='mask'&&intent.embarrassment==='mask';
  return {register:distance&&(!intent.discomfortTone||intent.discomfortTone==='contextual')?'formal':'casual',positiveTone:joy>=.6?'bright':joy>=.05?'warm':'neutral',...(distance?{discomfortTone:intent.discomfortTone??'contextual' as const}:related&&intent.discomfort==='mask'&&!concealed?{discomfortTone:'masked' as const}:{}),...(state.expression.kind==='embarrassed'&&intent.embarrassment!=='mask'?{nuance:'cautious' as const}:{}),...(concealed?{concealAffect:true as const}:{})};
}
// Store supplies only the last completed delivery to this recipient in this
// session, with a still-valid shared cause. Hiding is not relationship repair.
export function continueRegister(state:State,plan:Plan,previous:Plan|null):Plan {
  if(!plan.speechStyle||previous?.targetIdentityId!==plan.targetIdentityId||!plan.targetIdentityId||!previous.speechStyle||state.affect.frustration.value<.05||!state.affect.frustration.causes.some(c=>c.targetId===plan.targetIdentityId))return plan;
  if(previous.speechStyle.register==='casual'&&!previous.speechStyle.discomfortTone&&!previous.speechStyle.concealAffect)return plan;
  const continuingCasual=previous.speechStyle.register==='casual'&&!plan.speechStyle.discomfortTone&&!plan.speechStyle.concealAffect;
  return {...plan,speechStyle:{...plan.speechStyle,register:previous.speechStyle.register,...(continuingCasual?{discomfortTone:'restrained' as const}:{})}};
}
export function dialoguePlan(state:State,purpose:string,targetIdentityId:string|null,memoryIds:string[]=[]):Plan {
  return {action:purpose==='question'?'answer':purpose==='clarify'||purpose==='request_hint'||purpose==='resume_puzzle'?'ask':'acknowledge',purpose,targetIdentityId,expression:state.expression.kind,maxSentences:state.affect.frustration.value>=.6||state.affect.embarrassment.value>=.6?1:2,delivery:state.mood.pleasantness<.45?'calm':state.mood.pleasantness>.65?'lively':'normal',speechStyle:speechStyle(state,targetIdentityId),memoryIds};
}
// Project only the already-selected performance; never disclose the internal face.
export function stageExpression(plan:Plan):Plan['expression'] {
  if(!plan.speechStyle||plan.speechStyle.concealAffect||plan.participation&&plan.participation.mode!=='speak'||['ignore','pause','listen'].includes(plan.action))return 'neutral';
  if(plan.speechStyle.nuance==='cautious')return 'embarrassed';
  if(plan.speechStyle.discomfortTone!=='masked'&&(plan.speechStyle.register==='formal'||plan.speechStyle.discomfortTone))return 'uncomfortable';
  return plan.speechStyle.positiveTone==='warm'||plan.speechStyle.positiveTone==='bright'?'happy':'neutral';
}
export type SocialContext={text?:string;previousSilence?:SilenceRecord|null;explainedSilenceEventId?:string;recentWithholdingEventId?:string;recentBoundaryDelivered?:boolean;appraisalFailed?:boolean;unresolvedReference?:boolean;previousOutputFailed?:boolean;participationEvidence?:{target:'character';act:Appraisal['act'];acknowledgePraise?:true};conversationEvidence?:import('../../contracts/src/conversation.ts').ConversationEvidence};
export function chooseSocial(state:State,a:Appraisal,effect:ReturnType<typeof socialEffect>,identityId:string,now:number,context:SocialContext={}):Plan {
  const speak=(purpose:string):Plan=>({...dialoguePlan(state,purpose,identityId),participation:{mode:'speak'}});
  const repeated=(category:string):Plan|undefined=>{
    const last=state.turn.acknowledgements[`${identityId}:${category}`];
    if(last!==undefined&&now-last<15000)return {...dialoguePlan(state,'repeat',identityId),action:'ignore',participation:context.previousOutputFailed?{mode:'defer'}:{mode:'silent',reason:'no_addition'}};
  };
  // No social meaning is known: reply without any social act or affect
  // (2026-10-22 user decision; failure no longer means silence).
  if(context.appraisalFailed) return speak('other');
  const semantic=context.conversationEvidence,v2=isInteractionEvidence(semantic)?semantic:undefined;
  // v2 authority is already source-verified; uncertain affect never suppresses
  // an independently known action. Do not route it through legacy regex gates.
  if(v2){
    const prior=context.previousSilence;
    if(v2.responsePressure==='yes'&&!context.previousOutputFailed&&prior?.reason==='withholding'&&prior.identityId===identityId&&prior.at<=now){
      if(context.recentBoundaryDelivered||state.affect.frustration.value>=.6)return {...dialoguePlan(state,'intentional_silence',identityId),action:'listen',participation:{mode:'silent',reason:'withholding'}};
      return {...speak('set_boundary'),maxSentences:1,reengagement:{silenceEventId:prior.eventId,disclosure:'deflect'}};
    }
    if(v2.directAttack==='yes')return {...dialoguePlan(state,'intentional_silence',identityId),action:'listen',participation:{mode:'silent',reason:'withholding'}};
    if(v2.acts.listen_request==='yes')return {...dialoguePlan(state,'intentional_silence',identityId),action:'listen',participation:{mode:'silent',reason:'listening'}};
    if(v2.acts.listen_request==='unknown')return speak('clarify');
  }
  // Validated target/act evidence authorizes only the explicit acts below, never affect changes.
  const explicitTarget=a.target==='character'&&a.act!=='unknown'&&(!a.uncertain||(context.participationEvidence?.target===a.target&&context.participationEvidence.act===a.act));
  // Conversational acts come only from verified semantic evidence, never from wording patterns.
  if(hasConversationAct(semantic,'ask_silence_reason')) {
    const previous=context.previousSilence;
    const record=!context.previousOutputFailed&&previous?.identityId===identityId&&previous.at<=now?previous:null;
    // Only a delivered explanation plan in the validated recent conversation
    // grants this option. Repeated wording alone is not evidence or an attack.
    const linkedCause=!!record&&state.affect.frustration.causes.some(c=>c.targetId===identityId&&(c.eventId===record.eventId||record.sourceRefs.some(ref=>ref.kind==='event'&&ref.id===c.eventId)));
    // A recent, source-checked withholding choice has its own disclosure
    // policy. Fine intensity uncertainty does not erase that choice. Bound it
    // to the existing four-exchange context and ten-minute incident window.
    const recentWithholding=!!v2&&record?.reason==='withholding'&&context.recentWithholdingEventId===record.eventId&&now-record.at<=600000;
    const noRepairQuestion=v2?v2.acts.apology==='no'&&v2.acts.clarify_target==='no':!hasConversationAct(semantic,'apology')&&!hasConversationAct(semantic,'clarify_target');
    const alreadyExplained=!!record&&context.explainedSilenceEventId===record.eventId&&(linkedCause||recentWithholding)&&noRepairQuestion;
    // Like the expression's .20 entry/.10 exit bands, retained discomfort
    // should not disappear at .199. Bind retention to this valid incident's
    // recorded affect and current causes, independently of the visible face.
    const uncomfortable=state.affect.frustration.value>=.2||linkedCause&&record!.affect.frustration>=.2&&state.affect.frustration.value>=.1;
    const limitedDisclosure=uncomfortable||recentWithholding;
    const disclosure=record?record.reason==='withholding'?(state.affect.frustration.value>=.6||limitedDisclosure&&alreadyExplained?'deflect':limitedDisclosure?'partial':'explain'):'explain':'unknown';
    const plan:Plan={...speak('reengage'),action:'answer',reengagement:{silenceEventId:record?.eventId??null,disclosure}};
    // Preserve deliberate composure in the old high-affect concealment case.
    // A repeated reason can stay private without masking either emotion.
    if(disclosure==='deflect'&&state.affect.frustration.value>=.6)plan.speechStyle=speechStyle(state,identityId,{joy:'mask',discomfort:'mask',embarrassment:'mask'});
    return plan;
  }
  if(hasConversationAct(semantic,'listen_request')) return {...dialoguePlan(state,'intentional_silence',identityId),action:'listen',participation:{mode:'silent',reason:'listening'}};
  if(effect.category!=='direct_insult'&&canAttemptRepair(semantic))return speak('acknowledge_repair');
  // The input refers to one of my past suggestions but not to a single known
  // one: ask which. Silence, re-engagement and repair above keep precedence.
  if(context.unresolvedReference&&effect.category!=='direct_insult'&&!(!a.uncertain&&a.target==='character'&&a.act==='criticism'&&a.hostility===3))return {...speak('clarify'),action:'ask',reference:'unresolved_suggestion'};
  if(v2){
    // Uncertain sentence form alone is not missing conversational information.
    // Only ordinary input with all participation-sensitive acts ruled out may
    // respond normally; it grants no affect, repair or disclosure authority.
    if(v2.speechAct==='unknown'&&v2.directAttack==='no'&&v2.directPraise==='no'&&Object.values(v2.acts).every(act=>act==='no'))return speak('other');
    if(v2.directAttack==='unknown'||Object.values(v2.acts).includes('unknown')||v2.speechAct==='unknown')return speak('clarify');
    const purpose=v2.speechAct==='question'?'question':v2.directPraise==='yes'?'praise':v2.speechAct==='statement'?'other':v2.speechAct;
    return (['praise','greeting'].includes(purpose)?repeated(purpose):undefined)??speak(purpose);
  }
  // Uncertain meaning withholds affect only (socialAffect grants nothing for it);
  // the character still answers. Only a certain hostile attack is withheld.
  if(!a.uncertain&&a.target==='character'&&a.act==='criticism'&&a.hostility===3) return {...dialoguePlan(state,'intentional_silence',identityId),action:'listen',participation:{mode:'silent',reason:'withholding'}};
  // `uncertain` also covers strength/hostility/goal confidence, so it is not a
  // meaning gap. Ask back only when who or what is meant is unknown.
  if(a.act==='question') return speak(a.target==='unknown'?'clarify':'question');
  // An uncertain act label cannot establish a repetition unless verified evidence supports it.
  const verifiedAct=!a.uncertain||!!effect.category||explicitTarget&&a.act==='praise'&&context.participationEvidence?.acknowledgePraise===true;
  if(verifiedAct&&['greeting','praise','criticism'].includes(a.act)) {
    const repeat=repeated(effect.category??a.act);if(repeat)return repeat;
  }
  return speak(a.uncertain||a.act==='unknown'||a.target==='unknown'?'other':a.act);
}
export function applyRepair(state:State,now:number,eligible:boolean):{state:State;amount:number}{
  const next=decay(state,now),amount=eligible?Math.min(.03,next.affect.frustration.value*.10):0;
  if(amount>0){next.affect.frustration.value-=amount;next.mood.pleasantness=clamp(next.mood.pleasantness+.1*amount);next.expression=expression(next,next.mood.asOf);}
  return {state:next,amount};
}
export function koreanDate(now:number):string { return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export function projectRelationships(inputs:EvidenceInput[]):Map<string,Relationship> {
  const all=[...inputs].sort((a,b)=>a.at-b.at||(a.order<b.order?-1:a.order>b.order?1:a.id.localeCompare(b.id)));
  const result=new Map<string,Relationship>();
  for(const identityId of new Set(all.map(x=>x.identityId))) {
    const list=all.filter(x=>x.identityId===identityId); const r:Relationship={familiarity:0,affinity:.5,interactionDays:0,verifiedProblemCount:0,verifiedHelpDays:0,lastHelpAt:null};
    const dates=new Set<string>(),helpDates=new Set<string>(),problems=new Set<string>();
    const budgets=new Map<string,{positive:number;negative:number;helps:number}>();
    const socials:EvidenceInput[]=[];
    for(const e of list) {
      const date=koreanDate(e.at); const b=budgets.get(date)??{positive:0,negative:0,helps:0}; budgets.set(date,b);
      if(e.kind==='first_observed'&&!dates.has(date)) {dates.add(date);r.familiarity=clamp(r.familiarity+.02);}
      if(e.kind==='verified_hint'&&e.problemId&&!problems.has(e.problemId)) {
        problems.add(e.problemId);helpDates.add(date);r.lastHelpAt=e.at;
        if(b.helps<2) {r.familiarity=clamp(r.familiarity+.01);b.helps++;}
        const delta=Math.min(.015,.03-b.positive); b.positive+=delta;r.affinity=clamp(r.affinity+delta);
      }
      if(e.relationshipEligible!==false&&(e.kind==='praise'||e.kind==='direct_insult')) {
        const a:Appraisal={target:'character',act:e.kind==='praise'?'praise':'criticism',strength:e.strength??0,hostility:2,goal_relation:'unrelated',uncertain:false,evidence_refs:[]};
        const effect=socialEffect(a,socials,identityId,e.at); socials.push({...e,appliedStimulus:effect.stimulus});
        const positive=e.kind==='praise'; const remaining=.03-(positive?b.positive:b.negative);
        const amount=effect.stimulus>1e-12?Math.min(.005*((e.strength??0)/3)*effect.habituation,Math.max(0,remaining)):0;
        if(positive)b.positive+=amount;else b.negative+=amount;
        r.affinity=clamp(r.affinity+(positive?amount:-amount));
      }
    }
    r.interactionDays=dates.size;r.verifiedProblemCount=problems.size;r.verifiedHelpDays=helpDates.size;result.set(identityId,r);
  }
  return result;
}
export type AttentionCandidate={id:string;identityId:string;receivedAt:number;priority:0|1|2;deleted?:boolean};
export function selectAttention(candidates:AttentionCandidate[],now:number,lastIdentityId:string|null,consecutive:number):AttentionCandidate|null {
  const valid=candidates.filter(c=>!c.deleted&&c.receivedAt>now-20000).sort((a,b)=>b.priority-a.priority||a.receivedAt-b.receivedAt||a.id.localeCompare(b.id));
  const top=valid.filter(c=>c.priority===valid[0]?.priority);
  if(consecutive>=2&&top.some(c=>c.identityId!==lastIdentityId)) return top.find(c=>c.identityId!==lastIdentityId)!;
  return valid[0]??null;
}
export function agendaEligible(input:{now:number;sessionStart:number;lastUser:number;lastOutput:number;busy:boolean;participantPresent:boolean;expiresAt:number;attempted:boolean;createdSessionId:string;sessionId:string}):boolean {
  return input.createdSessionId!==input.sessionId&&input.now-input.sessionStart>=30000&&input.now-Math.max(input.lastUser,input.lastOutput)>=8000&&!input.busy&&input.participantPresent&&input.now<input.expiresAt&&!input.attempted;
}
