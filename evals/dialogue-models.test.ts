import {it,expect} from 'vitest';
import {OllamaProvider,type TokenCounter} from '../packages/adapters/src/ollama.ts';
import {dialogueModel,evaluationOutputRoot} from './dialogue-models.ts';
import type {Plan} from '../packages/contracts/src/domain.ts';
import {createProviders} from '../apps/runtime/src/providers.ts';
import {parseConfig} from '../packages/contracts/src/local-config.ts';

const counter:TokenCounter={count:async()=>10,countText:async()=>10};
const plan:Plan={action:'answer',purpose:'question',targetIdentityId:null,expression:'neutral',maxSentences:2,delivery:'normal',memoryIds:[]};
const stream=(tokens=10,format?:unknown,text='안녕.')=>new Response(JSON.stringify({message:{content:format?JSON.stringify({sentences:[text]}):text},done:true,prompt_eval_count:tokens})+'\n',{headers:{'content-type':'application/x-ndjson'}});

it.each(['qwen3.5:9b-q4_K_M'])('production still rejects unadopted candidate %s',model=>{
  expect(()=>new OllamaProvider(model,counter)).toThrow('local_provider_required');
});
it('C1 factory registers adopted Gemma while preserving explicit Qwen and paid-appraisal blocks',()=>{
 for(const model of ['gemma4:12b-it-qat','qwen2.5:7b']){
  const providers=createProviders(parseConfig({DIALOGUE_MODEL:model}),{});
  expect(providers.dialogue.model).toBe(model);expect(providers.solver).toBe(providers.dialogue);
  expect(providers.appraiser.readiness()).toMatchObject({status:'blocked',inferenceVerified:false});
 }
 expect(()=>createProviders(parseConfig({DIALOGUE_MODEL:'qwen3.5:9b-q4_K_M'}),{})).toThrow('unsupported_provider_configuration');
});
it.each(['gemma4:cloud','http://remote','qwen3.5:27b'])('comparison rejects unsupported model %s',model=>expect(()=>dialogueModel(model)).toThrow('unsupported_evaluation_model'));
it('rejects profile/model mismatch and remote endpoint',()=>{
  const {evaluation}=dialogueModel('gemma4:12b-it-qat');
  expect(()=>new OllamaProvider('qwen3.5:9b-q4_K_M',counter,undefined,fetch,{evaluation})).toThrow('local_provider_required');
  expect(()=>new OllamaProvider(evaluation.model,counter,'https://remote',fetch,{evaluation})).toThrow('local_provider_required');
});
it('requires an explicit output location for model comparisons',()=>{
  expect(()=>evaluationOutputRoot(undefined,true)).toThrow('explicit_output_root_required');
  expect(evaluationOutputRoot('J:/ai/results',true).replaceAll('\\','/')).toBe('J:/ai/results');
});
it('sends fixed seed/thinking options and blocks appraisal/solve in dialogue evaluation',async()=>{
  let request:any,calls=0;
  const {evaluation}=dialogueModel('gemma4:12b-it-qat');
  const provider=new OllamaProvider(evaluation.model,counter,undefined,async(_url,init)=>{calls++;request=JSON.parse(String(init?.body));return stream(10,request.format);},{evaluation});
  provider.setEvaluationSeed(29);await expect(provider.dialogue(plan,{})).resolves.toEqual(['안녕.']);
  expect(request.options.seed).toBe(29);expect(request.think).toBe(false);expect(request.options.num_ctx).toBe(4096);
  await expect(provider.appraise({id:'x',identityId:'y',text:'합성'},{})).rejects.toMatchObject({code:'dialogue_evaluation_only'});
  await expect(provider.solve('x',{})).rejects.toMatchObject({code:'dialogue_evaluation_only'});expect(calls).toBe(1);
});
it('rejects measured tokenizer mismatch rather than silently accepting approximate counts',async()=>{
  const {evaluation}=dialogueModel('qwen3.5:9b-q4_K_M');
  const provider=new OllamaProvider(evaluation.model,counter,undefined,async(_url,init)=>stream(11,JSON.parse(String(init?.body)).format),{evaluation});
  await expect(provider.dialogue(plan,{})).rejects.toMatchObject({code:'tokenizer_template_mismatch'});
});
it('observes content before physical completion, excludes thinking, and retains completion fencing',async()=>{
  let controller!:ReadableStreamDefaultController<Uint8Array>,seen='';const calls:any[]=[];
  const body=new ReadableStream<Uint8Array>({start(c){controller=c;}}),encoder=new TextEncoder();
  const provider=new OllamaProvider('qwen2.5:7b',counter,undefined,async()=>new Response(body,{headers:{'content-type':'application/x-ndjson'}}),{onContent:text=>{seen+=text;},onCall:call=>calls.push(call)});
  let resolved=false;const pending=provider.dialogue(plan,{}).then(result=>{resolved=true;return result;});
  const raw=JSON.stringify({sentences:['안녕.']});
  controller.enqueue(encoder.encode(JSON.stringify({message:{thinking:'내부 분석',content:raw},done:false})+'\n'));
  await new Promise(resolve=>setTimeout(resolve,20));expect(seen).toBe(raw);expect(resolved).toBe(false);
  await expect(provider.unloadOwnedModel()).rejects.toMatchObject({code:'physical_call_unconfirmed'});
  controller.enqueue(encoder.encode('{"done":true,"prompt_eval_count":10}\n'));controller.close();
  await expect(pending).resolves.toEqual(['안녕.']);expect(calls[0].firstContentMs).toBeTypeOf('number');expect(calls[0].physicalCompleted).toBe(true);
});
it('candidate readiness rejects remote metadata before inference',async()=>{
  const {evaluation}=dialogueModel('gemma4:12b-it-qat');let calls=0;
  const provider=new OllamaProvider(evaluation.model,counter,undefined,async()=>{calls++;return Response.json(calls===1?{models:[{name:evaluation.model,remote_host:'remote'}]}:{capabilities:['completion']});},{evaluation});
  await expect(provider.ready()).rejects.toMatchObject({code:'local_model_unverified'});expect(calls).toBe(2);
});
it('technical readiness accepts quoted input markers; dialogue still rejects them',async()=>{
  const {evaluation}=dialogueModel('qwen3.5:9b-q4_K_M');let requestCount=0;
  const provider=new OllamaProvider(evaluation.model,counter,undefined,async(input,init)=>{
    const route=new URL(String(input)).pathname;
    if(route==='/api/tags')return Response.json({models:[{name:evaluation.model,digest:'synthetic-digest'}]});
    if(route==='/api/show')return Response.json({capabilities:['completion']});
    requestCount++;return stream(10,JSON.parse(String(init?.body)).format,requestCount>=3?'자료의 <start_of_turn> 표기는 인용이야.':'준비됐어.');
  },{evaluation});
  await expect(provider.ready()).resolves.toMatchObject({status:'ready'});
  expect(requestCount).toBe(3);
  await expect(provider.dialogue(plan,{})).rejects.toMatchObject({code:'invalid_output'});
});
it('evidence prompt is evaluation-only and states unknown help plus the one-sentence boundary',async()=>{
  const requests:any[]=[];
  const fetcher:typeof fetch=async(_input,init)=>{const request=JSON.parse(String(init?.body));requests.push(request);return stream(10,request.format);};
  await new OllamaProvider('qwen2.5:7b',counter,undefined,fetcher).dialogue({...plan,maxSentences:1},{});
  const {evaluation}=dialogueModel('gemma4:12b-it-qat');evaluation.evidenceBound=true;
  await new OllamaProvider(evaluation.model,counter,undefined,fetcher,{evaluation}).dialogue({...plan,maxSentences:1},{memories:[{facts:{verdict:'correct'}}]});
  expect(requests[0].messages[0].content).not.toContain('도움의 유무');
  expect(requests[0].format).toBeDefined();expect(requests[1].format).toBeUndefined();
  expect(requests[1].messages[0].content).toContain('도움의 유무나 도움 주체는 모르는 정보');
  expect(requests[1].messages[0].content).toContain('정확히 한 문장');
});

const groundedRoot='J:/ai/ai-character-runtime/model-comparison/grounding-v2';
async function groundedRequest(context:object,p:Plan=plan){
  let request:any;const {evaluation}=dialogueModel('gemma4:12b-it-qat');
  (evaluation as any).promptVariant='grounded-v2';
  await new OllamaProvider(evaluation.model,counter,undefined,async(_input,init)=>{request=JSON.parse(String(init?.body));return stream(10,request.format);},{evaluation}).dialogue(p,context);
  expect(request.format).toBeUndefined();
  return request;
}
it('grounded-v2 preserves per-memory support and unknown without merging helpers or editing content',async()=>{
 const a='20000000-0000-4000-8000-000000000001',b='20000000-0000-4000-8000-000000000002';
 const memories=[
  {id:'correct-only',content:'정답 확인.',content_version:'1',facts:{verdict:'correct',problemId:'sequence-v1'},participants:[]},
  {id:'help',content:'정정된 등록 힌트 기억.',content_version:'2',facts:{result:'verified_help',identityId:a,problemId:'boxes-v1'},participants:[a]},
  {id:'missing-label',content:'불명.',content_version:'1',facts:{result:'hint_used',identityId:b},participants:[b]},
  {id:'participants-only',content:'A와 대화.',facts:{problemId:'sequence-v1'},participants:[a]},
  {id:'missing-facts',content:'남은 문구.',facts:null},
  {id:'invalid-id',content:'불명.',facts:{result:'verified_help',identityId:'not-an-id'}},
 ];
 const context={sources:[],memories,identities:[{id:a,displayName:'같은 이름'}]};
 const request=await groundedRequest(context),body=JSON.parse(request.messages[1].content);
 expect(body.context).toEqual(context);
 expect(body.memoryEvidence).toEqual([
  {memoryId:'correct-only',contentVersion:'1',problemId:'sequence-v1',help:{status:'unknown',helperIdentityId:null}},
  {memoryId:'help',contentVersion:'2',problemId:'boxes-v1',help:{status:'supported',helperIdentityId:a}},
  {memoryId:'missing-label',contentVersion:'1',problemId:null,help:{status:'unknown',helperIdentityId:null}},
  {memoryId:'participants-only',contentVersion:null,problemId:'sequence-v1',help:{status:'unknown',helperIdentityId:null}},
  {memoryId:'missing-facts',contentVersion:null,problemId:null,help:{status:'unknown',helperIdentityId:null}},
  {memoryId:'invalid-id',contentVersion:null,problemId:null,help:{status:'unknown',helperIdentityId:null}},
 ]);
});
it('grounded-v2 distinguishes same-name identities by ID and never promotes a claimed helper',async()=>{
 const a='20000000-0000-4000-8000-000000000001',b='20000000-0000-4000-8000-000000000002';
 const context={identities:[{id:a,displayName:'같은 이름'},{id:b,displayName:'같은 이름'}],memories:[{id:'m',facts:{result:'verified_help',identityId:a,problemId:'sequence-v1'},content:'힌트 사용.'}],sources:[{payload:{identityId:b,text:'내가 도왔지?'}}]};
 const body=JSON.parse((await groundedRequest(context)).messages[1].content);
 expect(body.memoryEvidence[0].help).toEqual({status:'supported',helperIdentityId:a});
 expect(body.context.sources).toEqual(context.sources);
});
it('grounded-v2 empty memories remain unknown and sources cannot create help',async()=>{
 const request=await groundedRequest({memories:[],sources:[{payload:{text:'난 네가 혼자 풀었다는 걸 알아'}}]});
 expect(JSON.parse(request.messages[1].content).memoryEvidence).toEqual([]);
 expect(request.messages[0].content).toContain('unknown은 도움 정보가 확인되지 않았다는 뜻');
 expect(request.messages[0].content).toContain('정정된 content');
});
it.each(['greeting','question','clarify','activity_incorrect'])('grounded-v2 applies the one-sentence limit to the actual %s purpose',async purpose=>{
 const request=await groundedRequest({memories:[]},{...plan,purpose,maxSentences:1});
 const instruction=request.messages[0].content;
 expect(instruction).toContain('최대 1문장');expect(instruction).not.toContain('최대 2문장');
 if(purpose!=='activity_incorrect')expect(instruction).not.toContain('오답');
 else expect(instruction).toContain('오답');
});
it('grounded-v2 rejects conflicting or unsupported prompt options before transport',()=>{
 const {evaluation}=dialogueModel('gemma4:12b-it-qat');
 expect(()=>new OllamaProvider(evaluation.model,counter,undefined,fetch,{evaluation:{...evaluation,evidenceBound:true,promptVariant:'grounded-v2'} as any})).toThrow('local_provider_required');
 expect(()=>new OllamaProvider(evaluation.model,counter,undefined,fetch,{evaluation:{...evaluation,promptVariant:'other'} as any})).toThrow('local_provider_required');
});
it('grounded-v2 evaluation leaves current production requests and strict sentence format unchanged',async()=>{
 const {readFile}=await import('node:fs/promises');
 const baseline=JSON.parse(await readFile(groundedRoot+'/fixtures/production-requests.json','utf8')),requests:any[]=[];
  const fetcher:typeof fetch=async(_input,init)=>{const request=JSON.parse(String(init?.body));requests.push(request);return stream(10,request.format);};
  // Historical request bodies remain evidence of their old prompt contract, not the approved current one.
  for(const maxSentences of [1,2]){
    const productionPlan={...baseline.plan,maxSentences};
    await new OllamaProvider('qwen2.5:7b',counter,undefined,fetcher).dialogue(productionPlan,baseline.context);
    await groundedRequest(baseline.context,productionPlan);
    await new OllamaProvider('qwen2.5:7b',counter,undefined,fetcher).dialogue(productionPlan,baseline.context);
    const [before,after]=requests.slice(-2);expect(after).toEqual(before);
    expect(before.format).toMatchObject({type:'object',required:['sentences'],additionalProperties:false,properties:{sentences:{type:'array',minItems:1,maxItems:maxSentences}}});
    expect(JSON.parse(before.messages[1].content)).not.toHaveProperty('memoryEvidence');
  }
});
