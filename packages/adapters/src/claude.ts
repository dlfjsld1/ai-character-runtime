import Anthropic from '@anthropic-ai/sdk';
import {RuntimeError,type Plan} from '../../contracts/src/domain.ts';
import type {DialogueContext,DialogueGenerator,EventInterpreter,Message} from '../../contracts/src/ai-ports.ts';
import {eligibleAffectEpisodes,type EventInterpretationRequest,type EventInterpretation} from '../../contracts/src/affect-appraisal.ts';
import {budgetConversation,dropOldestExchange} from '../../contracts/src/conversation.ts';
import {SplitEventInterpreter} from './split-event-interpreter.ts';
import {buildDialogueRequest,buildKnowledgeRequest,decodeDialogueOutput,decodeKnowledgeOutput} from './dialogue-request.ts';
import {buildAnnotatedDialogueRequest,decodeAnnotatedDialogueOutput} from './recommendation-capture.ts';
import {prepareOutcomeReferenceProbe,type OutcomeReading} from './outcome-probe.ts';
import {prepareAppraisalProbe} from './appraisal-probe.ts';
import {ClaudeBudget,claudeInputBound,claudeInputBoundLimit,isClaudeModel,type ClaudeModel} from './claude-budget.ts';

type StructuredRequest={messages:Message[];format?:object;schema?:object};
export type ClaudeEffort='low'|'medium'|'high';
// thinking 'off' trades depth for latency: Sonnet 5.5 uses between_tools, Haiku 5.5
// disabled (both only at effort high or below); Opus 5.5 cannot turn it off.
export type ClaudeOptions={localOnly:boolean;allowPaidProviders:boolean;apiKey:string;model:string;effort:ClaudeEffort;thinking?:'adaptive'|'off';budget:ClaudeBudget;
  fetcher?:typeof fetch;deadlineMs?:number;physicalTimeoutMs?:number;onCall?:(record:Record<string,unknown>)=>void;onResponse?:(record:{content:string|null;stopReason:string|null;model:string|null})=>void};

// Structured outputs accept a JSON Schema subset. Drop the unsupported
// constraints from the wire copy only; the existing host validators still
// check every one of them after decoding. `pattern` is kept: the API accepted
// the dialogue one-sentence pattern (checked live 2026-10-26), and without it
// the model merged two sentences into one item.
const unsupported=new Set(['$schema','minimum','maximum','exclusiveMinimum','exclusiveMaximum','multipleOf','minLength','maxLength','minItems','maxItems','uniqueItems','default','title']);
const formats=new Set(['date-time','time','date','duration','email','hostname','uri','ipv4','ipv6','uuid']);
export function claudeOutputSchema(schema:unknown):Record<string,unknown>{
  const walk=(node:unknown):unknown=>{
    if(Array.isArray(node))return node.map(walk);
    if(!node||typeof node!=='object')return node;
    const out:Record<string,unknown>={};
    for(const [key,value] of Object.entries(node)){
      if(unsupported.has(key)||key==='format'&&!formats.has(String(value)))continue;
      out[key]=key==='properties'?Object.fromEntries(Object.entries(value as object).map(([k,v])=>[k,walk(v)])):walk(value);
    }
    if(out.type==='object'||out.properties){
      if(out.additionalProperties!==undefined&&out.additionalProperties!==false)throw new RuntimeError('claude_schema_unsupported',400);
      out.additionalProperties=false;
    }
    return out;
  };
  return walk(schema) as Record<string,unknown>;
}
const thinkingOff={'claude-sonnet-5-5':{type:'between_tools' as const},'claude-haiku-5-5':{type:'disabled' as const}} as const;
export function claudePayload(model:ClaudeModel,effort:ClaudeEffort,request:StructuredRequest,maxTokens:number,thinking:'adaptive'|'off'='adaptive'){
  const system=request.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n\n');
  const messages=request.messages.filter(m=>m.role!=='system').map(m=>({role:m.role as 'user'|'assistant',content:m.content}));
  if(messages[0]?.role!=='user')throw new RuntimeError('claude_request_invalid',400);
  // No sampling parameters (rejected since 2026-10-21). Without a thinking
  // field the models run adaptive thinking; effort is the depth control.
  if(thinking==='off'&&!(model in thinkingOff))throw new RuntimeError('unsupported_provider_configuration',400);
  return {model,max_tokens:maxTokens,...(system?{system}:{}),messages,...(thinking==='off'?{thinking:thinkingOff[model as keyof typeof thinkingOff]}:{}),
    output_config:{effort,format:{type:'json_schema' as const,schema:claudeOutputSchema(request.format??request.schema)}}};
}

class ClaudeChat {
  readonly name='anthropic';readonly model:ClaudeModel;
  private busy=false;private verified=false;private client:Anthropic;
  readonly counter={count:async(messages:Message[])=>claudeInputBound(messages),countText:async(text:string)=>Buffer.byteLength(text,'utf8')};
  // Haiku can run interpretation probes for evaluation; the runtime config
  // does not accept it, and dialogue never does.
  protected readonly models:readonly ClaudeModel[]=['claude-opus-5-5','claude-sonnet-5-5','claude-haiku-5-5'];
  constructor(protected readonly options:ClaudeOptions){
    if(options.localOnly||!options.allowPaidProviders)throw new RuntimeError('paid_provider_disabled',400);
    const key=options.apiKey.trim();if(!key||/\s/.test(key))throw new RuntimeError('claude_key_missing',400);
    if(!isClaudeModel(options.model)||!this.allowed().includes(options.model))throw new RuntimeError('unsupported_provider_configuration',400);
    if(options.thinking==='off'&&(options.model==='claude-opus-5-5'||!['low','medium','high'].includes(options.effort)))throw new RuntimeError('unsupported_provider_configuration',400);
    this.model=options.model;
    // An explicit key only: never fall back to environment keys or CLI
    // profiles that could bill another account. No SDK retries: one ledger
    // reservation is one physical call.
    this.client=new Anthropic({apiKey:key,maxRetries:0,timeout:options.physicalTimeoutMs??120000,...(options.fetcher?{fetch:options.fetcher}:{})});
  }
  protected allowed():readonly ClaudeModel[]{return this.models;}
  readiness(){const error=this.options.budget.availability();return {status:this.busy?'busy':error?'blocked':this.verified?'ready':'not_verified',inferenceVerified:this.verified,preparationError:error};}
  async ready(){return this.readiness();}
  protected async request(request:StructuredRequest,maxTokens:number):Promise<string>{
    if(this.busy)throw new RuntimeError('physical_call_unconfirmed',503);
    const body=claudePayload(this.model,this.options.effort,request,maxTokens,this.options.thinking),inputBound=claudeInputBound(body);
    if(inputBound>claudeInputBoundLimit)throw new RuntimeError('context_limit',503);
    const id=this.options.budget.reserve(this.model,inputBound,maxTokens);this.busy=true;
    let timer:ReturnType<typeof setTimeout>|undefined;
    const physical=(async()=>{
      let settled=false,physicalCompleted=false;
      try{
        let message:Anthropic.Message;
        try{message=await this.client.messages.create(body);}
        catch(error){
          // An HTTP error response is a completed request that was not billed for output.
          if(error instanceof Anthropic.APIError&&typeof error.status==='number'){physicalCompleted=true;this.options.budget.finish(id,{input_tokens:0,output_tokens:0,cache_creation_input_tokens:0,cache_read_input_tokens:0});settled=true;
            throw new RuntimeError(error.status===429||error.status>=500?'claude_provider_unavailable':'claude_provider_http_'+error.status,503);}
          throw error;
        }
        physicalCompleted=true;
        const u=message.usage;
        const valid=this.options.budget.finish(id,{input_tokens:u.input_tokens,output_tokens:u.output_tokens,cache_creation_input_tokens:u.cache_creation_input_tokens??0,cache_read_input_tokens:u.cache_read_input_tokens??0});settled=true;
        const texts=message.content.filter((b):b is Anthropic.TextBlock=>b.type==='text');
        this.options.onResponse?.({content:texts.map(b=>b.text).join('').replaceAll(this.options.apiKey.trim(),'[redacted]').slice(0,131072)||null,stopReason:message.stop_reason,model:message.model});
        if(!valid)throw new RuntimeError('claude_usage_unconfirmed',503);
        if(message.stop_reason==='refusal')throw new RuntimeError('claude_refusal',503);
        // Thinking blocks are ignored; exactly one text block is the answer.
        // Distinct codes for diagnosis; each still classifies as invalid_output.
        if(message.stop_reason==='max_tokens')throw new RuntimeError('claude_max_tokens_invalid_output',503);
        if(message.stop_reason!=='end_turn')throw new RuntimeError('claude_stop_invalid_output',503);
        if(message.model!==this.model)throw new RuntimeError('claude_model_invalid_output',503);
        if(texts.length!==1||!texts[0]!.text.trim())throw new RuntimeError('claude_text_invalid_output',503);
        this.verified=true;return texts[0]!.text;
      }catch(error){if(!settled)this.options.budget.finish(id);throw error instanceof RuntimeError?error:new RuntimeError('claude_provider_unavailable',503);}
      finally{clearTimeout(timer);this.busy=false;this.options.onCall?.({id,provider:this.name,model:this.model,physicalCompleted});}
    })();
    const logical=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new RuntimeError('claude_deadline',503)),this.options.deadlineMs??(this.options.physicalTimeoutMs??120000)+5000);});
    return Promise.race([physical,logical]);
  }
}

export class ClaudeDialogue extends ClaudeChat implements DialogueGenerator {
  protected override allowed():readonly ClaudeModel[]{return ['claude-opus-5-5','claude-sonnet-5-5'];}
  private compose(plan:Plan,context:DialogueContext){return buildDialogueRequest(plan,context,this.model,{promptVariant:'conversation-history-v1'});}
  async fitConversation(plan:Plan,context:DialogueContext){
    if(plan.purpose==='knowledge_answer'){
      const inputTokens=claudeInputBound(claudePayload(this.model,this.options.effort,buildKnowledgeRequest(plan,context),4096));
      if(inputTokens>claudeInputBoundLimit)throw new RuntimeError('context_limit',503);
      return {conversation:undefined,inputTokens};
    }
    let conversation=context.conversation?await budgetConversation(context.conversation,t=>this.counter.countText(t)):undefined;
    for(;;){const inputTokens=claudeInputBound(claudePayload(this.model,this.options.effort,buildAnnotatedDialogueRequest(plan,{...context,conversation},this.model,{promptVariant:'conversation-history-v1'}),4096));
      if(inputTokens<=claudeInputBoundLimit)return {conversation,inputTokens};
      if(!conversation?.turns.length)throw new RuntimeError('context_limit',503);conversation=dropOldestExchange(conversation);
    }
  }
  async dialogue(plan:Plan,context:DialogueContext){const request=this.compose(plan,context);return decodeDialogueOutput(request,await this.request(request,4096),plan.maxSentences);}
  async answerKnowledge(plan:Plan,context:DialogueContext){const request=buildKnowledgeRequest(plan,context);return decodeKnowledgeOutput(request,await this.request(request,4096),plan.maxSentences);}
  async generateTurn(plan:Plan,context:DialogueContext){
    if(plan.purpose==='knowledge_answer')throw new RuntimeError('recommendation_capture_unsupported',400);
    const request=buildAnnotatedDialogueRequest(plan,context,this.model,{promptVariant:'conversation-history-v1'});
    return decodeAnnotatedDialogueOutput(request,await this.request(request,4096),plan.maxSentences);
  }
}
export class ClaudeOutcomeReferenceProbe extends ClaudeChat {
  async probe(input:EventInterpretationRequest):Promise<OutcomeReading>{
    let prepared:ReturnType<typeof prepareOutcomeReferenceProbe>;
    try{prepared=prepareOutcomeReferenceProbe(input);}catch{throw new RuntimeError('outcome_probe_invalid_input',400);}
    const text=await this.request(prepared.request,8192);
    try{return prepared.decode(text);}catch{throw new RuntimeError('outcome_probe_invalid_output',503);}
  }
}
export class ClaudeAppraisalProbe extends ClaudeChat {
  async probe(input:EventInterpretationRequest,outcome:EventInterpretation['outcome']):Promise<EventInterpretation>{
    let prepared:ReturnType<typeof prepareAppraisalProbe>;
    try{prepared=prepareAppraisalProbe(input,outcome);}catch{throw new RuntimeError('appraisal_probe_invalid_input',400);}
    const text=await this.request(prepared.request,8192);
    try{return prepared.decode(text);}catch{throw new RuntimeError('appraisal_probe_invalid_output',503);}
  }
}
// The same two-stage interpretation as DeepSeek, with the same prompts. With
// no eligible episode only the appraisal stage is billed.
export function createClaudeEventInterpreter(options:ClaudeOptions):EventInterpreter{
  return new SplitEventInterpreter(
    async request=>eligibleAffectEpisodes(request).length?new ClaudeOutcomeReferenceProbe(options).probe(request):null,
    (request,outcome)=>new ClaudeAppraisalProbe(options).probe(request,outcome));
}
