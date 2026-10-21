import {it,expect,vi,afterEach} from 'vitest';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DeepSeekBudget,deepseekInputBound,deepseekReservationUsd} from './deepseek-budget.ts';
import {DeepSeekDialogue,DeepSeekEventInterpreter,DeepSeekOutcomeProbe,DeepSeekAppraisalProbe,deepseekPayload} from './deepseek.ts';
import {prepareAppraisalProbe} from './appraisal-probe.ts';
import {prepareOutcomeProbe} from './outcome-probe.ts';
import {buildOutcomeProbePreparation,authoredProbeOutcome} from '../../../evals/affect-outcome-probe.ts';
import {buildEventInterpretationRequest} from './event-interpreter.ts';
import {StructuredEventInterpreter} from './event-interpreter.ts';
import {affectRequest,affectMeaning} from '../../../evals/affect-fixture.ts';
import {initialState,dialoguePlan} from '../../character-core/src/index.ts';
import {parseConfig} from '../../contracts/src/local-config.ts';
import {createProviders} from '../../../apps/runtime/src/providers.ts';
import {buildDialogueRequest,buildKnowledgeRequest} from './dialogue-request.ts';
import {authoredReferenceReply} from '../../../evals/affect-reference-fixture.ts';
const dirs:string[]=[];
afterEach(()=>{for(const d of dirs.splice(0))rmSync(d,{recursive:true,force:true});vi.unstubAllGlobals();});
const plan=()=>dialoguePlan(initialState(1700000000000),'question','00000000-0000-4000-8000-000000000001');
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
it.each(['valid','outcome','quote','usage','http'])('C2 second stage shares transport/ledger and stops on %s',async variant=>{
  const input=affectRequest();let call=0;
  const fetcher=vi.fn(async(_url:any,init:any)=>{
    call++;const body=JSON.parse(init.body);if(call===1)return completed({outcome:null});
    expect(body).toEqual(deepseekPayload(prepareAppraisalProbe(input,null).request,2048));
    const view=JSON.parse(body.messages.at(-1).content),{outcome:_,...raw}=authoredReferenceReply(view.input);
    if(variant==='http')return Response.json({error:'private'},{status:503});
    if(variant==='outcome')(raw as any).outcome=null;if(variant==='quote')raw.appraisals[0]!.evidence[0]!.quote='invented';
    if(variant==='usage')return Response.json({model:'deepseek-flash',choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(raw)}}]});
    return completed(raw);
  });
  const {options,path}=setup(fetcher),first=new DeepSeekOutcomeProbe(options),second=new DeepSeekAppraisalProbe(options);
  const fixed=(await first.probe(input)).outcome;
  if(variant==='valid')expect((await second.probe(input,fixed)).appraisals.length).toBeGreaterThan(0);
  else{await expect(second.probe(input,fixed)).rejects.toThrow();await expect(second.probe(input,fixed)).rejects.toThrow('deepseek_provider_stopped');}
  expect(fetcher).toHaveBeenCalledTimes(2);expect(read(path).entries).toHaveLength(2);
});
it.each([false,true])('refs DeepSeek reserves the actual payload and decodes nonempty output; malformed=%s stops without fallback',async malformed=>{
  const request=affectRequest();let path='';
  const fetcher=vi.fn(async(_url:any,init:any)=>{
    const body=JSON.parse(init.body),entry=read(path).entries.at(-1);
    expect(body).toEqual(deepseekPayload(buildEventInterpretationRequest(request,'refs-v1'),2048));
    expect(entry.inputBound).toBe(deepseekInputBound(body));expect(entry.usd).toBe(deepseekReservationUsd(entry.inputBound,2048));
    const reply=authoredReferenceReply(JSON.parse(body.messages.at(-1).content));if(malformed)reply.appraisals[0]!.concern.source.sourceId='r999';
    return completed(reply);
  });
  const setupResult=setup(fetcher);path=setupResult.path;const provider=new DeepSeekEventInterpreter(setupResult.options,'refs-v1');
  expect(provider.promptVersion).toBe('event-interpretation-v3-refs1');
  expect(await provider.interpret(request)).toMatchObject(malformed?{status:'unavailable',reason:'invalid_output'}:{status:'interpreted',interpretation:authoredReferenceReply(request)});
  if(malformed)await provider.interpret(request);expect(fetcher).toHaveBeenCalledTimes(1);
});
it('opt-in diagnostics preserve rejected content but exclude key, headers, reasoning and HTTP error bodies',async()=>{
  const responses:any[]=[],diagnostics:any[]=[];
  const fetcher=vi.fn(async()=>Response.json({model:'deepseek-flash',usage:{prompt_tokens:100,completion_tokens:25},choices:[{finish_reason:'stop',message:{role:'assistant',content:'{broken synthetic-deepseek-key',reasoning_content:'private reasoning'}}]}));
  const {options}=setup(fetcher),p=new DeepSeekEventInterpreter({...options,onResponse:r=>responses.push(r),onDiagnostic:r=>diagnostics.push(r)});
  expect((await p.interpret(affectRequest())).status).toBe('unavailable');
  expect(responses).toHaveLength(1);expect(responses[0].content).toBe('{broken [redacted]');expect(diagnostics).toEqual([{stage:'json',code:'invalid_json'}]);
  expect(JSON.stringify(responses)).not.toContain('synthetic-deepseek-key');expect(JSON.stringify(responses)).not.toContain('private reasoning');
  const rejected=setup(vi.fn(async()=>Response.json({error:'private error body'},{status:402})));
  await new DeepSeekEventInterpreter({...rejected.options,onResponse:r=>responses.push(r)}).interpret(affectRequest());expect(responses).toHaveLength(1);
});
it('replays a rejected provenance response offline with the same diagnostic and no second provider call',async()=>{
  const output=affectMeaning();output.appraisals[0]!.expectedness=.5;output.appraisals[0]!.expectation={...output.appraisals[0]!.evidence[0]!};
  const fetcher=vi.fn(async()=>completed(output)),{options}=setup(fetcher),responses:any[]=[],diagnostics:any[]=[];
  const result=await new DeepSeekEventInterpreter({...options,onResponse:r=>responses.push(r),onDiagnostic:r=>diagnostics.push(r)}).interpret(affectRequest());
  const replayDiagnostics:any[]=[],replayed=await new StructuredEventInterpreter(async()=>responses[0].content,r=>replayDiagnostics.push(r)).interpret(affectRequest());
  expect(replayed).toEqual(result);expect(diagnostics).toEqual([{stage:'provenance',code:'affect_expectation_not_prior'}]);expect(replayDiagnostics).toEqual(diagnostics);expect(fetcher).toHaveBeenCalledTimes(1);
});
it('plain and knowledge requests send JSON Schema rather than the Zod validator internals',()=>{
  for(const request of [buildDialogueRequest(plan(),{},'deepseek-flash',{promptVariant:'conversation-history-v1'}),buildKnowledgeRequest({...plan(),purpose:'knowledge_answer'},{knowledge:{query:'요일은?',revision:'1',chunks:[]}})]){
    const sent=deepseekPayload(request,256).messages[0]!.content.split('\n').slice(1).join('\n');
    expect(JSON.parse(sent)).toEqual(request.format);expect(JSON.parse(sent)).toHaveProperty('properties');expect(JSON.parse(sent)).not.toHaveProperty('def');
  }
});
function setup(fetcher:typeof fetch,patch:{limit?:number;calls?:number}={}){const dir=mkdtempSync(join(tmpdir(),'deepseek-'));dirs.push(dir);const path=join(dir,'budget.json'),budget=new DeepSeekBudget(path,patch.limit??1,patch.calls??30,'synthetic tests only');return {path,budget,options:{localOnly:false,allowPaidProviders:true,apiKey:'synthetic-deepseek-key',budget,fetcher}};}
function completed(content:unknown={content:'수요일이야.',sentences:['수요일이야.']},patch:object={}){return Response.json({model:'deepseek-flash',usage:{prompt_tokens:100,completion_tokens:25},choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(content)}}],...patch});}
it('requires separate credentials, explicit budget and permission; selects dialogue without replacing appraisal',async()=>{
  const fetcher=vi.fn(),{options,path}=setup(fetcher);
  for(const patch of [{localOnly:true},{allowPaidProviders:false},{apiKey:''}])expect(()=>new DeepSeekDialogue({...options,...patch})).toThrow();
  expect(()=>parseConfig({DIALOGUE_PROVIDER:'deepseek',DIALOGUE_API_KEY:'openai-key'})).toThrow();
  const c=parseConfig({LOCAL_ONLY:'false',ALLOW_PAID_PROVIDERS:'true',DIALOGUE_PROVIDER:'deepseek',DIALOGUE_MODEL:'deepseek-flash',DEEPSEEK_API_KEY:'synthetic',DEEPSEEK_BUDGET_PATH:path,DEEPSEEK_BUDGET_USD:'1',DEEPSEEK_MAX_CALLS:'30',DEEPSEEK_BUDGET_AUTHORIZATION:'synthetic'});
  const p=createProviders(c,{});expect(p.dialogue.name).toBe('deepseek');expect(p.appraiser.name).toBe('jev');expect(p.solver).toBeUndefined();
  expect(createProviders(parseConfig({}),{}).dialogue.name).toBe('ollama');
  await p.dialogue.ready?.();expect(existsSync(path)).toBe(false);expect(fetcher).not.toHaveBeenCalled();
});
it('reuses event interpretation contract with one DeepSeek call, schema in JSON prompt and no role mixing',async()=>{
  const fetcher=vi.fn(async()=>completed(affectMeaning())),{options,path}=setup(fetcher),p=new DeepSeekEventInterpreter(options);
  const result=await p.interpret(affectRequest());expect(result.status).toBe('interpreted');expect(fetcher).toHaveBeenCalledTimes(1);expect(p).not.toHaveProperty('dialogue');
  const [url,init]=fetcher.mock.calls[0] as unknown as [string,RequestInit];expect(url).toBe('https://api.deepseek.com/chat/completions');expect(init.redirect).toBe('error');
  expect(JSON.parse(String(init.body))).toEqual(deepseekPayload(buildEventInterpretationRequest(affectRequest()),2048));
  expect(JSON.parse(String(init.body))).toMatchObject({thinking:{type:'disabled'},response_format:{type:'json_object'},max_tokens:2048,stream:false});
  expect(read(path).entries[0]).toMatchObject({status:'completed',usage:{prompt_tokens:100,completion_tokens:25}});expect(readFileSync(path,'utf8')).not.toContain(options.apiKey);
});
it('rejects invalid affect input before network or reservation',async()=>{const fetcher=vi.fn(),{options,path}=setup(fetcher);expect((await new DeepSeekEventInterpreter(options).interpret({...affectRequest(),configVersion:''})).status).toBe('unavailable');expect(fetcher).not.toHaveBeenCalled();expect(existsSync(path)).toBe(false);});
it('counts and fits locally then generates normal speech without OpenAI or tokenizer calls',async()=>{
  const fetcher=vi.fn(async()=>completed()),{options}=setup(fetcher),p=new DeepSeekDialogue(options),c={currentInput:{payload:{text:'요일은?'}}};
  const fit=await p.fitConversation(plan(),c);expect(fit.inputTokens).toBeGreaterThan(1024);expect(fetcher).not.toHaveBeenCalled();expect(await p.dialogue(plan(),c)).toEqual(['수요일이야.']);expect(fetcher).toHaveBeenCalledTimes(1);
});
it('annotation keeps valid speech when capture is invalid; knowledge uses its existing citation validator',async()=>{
  const fetcher=vi.fn(async()=>completed({content:'영화 추천',sentences:['별의 강을 추천해.'],recommendations:[{kind:'movie',title:'다른 제목',sentenceIndex:0,quote:'다른 제목을 추천해.'}]}));
  const {options}=setup(fetcher);expect(await new DeepSeekDialogue(options).generateTurn(plan(),{})).toMatchObject({annotationStatus:'invalid',sentences:['별의 강을 추천해.']});
  const bad=vi.fn(async()=>completed({status:'answered',sentences:['자료에 있어.'],citationIds:['K9']}));
  const {options:k}=setup(bad);await expect(new DeepSeekDialogue(k).answerKnowledge({...plan(),purpose:'knowledge_answer'},{knowledge:{query:'요일은?',revision:'1',chunks:[]}})).rejects.toThrow('invalid_output');
});
it.each(['http','network','usage','output_cap','input_bound','length','model','empty','json','quote','tool'])('stops without retry after %s',async failure=>{
  const fetcher=vi.fn(async()=>{
    if(failure==='network')throw new Error('secret server text');
    if(failure==='http')return Response.json({error:'secret server text'},{status:402});
    const data:any={model:'deepseek-flash',usage:{prompt_tokens:100,completion_tokens:25},choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(affectMeaning())}}]};
    if(failure==='usage')delete data.usage;
    if(failure==='output_cap')data.usage.completion_tokens=2049;
    if(failure==='input_bound')data.usage.prompt_tokens=100000;
    if(failure==='length')data.choices[0].finish_reason='length';
    if(failure==='model')data.model='wrong';
    if(failure==='empty')data.choices[0].message.content='';
    if(failure==='json')data.choices[0].message.content='{';
    if(failure==='quote'){const value=affectMeaning();value.appraisals[0]!.evidence[0]!.quote='없는 인용';data.choices[0].message.content=JSON.stringify(value);}
    if(failure==='tool')data.choices[0].message.tool_calls=[{}];return Response.json(data);
  });
  const {options,budget}=setup(fetcher),p=new DeepSeekEventInterpreter(options);
  expect((await p.interpret(affectRequest())).status).toBe('unavailable');expect((await p.interpret(affectRequest())).status).toBe('unavailable');expect(fetcher).toHaveBeenCalledTimes(1);
  if(['http','network','usage','output_cap','input_bound'].includes(failure))expect(budget.availability()).toBe('deepseek_usage_unconfirmed');
});
it('deadline retains a reservation until physical completion, rejects another instance and never retries',async()=>{
  let complete!:(r:Response)=>void;const fetcher=vi.fn(()=>new Promise<Response>(resolve=>{complete=resolve;})),{options,budget,path}=setup(fetcher);
  const p=new DeepSeekDialogue({...options,deadlineMs:5});await expect(p.dialogue(plan(),{})).rejects.toThrow('deepseek_deadline');
  expect(read(path).entries[0].status).toBe('reserved');await expect(new DeepSeekDialogue(options).dialogue(plan(),{})).rejects.toThrow('deepseek_usage_unconfirmed');
  complete(completed());await new Promise(r=>setTimeout(r,10));expect(budget.summary().unresolvedEntries).toBe(0);await expect(p.dialogue(plan(),{})).rejects.toThrow('deepseek_provider_stopped');expect(fetcher).toHaveBeenCalledTimes(1);
});
it('caps money, cumulative attempts and context before HTTP; refuses OpenAI ledger',async()=>{
  const fetcher=vi.fn(async()=>completed()),{options,path,budget}=setup(fetcher,{calls:1});
  await new DeepSeekDialogue(options).dialogue(plan(),{});await expect(new DeepSeekDialogue(options).dialogue(plan(),{})).rejects.toThrow('deepseek_attempt_limit');expect(fetcher).toHaveBeenCalledTimes(1);
  writeFileSync(path,JSON.stringify({version:1,model:'gpt-6-sol',limitUsd:1,entries:[]}));expect(()=>budget.reserve(100,256)).toThrow('deepseek_budget_invalid');
  const poor=setup(fetcher,{limit:.00001});await expect(new DeepSeekDialogue(poor.options).dialogue(plan(),{})).rejects.toThrow('deepseek_budget_exceeded');
  const large=setup(fetcher);await expect(new DeepSeekDialogue(large.options).dialogue(plan(),{currentInput:{payload:{text:'가'.repeat(40000)}}})).rejects.toThrow();expect(fetcher).toHaveBeenCalledTimes(1);
  expect(()=>deepseekReservationUsd(1,2049)).toThrow();expect(deepseekInputBound('가')).toBe(1027);
});
it('ledger lock prevents overlapping authorization; missing or malformed usage keeps full reservation',()=>{
  const {path,budget}=setup(vi.fn());writeFileSync(path+'.lock','');expect(()=>budget.reserve(1000,256)).toThrow('deepseek_budget_locked');rmSync(path+'.lock');
  const id=budget.reserve(1000,256),usd=budget.summary().enforcedTotalUsd;expect(budget.finish(id,{prompt_tokens:-1,completion_tokens:1})).toBe(false);expect(budget.summary().enforcedTotalUsd).toBe(usd);expect(()=>budget.reserve(1000,256)).toThrow('deepseek_usage_unconfirmed');
});

it.each([0,4])('outcome probe sends the prepared body, reserves it and returns only outcome; case %s',async index=>{
  const prepared=buildOutcomeProbePreparation(),input=prepared.originals[index]!.request,expected=prepared.diagnostics[index]!.item.expected.outcome;
  const probe=prepareOutcomeProbe(input),reply=authoredProbeOutcome(JSON.parse(probe.request.messages[1]!.content),expected===null?null:{...expected,result:expected.result[0]!});
  let ledger='';const fetcher=vi.fn(async(_url:any,init:any)=>{
    expect(JSON.parse(init.body)).toEqual(prepared.requests[index]!.body);
    const entry=read(ledger).entries.at(-1);expect(entry.inputBound).toBe(deepseekInputBound(prepared.requests[index]!.body));
    expect(entry.usd).toBe(deepseekReservationUsd(entry.inputBound,2048));return completed(reply);
  });
  const {options,path}=setup(fetcher);ledger=path;const result=await new DeepSeekOutcomeProbe(options).probe(input);
  expect(result).toEqual(probe.decode(reply));expect(result).not.toHaveProperty('appraisals');expect(result).not.toHaveProperty('status');expect(fetcher).toHaveBeenCalledTimes(1);
});
it('outcome invalid input makes no reservation or request',async()=>{
  const fetcher=vi.fn(),{options,path}=setup(fetcher);
  await expect(new DeepSeekOutcomeProbe(options).probe({...affectRequest(),configVersion:''})).rejects.toThrow('outcome_probe_invalid_input');
  expect(existsSync(path)).toBe(false);expect(fetcher).not.toHaveBeenCalled();
});
it.each(['json','reference','quote','appraisals'])('outcome %s failure preserves raw and stops without retry',async kind=>{
  const prepared=buildOutcomeProbePreparation(),input=prepared.originals[0]!.request,probe=prepareOutcomeProbe(input);
  const reply=authoredProbeOutcome(JSON.parse(probe.request.messages[1]!.content),{episode:0,use:'used',result:'unfavorable'});
  if(kind==='reference')reply.outcome!.episodeId='r999';if(kind==='quote')reply.outcome!.evidence[0]!.quote='없는 인용';if(kind==='appraisals')Object.assign(reply,{appraisals:[]});
  const content=kind==='json'?'{':JSON.stringify(reply),responses:any[]=[];
  const fetcher=vi.fn(async()=>completed(null,{choices:[{finish_reason:'stop',message:{role:'assistant',content}}]})),{options}=setup(fetcher);
  const provider=new DeepSeekOutcomeProbe({...options,onResponse:r=>responses.push(r)});
  await expect(provider.probe(input)).rejects.toThrow('outcome_probe_invalid_output');await expect(provider.probe(input)).rejects.toThrow('deepseek_provider_stopped');
  expect(responses[0].content).toBe(content);expect(fetcher).toHaveBeenCalledTimes(1);
});
it('outcome snapshot survives caller mutation and deadline never permits a retry',async()=>{
  const input=buildOutcomeProbePreparation().originals[0]!.request,probe=prepareOutcomeProbe(input);
  const reply=authoredProbeOutcome(JSON.parse(probe.request.messages[1]!.content),{episode:0,use:'used',result:'unfavorable'});
  let complete!:(response:Response)=>void;
  const fetcher=vi.fn(()=>new Promise<Response>(resolve=>complete=resolve)),{options,path}=setup(fetcher),provider=new DeepSeekOutcomeProbe(options);
  const pending=provider.probe(input);input.sources[0]!.text='변경됨';complete(completed(reply));expect(await pending).toEqual(probe.decode(reply));
  const late=setup(fetcher),stopped=new DeepSeekOutcomeProbe({...late.options,deadlineMs:5});
  await expect(stopped.probe(probe.originalInput)).rejects.toThrow('deepseek_deadline');expect(read(late.path).entries[0].status).toBe('reserved');
  complete(completed(reply));await new Promise(r=>setTimeout(r,10));
  await expect(stopped.probe(probe.originalInput)).rejects.toThrow('deepseek_provider_stopped');expect(fetcher).toHaveBeenCalledTimes(2);expect(read(path).entries).toHaveLength(1);
});
