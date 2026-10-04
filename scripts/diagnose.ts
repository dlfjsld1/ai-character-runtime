import { existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import { loadLocalEnv } from './env.ts';
import { parseConfig } from '../packages/contracts/src/local-config.ts';

type Check = { status: string; detail?: string };

loadLocalEnv();

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function countTtsSnapshotCandidates(): Promise<number> {
  const snapshots = 'D:/AI_Cache/hub/models--k2-fsa--OmniVoice/snapshots';
  try {
    const entries = await readdir(snapshots, { withFileTypes: true });
    const checks = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
      const root = join(snapshots, entry.name);
      return (await isFile(join(root, 'config.json')))
        && (await isFile(join(root, 'tokenizer_config.json')))
        && (await isDirectory(join(root, 'audio_tokenizer')));
    }));
    return checks.filter(Boolean).length;
  } catch {
    return 0;
  }
}

async function checkDatabase(databaseUrl: string): Promise<Check> {
  if (!databaseUrl) return { status: 'not_configured' };
  const url = new URL(databaseUrl);
  const port = Number(url.port || '5432');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { status: 'invalid_configuration', detail: 'Invalid local PostgreSQL port' };
  }

  return new Promise((resolve) => {
    const socket = createConnection({ host: url.hostname, port });
    let settled = false;
    function finish(check: Check) {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(check);
    }
    socket.setTimeout(1500);
    socket.once('connect', () => finish({ status: 'reachable', detail: 'TCP only; credentials and schema not checked' }));
    socket.once('timeout', () => finish({ status: 'unavailable', detail: 'Connection timed out' }));
    socket.once('error', () => finish({ status: 'unavailable', detail: 'Local PostgreSQL port is not reachable' }));
  });
}

async function checkOllama(baseUrl: string, models: string[]): Promise<Check> {
  try {
    const tagsResponse = await fetch(new URL('/api/tags', baseUrl), { signal: AbortSignal.timeout(2000), redirect: 'error' });
    if (!tagsResponse.ok) return { status: 'unavailable', detail: `Local API returned ${tagsResponse.status}` };
    const tags = await tagsResponse.json() as { models?: Array<{ name?: string }> };
    const installed = new Set((tags.models ?? []).map((model) => model.name));
    const missing = models.filter((model) => !installed.has(model));
    if (missing.length) return { status: 'model_missing', detail: missing.join(', ') };

    const runningResponse = await fetch(new URL('/api/ps', baseUrl), { signal: AbortSignal.timeout(2000), redirect: 'error' });
    if (!runningResponse.ok) return { status: 'installed', detail: 'Configured models found; load state unknown' };
    const running = await runningResponse.json() as { models?: Array<{ name?: string }> };
    const loaded = new Set((running.models ?? []).map((model) => model.name));
    return models.every((model) => loaded.has(model))
      ? { status: 'loaded', detail: 'Model presence checked; inference not run' }
      : { status: 'installed', detail: 'Configured models found; inference not run' };
  } catch {
    return { status: 'unavailable', detail: 'Local Ollama API is not reachable' };
  }
}

async function checkTts(python: string, modelPath: string, voicePresetId: string): Promise<Check> {
  if (!python || !(await isFile(python))) return { status: 'unavailable', detail: 'OmniVoice Python was not found' };
  if (!modelPath) {
    const candidates = await countTtsSnapshotCandidates();
    return { status: 'not_configured', detail: `Python found; model snapshot not selected (${candidates} metadata candidates)` };
  }
  const config = await isFile(join(modelPath, 'config.json'));
  const tokenizer = await isFile(join(modelPath, 'tokenizer_config.json'));
  const audioTokenizer = await isDirectory(join(modelPath, 'audio_tokenizer'));
  if (!config || !tokenizer || !audioTokenizer) {
    return { status: 'incomplete', detail: 'Snapshot config or audio tokenizer is missing' };
  }
  if (!voicePresetId) return { status: 'not_configured', detail: 'Model files found; voice preset not selected' };
  return { status: 'files_present', detail: 'Model loading and voice synthesis not tested' };
}

async function checkStt(python: string, modelPath: string): Promise<Check> {
  if (!python || !modelPath) return { status: 'not_configured' };
  if (!(await isFile(python))) return { status: 'unavailable', detail: 'STT Python was not found' };
  if (!(await isFile(join(modelPath, 'model.bin'))) || !(await isFile(join(modelPath, 'config.json')))) {
    return { status: 'incomplete', detail: 'CTranslate2 model files are missing' };
  }
  return { status: 'files_present', detail: 'Transcription not tested' };
}

try {
  const config = parseConfig(process.env);
  const jevError=config.LOCAL_ONLY||!config.ALLOW_PAID_PROVIDERS?'jev_paid_api_disabled':!config.TYPESAFE_API_KEY?'jev_key_missing':null;
  const checks = {
    node: { status: 'available', detail: process.version },
    database: await checkDatabase(config.DATABASE_URL),
    jev: {status:jevError?'blocked':'configured',model:config.APPRAISAL_MODEL,keyConfigured:Boolean(config.TYPESAFE_API_KEY),inferenceVerified:false,errorCode:jevError},
    ollama: await checkOllama(config.OLLAMA_BASE_URL, [config.DIALOGUE_MODEL]),
    omnivoice: await checkTts(config.OMNIVOICE_PYTHON, config.OMNIVOICE_MODEL_PATH, config.VOICE_PRESET_ID),
    stt: await checkStt(config.STT_PYTHON, config.STT_MODEL_PATH),
    studio: { status: existsSync(join(process.cwd(),'apps/studio/dist/index.html'))?'files_present':'build_missing', detail: 'Text UI; runtime connectivity checked separately' },
    stage: { status: existsSync(join(process.cwd(),'apps/studio/dist/index.html'))?'files_present':'build_missing', detail: 'Text captions only; voice/VRM blocked by P05' },
  };
  process.stdout.write(`${JSON.stringify({ diagnosticVersion: 1, checks }, null, 2)}\n`);
} catch (error) {
  const detail = error instanceof Error ? error.name : 'unknown';
  process.stderr.write(`Configuration could not be read or validated (${detail}). Check local-only flags and paths.\n`);
  process.exitCode = 1;
}
