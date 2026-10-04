import { stateSchema, type State, type Emotion, type Appraisal, type Plan, type EvidenceInput, type Relationship } from '../../contracts/src/domain.ts';

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const timing: Record<Emotion, {hold:number;half:number}> = {joy:{hold:4000,half:45000},frustration:{hold:6000,half:90000},surprise:{hold:1000,half:8000},embarrassment:{hold:3000,half:30000}};
export function initialState(now: number): State {
  const emotion = () => ({value:0,asOf:now,holdUntil:now,causes:[]});
  return {affect:{joy:emotion(),frustration:emotion(),surprise:emotion(),embarrassment:emotion()},mood:{pleasantness:.6,asOf:now},attention:{eventId:null,lastIdentityId:null,consecutive:0},workingMemoryEventIds:[],expression:{kind:'neutral',since:now},turn:{listening:false,acknowledgements:{}}};
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
  const window=history.filter(x=>x.identityId===identityId&&x.kind===category&&x.at>now-600000&&x.at<=now).sort((a,b)=>a.at-b.at||(a.order<b.order?-1:1));
  const cap=category==='praise'?.3:.24;
  const consumed=window.reduce((sum,e)=>sum+(e.appliedStimulus??0),0);
  const habituation=1/(1+window.length);
  return {category,stimulus:Math.min(.18*(appraisal.strength/3)*habituation,Math.max(0,cap-consumed)),n:window.length,habituation};
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
export function dialoguePlan(state:State,purpose:string,targetIdentityId:string|null,memoryIds:string[]=[]):Plan {
  return {action:purpose==='question'?'answer':purpose==='clarify'||purpose==='request_hint'||purpose==='resume_puzzle'?'ask':'acknowledge',purpose,targetIdentityId,expression:state.expression.kind,maxSentences:state.affect.frustration.value>=.6||state.affect.embarrassment.value>=.6?1:2,delivery:state.mood.pleasantness<.45?'calm':state.mood.pleasantness>.65?'lively':'normal',memoryIds};
}
export function chooseSocial(state:State,a:Appraisal,effect:ReturnType<typeof socialEffect>,identityId:string,now:number):Plan {
  if(a.act==='question') return dialoguePlan(state,a.uncertain||a.target==='unknown'?'clarify':'question',identityId);
  if(a.uncertain||a.target==='unknown') return {...dialoguePlan(state,'uncertain',identityId),action:'listen'};
  if(!['greeting','praise','criticism'].includes(a.act)) return {...dialoguePlan(state,'unselected',identityId),action:'listen'};
  const category=effect.category??a.act; const key=`${identityId}:${category}`;
  if((effect.category&&effect.stimulus<=1e-12)||(state.turn.acknowledgements[key]!==undefined&&now-state.turn.acknowledgements[key]<15000)) return {...dialoguePlan(state,'repeat',identityId),action:'ignore'};
  return dialoguePlan(state,a.act,identityId);
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
      if(e.kind==='praise'||e.kind==='direct_insult') {
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
