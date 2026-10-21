import {RuntimeError,type Plan} from '../../contracts/src/domain.ts';
import type {DialogueContext,DialogueGenerator,EventInterpreter,Message} from '../../contracts/src/ai-ports.ts';
import {eligibleAffectEpisodes,type EventInterpretationRequest,type EventInterpretation} from '../../contracts/src/affect-appraisal.ts';
import {SplitEventInterpreter} from './split-event-interpreter.ts';
import {budgetConversation,dropOldestExchange} from '../../contracts/src/conversation.ts';
import {StructuredEventInterpreter,eventInterpreterVersion,type EventInterpretationDiagnostic} from './event-interpreter.ts';
import type {EventWireFormat} from './event-reference-codec.ts';
import {buildDialogueRequest,buildKnowledgeRequest,decodeDialogueOutput,decodeKnowledgeOutput} from './dialogue-request.ts';
import {buildAnnotatedDialogueRequest,decodeAnnotatedDialogueOutput} from './recommendation-capture.ts';
import {DeepSeekBudget,deepseekCandidate,deepseekInputBound} from './deepseek-budget.ts';
import {prepareOutcomeProbe,type OutcomeProbeResult} from './outcome-probe.ts';
import {prepareAppraisalProbe} from './appraisal-probe.ts';

type StructuredRequest={messages:Message[];format?:object;schema?:object};
export function deepseekPayload(request:StructuredRequest,maxTokens:number){
  // JSON mode is syntax-only. Existing port validators still own the contract.
  return {model:deepseekCandidate.model,messages:[{role:'system',content:'Return one JSON object satisfying this JSON schema. No markdown.\n'+JSON.stringify(request.format??request.schema)},...request.messages],response_format:{type:'json_object'},thinking:{type:'disabled'},temperature:.2,max_tokens:maxTokens,stream:false};
}
export type DeepSeekResponseRecord={content:string|null;truncated:boolean;finishReason:string|null;model:string|null};
export type DeepSeekOptions={localOnly:boolean;allowPaidProviders:boolean;apiKey:string;budget:DeepSeekBudget;fetcher?:typeof fetch;deadlineMs?:number;physicalTimeoutMs?:number;onCall?:(record:Record<string,unknown>)=>void;onResponse?:(record:DeepSeekResponseRecord)=>void;onDiagnostic?:(record:EventInterpretationDiagnostic)=>void};
class DeepSeekChat {
  readonly name='deepseek';readonly model=deepseekCandidate.model;
  private busy=false;private verified=false;protected stopped=false;
  // A conservative byte bound, explicitly NOT an exact provider tokenizer.
  readonly counter={count:async(messages:Message[])=>deepseekInputBound(messages),countText:async(text:string)=>Buffer.byteLength(text,'utf8')};
  constructor(protected readonly options:DeepSeekOptions){
    if(options.localOnly||!options.allowPaidProviders)throw new RuntimeError('paid_provider_disabled',400);
    if(!options.apiKey.trim()||/\s/.test(options.apiKey.trim()))throw new RuntimeError('deepseek_key_missing',400);
  }
  readiness(){const error=this.stopped?'deepseek_provider_stopped':this.options.budget.availability();return {status:this.busy?'busy':error?'blocked':this.verified?'ready':'not_verified',inferenceVerified:this.verified,preparationError:error};}
  async ready(){return this.readiness();}
  protected async request(request:StructuredRequest,maxTokens:number):Promise<string>{
    if(this.stopped)throw new RuntimeError('deepseek_provider_stopped',503);
    if(this.busy)throw new RuntimeError('physical_call_unconfirmed',503);
    const body=deepseekPayload(request,maxTokens),inputBound=deepseekInputBound(body);
    const id=this.options.budget.reserve(inputBound,maxTokens);this.busy=true;
    let timer:ReturnType<typeof setTimeout>|undefined;
    const physical=(async()=>{
      let settled=false,physicalCompleted=false;
      try{
        const response=await (this.options.fetcher??fetch)('https://api.deepseek.com/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+this.options.apiKey.trim()},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(this.options.physicalTimeoutMs??120000)});
        const data=await response.json();physicalCompleted=true;
        if(!response.ok)throw new RuntimeError('deepseek_provider_http_'+response.status,503);
        const usage=data.usage;
        const valid=this.options.budget.finish(id,usage?{prompt_tokens:usage.prompt_tokens,completion_tokens:usage.completion_tokens}:undefined);settled=true;
        if(this.options.onResponse){
          const content=data.choices?.[0]?.message?.content;
          const redact=(value:unknown,max:number)=>typeof value==='string'?value.replaceAll(this.options.apiKey.trim(),'[redacted]').slice(0,max):null;
          this.options.onResponse({content:redact(content,131072),truncated:typeof content==='string'&&content.length>131072,finishReason:redact(data.choices?.[0]?.finish_reason,100),model:redact(data.model,100)});
        }
        if(!valid)throw new RuntimeError('deepseek_usage_unconfirmed',503);
        const choice=data.choices?.[0],message=choice?.message;
        if(data.model!==this.model||!Array.isArray(data.choices)||data.choices.length!==1||choice.finish_reason!=='stop'||message?.role!=='assistant'||message.tool_calls?.length||typeof message.content!=='string'||!message.content.trim())throw new RuntimeError('invalid_output',503);
        this.verified=true;return message.content;
      }catch(error){this.stopped=true;if(!settled)this.options.budget.finish(id);throw error instanceof RuntimeError?error:new RuntimeError('deepseek_provider_unavailable',503);}
      finally{clearTimeout(timer);this.busy=false;this.options.onCall?.({id,provider:this.name,model:this.model,physicalCompleted});}
    })();
    const logical=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{this.stopped=true;reject(new RuntimeError('deepseek_deadline',503));},this.options.deadlineMs??60000);});
    return Promise.race([physical,logical]);
  }
  protected async decode<T>(request:StructuredRequest,maxTokens:number,decoder:(text:string)=>T):Promise<T>{
    try{return decoder(await this.request(request,maxTokens));}catch(error){this.stopped=true;throw error;}
  }
}
export class DeepSeekDialogue extends DeepSeekChat implements DialogueGenerator {
  private compose(plan:Plan,context:DialogueContext){return buildDialogueRequest(plan,context,this.model,{promptVariant:'conversation-history-v1'});}
  async fitConversation(plan:Plan,context:DialogueContext){
    if(plan.purpose==='knowledge_answer'){
      const inputTokens=deepseekInputBound(deepseekPayload(buildKnowledgeRequest(plan,context),256));
      if(inputTokens>deepseekCandidate.inputBound)throw new RuntimeError('context_limit',503);
      return {conversation:undefined,inputTokens};
    }
    let conversation=context.conversation?await budgetConversation(context.conversation,t=>this.counter.countText(t)):undefined;
    for(;;){const inputTokens=deepseekInputBound(deepseekPayload(this.compose(plan,{...context,conversation}),256));
      if(inputTokens<=deepseekCandidate.inputBound)return {conversation,inputTokens};
      if(!conversation?.turns.length)throw new RuntimeError('context_limit',503);conversation=dropOldestExchange(conversation);
    }
  }
  async dialogue(plan:Plan,context:DialogueContext){const request=this.compose(plan,context);return this.decode(request,256,text=>decodeDialogueOutput(request,text,plan.maxSentences));}
  async answerKnowledge(plan:Plan,context:DialogueContext){const request=buildKnowledgeRequest(plan,context);return this.decode(request,256,text=>decodeKnowledgeOutput(request,text,plan.maxSentences));}
  async generateTurn(plan:Plan,context:DialogueContext){
    if(plan.purpose==='knowledge_answer')throw new RuntimeError('recommendation_capture_unsupported',400);
    const request=buildAnnotatedDialogueRequest(plan,context,this.model,{promptVariant:'conversation-history-v1'});
    return this.decode(request,512,text=>decodeAnnotatedDialogueOutput(request,text,plan.maxSentences));
  }
}
export class DeepSeekEventInterpreter extends DeepSeekChat implements EventInterpreter {
  readonly promptVersion:string;
  constructor(options:DeepSeekOptions,private readonly wireFormat:EventWireFormat='uuid-v3'){super(options);this.promptVersion=eventInterpreterVersion(wireFormat);}
  async interpret(input:EventInterpretationRequest){
    const result=await new StructuredEventInterpreter(request=>this.request(request,2048),this.options.onDiagnostic,this.wireFormat).interpret(input);
    if(result.status==='unavailable')this.stopped=true;
    return result;
  }
}

// Experimental evaluation adapter only; deliberately not an EventInterpreter.
export class DeepSeekOutcomeProbe extends DeepSeekChat {
  async probe(input:EventInterpretationRequest):Promise<OutcomeProbeResult>{
    let prepared:ReturnType<typeof prepareOutcomeProbe>;
    try{prepared=prepareOutcomeProbe(input);}catch{throw new RuntimeError('outcome_probe_invalid_input',400);}
    return this.decode(prepared.request,2048,text=>{
      try{return prepared.decode(text);}catch{throw new RuntimeError('outcome_probe_invalid_output',503);}
    });
  }
}

// Evaluation-only second stage; registration in the runtime is a separate task.
export class DeepSeekAppraisalProbe extends DeepSeekChat {
  async probe(input:EventInterpretationRequest,outcome:EventInterpretation['outcome']):Promise<EventInterpretation>{
    let prepared:ReturnType<typeof prepareAppraisalProbe>;
    try{prepared=prepareAppraisalProbe(input,outcome);}catch{throw new RuntimeError('appraisal_probe_invalid_input',400);}
    return this.decode(prepared.request,2048,text=>{
      try{return prepared.decode(text);}catch{throw new RuntimeError('appraisal_probe_invalid_output',503);}
    });
  }
}
// The logical deadline must outlast the physical abort: the coordinator must
// never move on to dialogue while this call's ledger reservation is still open.
export function o2Timeouts(physicalTimeoutMs:number){return {physicalTimeoutMs,deadlineMs:physicalTimeoutMs+5000};}
// Runtime composition of the evaluated split interpreter. With no eligible
// episode the fixed outcome is null by contract, so only the appraisal stage is
// billed. A fresh probe per stage keeps one failed call from stopping later
// turns; the shared ledger still gates every reservation.
export function createDeepSeekEventInterpreter(options:DeepSeekOptions):EventInterpreter{
  return new SplitEventInterpreter(
    async request=>eligibleAffectEpisodes(request).length?(await new DeepSeekOutcomeProbe(options).probe(request)).outcome:null,
    (request,outcome)=>new DeepSeekAppraisalProbe(options).probe(request,outcome));
}
