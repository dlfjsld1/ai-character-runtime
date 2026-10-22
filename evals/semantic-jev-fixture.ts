// Synthetic Jev conversation evaluations for DB tests. A test states the
// conversational act explicitly; nothing here infers it from wording.
import {JevConversationCandidate} from '../packages/adapters/src/jev.ts';
import type {AppraisalProvider} from '../packages/contracts/src/ai-ports.ts';
import {recordedJevResponse} from './jev-fixture.ts';

export type ConversationAct='ordinary'|'ask_silence_reason'|'listen_request'|'apology'|'clarify_target'|'unknown';
const acts=['ordinary','ask_silence_reason','listen_request','apology','clarify_target','unknown'];
const targets=['candidate','other','unknown'];
const choice=(value:string,keys:string[],confidence=.95)=>({type:'choice',choice:value,confidence,probabilities:Object.fromEntries(keys.map(k=>[k,k===value?1:0]))});
export function conversationRaw(act:ConversationAct='ordinary',repairTarget='unknown',base=recordedJevResponse()){
  return {...base,answers:{...base.answers,conversation_act:choice(act,acts),repair_target:choice(repairTarget,targets)}};
}
type Selected={event:{id:string;identity_id:string;payload:{text:string}};revision:number|bigint|string;conversation?:unknown;conversationContext?:unknown};
// One evaluation bound to the selected event and its conversation snapshot.
export async function semanticEvaluation(selected:Selected,act:ConversationAct='ordinary',base=recordedJevResponse(),repairTarget='unknown'){
  const provider=new JevConversationCandidate({localOnly:false,allowPaidProviders:true,apiKey:'fixture'},async()=>Response.json(conversationRaw(act,repairTarget,base)));
  return provider.evaluate({id:selected.event.id,identityId:selected.event.identity_id,revision:String(selected.revision),text:selected.event.payload.text},{conversation:selected.conversation as never,conversationContext:selected.conversationContext as never});
}
// A Coordinator appraiser driven by an explicit text → act table written in the test.
export function scriptedJev(table:Record<string,ConversationAct|{act:ConversationAct;base?:ReturnType<typeof recordedJevResponse>;repairTarget?:string}>,fallback:ReturnType<typeof recordedJevResponse>=recordedJevResponse()):AppraisalProvider{
  const provider=new JevConversationCandidate({localOnly:false,allowPaidProviders:true,apiKey:'fixture'},async(_url,init)=>{
    const text=JSON.parse(String(init?.body)).state.utterance as string,entry=table[text]??'ordinary';
    const spec=typeof entry==='string'?{act:entry}:entry;
    return Response.json(conversationRaw(spec.act,spec.repairTarget,spec.base??fallback));
  });
  return provider;
}
