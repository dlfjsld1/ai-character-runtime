import { z } from 'zod';

const booleanSetting = z.enum(['true','false']).transform(value => value === 'true');
const optionalPath = z.string().trim().optional().default('');
const configuredPath = optionalPath.refine((value) => !/[<>]/.test(value), 'Replace placeholder paths with local paths');

const loopbackUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'http:'
    && url.hostname === '127.0.0.1'
    && url.username === ''
    && url.password === ''
    && url.pathname === '/'
    && url.search === ''
    && url.hash === '';
}, 'Ollama must use http://127.0.0.1 on the local PC');

const localModel = z.string().trim().min(1).refine((value) => {
  return !/(:cloud|https?:|\/|\\)/i.test(value);
}, 'Cloud and remote model identifiers are not allowed');

const localDatabaseUrl = configuredPath.refine((value) => {
  if (value === '') return true;
  try {
    const url = new URL(value);
    return (url.protocol === 'postgresql:' || url.protocol === 'postgres:')
      && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
      && url.hash === '';
  } catch {
    return false;
  }
}, 'PostgreSQL must use a local URL');

const claudeModelIds=['claude-opus-5-5','claude-sonnet-5-5'];
function claudeReady(value:{LOCAL_ONLY:boolean;ALLOW_PAID_PROVIDERS:boolean;CLAUDE_KEY_FILE:string;CLAUDE_BUDGET_USD:number;CLAUDE_BUDGET_PATH:string;CLAUDE_MAX_CALLS:number;CLAUDE_BUDGET_AUTHORIZATION:string}){
  return !value.LOCAL_ONLY&&value.ALLOW_PAID_PROVIDERS&&!!value.CLAUDE_KEY_FILE&&value.CLAUDE_BUDGET_USD>0&&!!value.CLAUDE_BUDGET_PATH&&value.CLAUDE_MAX_CALLS>0&&!!value.CLAUDE_BUDGET_AUTHORIZATION;
}

export const configSchema = z.object({
  LOCAL_ONLY: booleanSetting,
  ALLOW_PAID_PROVIDERS: booleanSetting,
  OLLAMA_BASE_URL: loopbackUrl,
  APPRAISAL_PROVIDER: z.string().trim().min(1),
  DIALOGUE_PROVIDER: z.string().trim().min(1),
  APPRAISAL_MODEL: z.string().trim().min(1),
  TYPESAFE_API_KEY: z.string().trim().default(''),
  DIALOGUE_API_KEY: z.string().trim().default(''),
  DEEPSEEK_API_KEY: z.string().trim().default(''),
  DEEPSEEK_BUDGET_USD: z.coerce.number().finite().min(0).default(0),
  DEEPSEEK_BUDGET_PATH: configuredPath,
  DEEPSEEK_MAX_CALLS: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  DEEPSEEK_BUDGET_AUTHORIZATION: z.string().trim().default(''),
  // Claude: the key stays in its own file (CLAUDE_KEY_FILE); limits are per local day.
  CLAUDE_KEY_FILE: configuredPath,
  CLAUDE_BUDGET_USD: z.coerce.number().finite().min(0).default(0),
  CLAUDE_BUDGET_PATH: configuredPath,
  CLAUDE_MAX_CALLS: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  CLAUDE_BUDGET_AUTHORIZATION: z.string().trim().default(''),
  CLAUDE_DIALOGUE_EFFORT: z.enum(['low','medium','high']).default('low'),
  CLAUDE_INTERPRETER_MODEL: z.string().trim().default(''),
  CLAUDE_INTERPRETER_EFFORT: z.enum(['low','medium','high']).default('medium'),
  CLAUDE_INTERPRETER_THINKING: z.enum(['adaptive','off']).default('adaptive'),
  // auto keeps the earlier rule: DeepSeek when it is fully configured.
  EVENT_INTERPRETER: z.enum(['auto','deepseek','claude','none']).default('auto'),
  // Diagnostic only: append each interpreter request and result as JSON lines.
  EVENT_INTERPRETER_CAPTURE_PATH: configuredPath,
  APPRAISAL_DAILY_MAX_CALLS: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  APPRAISAL_CALL_COUNT_PATH: configuredPath,
  DIALOGUE_BUDGET_USD: z.coerce.number().finite().min(0).default(0),
  DIALOGUE_BUDGET_PATH: configuredPath,
  OPENAI_MAX_DECISION_CALLS: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(36),
  OPENAI_MAX_DIALOGUE_CALLS: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(24),
  OPENAI_BUDGET_AUTHORIZATION: z.string().trim().default(''),
  OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID: z.string().trim().default(''),
  OPENAI_ACKNOWLEDGED_DIALOGUE_ENTRY_ID: z.string().trim().default(''),
  DIALOGUE_MODEL: localModel,
  OLLAMA_CONTEXT_TOKENS: z.coerce.number().int().min(512).max(32768),
  DATABASE_URL: localDatabaseUrl,
  STUDIO_DIST_PATH: configuredPath,
  OMNIVOICE_PYTHON: configuredPath,
  OMNIVOICE_MODEL_PATH: configuredPath,
  VOICE_PRESET_ID: z.string().trim().optional().default(''),
  STT_PYTHON: configuredPath,
  STT_MODEL_PATH: configuredPath,
  STT_DEVICE: z.literal('cpu'),
  STT_COMPUTE_TYPE: z.literal('int8'),
  STT_LANGUAGE: z.literal('ko'),
}).strict().refine(value => !(value.LOCAL_ONLY && value.ALLOW_PAID_PROVIDERS), 'Paid providers require LOCAL_ONLY=false')
  .refine(value => value.DIALOGUE_PROVIDER!=='deepseek'||(!value.LOCAL_ONLY&&value.ALLOW_PAID_PROVIDERS&&value.DIALOGUE_MODEL==='deepseek-flash'&&!!value.DEEPSEEK_API_KEY&&value.DEEPSEEK_BUDGET_USD>0&&!!value.DEEPSEEK_BUDGET_PATH&&value.DEEPSEEK_MAX_CALLS>0&&!!value.DEEPSEEK_BUDGET_AUTHORIZATION), 'DeepSeek requires explicit permission, deepseek-flash, separate key, daily budget and call authorization')
  .refine(value => value.DIALOGUE_PROVIDER!=='openai'||(!value.LOCAL_ONLY&&value.ALLOW_PAID_PROVIDERS&&value.DIALOGUE_MODEL==='gpt-6-sol'&&!!value.DIALOGUE_API_KEY&&value.DIALOGUE_BUDGET_USD>0&&!!value.DIALOGUE_BUDGET_PATH), 'OpenAI requires explicit paid permission, model, key and budget ledger')
  .refine(value => value.DIALOGUE_PROVIDER!=='claude'||(claudeReady(value)&&claudeModelIds.includes(value.DIALOGUE_MODEL)), 'Claude dialogue requires explicit permission, claude-opus-5-5 or claude-sonnet-5-5, a key file, daily budget and authorization')
  .refine(value => value.EVENT_INTERPRETER!=='claude'||(claudeReady(value)&&claudeModelIds.includes(value.CLAUDE_INTERPRETER_MODEL)), 'The Claude interpreter requires explicit permission, CLAUDE_INTERPRETER_MODEL claude-opus-5-5 or claude-sonnet-5-5, a key file, daily budget and authorization')
  .refine(value => value.CLAUDE_INTERPRETER_THINKING!=='off'||value.CLAUDE_INTERPRETER_MODEL!=='claude-opus-5-5', 'Claude Opus 5.5 cannot turn thinking off')
  .refine(value => value.APPRAISAL_PROVIDER!=='jev'||value.APPRAISAL_MODEL==='jev-1.13.0', 'Jev requires APPRAISAL_MODEL=jev-1.13.0')
  .refine(value => value.APPRAISAL_DAILY_MAX_CALLS===0||!!value.APPRAISAL_CALL_COUNT_PATH, 'APPRAISAL_DAILY_MAX_CALLS requires APPRAISAL_CALL_COUNT_PATH')
  .refine(value => !['openai-decisions-v3','openai-decisions-v4','openai-decisions-v5'].includes(value.APPRAISAL_PROVIDER)||(!value.LOCAL_ONLY&&value.ALLOW_PAID_PROVIDERS&&value.APPRAISAL_MODEL==='gpt-6-luna'&&!!value.DIALOGUE_API_KEY&&value.DIALOGUE_BUDGET_USD>0&&!!value.DIALOGUE_BUDGET_PATH), 'Decisions v3/v4/v5 require explicit paid permission, gpt-6-luna, key and shared budget ledger')
  .refine(value => !!value.OPENAI_BUDGET_AUTHORIZATION||(value.DIALOGUE_BUDGET_USD<=1&&value.OPENAI_MAX_DECISION_CALLS===36&&value.OPENAI_MAX_DIALOGUE_CALLS===24&&!value.OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID&&!value.OPENAI_ACKNOWLEDGED_DIALOGUE_ENTRY_ID), 'Higher budget, custom cumulative limits and count acknowledgement require explicit budget authorization');

export type LocalConfig = z.output<typeof configSchema>;

export function parseConfig(environment: NodeJS.ProcessEnv): LocalConfig {
  return configSchema.parse({
    LOCAL_ONLY: environment.LOCAL_ONLY ?? 'true',
    ALLOW_PAID_PROVIDERS: environment.ALLOW_PAID_PROVIDERS ?? 'false',
    OLLAMA_BASE_URL: environment.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434',
    APPRAISAL_PROVIDER: environment.APPRAISAL_PROVIDER ?? 'jev',
    DIALOGUE_PROVIDER: environment.DIALOGUE_PROVIDER ?? 'ollama',
    APPRAISAL_MODEL: environment.APPRAISAL_MODEL ?? 'jev-1.13.0',
    TYPESAFE_API_KEY: environment.TYPESAFE_API_KEY ?? '',
    DIALOGUE_API_KEY: environment.DIALOGUE_API_KEY ?? '',
    DEEPSEEK_API_KEY: environment.DEEPSEEK_API_KEY,
    DEEPSEEK_BUDGET_USD: environment.DEEPSEEK_BUDGET_USD,
    DEEPSEEK_BUDGET_PATH: environment.DEEPSEEK_BUDGET_PATH,
    DEEPSEEK_MAX_CALLS: environment.DEEPSEEK_MAX_CALLS,
    DEEPSEEK_BUDGET_AUTHORIZATION: environment.DEEPSEEK_BUDGET_AUTHORIZATION,
    CLAUDE_KEY_FILE: environment.CLAUDE_KEY_FILE,
    CLAUDE_BUDGET_USD: environment.CLAUDE_BUDGET_USD,
    CLAUDE_BUDGET_PATH: environment.CLAUDE_BUDGET_PATH,
    CLAUDE_MAX_CALLS: environment.CLAUDE_MAX_CALLS,
    CLAUDE_BUDGET_AUTHORIZATION: environment.CLAUDE_BUDGET_AUTHORIZATION,
    CLAUDE_DIALOGUE_EFFORT: environment.CLAUDE_DIALOGUE_EFFORT,
    CLAUDE_INTERPRETER_MODEL: environment.CLAUDE_INTERPRETER_MODEL,
    CLAUDE_INTERPRETER_EFFORT: environment.CLAUDE_INTERPRETER_EFFORT,
    CLAUDE_INTERPRETER_THINKING: environment.CLAUDE_INTERPRETER_THINKING,
    EVENT_INTERPRETER: environment.EVENT_INTERPRETER,
    EVENT_INTERPRETER_CAPTURE_PATH: environment.EVENT_INTERPRETER_CAPTURE_PATH,
    APPRAISAL_DAILY_MAX_CALLS: environment.APPRAISAL_DAILY_MAX_CALLS,
    APPRAISAL_CALL_COUNT_PATH: environment.APPRAISAL_CALL_COUNT_PATH,
    DIALOGUE_BUDGET_USD: environment.DIALOGUE_BUDGET_USD ?? '0',
    DIALOGUE_BUDGET_PATH: environment.DIALOGUE_BUDGET_PATH,
    OPENAI_MAX_DECISION_CALLS: environment.OPENAI_MAX_DECISION_CALLS,
    OPENAI_MAX_DIALOGUE_CALLS: environment.OPENAI_MAX_DIALOGUE_CALLS,
    OPENAI_BUDGET_AUTHORIZATION: environment.OPENAI_BUDGET_AUTHORIZATION,
    OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID: environment.OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID,
    OPENAI_ACKNOWLEDGED_DIALOGUE_ENTRY_ID: environment.OPENAI_ACKNOWLEDGED_DIALOGUE_ENTRY_ID,
    DIALOGUE_MODEL: environment.DIALOGUE_MODEL ?? 'qwen2.5:7b',
    OLLAMA_CONTEXT_TOKENS: environment.OLLAMA_CONTEXT_TOKENS ?? '4096',
    DATABASE_URL: environment.DATABASE_URL,
    STUDIO_DIST_PATH: environment.STUDIO_DIST_PATH,
    OMNIVOICE_PYTHON: environment.OMNIVOICE_PYTHON ?? 'J:/ai/omnivoice tts/omnivoice-env/Scripts/python.exe',
    OMNIVOICE_MODEL_PATH: environment.OMNIVOICE_MODEL_PATH,
    VOICE_PRESET_ID: environment.VOICE_PRESET_ID,
    STT_PYTHON: environment.STT_PYTHON,
    STT_MODEL_PATH: environment.STT_MODEL_PATH,
    STT_DEVICE: environment.STT_DEVICE ?? 'cpu',
    STT_COMPUTE_TYPE: environment.STT_COMPUTE_TYPE ?? 'int8',
    STT_LANGUAGE: environment.STT_LANGUAGE ?? 'ko',
  });
}
