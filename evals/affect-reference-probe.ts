import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {DialogueBudget,OpenAIEventInterpreter,openaiCandidate,openaiReservationUsd} from '../packages/adapters/src/openai.ts';
import {buildEventInterpretationRequest} from '../packages/adapters/src/event-interpreter.ts';
import {validateAffectSuites,affectHash} from './affect-cases.ts';
import {materializeAffectDiagnostic} from './affect-diagnostic.ts';
import {authoredReferenceReply} from './affect-reference-fixture.ts';
import {eventWireOption,referenceInputs,referenceMetadata,referenceSourceHashes} from './affect-reference-artifacts.ts';

export async function rehearseReferenceDiagnostic(rawArgs:string[]){
  const {args,wireFormat}=eventWireOption(rawArgs,false);
  assert.equal(wireFormat,'refs-v1');assert.deepEqual(args.slice(0,2),['--rehearse-reference-diagnostic','--output']);assert.equal(args.length,3);
  const base=resolve('J:/ai/ai-character-runtime'),root=resolve(args[2]!),within=relative(base,root);
  assert(within&&within!=='..'&&!within.startsWith(`..${sep}`)&&!within.startsWith(sep)&&!within.includes(':'),'output_must_be_inside_J_ai');assert(!existsSync(root),'evidence_exists');
  const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
  const suite=validateAffectSuites(read('evals/fixtures/affect-dev-v3.json'),read('evals/fixtures/affect-confirm-v3.json')).dev;
  const events=materializeAffectDiagnostic(suite,read('evals/fixtures/affect-diagnostic-v1.json'));
  const inputs=referenceInputs(events.map(r=>({id:r.item.id,request:r.request})));
  mkdirSync(root,{recursive:true});
  const budget=new DialogueBudget(resolve(root,'synthetic-budget.json'),1,undefined,{authorization:'Offline reference diagnostic only',maxDecisionCalls:0,maxDialogueCalls:8});
  const requests:any[]=[],responses:any[]=[],results:any[]=[];let active='';
  const fetcher:typeof fetch=async(url,init)=>{
    const address=String(url);assert(['https://api.openai.com/v1/responses','https://api.openai.com/v1/responses/input_tokens'].includes(address));
    const body=JSON.parse(String(init!.body)),kind=address.endsWith('input_tokens')?'count':'dialogue';
    assert(!requests.some(r=>r.id===active&&r.kind===kind),'duplicate_mock_request');
    const original=events.find(r=>r.item.id===active)!,built=buildEventInterpretationRequest(original.request,wireFormat);
    assert.deepEqual(body.input,built.messages);
    requests.push({id:active,kind,body});
    assert.equal(read(budget.path).entries.at(-1).usd,openaiReservationUsd(kind,body));
    if(kind==='count')return Response.json({input_tokens:1000});
    const {model,input,reasoning,text}=body;assert.deepEqual(requests.at(-2),{id:active,kind:'count',body:{model,input,reasoning,text}});
    return Response.json({model:openaiCandidate.model,status:'completed',usage:{input_tokens:1000,output_tokens:100},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(authoredReferenceReply(JSON.parse(body.input[1].content)))}]}]});
  };
  const provider=new OpenAIEventInterpreter({localOnly:false,allowPaidProviders:true,apiKey:'synthetic-no-network',budget,fetcher,onContent:content=>responses.push({id:active,content})},wireFormat);
  for(const row of events){active=row.item.id;const result=await provider.interpret(row.request);assert.equal(result.status,'interpreted');if(result.status==='interpreted')assert.deepEqual(result.interpretation,authoredReferenceReply(row.request));results.push({id:active,result});}
  assert.equal(requests.length,16);assert.equal(responses.length,8);assert.equal(budget.summary().unresolvedEntries,0);
  const additional=['evals/affect-reference-probe.ts','evals/affect-probe.ts','evals/affect-diagnostic.ts','evals/affect-cases.ts','evals/fixtures/affect-diagnostic-v1.json','evals/fixtures/affect-dev-v3.json'];
  const manifest={status:'REFERENCE_REHEARSAL_PASS',provider:'openai',syntheticOnly:true,providerCalls:0,countCalls:8,generationCalls:8,semanticQuality:'NOT_RUN',
    ...referenceMetadata(inputs),sourceHashes:{...referenceSourceHashes(),...Object.fromEntries(additional.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]))},requestHash:affectHash(requests),summary:budget.summary()};
  for(const [name,value] of Object.entries({'manifest.json':manifest,'event-inputs.json':inputs,'http-requests.json':requests,'responses.json':responses,'results.json':results}))writeFileSync(resolve(root,name),JSON.stringify(value,null,2));
  console.log(JSON.stringify({status:manifest.status,root,providerCalls:0,mockCalls:16}));
}
