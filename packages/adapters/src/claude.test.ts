import {it,expect,vi,afterEach} from 'vitest';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ClaudeDialogue,ClaudeAppraisalProbe,createClaudeEventInterpreter,claudeOutputSchema,type ClaudeOptions} from './claude.ts';
import {ClaudeBudget,claudeUsageUsd} from './claude-budget.ts';
import {prepareAppraisalProbe} from './appraisal-probe.ts';
import {affectRequest} from '../../../evals/affect-fixture.ts';
import {authoredReferenceReply} from '../../../evals/affect-reference-fixture.ts';
import {initialState,dialoguePlan} from '../../character-core/src/index.ts';
import {claudeKey} from '../../../apps/runtime/src/providers.ts';

const dirs:string[]=[];
afterEach(()=>{for(const d of dirs.splice(0))rmSync(d,{recursive:true,force:true});});
const KEY='sk-ant-synthetic-test-key';
const usage={input_tokens:1200,output_tokens:300,cache_creation_input_tokens:0,cache_read_input_tokens:0};
const reply=(text:string|null,patch:Record<string,unknown>={},model='claude-sonnet-5-5')=>Response.json({id:'msg_1',type:'message',role:'assistant',model,
  content:[{type:'thinking',thinking:'',signature:'s'},...(text===null?[]:[{type:'text',text}])],stop_reason:'end_turn',stop_sequence:null,usage,...patch});
function setup(fetcher:(url:string,init:RequestInit)=>Promise<Response>,patch:Partial<ClaudeOptions>={}){
  const dir=mkdtempSync(join(tmpdir(),'claude-'));dirs.push(dir);const path=join(dir,'ledger.json');
  const budget=new ClaudeBudget(path,1,20,'synthetic tests only');
  const fetch=vi.fn(async(url:any,init:any)=>fetcher(String(url),init));
  return {path,budget,fetch,options:{localOnly:false,allowPaidProviders:true,apiKey:KEY,model:'claude-sonnet-5-5',effort:'low',budget,fetcher:fetch as unknown as typeof globalThis.fetch,...patch} as ClaudeOptions};
}
const plan=()=>dialoguePlan(initialState(1700000000000),'question','00000000-0000-4000-8000-000000000001');
const ledger=(path:string)=>JSON.parse(readFileSync(path,'utf8'));

it('sends the explicit key, no sampling or thinking fields, explicit effort and a supported schema; records usage',async()=>{
  let sent:any,headers:Headers|undefined;
  const {fetch,options,path}=setup(async(_u,init)=>{sent=JSON.parse(String(init.body));headers=new Headers(init.headers);return reply(JSON.stringify({content:'답한다.',sentences:['좋아, 그렇게 하자.'],recommendations:[]}));});
  const turn=await new ClaudeDialogue(options).generateTurn(plan(),{});
  expect(turn).toMatchObject({sentences:['좋아, 그렇게 하자.'],annotationStatus:'none'});
  expect(fetch).toHaveBeenCalledTimes(1);expect(headers!.get('authorization')).toBe('Bearer '+KEY);
  for(const field of ['temperature','top_p','top_k','thinking'])expect(sent).not.toHaveProperty(field);
  expect(sent).toMatchObject({model:'claude-sonnet-5-5',max_tokens:4096,output_config:{effort:'low',format:{type:'json_schema'}}});
  expect(sent.messages[0].role).toBe('user');expect(typeof sent.system).toBe('string');
  expect(JSON.stringify(sent.output_config.format.schema)).not.toMatch(/"(minLength|maxLength|minItems|maxItems|minimum|maximum|\$schema)"/);
  expect(ledger(path).entries).toEqual([expect.objectContaining({status:'completed',model:'claude-sonnet-5-5',usd:claudeUsageUsd('claude-sonnet-5-5',usage)})]);
});
it('the wire schema keeps structure, forces closed objects and rejects open maps',()=>{
  const schema=claudeOutputSchema({$schema:'x',type:'object',properties:{a:{type:'string',minLength:1,format:'uuid'},b:{type:'array',items:{type:'object',properties:{c:{type:'integer',minimum:0}}},maxItems:2}},required:['a','b']});
  expect(schema).toEqual({type:'object',properties:{a:{type:'string',format:'uuid'},b:{type:'array',items:{type:'object',properties:{c:{type:'integer'}},additionalProperties:false}}},required:['a','b'],additionalProperties:false});
  expect(()=>claudeOutputSchema({type:'object',additionalProperties:{type:'string'}})).toThrow();
});
it.each([
  ['max_tokens',{stop_reason:'max_tokens'},'invalid_output'],
  ['refusal',{stop_reason:'refusal'},'claude_refusal'],
  ['two text blocks',{content:[{type:'text',text:'{}'},{type:'text',text:'{}'}]},'invalid_output'],
  ['other model',{model:'claude-opus-5-5'},'invalid_output'],
] as const)('%s is rejected after the ledger records its usage',async(_name,patch,code)=>{
  const {options,path}=setup(async()=>reply('{}',patch as Record<string,unknown>));
  await expect(new ClaudeDialogue(options).dialogue(plan(),{})).rejects.toMatchObject({code});
  expect(ledger(path).entries.map((e:any)=>e.status)).toEqual(['completed']);
});
it('an HTTP error is one physical call with no retry and no charge; a network failure leaves usage unresolved and blocks',async()=>{
  const failing=setup(async()=>Response.json({type:'error',error:{type:'overloaded_error',message:'private'}},{status:529}));
  await expect(new ClaudeDialogue(failing.options).dialogue(plan(),{})).rejects.toMatchObject({code:'claude_provider_unavailable'});
  expect(failing.fetch).toHaveBeenCalledTimes(1);expect(ledger(failing.path).entries).toEqual([expect.objectContaining({status:'completed',usd:0})]);
  const down=setup(async()=>{throw new TypeError('network down');});
  await expect(new ClaudeDialogue(down.options).dialogue(plan(),{})).rejects.toMatchObject({code:'claude_provider_unavailable'});
  expect(down.fetch).toHaveBeenCalledTimes(1);expect(down.budget.availability()).toBe('claude_usage_unconfirmed');
});
it('rejects models outside Opus 5.5 and Sonnet 5.5, a missing key and local-only mode before any call',()=>{
  const {options,fetch}=setup(async()=>reply('{}'));
  for(const patch of [{model:'claude-haiku-5-5'},{apiKey:' '},{localOnly:true},{allowPaidProviders:false}])expect(()=>new ClaudeDialogue({...options,...patch})).toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
it('the key is redacted from recorded output',async()=>{
  const seen:string[]=[];const {options}=setup(async()=>reply(JSON.stringify({content:KEY,sentences:['응.'],recommendations:[]})));
  await new ClaudeDialogue({...options,onResponse:r=>seen.push(String(r.content))}).generateTurn(plan(),{}).catch(()=>undefined);
  expect(seen.join('')).not.toContain(KEY);expect(seen.join('')).toContain('[redacted]');
});
it('the daily ledger prices cache use per model and resets at local midnight',()=>{
  expect(claudeUsageUsd('claude-opus-5-5',{input_tokens:1e6,output_tokens:1e6,cache_creation_input_tokens:1e6,cache_read_input_tokens:1e6})).toBeCloseTo(4+20+5+.2);
  const dir=mkdtempSync(join(tmpdir(),'claude-day-'));dirs.push(dir);let now=new Date(2026,9,26,23,0).getTime();
  const budget=new ClaudeBudget(join(dir,'l.json'),1,1,'test',()=>now);
  budget.finish(budget.reserve('claude-sonnet-5-5',5000,1000),usage);expect(budget.availability()).toBe('claude_attempt_limit');
  now=new Date(2026,9,27,0,1).getTime();expect(budget.availability()).toBeNull();
});
it('the split interpreter runs only the appraisal stage without episodes and decodes it',async()=>{
  const input=affectRequest(),expected=prepareAppraisalProbe(input,null);
  const {fetch,options}=setup(async(_u,init)=>{const body=JSON.parse(String(init.body));
    expect(body.messages.at(-1).content).toBe(expected.request.messages.at(-1)!.content);
    const {outcome:_o,...raw}=authoredReferenceReply(JSON.parse(body.messages.at(-1).content).input);return reply(JSON.stringify(raw));});
  const result=await createClaudeEventInterpreter(options).interpret(input);
  expect(result.status).toBe('interpreted');expect(fetch).toHaveBeenCalledTimes(1);
  const bad=setup(async()=>reply('{"status":"appraised","appraisals":[]}'));
  expect(await createClaudeEventInterpreter(bad.options).interpret(input)).toMatchObject({status:'unavailable',reason:'invalid_output'});
  expect(ClaudeAppraisalProbe).toBeDefined();
});
it('the runtime reads the key from its own file only',()=>{
  const dir=mkdtempSync(join(tmpdir(),'claude-key-'));dirs.push(dir);const file=join(dir,'anthropic.env');
  writeFileSync(file,'# note\nANTHROPIC_API_KEY='+KEY+'\n');expect(claudeKey({CLAUDE_KEY_FILE:file})).toBe(KEY);
  writeFileSync(file,'ANTHROPIC_API_KEY=\n');expect(()=>claudeKey({CLAUDE_KEY_FILE:file})).toThrow('claude_key_missing');
  expect(()=>claudeKey({CLAUDE_KEY_FILE:join(dir,'missing.env')})).toThrow('claude_key_missing');
});
it('configuration picks Claude only when asked and fully authorized; models are allowlisted per role',async()=>{
  const {parseConfig}=await import('../../contracts/src/local-config.ts'),{createProviders}=await import('../../../apps/runtime/src/providers.ts');
  const dir=mkdtempSync(join(tmpdir(),'claude-cfg-'));dirs.push(dir);const file=join(dir,'anthropic.env');writeFileSync(file,'ANTHROPIC_API_KEY='+KEY+'\n');
  const base={LOCAL_ONLY:'false',ALLOW_PAID_PROVIDERS:'true',CLAUDE_KEY_FILE:file,CLAUDE_BUDGET_USD:'1',CLAUDE_BUDGET_PATH:join(dir,'ledger.json'),CLAUDE_MAX_CALLS:'50',CLAUDE_BUDGET_AUTHORIZATION:'test'};
  const providers=createProviders(parseConfig({...base,DIALOGUE_PROVIDER:'claude',DIALOGUE_MODEL:'claude-opus-5-5',EVENT_INTERPRETER:'claude',CLAUDE_INTERPRETER_MODEL:'claude-sonnet-5-5'}));
  expect(providers.dialogue).toBeInstanceOf(ClaudeDialogue);expect(providers.dialogue.model).toBe('claude-opus-5-5');expect(providers.interpreter).toBeDefined();
  expect(()=>parseConfig({...base,DIALOGUE_PROVIDER:'claude',DIALOGUE_MODEL:'claude-haiku-5-5'})).toThrow();
  expect(()=>parseConfig({...base,EVENT_INTERPRETER:'claude',CLAUDE_INTERPRETER_MODEL:''})).toThrow();
  expect(()=>parseConfig({...base,CLAUDE_BUDGET_USD:'0',EVENT_INTERPRETER:'claude',CLAUDE_INTERPRETER_MODEL:'claude-sonnet-5-5'})).toThrow();
  // Claude settings alone never enable a paid interpreter.
  expect(createProviders(parseConfig({...base})).interpreter).toBeUndefined();
});
