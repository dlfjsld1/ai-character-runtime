// Evaluation entry point only: production adapters/server, optional mock HTTP transport.
// The single concealment intervention is explicitly controlled, never a natural-policy claim.
import assert from 'node:assert/strict';
import {parseConfig} from '../packages/contracts/src/index.ts';
import {Database} from '../packages/database/src/connection.ts';
import {Store} from '../packages/database/src/store.ts';
import {assertMigrations} from '../packages/database/src/migrate.ts';
import {CHARACTER_ID} from '../packages/database/src/seed.ts';
import {createProviders,type ProviderRegistry} from '../apps/runtime/src/providers.ts';
import {createServer} from '../apps/runtime/src/http/server.ts';
import {PostgresKnowledgeRetriever} from '../packages/adapters/src/postgres-knowledge.ts';
import {DialogueBudget,OpenAIDialogue} from '../packages/adapters/src/openai.ts';
import {OpenAIInteractionV5Candidate,interactionV5EvidenceVerifier} from '../packages/adapters/src/openai-interaction-v5.ts';

const mode=process.argv[2];
assert(process.send&&['--rehearsal','--live'].includes(mode??''),'evaluation_child_only');
const config=parseConfig(process.env),url=new URL(config.DATABASE_URL);
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55434');
assert.match(url.pathname,new RegExp('^/character_runtime_h2a_'+(mode==='--live'?'live':'rehearsal')+'_20261017_r[1-3]$'));
assert.match(config.DIALOGUE_BUDGET_PATH.replaceAll('\\','/'),/^J:\/ai\/ai-character-runtime\//i);
assert(config.OPENAI_BUDGET_AUTHORIZATION.includes('H2-A'));
const mock=mode==='--rehearsal';
const maxCounts=Number(process.env.H2A_MAX_COUNT_CALLS);assert(Number.isSafeInteger(maxCounts)&&maxCounts>0);
class ScopedBudget extends DialogueBudget {
 override reserve(kind:Parameters<DialogueBudget['reserve']>[0],body:object){
  if(kind==='count'&&this.summary().attempts.count>=maxCounts)throw Error('h2a_count_attempt_limit');
  return super.reserve(kind,body);
 }
}
const budget=()=>new ScopedBudget(config.DIALOGUE_BUDGET_PATH,config.DIALOGUE_BUDGET_USD,undefined,{
 authorization:config.OPENAI_BUDGET_AUTHORIZATION,maxDecisionCalls:config.OPENAI_MAX_DECISION_CALLS,maxDialogueCalls:config.OPENAI_MAX_DIALOGUE_CALLS,
 ...(config.OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID?{acknowledgedCountEntryId:config.OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID}:{}),
 ...(config.OPENAI_ACKNOWLEDGED_DIALOGUE_ENTRY_ID?{acknowledgedDialogueEntryId:config.OPENAI_ACKNOWLEDGED_DIALOGUE_ENTRY_ID}:{})});
const fetcher:typeof fetch=async(input,init)=>{
 const endpoint=String(input),body=JSON.parse(String(init?.body));
 assert(['https://api.openai.com/v1/responses','https://api.openai.com/v1/responses/input_tokens','https://api.openai.com/v1/decisions'].includes(endpoint),'unexpected_provider_endpoint');
 const kind=endpoint.endsWith('input_tokens')?'count':body.questions?'decision':'dialogue';
 // Bodies contain only fixed synthetic evaluation data; credentials/headers never leave this child.
 process.send!({type:'request',kind,body,mock});
 if(!mock)return fetch(input,init);
 if(kind==='count')return Response.json({input_tokens:300});
 if(kind==='decision'){
  const current=JSON.parse(body.input).current.text,form=current==='안녕!'?'greeting':'question';
  return Response.json({model:body.model,answers:body.questions.map((q:any)=>q.type==='predicate'?{type:q.type,name:q.name,probability:0}:q.type==='choice'?{type:q.type,name:q.name,choice:form,confidence:1,probabilities:q.choices.map((c:any)=>({value:c.value,probability:c.value===form?1:0}))}:{type:q.type,name:q.name,score:0,confidence:1,probabilities:q.levels.map((l:any,i:number)=>({value:i,label:l.label,probability:i===0?1:0}))}),usage:{input_tokens:300,output_tokens:0,total_tokens:300,input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:0}}});
 }
 const material=JSON.parse(body.input.filter((m:any)=>m.role==='user').at(-1).content),evidence=material.evidence??material;
 let output:object;
 if(material.query){
  const source=material.chunks.find((c:any)=>/합성 필터는 (6|12)개월/.test(c.text));
  const months=source?.text.match(/(6|12)개월/)?.[1];
  output={status:source?'answered':'not_found',sentences:[source?`합성 필터는 ${months}개월마다 교체합니다.`:'자료에서 교체 주기를 확인할 수 없습니다.'],citationIds:source?[source.citationId]:[]};
 }else{
  const value=evidence.personalFacts?.find((f:any)=>f.key==='음료 선호')?.value;
  const sentence=evidence.input?.payload?.text==='안녕!'?'안녕!':value?`${value}를 선호한다고 적혀 있어.`:'저장된 음료 선호가 없어.';
  output={content:sentence,sentences:[sentence]};
 }
 return Response.json({status:'completed',model:body.model,usage:{input_tokens:300,output_tokens:25},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(output)}]}]});
};
const options=()=>({localOnly:false,allowPaidProviders:true,apiKey:config.DIALOGUE_API_KEY,budget:budget(),fetcher});
const registry:ProviderRegistry={dialogue:{openai:()=>({dialogue:new OpenAIDialogue(options())})},appraisal:{'openai-decisions-v5':()=>({appraiser:new OpenAIInteractionV5Candidate(options()),evidenceVerifier:interactionV5EvidenceVerifier})}};
assert.equal(config.DIALOGUE_PROVIDER,'openai');assert.equal(config.APPRAISAL_PROVIDER,'openai-decisions-v5');
const providers=createProviders(config,process.env,registry),db=new Database(url.href),store=new Store(db,undefined,undefined,providers.evidenceVerifier);
await assertMigrations(db);await db.own(CHARACTER_ID,()=>process.exit(2));await store.recover();
let concealNext=false;
const fit=providers.dialogue.fitConversation.bind(providers.dialogue);
providers.dialogue.fitConversation=async(plan,context)=>{
 if(concealNext){
  assert.equal(plan.purpose,'knowledge_answer');assert.equal(plan.speechStyle?.register,'formal');
  const original=JSON.stringify(plan);plan.speechStyle={...plan.speechStyle!,concealAffect:true};
  const changed=await db.pool.query("UPDATE response_runs SET plan=$2 WHERE character_id=$1 AND status='planned' AND plan=$3::jsonb RETURNING id",[store.characterId,plan,original]);
  assert.equal(changed.rowCount,1,'controlled_concealment_requires_one_pending_response');
  concealNext=false;process.send!({type:'intervention',kind:'controlled_concealment_before_count',responseId:changed.rows[0].id,plan});
 }
 return fit(plan,context);
};
const runtime=await createServer(store,providers.dialogue,providers.appraiser,{knowledge:new PostgresKnowledgeRetriever(db.pool),staticRoot:config.STUDIO_DIST_PATH||undefined});
await runtime.app.listen({host:'127.0.0.1',port:3001});
process.send!({type:'ready',code:runtime.studioCode});
process.on('message',async message=>{
 if(message==='conceal-next'){assert(!concealNext);concealNext=true;process.send!({type:'armed'});}
 if(message==='stop'){await runtime.app.close();await db.close();process.exit(0);}
});
