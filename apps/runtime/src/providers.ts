import {RuntimeError} from '../../../packages/contracts/src/domain.ts';
import type {LocalConfig} from '../../../packages/contracts/src/local-config.ts';
import type {DialogueGenerator,ActivitySolver,AppraisalProvider,AppraisalEvidenceVerifier,EventInterpreter} from '../../../packages/contracts/src/ai-ports.ts';
import {OllamaProvider,PythonTokenCounter} from '../../../packages/adapters/src/ollama.ts';
import {JevConversationCandidate} from '../../../packages/adapters/src/jev.ts';
import {DailyCallCap,countDailyCall} from '../../../packages/adapters/src/daily-call-cap.ts';
import {JevOutcomeProbe} from '../../../packages/adapters/src/jev-outcome.ts';
import {JevSituationProbe} from '../../../packages/adapters/src/jev-situation.ts';
import {jevEvidenceVerifier} from '../../../packages/adapters/src/appraisal-evidence.ts';
import {OpenAIDialogue,DialogueBudget} from '../../../packages/adapters/src/openai.ts';
import {DeepSeekDialogue,createDeepSeekEventInterpreter,o2Timeouts} from '../../../packages/adapters/src/deepseek.ts';
import {DeepSeekBudget} from '../../../packages/adapters/src/deepseek-budget.ts';
import {readFileSync,appendFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {ClaudeDialogue,createClaudeEventInterpreter,type ClaudeOptions} from '../../../packages/adapters/src/claude.ts';
import {ClaudeBudget} from '../../../packages/adapters/src/claude-budget.ts';
import {OpenAIInteractionV3Candidate,interactionV3EvidenceVerifier} from '../../../packages/adapters/src/openai-interaction-v3.ts';
import {OpenAIInteractionV4Candidate,interactionV4EvidenceVerifier} from '../../../packages/adapters/src/openai-interaction-v4.ts';

import {OpenAIInteractionV5Candidate,interactionV5EvidenceVerifier} from '../../../packages/adapters/src/openai-interaction-v5.ts';

function openaiBudget(config:LocalConfig){return new DialogueBudget(config.DIALOGUE_BUDGET_PATH,config.DIALOGUE_BUDGET_USD,undefined,config.OPENAI_BUDGET_AUTHORIZATION?{authorization:config.OPENAI_BUDGET_AUTHORIZATION,maxDecisionCalls:config.OPENAI_MAX_DECISION_CALLS,maxDialogueCalls:config.OPENAI_MAX_DIALOGUE_CALLS,...(config.OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID?{acknowledgedCountEntryId:config.OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID}:{}),...(config.OPENAI_ACKNOWLEDGED_DIALOGUE_ENTRY_ID?{acknowledgedDialogueEntryId:config.OPENAI_ACKNOWLEDGED_DIALOGUE_ENTRY_ID}:{})}:undefined);}

export type RuntimeProviders={dialogue:DialogueGenerator;solver?:ActivitySolver;appraiser:AppraisalProvider;evidenceVerifier:AppraisalEvidenceVerifier;interpreter?:EventInterpreter;situation?:JevSituationProbe};
type Factory<T>=(config:LocalConfig,environment:NodeJS.ProcessEnv)=>T;
export type ProviderRegistry={dialogue:Record<string,Factory<Pick<RuntimeProviders,'dialogue'|'solver'>>>;appraisal:Record<string,Factory<Pick<RuntimeProviders,'appraiser'|'evidenceVerifier'>>>};
export function createOllamaDialogue(config:Pick<LocalConfig,'DIALOGUE_MODEL'|'OLLAMA_BASE_URL'|'OMNIVOICE_PYTHON'>,environment:NodeJS.ProcessEnv,probeOptions:ConstructorParameters<typeof OllamaProvider>[4]={}){
  if(!['qwen2.5:7b','gemma4:12b-it-qat'].includes(config.DIALOGUE_MODEL))throw new RuntimeError('unsupported_provider_configuration',400);
  const gemma=config.DIALOGUE_MODEL==='gemma4:12b-it-qat';
  const tokenizer=environment.DIALOGUE_TOKENIZER_PATH?.trim()||(gemma?'':environment.QWEN_TOKENIZER_PATH??'');
  // Model capabilities are named here, at configuration, not inside the adapter or prompt builder.
  return new OllamaProvider(config.DIALOGUE_MODEL,new PythonTokenCounter(environment.TOKENIZER_PYTHON??config.OMNIVOICE_PYTHON,tokenizer,gemma?{enable_thinking:false}:{}),config.OLLAMA_BASE_URL,fetch,{...(gemma?{promptVariant:'content-first' as const,think:false as const}:{}),...probeOptions});
}
const registeredProviders:ProviderRegistry={
  dialogue:{ollama:(config,environment)=>{
    const dialogue=createOllamaDialogue(config,environment);
    return {dialogue,solver:dialogue};
  },openai:config=>{
    if(config.DIALOGUE_MODEL!=='gpt-6-sol')throw new RuntimeError('unsupported_provider_configuration',400);
    return {dialogue:new OpenAIDialogue({localOnly:config.LOCAL_ONLY,allowPaidProviders:config.ALLOW_PAID_PROVIDERS,apiKey:config.DIALOGUE_API_KEY,budget:openaiBudget(config)})};
  },claude:config=>({dialogue:new ClaudeDialogue(claudeOptions(config,config.DIALOGUE_MODEL,config.CLAUDE_DIALOGUE_EFFORT))}),
  deepseek:config=>{
    if(config.DIALOGUE_MODEL!=='deepseek-flash')throw new RuntimeError('unsupported_provider_configuration',400);
    return {dialogue:new DeepSeekDialogue({localOnly:config.LOCAL_ONLY,allowPaidProviders:config.ALLOW_PAID_PROVIDERS,apiKey:config.DEEPSEEK_API_KEY,budget:new DeepSeekBudget(config.DEEPSEEK_BUDGET_PATH,config.DEEPSEEK_BUDGET_USD,config.DEEPSEEK_MAX_CALLS,config.DEEPSEEK_BUDGET_AUTHORIZATION,'daily')})};
  }},
  appraisal:{jev:config=>({appraiser:new JevConversationCandidate({localOnly:config.LOCAL_ONLY,allowPaidProviders:config.ALLOW_PAID_PROVIDERS,apiKey:config.TYPESAFE_API_KEY}),evidenceVerifier:jevEvidenceVerifier}),
    'openai-decisions-v3':config=>{
      if(config.APPRAISAL_MODEL!=='gpt-6-luna')throw new RuntimeError('unsupported_provider_configuration',400);
      return {appraiser:new OpenAIInteractionV3Candidate({localOnly:config.LOCAL_ONLY,allowPaidProviders:config.ALLOW_PAID_PROVIDERS,apiKey:config.DIALOGUE_API_KEY,budget:openaiBudget(config)}),evidenceVerifier:interactionV3EvidenceVerifier};
    },
    'openai-decisions-v5':config=>{
      if(config.APPRAISAL_MODEL!=='gpt-6-luna')throw new RuntimeError('unsupported_provider_configuration',400);
      return {appraiser:new OpenAIInteractionV5Candidate({localOnly:config.LOCAL_ONLY,allowPaidProviders:config.ALLOW_PAID_PROVIDERS,apiKey:config.DIALOGUE_API_KEY,budget:openaiBudget(config)}),evidenceVerifier:interactionV5EvidenceVerifier};
    },
    'openai-decisions-v4':config=>{
      if(config.APPRAISAL_MODEL!=='gpt-6-luna')throw new RuntimeError('unsupported_provider_configuration',400);
      return {appraiser:new OpenAIInteractionV4Candidate({localOnly:config.LOCAL_ONLY,allowPaidProviders:config.ALLOW_PAID_PROVIDERS,apiKey:config.DIALOGUE_API_KEY,budget:openaiBudget(config)}),evidenceVerifier:interactionV4EvidenceVerifier};
    }},
};
// O2 default: event affect runs whenever paid DeepSeek is fully authorized,
// independently of the dialogue provider. Local-only setups never call it.
export function deepseekConfigured(config:LocalConfig){return !config.LOCAL_ONLY&&config.ALLOW_PAID_PROVIDERS&&!!config.DEEPSEEK_API_KEY&&config.DEEPSEEK_BUDGET_USD>0&&!!config.DEEPSEEK_BUDGET_PATH&&config.DEEPSEEK_MAX_CALLS>0&&!!config.DEEPSEEK_BUDGET_AUTHORIZATION;}
function deepseekInterpreter(config:LocalConfig){return createDeepSeekEventInterpreter({localOnly:config.LOCAL_ONLY,allowPaidProviders:config.ALLOW_PAID_PROVIDERS,apiKey:config.DEEPSEEK_API_KEY,budget:new DeepSeekBudget(config.DEEPSEEK_BUDGET_PATH,config.DEEPSEEK_BUDGET_USD,config.DEEPSEEK_MAX_CALLS,config.DEEPSEEK_BUDGET_AUTHORIZATION,'daily'),...o2Timeouts(20000)});}
// The key is read from its own file only; process environment keys and CLI
// profiles are never used, so no other account can be billed.
export function claudeKey(config:Pick<LocalConfig,'CLAUDE_KEY_FILE'>){
  let key:string|undefined;try{key=parseEnv(readFileSync(config.CLAUDE_KEY_FILE,'utf8')).ANTHROPIC_API_KEY?.trim();}catch{key=undefined;}
  if(!key)throw new RuntimeError('claude_key_missing',400);return key;
}
// Dialogue and interpreter share one daily ledger and its lock.
function claudeOptions(config:LocalConfig,model:string,effort:ClaudeOptions['effort'],thinking:ClaudeOptions['thinking']='adaptive'):ClaudeOptions{
  return {localOnly:config.LOCAL_ONLY,allowPaidProviders:config.ALLOW_PAID_PROVIDERS,apiKey:claudeKey(config),model,effort,thinking,
    budget:new ClaudeBudget(config.CLAUDE_BUDGET_PATH,config.CLAUDE_BUDGET_USD,config.CLAUDE_MAX_CALLS,config.CLAUDE_BUDGET_AUTHORIZATION),physicalTimeoutMs:60000};
}
// Diagnostic capture for offline comparison; it never changes the result.
export function capturingInterpreter(inner:EventInterpreter,path:string):EventInterpreter{
  return {promptVersion:inner.promptVersion,async interpret(request){
    const result=await inner.interpret(request);
    try{appendFileSync(path,JSON.stringify({at:Date.now(),request,result})+'\n');}catch{}
    return result;
  }};
}
function interpreter(config:LocalConfig):EventInterpreter|undefined{
  const chosen=selectInterpreter(config);
  return chosen&&config.EVENT_INTERPRETER_CAPTURE_PATH?capturingInterpreter(chosen,config.EVENT_INTERPRETER_CAPTURE_PATH):chosen;
}
function selectInterpreter(config:LocalConfig):EventInterpreter|undefined{
  // Jev-first calls share the daily appraisal allowance with the social appraisal.
  const jevFirst=config.EVENT_OUTCOME_FIRST==='jev'?new JevOutcomeProbe(config.TYPESAFE_API_KEY,()=>{if(config.APPRAISAL_DAILY_MAX_CALLS>0)countDailyCall(config.APPRAISAL_CALL_COUNT_PATH,config.APPRAISAL_DAILY_MAX_CALLS);}):undefined;
  if(config.EVENT_INTERPRETER==='claude')return createClaudeEventInterpreter(claudeOptions(config,config.CLAUDE_INTERPRETER_MODEL,config.CLAUDE_INTERPRETER_EFFORT,config.CLAUDE_INTERPRETER_THINKING),jevFirst);
  if(config.EVENT_INTERPRETER==='deepseek'&&!deepseekConfigured(config))throw new RuntimeError('unsupported_provider_configuration',400);
  return config.EVENT_INTERPRETER!=='none'&&deepseekConfigured(config)?deepseekInterpreter(config):undefined;
}
export function createProviders(config:LocalConfig,environment:NodeJS.ProcessEnv=process.env,registry:ProviderRegistry=registeredProviders):RuntimeProviders {
  if(!Object.hasOwn(registry.dialogue,config.DIALOGUE_PROVIDER)||!Object.hasOwn(registry.appraisal,config.APPRAISAL_PROVIDER))throw new RuntimeError('unsupported_provider_configuration',400);
  const appraisal=registry.appraisal[config.APPRAISAL_PROVIDER]!(config,environment);
  if(config.APPRAISAL_DAILY_MAX_CALLS>0)appraisal.appraiser=new DailyCallCap(appraisal.appraiser,config.APPRAISAL_CALL_COUNT_PATH,config.APPRAISAL_DAILY_MAX_CALLS);
  return {...registry.dialogue[config.DIALOGUE_PROVIDER]!(config,environment),...appraisal,...((i=>i?{interpreter:i}:{})(interpreter(config))),
    // Jev situation calls share the daily appraisal allowance.
    ...(config.FIRST_REACTION==='jev'?{situation:new JevSituationProbe(config.TYPESAFE_API_KEY,()=>{if(config.APPRAISAL_DAILY_MAX_CALLS>0)countDailyCall(config.APPRAISAL_CALL_COUNT_PATH,config.APPRAISAL_DAILY_MAX_CALLS);})}:{})};
}
