import {readFileSync,writeFileSync,renameSync,openSync,closeSync,unlinkSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {RuntimeError,type Plan} from '../../contracts/src/domain.ts';
import type {DialogueGenerator,DialogueContext,Message,EventInterpreter} from '../../contracts/src/ai-ports.ts';
import type {EventInterpretationRequest} from '../../contracts/src/affect-appraisal.ts';
import {StructuredEventInterpreter,eventInterpreterVersion} from './event-interpreter.ts';
import type {EventWireFormat} from './event-reference-codec.ts';
import {buildAnnotatedDialogueRequest,decodeAnnotatedDialogueOutput} from './recommendation-capture.ts';
import {budgetConversation,dropOldestExchange,type ConversationSnapshot} from '../../contracts/src/conversation.ts';
import {buildDialogueRequest,decodeDialogueOutput,buildKnowledgeRequest,decodeKnowledgeOutput} from './dialogue-request.ts';

// Frozen standard-price upper bounds: includes the higher cache-write input rate.
export const openaiCandidate={model:'gpt-6-sol',inputUsdPerMillion:2.5,outputUsdPerMillion:10,outputTokens:256,temperature:.2,reasoning:'none'} as const;
export const openaiDecisionCandidate={model:'gpt-6-luna',inputUsdPerMillion:.10,maxCalls:36} as const;
type CountContinuation={entryId:string;authorization:string;kind?:'count'|'decision';maxDecisionCalls?:number};
export type RuntimeBudgetAuthorization={authorization:string;maxDecisionCalls:number;maxDialogueCalls:number;acknowledgedCountEntryId?:string;acknowledgedDialogueEntryId?:string};
type Entry={id:string;kind:'count'|'dialogue'|'decision';status:'reserved'|'completed'|'unknown';usd:number;maxOutputTokens?:number;usage?:{input_tokens:number;output_tokens:number;cached_tokens:number};continuedAfter?:CountContinuation;runtimeAuthorization?:RuntimeBudgetAuthorization;model?:string;inputUsdPerMillion?:number};
type Ledger={version:1;model:string;limitUsd:number;entries:Entry[]};
export const openaiAffectLimits={inputTokens:8192,outputTokens:2048,annotationOutputTokens:512} as const;
function outputLimit(body:object){
  const value=(body as {max_output_tokens?:number}).max_output_tokens??openaiCandidate.outputTokens;
  if(!Number.isSafeInteger(value)||value<1||value>openaiAffectLimits.outputTokens)throw new RuntimeError('dialogue_output_limit_invalid',400);
  return value;
}
export function openaiReservationUsd(kind:Entry['kind'],body:object){
  const rate=kind==='decision'?openaiDecisionCandidate.inputUsdPerMillion:openaiCandidate.inputUsdPerMillion;
  return ((Buffer.byteLength(JSON.stringify(body))+1024)*rate+(kind==='dialogue'?outputLimit(body)*openaiCandidate.outputUsdPerMillion:0))/1e6;
}
export class DialogueBudget {
  constructor(readonly path:string,readonly limitUsd:number,private countContinuation?:CountContinuation,private runtimeAuthorization?:RuntimeBudgetAuthorization){
    if(!path||!Number.isFinite(limitUsd)||limitUsd<=0)throw new RuntimeError('dialogue_budget_required',400);
    if(limitUsd>1&&!runtimeAuthorization?.authorization.trim())throw new RuntimeError('runtime_budget_authorization_required',400);
    if(countContinuation&&(!countContinuation.entryId||!countContinuation.authorization.trim()||countContinuation.maxDecisionCalls!==undefined&&(!Number.isSafeInteger(countContinuation.maxDecisionCalls)||countContinuation.maxDecisionCalls<openaiDecisionCandidate.maxCalls||countContinuation.maxDecisionCalls>62||countContinuation.kind!=='decision')))throw new RuntimeError('count_continuation_authorization_required',400);
    if(runtimeAuthorization&&(countContinuation||!runtimeAuthorization.authorization.trim()||![runtimeAuthorization.maxDecisionCalls,runtimeAuthorization.maxDialogueCalls].every(n=>Number.isSafeInteger(n)&&n>=0)||runtimeAuthorization.acknowledgedCountEntryId!==undefined&&!runtimeAuthorization.acknowledgedCountEntryId.trim()||runtimeAuthorization.acknowledgedDialogueEntryId!==undefined&&!runtimeAuthorization.acknowledgedDialogueEntryId.trim()))throw new RuntimeError('runtime_budget_authorization_required',400);
  }
  private readLedger():Ledger{
    let ledger:Ledger;
    try{ledger=JSON.parse(readFileSync(this.path,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw new RuntimeError('dialogue_budget_invalid',503);ledger={version:1,model:openaiCandidate.model,limitUsd:this.limitUsd,entries:[]};}
    if(ledger.version!==1||ledger.model!==openaiCandidate.model||ledger.limitUsd!==this.limitUsd||!Array.isArray(ledger.entries)||ledger.entries.some(e=>!e.id||!['count','dialogue','decision'].includes(e.kind)||!['reserved','completed','unknown'].includes(e.status)||!Number.isFinite(e.usd)||e.usd<0||(e.kind==='decision'&&(e.model!==openaiDecisionCandidate.model||e.inputUsdPerMillion!==openaiDecisionCandidate.inputUsdPerMillion))))throw new RuntimeError('dialogue_budget_invalid',503);
    if(ledger.entries.some(e=>e.maxOutputTokens!==undefined&&(e.kind!=='dialogue'||!Number.isSafeInteger(e.maxOutputTokens)||e.maxOutputTokens<1||e.maxOutputTokens>openaiAffectLimits.outputTokens)))throw new RuntimeError('dialogue_budget_invalid',503);
    return ledger;
  }
  private transaction<T>(fn:(ledger:Ledger)=>T):T{
    let fd:number;try{fd=openSync(this.path+'.lock','wx');}catch{throw new RuntimeError('dialogue_budget_locked',503);}
    try{
      const ledger=this.readLedger();
      const result=fn(ledger);writeFileSync(this.path+'.tmp',JSON.stringify(ledger,null,2)+'\n');renameSync(this.path+'.tmp',this.path);return result;
    }finally{closeSync(fd);unlinkSync(this.path+'.lock');}
  }
  private reservationCost(ledger:Ledger,kind:Entry['kind'],body:object){
    const unresolved=ledger.entries.filter(e=>e.status!=='completed');
    // Explicit acknowledgements retain historical unknown costs. Reserved calls
    // cannot be acknowledged: their physical outcome must first be resolved.
    // A new unknown/pending call blocks every role, including this continuation.
    const continuationKind=this.countContinuation?.kind??'count';
    const acknowledgedId=this.runtimeAuthorization?.acknowledgedCountEntryId??(kind===continuationKind?this.countContinuation?.entryId:undefined);
    if(this.runtimeAuthorization?.acknowledgedCountEntryId&&!ledger.entries.some(e=>e.id===acknowledgedId&&e.kind==='count'&&e.status==='unknown'))throw new RuntimeError('dialogue_usage_unconfirmed',503);
    const dialogueId=this.runtimeAuthorization?.acknowledgedDialogueEntryId;
    if(dialogueId&&!ledger.entries.some(e=>e.id===dialogueId&&e.kind==='dialogue'&&e.status==='unknown'))throw new RuntimeError('dialogue_usage_unconfirmed',503);
    if(unresolved.some(e=>e.status!=='unknown'||!(e.kind==='count'&&e.id===acknowledgedId||e.kind==='dialogue'&&e.id===dialogueId)))throw new RuntimeError('dialogue_usage_unconfirmed',503);
    if(this.countContinuation&&kind!==continuationKind)throw new RuntimeError('count_continuation_only',503);
    if((kind==='dialogue'||kind==='count'&&this.runtimeAuthorization)&&ledger.entries.filter(e=>e.kind==='dialogue').length>=(this.runtimeAuthorization?.maxDialogueCalls??24))throw new RuntimeError('dialogue_attempt_limit',503);
    if(kind==='decision'&&ledger.entries.filter(e=>e.kind==='decision').length>=(this.runtimeAuthorization?.maxDecisionCalls??this.countContinuation?.maxDecisionCalls??openaiDecisionCandidate.maxCalls))throw new RuntimeError('decision_attempt_limit',503);
    // UTF-8 byte bound plus framing allowance, not an exact tokenizer estimate.
    // Token-count requests retain this conservative allowance: their billing is unverified.
    const usd=openaiReservationUsd(kind,body);
    if(ledger.entries.reduce((sum,e)=>sum+e.usd,0)+usd>this.limitUsd)throw new RuntimeError('dialogue_budget_exceeded',503);
    return usd;
  }
  availability(kind:Entry['kind']):{errorCode:string|null}{
    try{if(existsSync(this.path+'.lock'))throw new RuntimeError('dialogue_budget_locked',503);this.reservationCost(this.readLedger(),kind,{});return {errorCode:null};}
    catch(e){return {errorCode:e instanceof RuntimeError?e.code:'dialogue_budget_unavailable'};}
  }
  // Read-only accounting view. The guard includes reservations and is not a bill.
  summary(){
    if(existsSync(this.path+'.lock'))throw new RuntimeError('dialogue_budget_locked',503);
    const ledger=this.readLedger(),attempts={count:0,dialogue:0,decision:0};
    let modelUsageEstimateUsd=0,tokenCountReserveUsd=0,unconfirmedModelReserveUsd=0,unresolvedEntries=0;
    for(const entry of ledger.entries){
      attempts[entry.kind]++;if(entry.status!=='completed')unresolvedEntries++;
      const usage=entry.usage,validUsage=usage&&[usage.input_tokens,usage.output_tokens,usage.cached_tokens].every(n=>Number.isSafeInteger(n)&&n>=0)&&usage.cached_tokens<=usage.input_tokens;
      if(entry.kind==='count')tokenCountReserveUsd+=entry.usd;
      else if(entry.status==='completed'&&validUsage)modelUsageEstimateUsd+=entry.usd;
      else unconfirmedModelReserveUsd+=entry.usd;
    }
    const enforcedTotalUsd=ledger.entries.reduce((sum,e)=>sum+e.usd,0);
    return {billingVerified:false as const,limitUsd:ledger.limitUsd,modelUsageEstimateUsd,tokenCountReserveUsd,unconfirmedModelReserveUsd,enforcedTotalUsd,remainingGuardUsd:Math.max(0,ledger.limitUsd-enforcedTotalUsd),attempts,unresolvedEntries};
  }
  reserve(kind:Entry['kind'],body:object){return this.transaction(ledger=>{
    const usd=this.reservationCost(ledger,kind,body);
    const id=randomUUID();ledger.entries.push({id,kind,status:'reserved',usd,...(kind==='dialogue'?{maxOutputTokens:outputLimit(body)}:{}),...(kind==='decision'?{model:openaiDecisionCandidate.model,inputUsdPerMillion:openaiDecisionCandidate.inputUsdPerMillion}:{}),...(this.countContinuation?{continuedAfter:this.countContinuation}:{}),...(this.runtimeAuthorization?{runtimeAuthorization:{...this.runtimeAuthorization}}:{})});return id;
  });}
  finish(id:string,usage?:Entry['usage']){return this.transaction(ledger=>{
    const entry=ledger.entries.find(e=>e.id===id);if(!entry||entry.status!=='reserved')throw new RuntimeError('dialogue_budget_invalid',503);
    if(entry.kind==='dialogue'||entry.kind==='decision'){
      if(!usage){entry.status='unknown';return false;}
      if(![usage.input_tokens,usage.output_tokens,usage.cached_tokens].every(n=>Number.isSafeInteger(n)&&n>=0)||usage.cached_tokens>usage.input_tokens)throw new RuntimeError('dialogue_usage_unconfirmed',503);
      const usd=entry.kind==='decision'?usage.input_tokens*entry.inputUsdPerMillion!/1e6:(usage.input_tokens*openaiCandidate.inputUsdPerMillion+usage.output_tokens*openaiCandidate.outputUsdPerMillion)/1e6;
      if(usd>entry.usd||entry.kind==='dialogue'&&usage.output_tokens>(entry.maxOutputTokens??256)){entry.usd=Math.max(entry.usd,usd);entry.status='unknown';entry.usage=usage;return false;}
      entry.usd=usd;entry.usage=usage;
    }
    entry.status='completed';
    return true;
  });}
  unknown(id:string){this.transaction(ledger=>{const entry=ledger.entries.find(e=>e.id===id);if(entry)entry.status='unknown';});}
}
// OpenAI strict schemas omit length keywords; full Zod validation remains at the port.
export function openaiSchema(value:any):any{
  if(Array.isArray(value))return value.map(openaiSchema);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['$schema','minLength','maxLength'].includes(k)).map(([k,v])=>[k,openaiSchema(v)]));
  return value;
}
type Options={localOnly:boolean;allowPaidProviders:boolean;apiKey:string;budget:DialogueBudget;fetcher?:typeof fetch;deadlineMs?:number;physicalTimeoutMs?:number;onCall?:(record:Record<string,unknown>)=>void;onContent?:(text:string)=>void};
class OpenAIResponses {
  readonly name='openai';readonly model=openaiCandidate.model;
  private busy=false;private verified=false;protected stopped=false;
  // One prepared request only; never persist or reuse across a provider call.
  protected preparedCount?:{body:string;inputTokens:number};
  readonly counter={count:(messages:Message[])=>this.countInput(messages),countText:(text:string)=>this.countInput(text)};
  constructor(private options:Options){
    if(options.localOnly||!options.allowPaidProviders)throw new RuntimeError('paid_provider_disabled',400);
    if(!options.apiKey.trim()||/\s/.test(options.apiKey.trim()))throw new RuntimeError('dialogue_key_missing',400);
  }
  readiness(){const error=this.stopped?'dialogue_provider_stopped':this.busy?null:this.options.budget.availability('dialogue').errorCode;return {status:this.busy?'busy':this.stopped?'unavailable':error?'blocked':this.verified?'ready':'not_verified',inferenceVerified:this.verified,preparationError:error};}
  async ready(){return this.readiness();} // Never hides a paid preparation call.
  protected async request(kind:'count'|'dialogue',body:object,expectedInputTokens?:number,inputLimit=3328):Promise<any>{
    this.preparedCount=undefined;
    if(this.stopped)throw new RuntimeError('dialogue_provider_stopped',503);
    if(this.busy)throw new RuntimeError('physical_call_unconfirmed',503);
    const id=this.options.budget.reserve(kind,body),started=performance.now();this.busy=true;
    let timer:ReturnType<typeof setTimeout>|undefined;
    const physical=(async()=>{
      let usage:Entry['usage']|undefined,confirmed=false;
      try{
        const response=await (this.options.fetcher??fetch)('https://api.openai.com/v1/responses'+(kind==='count'?'/input_tokens':''),{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+this.options.apiKey.trim()},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(this.options.physicalTimeoutMs??120000)});
        const data=await response.json();
        confirmed=true;
        if(!response.ok)throw new RuntimeError('dialogue_provider_http_'+response.status,503);
        if(kind==='count'){
          if(!Number.isSafeInteger(data.input_tokens)||data.input_tokens<0)throw new RuntimeError('dialogue_token_count_invalid',503);
          this.options.budget.finish(id);return data;
        }
        const u=data.usage,cached=u?.input_tokens_details?.cached_tokens??0;
        if(!u||![u.input_tokens,u.output_tokens,cached].every(n=>Number.isSafeInteger(n)&&n>=0)||cached>u.input_tokens)throw new RuntimeError('dialogue_usage_unconfirmed',503);
        usage={input_tokens:u.input_tokens,output_tokens:u.output_tokens,cached_tokens:cached};
        if(!this.options.budget.finish(id,usage))throw new RuntimeError('dialogue_usage_unconfirmed',503);
        if(u.input_tokens>inputLimit||u.input_tokens!==expectedInputTokens)throw new RuntimeError('dialogue_token_count_mismatch',503);
        if(data.status!=='completed'||data.model!==this.model)throw new RuntimeError('dialogue_incomplete_or_model_mismatch',503);
        if(!Array.isArray(data.output)||data.output.some((o:any)=>o.type!=='message'||o.role!=='assistant'||!Array.isArray(o.content)||o.content.some((c:any)=>c.type!=='output_text')))throw new RuntimeError('invalid_output',503);
        const text=data.output.flatMap((o:any)=>o.content.map((c:any)=>c.text)).join('');if(typeof text!=='string'||!text)throw new RuntimeError('invalid_output',503);
        this.verified=true;this.options.onContent?.(text);return text;
      }catch(e){
        if(!usage||kind==='count'){this.options.budget.unknown(id);this.stopped=true;}
        if(e instanceof RuntimeError&&e.code!=='invalid_output')this.stopped=true;
        throw e instanceof RuntimeError?e:new RuntimeError('dialogue_provider_unavailable',503);
      }finally{
        clearTimeout(timer);this.busy=false;
        this.options.onCall?.({id,kind,elapsedMs:performance.now()-started,physicalCompleted:confirmed,usage:usage??null});
      }
    })();
    const logical=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{this.stopped=true;reject(new RuntimeError('dialogue_deadline',503));},this.options.deadlineMs??60000);});
    return Promise.race([physical,logical]);
  }
  private async countInput(input:Message[]|string){return (await this.request('count',{model:this.model,input})).input_tokens as number;}
  protected payload(request:{messages:Message[];format?:object},maxOutputTokens:number=256,name='character_dialogue'){return {model:this.model,input:request.messages,store:false,reasoning:{effort:'none'},temperature:.2,max_output_tokens:maxOutputTokens,text:{format:{type:'json_schema',name,strict:true,schema:openaiSchema(request.format)}}};}
  protected async countPayload(body:ReturnType<OpenAIResponses['payload']>){
    // InputTokenCountParams excludes store/temperature/max_output_tokens.
    // Preserve all input-bearing fields, including the structured output schema.
    const {model,input,reasoning,text}=body;
    return (await this.request('count',{model,input,reasoning,text})).input_tokens as number;
  }
}
export class OpenAIDialogue extends OpenAIResponses implements DialogueGenerator {
  private compose(plan:Plan,context:object){return buildDialogueRequest(plan,context,this.model,{promptVariant:'conversation-history-v1'});}
  async fitConversation(plan:Plan,context:object){
    this.preparedCount=undefined;
    if(plan.purpose==='knowledge_answer'){
      const body=this.payload(buildKnowledgeRequest(plan,context)),inputTokens=await this.countPayload(body);
      if(inputTokens>3328)throw new RuntimeError('context_limit',503);
      this.preparedCount={body:JSON.stringify(body),inputTokens};return {conversation:undefined,inputTokens};
    }
    const original=(context as {conversation?:ConversationSnapshot}).conversation;
    let conversation=original?await budgetConversation(original,t=>this.counter.countText(t)):undefined;
    for(;;){const body=this.payload(this.compose(plan,{...context,conversation})),inputTokens=await this.countPayload(body);if(inputTokens<=3328){this.preparedCount={body:JSON.stringify(body),inputTokens};return {conversation,inputTokens};}
      if(!conversation?.turns.length)throw new RuntimeError('context_limit',503);conversation=dropOldestExchange(conversation);
    }
  }
  async dialogue(plan:Plan,context:object){
    const prepared=this.preparedCount;this.preparedCount=undefined;
    const request=this.compose(plan,context);
    const body=this.payload(request),inputTokens=prepared?.body===JSON.stringify(body)?prepared.inputTokens:await this.countPayload(body);
    if(inputTokens>3328)throw new RuntimeError('context_limit',503);
    const text=await this.request('dialogue',body,inputTokens);
    return decodeDialogueOutput(request,text,plan.maxSentences);
  }
  async answerKnowledge(plan:Plan,context:DialogueContext){
    const prepared=this.preparedCount;this.preparedCount=undefined;
    const request=buildKnowledgeRequest(plan,context),body=this.payload(request);
    const inputTokens=prepared?.body===JSON.stringify(body)?prepared.inputTokens:await this.countPayload(body);
    if(inputTokens>3328)throw new RuntimeError('context_limit',503);
    return decodeKnowledgeOutput(request,await this.request('dialogue',body,inputTokens),plan.maxSentences);
  }
  async generateTurn(plan:Plan,context:DialogueContext){
    // A plain dialogue fit has a different schema and cannot authorize this count.
    this.preparedCount=undefined;
    if(plan.purpose==='knowledge_answer')throw new RuntimeError('recommendation_capture_unsupported',400);
    const request=buildAnnotatedDialogueRequest(plan,context,this.model,{promptVariant:'conversation-history-v1'});
    const body=this.payload(request,openaiAffectLimits.annotationOutputTokens,'character_recommendation'),inputTokens=await this.countPayload(body);
    if(inputTokens>3328)throw new RuntimeError('context_limit',503);
    return decodeAnnotatedDialogueOutput(request,await this.request('dialogue',body,inputTokens),plan.maxSentences);
  }
}

// Uses the same bounded HTTP/accounting machinery, but has no dialogue role.
export class OpenAIEventInterpreter extends OpenAIResponses implements EventInterpreter {
  readonly promptVersion:string;
  constructor(options:Options,private readonly wireFormat:EventWireFormat='uuid-v3'){super(options);this.promptVersion=eventInterpreterVersion(wireFormat);}
  async interpret(input:EventInterpretationRequest){
    const interpreter=new StructuredEventInterpreter(async request=>{
      const body=this.payload({messages:request.messages,format:request.schema},openaiAffectLimits.outputTokens,'character_event');
      const inputTokens=await this.countPayload(body);
      if(inputTokens>openaiAffectLimits.inputTokens)throw new RuntimeError('context_limit',503);
      return this.request('dialogue',body,inputTokens,openaiAffectLimits.inputTokens);
    },undefined,this.wireFormat);
    const result=await interpreter.interpret(input);
    if(result.status==='unavailable')this.stopped=true;
    return result;
  }
}
