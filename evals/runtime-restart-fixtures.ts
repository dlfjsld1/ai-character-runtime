// Explicit test preload only. No remote request may leave this process.
import {appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {interactionFixture} from './interaction-fixture.ts';

const root=resolve('J:/ai/ai-character-runtime/runtime-restart-20261015');
const url=new URL(process.env.DATABASE_URL??'file:///missing');
if(process.env.RUNTIME_RESTART_FIXTURES!=='true'||url.hostname!=='127.0.0.1'||url.port!=='55434'||url.pathname!=='/character_runtime_restart_test'||process.env.DIALOGUE_API_KEY!=='synthetic-restart-key'||resolve(process.env.DIALOGUE_BUDGET_PATH??'')!==resolve(root,'synthetic-budget.json'))throw Error('explicit_restart_fixture_scope_required');
const captions={before:'이 문장은 재시작 검증을 위한 합성 자막으로 화면에 표시되는 도중 앱을 종료하고 다시 시작했을 때 이미 중단된 문장이 뒤늦게 다시 나타나지 않는지 확인하기 위해 사용하고 있어.',after:'새 세션의 합성 응답이야.'};
globalThis.fetch=async(input,init)=>{
 const endpoint=String(input),body=JSON.parse(String(init?.body??'{}'));
 const kind=endpoint==='https://api.openai.com/v1/decisions'?'decision':endpoint==='https://api.openai.com/v1/responses/input_tokens'?'count':endpoint==='https://api.openai.com/v1/responses'?'dialogue':'forbidden';
 appendFileSync(resolve(root,'fixture-calls.jsonl'),JSON.stringify({pid:process.pid,at:Date.now(),kind})+'\n');
 if(kind==='forbidden'||(init?.headers as Record<string,string>)?.authorization!=='Bearer synthetic-restart-key')throw Error('external_fetch_forbidden');
 if(kind==='count')return Response.json({input_tokens:100});
 if(kind==='decision'){
  const text=JSON.parse(body.input).current.text;
  if(text==='합성 공격 사건')return Response.json(interactionFixture({direct_attack:1},[0,0,0,1]));
  if(!['합성 중단 응답 확인','합성 재시작 후 새 질문'].includes(text))throw Error('unregistered_fixture_input');
  return Response.json(interactionFixture({speech_form:'question'}));
 }
 const text=JSON.stringify(body.input).includes('합성 재시작 후 새 질문')?captions.after:captions.before;
 return Response.json({model:'gpt-6-sol',status:'completed',usage:{input_tokens:100,output_tokens:100,input_tokens_details:{cached_tokens:0}},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({content:text,sentences:[text]})}]}]});
};
