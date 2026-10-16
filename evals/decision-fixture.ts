import {DECISION_QUESTIONS} from '../packages/adapters/src/openai-conversation.ts';
// Synthetic provider response for boundary tests, never domain-quality evidence.
export function decisionFixture(values:Record<string,string|number>={},confidence:Record<string,number>={}){
 const selected={target:'character',act:'other',goal_relation:'unrelated',strength:0,hostility:0,addressee:'character',conversation_act:'ordinary',repair_target:'unknown',...values};
 return {model:'gpt-6-luna',answers:DECISION_QUESTIONS.map(q=>q.type==='choice'
  ?{name:q.name,type:q.type,choice:selected[q.name as keyof typeof selected],confidence:confidence[q.name]??.95,probabilities:q.choices!.map(c=>({value:c.value,probability:c.value===selected[q.name as keyof typeof selected]?1:0}))}
  :{name:q.name,type:q.type,score:selected[q.name as keyof typeof selected],confidence:confidence[q.name]??.95,probabilities:q.levels!.map((c,i)=>({value:i,label:c.label,probability:i===selected[q.name as keyof typeof selected]?1:0}))}),usage:{input_tokens:100,output_tokens:0,total_tokens:100,input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:0}}};
}
