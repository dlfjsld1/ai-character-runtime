import {it,expect,vi,afterEach} from 'vitest';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DialogueBudget,OpenAIDialogue,OpenAIEventInterpreter,openaiReservationUsd} from './openai.ts';
import {affectRequest,affectMeaning} from '../../../evals/affect-fixture.ts';
import {initialState,dialoguePlan} from '../../character-core/src/index.ts';
import {authoredReferenceReply} from '../../../evals/affect-reference-fixture.ts';
const dirs:string[]=[];
afterEach(()=>{for(const dir of dirs.splice(0))rmSync(dir,{recursive:true,force:true});});
function setup(fetcher:typeof fetch,limit=1){const dir=mkdtempSync(join(tmpdir(),'affect-provider-'));dirs.push(dir);const path=join(dir,'budget.json'),budget=new DialogueBudget(path,limit);const options={apiKey:'synthetic-secret',localOnly:false,allowPaidProviders:true,budget,fetcher};return {path,budget,options};}
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const completed=(output:unknown,patch:object={})=>Response.json({model:'gpt-6-sol',status:'completed',usage:{input_tokens:100,output_tokens:600},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(output)}]}],...patch});
const plan=()=>dialoguePlan(initialState(1700000000000),'question','00000000-0000-4000-8000-000000000001');
it.each([false,true])('refs OpenAI decodes nonempty references and preserves count payload; malformed=%s stops without fallback',malformed=>{
  const bodies:any[]=[],request=affectRequest();
  const fetcher=vi.fn(async(url:any,init:any)=>{
    const body=JSON.parse(init.body);bodies.push(body);
    if(String(url).endsWith('input_tokens'))return Response.json({input_tokens:100});
    const reply=authoredReferenceReply(JSON.parse(body.input[1].content));
    if(malformed)reply.appraisals[0]!.concern.source.sourceId='r999';
    return completed(reply);
  });
  const {options}=setup(fetcher),provider=new OpenAIEventInterpreter(options,'refs-v1');
  return (async()=>{
    expect(provider.promptVersion).toBe('event-interpretation-v3-refs1');
    const result=await provider.interpret(request);
    expect(result).toMatchObject(malformed?{status:'unavailable',reason:'invalid_output'}:{status:'interpreted',interpretation:authoredReferenceReply(request)});
    const {model,input,reasoning,text}=bodies[1];expect(bodies[0]).toEqual({model,input,reasoning,text});
    expect(input[1].content).toContain('"r');
    if(malformed)await provider.interpret(request);
    expect(fetcher).toHaveBeenCalledTimes(2);
  })();
});
it('event interpreter counts the exact schema and reserves its larger output; no dialogue role or key in ledger',async()=>{
  const bodies:any[]=[],fetcher=vi.fn(async(url:any,init:any)=>{bodies.push(JSON.parse(init.body));return String(url).endsWith('input_tokens')?Response.json({input_tokens:100}):completed(affectMeaning());});
  const {options,path}=setup(fetcher),provider=new OpenAIEventInterpreter(options);
  expect('dialogue' in provider).toBe(false);await provider.ready();expect(fetcher).not.toHaveBeenCalled();
  expect(await provider.interpret(affectRequest())).toMatchObject({status:'interpreted',interpretation:affectMeaning()});
  const {model,input,reasoning,text}=bodies[1];expect(bodies[0]).toEqual({model,input,reasoning,text});
  expect(bodies[1]).toMatchObject({max_output_tokens:2048,store:false,text:{format:{strict:true,name:'character_event'}}});
  expect(read(path).entries[1]).toMatchObject({kind:'dialogue',status:'completed',maxOutputTokens:2048,usage:{output_tokens:600}});
  expect(readFileSync(path,'utf8')).not.toContain('synthetic-secret');
});
it('invalid event input is rejected before HTTP or a reservation',async()=>{
  const fetcher=vi.fn(),{options,path}=setup(fetcher),request=affectRequest();request.sources[0]!.speakerId=null;
  expect(await new OpenAIEventInterpreter(options).interpret(request)).toMatchObject({status:'unavailable',reason:'invalid_input'});
  expect(fetcher).not.toHaveBeenCalled();expect(existsSync(path)).toBe(false);
});
it.each(['http','refusal','incomplete','missing_usage','wrong_count','bad_quote','over_output'] as const)('event %s stops the provider without automatic retries',async failure=>{
  const meaning=affectMeaning();if(failure==='bad_quote')meaning.appraisals[0]!.evidence[0]!.quote='없는 원문';
  const patch=failure==='refusal'?{output:[{type:'message',role:'assistant',content:[{type:'refusal',refusal:'no'}]}]}:failure==='incomplete'?{status:'incomplete'}:failure==='missing_usage'?{usage:null}:failure==='wrong_count'?{usage:{input_tokens:101,output_tokens:600}}:failure==='over_output'?{usage:{input_tokens:100,output_tokens:2049}}:{};
  const fetcher=vi.fn(async(url:any)=>String(url).endsWith('input_tokens')?Response.json({input_tokens:100}):failure==='http'?Response.json({},{status:429}):completed(meaning,patch));
  const {options,path}=setup(fetcher),provider=new OpenAIEventInterpreter(options);
  expect((await provider.interpret(affectRequest())).status).toBe('unavailable');
  expect((await provider.interpret(affectRequest())).status).toBe('unavailable');expect(fetcher).toHaveBeenCalledTimes(2);
  if(['http','missing_usage','over_output'].includes(failure))expect(()=>new DialogueBudget(path,1).reserve('count',{})).toThrow('dialogue_usage_unconfirmed');
});
it('event input overflow counts once and never generates or retries',async()=>{
  const fetcher=vi.fn(async()=>Response.json({input_tokens:8193})),{options}=setup(fetcher),provider=new OpenAIEventInterpreter(options);
  expect((await provider.interpret(affectRequest())).status).toBe('unavailable');expect((await provider.interpret(affectRequest())).status).toBe('unavailable');expect(fetcher).toHaveBeenCalledOnce();
});
it('larger output reserves before generation; too-small budget blocks HTTP generation',async()=>{
  expect(openaiReservationUsd('dialogue',{max_output_tokens:2048})-openaiReservationUsd('dialogue',{max_output_tokens:256})).toBeGreaterThan(.0179);
  const fetcher=vi.fn(async()=>Response.json({input_tokens:100})),{options,path}=setup(fetcher,.06);
  const provider=new OpenAIEventInterpreter(options);await provider.interpret(affectRequest());
  expect(fetcher).toHaveBeenCalledOnce();expect(read(path).entries).toHaveLength(1);
});
it('ledger validates cap metadata, preserves historical entries, and refuses output overruns even when dollar reserve is ample',()=>{
  const {budget,path}=setup(vi.fn());const old={id:'historical',kind:'dialogue',status:'completed',usd:.001};
  writeFileSync(path,JSON.stringify({version:1,model:'gpt-6-sol',limitUsd:1,entries:[old]}));
  const id=budget.reserve('dialogue',{max_output_tokens:512,input:'x'.repeat(10000)});
  expect(read(path).entries[0]).toEqual(old);expect(budget.finish(id,{input_tokens:1,output_tokens:513,cached_tokens:0})).toBe(false);
  expect(read(path).entries[1].status).toBe('unknown');
  const ledger=read(path);ledger.entries[1].maxOutputTokens=100000;writeFileSync(path,JSON.stringify(ledger));expect(()=>budget.summary()).toThrow('dialogue_budget_invalid');
});
it.each([0,2049,NaN,1.5])('invalid requested cap %s cannot reserve',value=>{
  const {budget}=setup(vi.fn());expect(()=>budget.reserve('dialogue',{max_output_tokens:value})).toThrow('dialogue_output_limit_invalid');
});
it('annotation reuses the fitted annotated count and keeps valid speech on malformed capture',async()=>{
  const bodies:any[]=[],fetcher=vi.fn(async(url:any,init:any)=>{bodies.push(JSON.parse(init.body));return String(url).endsWith('input_tokens')?Response.json({input_tokens:100}):completed({content:'영화를 권한다.',sentences:['별의 강을 추천해.'],recommendations:[{kind:'movie',title:'없는 제목',sentenceIndex:0,quote:'없는 제목을 추천해.'}]},{usage:{input_tokens:100,output_tokens:300}});});
  const {options,path}=setup(fetcher),provider=new OpenAIDialogue(options);await provider.fitConversation(plan(),{});
  expect(await provider.generateTurn(plan(),{})).toEqual({sentences:['별의 강을 추천해.'],recommendations:[],annotationStatus:'invalid'});
  // The runtime sends the annotated turn, so fitting counts that body once.
  expect(bodies).toHaveLength(2);const {model,input,reasoning,text}=bodies[1];expect(bodies[0]).toEqual({model,input,reasoning,text});
  expect(bodies[1].max_output_tokens).toBe(512);
  expect(read(path).entries.map((e:any)=>e.kind)).toEqual(['count','dialogue']);
});
it('annotation is not used for grounded knowledge answers',async()=>{
  const fetcher=vi.fn(),{options}=setup(fetcher),provider=new OpenAIDialogue(options);
  await expect(provider.generateTurn({...plan(),purpose:'knowledge_answer'},{})).rejects.toThrow('recommendation_capture_unsupported');expect(fetcher).not.toHaveBeenCalled();
});
