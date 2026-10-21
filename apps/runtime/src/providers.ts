import {RuntimeError} from '../../../packages/contracts/src/domain.ts';
import type {LocalConfig} from '../../../packages/contracts/src/local-config.ts';
import type {DialogueGenerator,ActivitySolver,AppraisalProvider,AppraisalEvidenceVerifier,EventInterpreter} from '../../../packages/contracts/src/ai-ports.ts';
import {OllamaProvider,PythonTokenCounter} from '../../../packages/adapters/src/ollama.ts';
import {JevAppraisalProvider} from '../../../packages/adapters/src/jev.ts';
import {DailyCallCap} from '../../../packages/adapters/src/daily-call-cap.ts';
import {jevEvidenceVerifier} from '../../../packages/adapters/src/appraisal-evidence.ts';
import {OpenAIDialogue,DialogueBudget} from '../../../packages/adapters/src/openai.ts';
import {DeepSeekDialogue,createDeepSeekEventInterpreter,o2Timeouts} from '../../../packages/adapters/src/deepseek.ts';
import {DeepSeekBudget} from '../../../packages/adapters/src/deepseek-budget.ts';
import {OpenAIInteractionV3Candidate,interactionV3EvidenceVerifier} from '../../../packages/adapters/src/openai-interaction-v3.ts';
import {OpenAIInteractionV4Candidate,interactionV4EvidenceVerifier} from '../../../packages/adapters/src/openai-interaction-v4.ts';

import {OpenAIInteractionV5Candidate,interactionV5EvidenceVerifier} from '../../../packages/adapters/src/openai-interaction-v5.ts';

function openaiBudget(config:LocalConfig){return new DialogueBudget(config.DIALOGUE_BUDGET_PATH,config.DIALOGUE_BUDGET_USD,undefined,config.OPENAI_BUDGET_AUTHORIZATION?{authorization:config.OPENAI_BUDGET_AUTHORIZATION,maxDecisionCalls:config.OPENAI_MAX_DECISION_CALLS,maxDialogueCalls:config.OPENAI_MAX_DIALOGUE_CALLS,...(config.OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID?{acknowledgedCountEntryId:config.OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID}:{}),...(config.OPENAI_ACKNOWLEDGED_DIALOGUE_ENTRY_ID?{acknowledgedDialogueEntryId:config.OPENAI_ACKNOWLEDGED_DIALOGUE_ENTRY_ID}:{})}:undefined);}

export type RuntimeProviders={dialogue:DialogueGenerator;solver?:ActivitySolver;appraiser:AppraisalProvider;evidenceVerifier:AppraisalEvidenceVerifier;interpreter?:EventInterpreter};
type Factory<T>=(config:LocalConfig,environment:NodeJS.ProcessEnv)=>T;
export type ProviderRegistry={dialogue:Record<string,Factory<Pick<RuntimeProviders,'dialogue'|'solver'>>>;appraisal:Record<string,Factory<Pick<RuntimeProviders,'appraiser'|'evidenceVerifier'>>>};
export function createOllamaDialogue(config:Pick<LocalConfig,'DIALOGUE_MODEL'|'OLLAMA_BASE_URL'|'OMNIVOICE_PYTHON'>,environment:NodeJS.ProcessEnv,probeOptions:ConstructorParameters<typeof OllamaProvider>[4]={}){
  if(!['qwen2.5:7b','gemma4:12b-it-qat'].includes(config.DIALOGUE_MODEL))throw new RuntimeError('unsupported_provider_configuration',400);
  const gemma=config.DIALOGUE_MODEL==='gemma4:12b-it-qat';
  const tokenizer=environment.DIALOGUE_TOKENIZER_PATH?.trim()||(gemma?'':environment.QWEN_TOKENIZER_PATH??'');
  return new OllamaProvider(config.DIALOGUE_MODEL,new PythonTokenCounter(environment.TOKENIZER_PYTHON??config.OMNIVOICE_PYTHON,tokenizer,gemma?{enable_thinking:false}:{}),config.OLLAMA_BASE_URL,fetch,probeOptions);
}
const registeredProviders:ProviderRegistry={
  dialogue:{ollama:(config,environment)=>{
    const dialogue=createOllamaDialogue(config,environment);
    return {dialogue,solver:dialogue};
  },openai:config=>{
    if(config.DIALOGUE_MODEL!=='gpt-6-sol')throw new RuntimeError('unsupported_provider_configuration',400);
    return {dialogue:new OpenAIDialogue({localOnly:config.LOCAL_ONLY,allowPaidProviders:config.ALLOW_PAID_PROVIDERS,apiKey:config.DIALOGUE_API_KEY,budget:openaiBudget(config)})};
  },deepseek:config=>{
    if(config.DIALOGUE_MODEL!=='deepseek-flash')throw new RuntimeError('unsupported_provider_configuration',400);
    return {dialogue:new DeepSeekDialogue({localOnly:config.LOCAL_ONLY,allowPaidProviders:config.ALLOW_PAID_PROVIDERS,apiKey:config.DEEPSEEK_API_KEY,budget:new DeepSeekBudget(config.DEEPSEEK_BUDGET_PATH,config.DEEPSEEK_BUDGET_USD,config.DEEPSEEK_MAX_CALLS,config.DEEPSEEK_BUDGET_AUTHORIZATION)})};
  }},
  appraisal:{jev:config=>({appraiser:new JevAppraisalProvider({localOnly:config.LOCAL_ONLY,allowPaidProviders:config.ALLOW_PAID_PROVIDERS,apiKey:config.TYPESAFE_API_KEY}),evidenceVerifier:jevEvidenceVerifier}),
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
function deepseekInterpreter(config:LocalConfig){return createDeepSeekEventInterpreter({localOnly:config.LOCAL_ONLY,allowPaidProviders:config.ALLOW_PAID_PROVIDERS,apiKey:config.DEEPSEEK_API_KEY,budget:new DeepSeekBudget(config.DEEPSEEK_BUDGET_PATH,config.DEEPSEEK_BUDGET_USD,config.DEEPSEEK_MAX_CALLS,config.DEEPSEEK_BUDGET_AUTHORIZATION),...o2Timeouts(20000)});}
export function createProviders(config:LocalConfig,environment:NodeJS.ProcessEnv=process.env,registry:ProviderRegistry=registeredProviders):RuntimeProviders {
  if(!Object.hasOwn(registry.dialogue,config.DIALOGUE_PROVIDER)||!Object.hasOwn(registry.appraisal,config.APPRAISAL_PROVIDER))throw new RuntimeError('unsupported_provider_configuration',400);
  const appraisal=registry.appraisal[config.APPRAISAL_PROVIDER]!(config,environment);
  if(config.APPRAISAL_DAILY_MAX_CALLS>0)appraisal.appraiser=new DailyCallCap(appraisal.appraiser,config.APPRAISAL_CALL_COUNT_PATH,config.APPRAISAL_DAILY_MAX_CALLS);
  return {...registry.dialogue[config.DIALOGUE_PROVIDER]!(config,environment),...appraisal,...(deepseekConfigured(config)?{interpreter:deepseekInterpreter(config)}:{})};
}
