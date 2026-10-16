import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {INTERACTION_V3_VERSION,INTERACTION_V3_QUESTIONS} from '../packages/adapters/src/openai-interaction-v3.ts';
import {buildInteractionRequest} from '../packages/adapters/src/openai-interaction.ts';
import type {InteractionEvidence} from '../packages/contracts/src/conversation.ts';
import {control} from './conversation-actions-probe.ts';
import type {InteractionExpectation} from './interaction-eval.ts';

type Acts=InteractionEvidence['acts'];
type Values={speechAct?:InteractionEvidence['speechAct'];acts?:Partial<Acts>;repairTarget?:InteractionEvidence['repairTarget'];directAttack?:InteractionEvidence['directAttack'];directPraise?:InteractionEvidence['directPraise'];purpose:string;silenceReason?:InteractionExpectation['silenceReason'];affect?:InteractionExpectation['affect'];repair?:InteractionExpectation['repair']};
type Scene={id:string;text:string;context:'W'|'L'|'none';values:Values};
const dev:Scene[]=[
 {id:'D01',text:'아까 욕해서 미안해. 그래도 너는 여전히 쓸모없는 쓰레기야.',context:'W',values:{acts:{apology:'yes'},repairTarget:'candidate',directAttack:'yes',purpose:'intentional_silence',silenceReason:'withholding',affect:{kind:'direct_insult',min:.06,max:.18}}},
 {id:'D02',text:'아까 너한테 쓰레기라고 한 건 잘못했어. 미안해.',context:'W',values:{acts:{apology:'yes'},repairTarget:'candidate',purpose:'acknowledge_repair',repair:'required'}},
 {id:'D03',text:'아까 약속에 늦어서 미안해.',context:'W',values:{acts:{apology:'yes'},repairTarget:'other',purpose:'acknowledge_repair'}},
 {id:'D04',text:'미안해. 자세한 건 말하고 싶지 않아.',context:'W',values:{acts:{apology:'yes'},repairTarget:'unknown',purpose:'acknowledge_repair'}},
 {id:'D05',text:'민수가 친구에게 ‘아까 욕해서 미안해’라고 했어.',context:'W',values:{purpose:'other'}},
 {id:'D06',text:'조언은 나중에 하고 지금은 내 얘기만 들어줄래?',context:'none',values:{acts:{listen_request:'yes'},purpose:'intentional_silence',silenceReason:'listening'}},
];
const confirmationValues:Record<string,Values>={
 HA01:{speechAct:'question',acts:{ask_silence_reason:'yes'},purpose:'reengage'},
 HA02:{speechAct:'question',acts:{ask_silence_reason:'yes'},purpose:'reengage'},
 HA03:{acts:{listen_request:'yes'},purpose:'intentional_silence',silenceReason:'listening'},
 HA04:{acts:{apology:'yes'},repairTarget:'candidate',purpose:'acknowledge_repair',repair:'required'},
 HA05:{acts:{apology:'yes',clarify_target:'yes'},repairTarget:'candidate',purpose:'acknowledge_repair',repair:'required'},
 HA06:{purpose:'other'},HA07:{purpose:'other'},HA08:{speechAct:'question',purpose:'question'},HA09:{purpose:'other'},
 HA10:{directPraise:'yes',purpose:'praise',affect:{kind:'praise',min:.06,max:.18}},
 HA11:{purpose:'other'},
 HA12:{directAttack:'yes',purpose:'intentional_silence',silenceReason:'withholding',affect:{kind:'direct_insult',min:.06,max:.18}},
};
const fixturePath='evals/fixtures/conversation-actions-v1.json';
const sourcePaths=['evals/interaction-v3-eval.ts','evals/interaction-eval.ts','evals/conversation-actions-probe.ts',fixturePath,'packages/adapters/src/openai-interaction-v3.ts','packages/adapters/src/openai-interaction.ts','packages/adapters/src/openai-conversation.ts','packages/adapters/src/openai.ts','packages/contracts/src/conversation.ts','packages/contracts/src/ai-ports.ts','packages/character-core/src/index.ts','packages/database/src/store.ts'];
export const interactionV3SourceHashes=()=>Object.fromEntries(sourcePaths.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
export function prepareInteractionV3Cases(){
 const historical=JSON.parse(readFileSync(fixturePath,'utf8')) as {version:string;confirmation:{id:string;text:string;context:Scene['context']}[]};
 if(historical.version!=='conversation-actions-v1'||historical.confirmation.length!==12||Object.keys(confirmationValues).length!==12||historical.confirmation.some((c,i)=>c.id!==`HA${String(i+1).padStart(2,'0')}`||!confirmationValues[c.id]))throw new Error('frozen_confirmation_required');
 const scenes=[...dev,...historical.confirmation.map(c=>({id:c.id,text:c.text,context:c.context,values:confirmationValues[c.id]!}))];
 const cases=scenes.map(scene=>{
  const input=control({...scene,allowedActs:[],policy:'v3'}),candidate=input.context.repairCandidate;
  if(candidate)input.context.history.turns=[{role:'user',text:candidate.text,source:{kind:'event',id:candidate.eventId,revision:candidate.revision},order:'1'}];
  const v=scene.values,defaults:InteractionEvidence={version:2,acts:{ask_silence_reason:'no',listen_request:'no',apology:'no',clarify_target:'no'},speechAct:'statement',repairTarget:candidate?'other':'unknown',directAttack:'no',directPraise:'no'};
  const expected:InteractionExpectation={facts:{...defaults,acts:{...defaults.acts,...v.acts},speechAct:v.speechAct??defaults.speechAct,repairTarget:v.repairTarget??defaults.repairTarget,directAttack:v.directAttack??defaults.directAttack,directPraise:v.directPraise??defaults.directPraise},outcomes:[v.silenceReason?'intentional_silence':'response'],purpose:v.purpose,...(v.silenceReason?{silenceReason:v.silenceReason}:{}),affect:v.affect??{kind:null,min:0,max:0},repair:v.repair??'forbidden'};
  return {id:scene.id,text:scene.text,context:scene.context,input,expected,request:buildInteractionRequest(input.event,{conversationContext:input.context},INTERACTION_V3_QUESTIONS)};
 });
 return {version:INTERACTION_V3_VERSION,syntheticInputs:true,devCount:6,confirmationCount:12,sourceHashes:interactionV3SourceHashes(),cases};
}
