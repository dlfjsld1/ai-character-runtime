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

export const configSchema = z.object({
  LOCAL_ONLY: booleanSetting,
  ALLOW_PAID_PROVIDERS: booleanSetting,
  OLLAMA_BASE_URL: loopbackUrl,
  APPRAISAL_MODEL: z.literal('jev-1.13.0', {error:'Jev is required: set APPRAISAL_MODEL=jev-1.13.0'}),
  TYPESAFE_API_KEY: z.string().trim().default(''),
  DIALOGUE_MODEL: localModel,
  OLLAMA_CONTEXT_TOKENS: z.coerce.number().int().min(512).max(32768),
  DATABASE_URL: localDatabaseUrl,
  OMNIVOICE_PYTHON: configuredPath,
  OMNIVOICE_MODEL_PATH: configuredPath,
  VOICE_PRESET_ID: z.string().trim().optional().default(''),
  STT_PYTHON: configuredPath,
  STT_MODEL_PATH: configuredPath,
  STT_DEVICE: z.literal('cpu'),
  STT_COMPUTE_TYPE: z.literal('int8'),
  STT_LANGUAGE: z.literal('ko'),
}).strict().refine(value => !(value.LOCAL_ONLY && value.ALLOW_PAID_PROVIDERS), 'Paid Jev requires LOCAL_ONLY=false');

export type LocalConfig = z.output<typeof configSchema>;

export function parseConfig(environment: NodeJS.ProcessEnv): LocalConfig {
  return configSchema.parse({
    LOCAL_ONLY: environment.LOCAL_ONLY ?? 'true',
    ALLOW_PAID_PROVIDERS: environment.ALLOW_PAID_PROVIDERS ?? 'false',
    OLLAMA_BASE_URL: environment.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434',
    APPRAISAL_MODEL: environment.APPRAISAL_MODEL ?? 'jev-1.13.0',
    TYPESAFE_API_KEY: environment.TYPESAFE_API_KEY ?? '',
    DIALOGUE_MODEL: environment.DIALOGUE_MODEL ?? 'qwen2.5:7b',
    OLLAMA_CONTEXT_TOKENS: environment.OLLAMA_CONTEXT_TOKENS ?? '4096',
    DATABASE_URL: environment.DATABASE_URL,
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
