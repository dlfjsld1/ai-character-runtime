import {it,expect,vi,afterEach} from 'vitest';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {OpenAIDialogue,DialogueBudget,openaiSchema} from './openai.ts';
import {initialState,dialoguePlan} from '../../character-core/src/index.ts';
import {parseConfig} from '../../contracts/src/local-config.ts';
import {createProviders} from '../../../apps/runtime/src/providers.ts';
const directories:string[]=[];
afterEach(()=>{for(const d of directories.splice(0))rmSync(d,{recursive:true,force:true});});
const plan=()=>dialoguePlan(initialState(1700000000000),'question','00000000-0000-4000-8000-000000000001');
function setup(patch:any={},fetcher?:typeof fetch){const dir=mkdtempSync(join(tmpdir(),'openai-unit-'));directories.push(dir);const path=join(dir,'ledger.json');const provider=new OpenAIDialogue({localOnly:false,allowPaidProviders:true,apiKey:'unit-secret',budget:new DialogueBudget(path,1),fetcher,...patch});return {provider,path};}
function completed(text='{"content":"수요일이야.","sentences":["수요일이야."]}',patch:any={}){return Response.json({status:'completed',model:'gpt-6-sol',usage:{input_tokens:100,output_tokens:25,input_tokens_details:{cached_tokens:0}},output:[{type:'message',role:'assistant',content:[{type:'output_text',text}]}],...patch});}
it('blocks missing paid permission/key/config before external calls; preserves defaults and independent Jev',()=>{
 const fetcher=vi.fn();expect(()=>setup({localOnly:true},fetcher)).toThrow('paid_provider_disabled');expect(()=>setup({allowPaidProviders:false},fetcher)).toThrow('paid_provider_disabled');expect(()=>setup({apiKey:''},fetcher)).toThrow('dialogue_key_missing');expect(fetcher.mock.calls).toHaveLength(0);
 expect(()=>parseConfig({DIALOGUE_PROVIDER:'openai'})).toThrow();
 const defaults=createProviders(parseConfig({}),{});expect(defaults.dialogue.name).toBe('ollama');expect(defaults.solver).toBe(defaults.dialogue);
 const selected=createProviders(parseConfig({LOCAL_ONLY:'false',ALLOW_PAID_PROVIDERS:'true',DIALOGUE_PROVIDER:'openai',DIALOGUE_MODEL:'gpt-6-sol',DIALOGUE_API_KEY:'unit-secret',DIALOGUE_BUDGET_USD:'1',DIALOGUE_BUDGET_PATH:'unit-no-write.json'}),{});
 expect(selected.dialogue.name).toBe('openai');expect(selected.solver).toBeUndefined();expect(selected.appraiser.name).toBe('jev');
});
it('native counting, strict request and full application validation; no hidden preparation call or secret log',async()=>{
 const requests:any[]=[],records:any[]=[];const fetcher=vi.fn(async(url:any,init:any)=>{requests.push({url,body:JSON.parse(init.body)});return String(url).endsWith('input_tokens')?Response.json({input_tokens:100}):completed();});
 const {provider,path}=setup({onCall:(r:any)=>records.push(r)},fetcher);await provider.ready();expect(requests).toHaveLength(0);
 expect(await provider.dialogue(plan(),{currentInput:{payload:{text:'모임 요일은?'}}})).toEqual(['수요일이야.']);
 expect(requests[1].body).toMatchObject({model:'gpt-6-sol',store:false,reasoning:{effort:'none'},temperature:.2,max_output_tokens:256,text:{format:{strict:true,type:'json_schema'}}});
 const {model,input,reasoning,text}=requests[1].body;expect(requests[0].body).toEqual({model,input,reasoning,text});
 expect(JSON.stringify(records)+readFileSync(path,'utf8')).not.toContain('unit-secret');expect(provider.readiness().inferenceVerified).toBe(true);
 expect(openaiSchema({minLength:1,maxLength:120,pattern:'x',items:{maxLength:2}})).toEqual({pattern:'x',items:{}});
});
it('uses the exact fitted request count once, without a second reservation or changing generated input',async()=>{
 const requests:any[]=[],fetcher=vi.fn(async(url:any,init:any)=>{requests.push({url,body:JSON.parse(init.body)});return String(url).endsWith('input_tokens')?Response.json({input_tokens:100}):completed();});
 const {provider,path}=setup({},fetcher),p=plan(),context={currentInput:{payload:{text:'모임은 수요일이야. 요일을 알려줘.'}}};
 const fit=await provider.fitConversation(p,context);expect(fit.inputTokens).toBe(100);expect(requests).toHaveLength(1);
 await provider.generateTurn(p,{...context,conversation:fit.conversation});
 expect(requests).toHaveLength(2);const {model,input,reasoning,text}=requests[1].body;expect(requests[0].body).toEqual({model,input,reasoning,text});
 expect(JSON.parse(readFileSync(path,'utf8')).entries.map((e:any)=>e.kind)).toEqual(['count','dialogue']);
 await provider.generateTurn(p,{...context,conversation:fit.conversation});expect(requests).toHaveLength(4);
});
it.each(['context','plan','intervening-count'])('recounts after %s changes instead of reusing stale preparation',async change=>{
 const requests:any[]=[],fetcher=vi.fn(async(url:any,init:any)=>{requests.push({url,body:JSON.parse(init.body)});return String(url).endsWith('input_tokens')?Response.json({input_tokens:100}):completed();});
 const {provider}=setup({},fetcher),p=plan(),context={currentInput:{payload:{text:'모임은 수요일이야.'}}};await provider.fitConversation(p,context);
 if(change==='context')context.currentInput.payload.text='모임은 목요일이야.';
 if(change==='plan')p.speechStyle={register:'formal',positiveTone:'warm'};
 if(change==='intervening-count')await provider.counter.countText('다른 요청');
 await provider.dialogue(p,context);
 expect(requests.map(r=>String(r.url).endsWith('input_tokens')?'count':'dialogue')).toEqual(change==='intervening-count'?['count','count','count','dialogue']:['count','count','dialogue']);
 const {model,input,reasoning,text}=requests.at(-1).body;expect(requests.at(-2).body).toEqual({model,input,reasoning,text});
});
it('MX07: fit and generation transmit the same mixed style without exposing hidden affect or rewriting speech',async()=>{
 const requests:any[]=[],fetcher=vi.fn(async(url:any,init:any)=>{requests.push({url,body:JSON.parse(init.body)});return String(url).endsWith('input_tokens')?Response.json({input_tokens:100}):completed('{"content":"칭찬을 고맙게 받는다.","sentences":["정말 감사합니다."]}');});
 const {provider}=setup({},fetcher),p={...plan(),speechStyle:{register:'formal' as const,positiveTone:'bright' as const}},context={currentInput:{payload:{text:'설명을 잘했어.'}},emotion:{joy:.7,frustration:.7,privateReason:'감춰 둔 원인'}};
 const fit=await provider.fitConversation(p,context);expect((await provider.generateTurn(p,{...context,conversation:fit.conversation})).sentences).toEqual(['정말 감사합니다.']);
 expect(requests).toHaveLength(2);expect(requests[0].body.input).toEqual(requests[1].body.input);
 const transmitted=JSON.stringify(requests[1].body.input);expect(transmitted).toContain('사무적인 존댓말');expect(transmitted).toContain('밝은 호응');expect(transmitted).not.toContain('감춰 둔 원인');expect(transmitted).not.toContain('"joy"');
});
it.each(['unknown','cap','amount','lock'])('prepared counts do not bypass the current %s budget guard',async guard=>{
 const fetcher=vi.fn(async()=>Response.json({input_tokens:100})),{provider,path}=setup({},fetcher),p=plan();await provider.fitConversation(p,{});
 const ledger=JSON.parse(readFileSync(path,'utf8'));
 if(guard==='unknown')ledger.entries.push({id:'new-unknown',kind:'dialogue',status:'unknown',usd:.01});
 if(guard==='cap')ledger.entries.push(...Array.from({length:24},(_,i)=>({id:'g'+i,kind:'dialogue',status:'completed',usd:0})));
 if(guard==='amount')ledger.entries.push({id:'spent',kind:'dialogue',status:'completed',usd:.99});
 writeFileSync(path,JSON.stringify(ledger));if(guard==='lock')writeFileSync(path+'.lock','');const before=readFileSync(path,'utf8');
 await expect(provider.generateTurn(p,{})).rejects.toThrow({unknown:'dialogue_usage_unconfirmed',cap:'dialogue_attempt_limit',amount:'dialogue_budget_exceeded',lock:'dialogue_budget_locked'}[guard]);
 expect(fetcher).toHaveBeenCalledOnce();expect(readFileSync(path,'utf8')).toBe(before);
});
it('compares real generation usage with the reused count before exposing content',async()=>{
 const content=vi.fn(),fetcher=vi.fn(async(url:any)=>String(url).endsWith('input_tokens')?Response.json({input_tokens:99}):completed());
 const {provider}=setup({onContent:content},fetcher),p=plan();await provider.fitConversation(p,{});
 await expect(provider.generateTurn(p,{})).rejects.toThrow('dialogue_token_count_mismatch');expect(fetcher).toHaveBeenCalledTimes(2);expect(content).not.toHaveBeenCalled();
});
it.each(['bad-json','too-long','no-korean','too-many-sentences'])('rejects %s without repair/retry',async kind=>{
 const text=kind==='bad-json'?'broken':kind==='too-long'?JSON.stringify({content:'가'.repeat(121),sentences:['안녕.']}):kind==='no-korean'?'{"content":"Hi.","sentences":["Hi."]}':'{"content":"안녕.","sentences":["안녕. 반가워."]}';
 const fetcher=vi.fn(async(url:any)=>String(url).endsWith('input_tokens')?Response.json({input_tokens:100}):completed(text));const {provider}=setup({},fetcher);
 await expect(provider.dialogue(plan(),{})).rejects.toThrow('invalid_output');expect(fetcher).toHaveBeenCalledTimes(2);
});
it.each(['http','missing-usage','incomplete','refusal','wrong-model'])('stops or rejects %s; restart cannot evade unknown cost',async kind=>{
 const result=kind==='http'?Response.json({}, {status:429}):kind==='missing-usage'?completed(undefined,{usage:null}):kind==='incomplete'?completed(undefined,{status:'incomplete'}):kind==='wrong-model'?completed(undefined,{model:'another-model'}):completed(undefined,{output:[{type:'message',role:'assistant',content:[{type:'refusal',refusal:'no'}]}]});
 const fetcher=vi.fn(async(url:any)=>String(url).endsWith('input_tokens')?Response.json({input_tokens:100}):result);const {provider,path}=setup({},fetcher);
 await expect(provider.dialogue(plan(),{})).rejects.toThrow();expect(fetcher).toHaveBeenCalledTimes(2);
 if(['http','missing-usage'].includes(kind)){await expect(provider.dialogue(plan(),{})).rejects.toThrow('dialogue_provider_stopped');expect(()=>new DialogueBudget(path,1).reserve('dialogue',{})).toThrow('dialogue_usage_unconfirmed');}
});
it('persists budget/call cap and fails closed on ledger corruption or stale lock',()=>{
 const {path}=setup();writeFileSync(path,JSON.stringify({version:1,model:'gpt-6-sol',limitUsd:1,entries:[{id:'a',kind:'dialogue',status:'completed',usd:.9999}]}));expect(()=>new DialogueBudget(path,1).reserve('dialogue',{})).toThrow('dialogue_budget_exceeded');
 writeFileSync(path,JSON.stringify({version:1,model:'gpt-6-sol',limitUsd:1,entries:Array.from({length:24},(_,i)=>({id:String(i),kind:'dialogue',status:'completed',usd:0}))}));expect(()=>new DialogueBudget(path,1).reserve('dialogue',{})).toThrow('dialogue_attempt_limit');
 writeFileSync(path,'{}');expect(()=>new DialogueBudget(path,1).reserve('count',{})).toThrow('dialogue_budget_invalid');writeFileSync(path+'.lock','');expect(()=>new DialogueBudget(path,1).reserve('count',{})).toThrow('dialogue_budget_locked');
});
it('full request over input limit makes no generation call',async()=>{
 const fetcher=vi.fn(async()=>Response.json({input_tokens:3329}));const {provider}=setup({},fetcher);
 await expect(provider.dialogue(plan(),{})).rejects.toThrow('context_limit');expect(fetcher).toHaveBeenCalledTimes(1);
});
it('authorized count continuation retains unknown reservation; never allows inference or a new unknown',()=>{
 const {path}=setup();const failed={id:'failed-count',kind:'count',status:'unknown',usd:.01};writeFileSync(path,JSON.stringify({version:1,model:'gpt-6-sol',limitUsd:1,entries:[failed]}));
 expect(()=>new DialogueBudget(path,1).reserve('count',{})).toThrow('dialogue_usage_unconfirmed');
 const resumed=new DialogueBudget(path,1,{entryId:failed.id,authorization:'user approved count-only resume'});
 const id=resumed.reserve('count',{});resumed.finish(id);const ledger=JSON.parse(readFileSync(path,'utf8'));expect(ledger.entries[0]).toEqual(failed);expect(ledger.entries[1].continuedAfter.entryId).toBe(failed.id);
 expect(()=>resumed.reserve('dialogue',{})).toThrow();expect(()=>new DialogueBudget(path,1).reserve('count',{})).toThrow('dialogue_usage_unconfirmed');
 const next=resumed.reserve('count',{});resumed.unknown(next);expect(()=>resumed.reserve('count',{})).toThrow('dialogue_usage_unconfirmed');
});
it('different actual input usage stops without exposing dialogue',async()=>{
 const content=vi.fn();const fetcher=vi.fn(async(url:any)=>String(url).endsWith('input_tokens')?Response.json({input_tokens:99}):completed());const {provider}=setup({onContent:content},fetcher);
 await expect(provider.dialogue(plan(),{})).rejects.toThrow('dialogue_token_count_mismatch');expect(content.mock.calls).toHaveLength(0);await expect(provider.dialogue(plan(),{})).rejects.toThrow('dialogue_provider_stopped');expect(fetcher).toHaveBeenCalledTimes(2);
});
it('logical deadline retains physical ownership and pending reservation until physical completion',async()=>{
 let finish!:(value:Response)=>void;const fetcher=vi.fn(async()=>await new Promise<Response>(resolve=>{finish=resolve;}));const {provider,path}=setup({deadlineMs:5},fetcher);
 await expect(provider.counter.countText('안녕')).rejects.toThrow('dialogue_deadline');expect(provider.readiness().status).toBe('busy');expect(()=>new DialogueBudget(path,1).reserve('count',{})).toThrow('dialogue_usage_unconfirmed');
 await expect(provider.counter.countText('둘')).rejects.toThrow('dialogue_provider_stopped');expect(fetcher).toHaveBeenCalledTimes(1);finish(Response.json({input_tokens:2}));await new Promise(r=>setTimeout(r,5));expect(JSON.parse(readFileSync(path,'utf8')).entries[0].status).toBe('completed');
});
it('headers alone do not confirm physical completion; body and late call record remain pending',async()=>{
 let finish!:(value:any)=>void;const response=Response.json({});response.json=()=>new Promise(resolve=>{finish=resolve;});const records:any[]=[];
 const {provider}=setup({deadlineMs:5,onCall:(r:any)=>records.push(r)},vi.fn(async()=>response));
 await expect(provider.counter.countText('안녕')).rejects.toThrow('dialogue_deadline');expect(provider.readiness().status).toBe('busy');expect(records).toHaveLength(0);
 finish({input_tokens:2});await new Promise(r=>setTimeout(r,5));expect(records).toHaveLength(1);expect(records[0].physicalCompleted).toBe(true);expect(provider.readiness().status).toBe('unavailable');
});
