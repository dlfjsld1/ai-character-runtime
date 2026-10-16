import {INTERACTION_QUESTIONS,INTERACTION_VERSION,mapInteractionResponse} from '../packages/adapters/src/openai-interaction.ts';
import {decisionContextHash} from '../packages/adapters/src/openai-conversation.ts';
import type {ConversationContext} from '../packages/contracts/src/conversation.ts';
// Synthetic answers test contract/policy only. They do not test Korean model quality.
export function interactionFixture(values:Record<string,string|number>={},intensity=[1,0,0,0],confidence=.95){
 return {model:'gpt-6-luna',answers:INTERACTION_QUESTIONS.map(q=>q.type==='predicate'
  ?{name:q.name,type:q.type,probability:values[q.name]??0}
  :q.type==='choice'?{name:q.name,type:q.type,choice:values[q.name]??'statement',confidence,probabilities:q.choices!.map(c=>({value:c.value,probability:c.value===(values[q.name]??'statement')?1:0}))}
  :{name:q.name,type:q.type,score:intensity.reduce((s,p,i)=>s+p*i,0),confidence,probabilities:q.levels!.map((c,i)=>({value:i,label:c.label,probability:intensity[i]}))}),usage:{input_tokens:100,output_tokens:0,total_tokens:100,input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:0}}};
}
export function boundInteraction(raw:unknown,eventId:string,context:ConversationContext,version=INTERACTION_VERSION){
 const v=mapInteractionResponse(raw,eventId,0,version);
 v.metadata.providerResult={version:4,provider:'openai-decisions',mappingVersion:version,eventId,identityId:context.identityId,eventRevision:'1',contextHash:decisionContextHash(context),payload:v.metadata.providerResult};
 return v;
}
export function pressureFixture(values:Record<string,string|number>={},intensity=[1,0,0,0]){
 const raw=interactionFixture(values,intensity);
 return {...raw,answers:[...raw.answers,{name:'response_pressure',type:'predicate',probability:values.response_pressure??0}]};
}
