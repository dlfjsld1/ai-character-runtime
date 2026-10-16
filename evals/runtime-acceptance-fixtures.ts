// Explicit synthetic process preload. Reject all real HTTP transport.
import {appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {acceptanceScenario} from './runtime-acceptance-cases.ts';
import {interactionFixture} from './interaction-fixture.ts';

const attempt=process.env.RUNTIME_ACCEPTANCE_ATTEMPT;if(!/^r[1-9]\d*$/.test(attempt??''))throw Error('explicit_acceptance_attempt_required');
const root=resolve('J:/ai/ai-character-runtime/g3-acceptance-fixture-20261015-'+attempt);
const url=new URL(process.env.DATABASE_URL??'file:///missing');
if(process.env.RUNTIME_ACCEPTANCE_FIXTURES!=='true'||url.hostname!=='127.0.0.1'||url.port!=='55434'||url.pathname!=='/character_runtime_g3_fixture_'+attempt||process.env.DIALOGUE_API_KEY!=='synthetic-acceptance-key'||resolve(process.env.DIALOGUE_BUDGET_PATH??'')!==resolve(root,'synthetic-budget.json'))throw Error('explicit_acceptance_fixture_scope_required');
let index=-1;
const scenario=process.env.RUNTIME_ACCEPTANCE_SCENARIO??'baseline';
if(!['baseline','uncertain-repeat'].includes(scenario))throw Error('unknown_acceptance_fixture_scenario');
const acceptanceScenes=acceptanceScenario(scenario==='uncertain-repeat');
globalThis.fetch=async(input,init)=>{
 const endpoint=String(input),body=JSON.parse(String(init?.body??'{}'));
 const kind=endpoint==='https://api.openai.com/v1/decisions'?'decision':endpoint==='https://api.openai.com/v1/responses/input_tokens'?'count':endpoint==='https://api.openai.com/v1/responses'?'dialogue':'forbidden';
 if(kind==='decision')index++;
 const scene=acceptanceScenes[index];
 appendFileSync(resolve(root,'fixture-calls.jsonl'),JSON.stringify({pid:process.pid,at:Date.now(),kind,caseId:scene?.id??null})+'\n');
 if(kind==='forbidden'||(init?.headers as Record<string,string>)?.authorization!=='Bearer synthetic-acceptance-key'||!scene)throw Error('external_fetch_forbidden');
 if(kind==='count')return Response.json({input_tokens:100});
 if(kind==='decision'){
  if(JSON.parse(body.input).current.text!==scene.text)throw Error('unexpected_acceptance_input');
  return Response.json(interactionFixture(scene.acts,scene.intensity));
 }
 if(!scene.speak||!scene.caption)throw Error('silent_case_must_not_generate');
 const output={...(body.text.format.schema.properties.content?{content:scene.caption}:{}),sentences:[scene.caption]};
 return Response.json({model:'gpt-6-sol',status:'completed',usage:{input_tokens:100,output_tokens:40,input_tokens_details:{cached_tokens:0}},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(output)}]}]});
};
