// Explicit synthetic inputs with the installed real provider; never resets a DB.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { chromium, expect, type Page } from '@playwright/test';
import { loadLocalEnv } from '../scripts/env.ts';
import { Database } from '../packages/database/src/connection.ts';
import { Store } from '../packages/database/src/store.ts';
import { CHARACTER_ID } from '../packages/database/src/seed.ts';
import { OllamaProvider, PythonTokenCounter } from '../packages/adapters/src/ollama.ts';
import { createServer } from '../apps/runtime/src/http/server.ts';
import { approvedSyntheticJev } from './jev-api.ts';
import type { AppraisalProvider } from '../packages/adapters/src/appraisal.ts';

if (!process.argv.includes('--synthetic-inputs')) throw new Error('explicit_synthetic_inputs_required');
const envIndex = process.argv.indexOf('--validation-env');
if (envIndex >= 0) process.loadEnvFile(process.argv[envIndex + 1]);
loadLocalEnv();
const localBaseline=process.argv.includes('--local-baseline');
if(localBaseline&&process.argv.includes('--allow-jev-api'))throw new Error('conflicting_appraisal_modes');
const jev=localBaseline?null:approvedSyntheticJev();
const url = process.env.VALIDATION_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
if (!url || !['/character_runtime_validation', '/character_runtime_test'].includes(new URL(url).pathname)) {
  throw new Error('dedicated_synthetic_database_required');
}
const directory = resolve('runtime-data/stage-validation-20261004', new Date().toISOString().replace(/[:.]/g, '-'));
await mkdir(directory, { recursive: true });
const db = new Database(url), store = new Store(db);
const calls: Record<string, unknown>[] = [], packets: Record<string, unknown>[] = [];
const record: Record<string, any> = {
  syntheticInputs: true, syntheticProvider: false, personalDataUsed: false,
  database: new URL(url).pathname.slice(1), model: 'qwen2.5:7b',
  appraisalProvider: localBaseline?'ollama-local-baseline':'jev', appraisalPromptVersion: localBaseline?'appraisal-v2':'jev-appraisal-v1', performanceGate: 'UNFROZEN', calls, packets, meetings: [],
};
record.sourceHashes=Object.fromEntries(await Promise.all(['packages/adapters/src/jev.ts','apps/runtime/src/coordinator/index.ts','packages/database/src/store.ts','packages/character-core/src/index.ts','apps/studio/src/main.tsx'].map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])));
record.jevCallsMax=localBaseline?0:2;
record.approvedBudgetUsd=jev?.budget??null;
const provider = new OllamaProvider('qwen2.5:7b', new PythonTokenCounter(
  process.env.TOKENIZER_PYTHON ?? '', process.env.QWEN_TOKENIZER_PATH ?? '',
), undefined, fetch, { onCall: metadata => { calls.push(metadata); console.log(JSON.stringify({ call: metadata })); } });
const appraiser:AppraisalProvider=jev?.provider??{name:provider.name,model:provider.model,promptVersion:provider.appraisalPromptVersion,readiness:()=>({status:'configured',inferenceVerified:false,errorCode:null}),evaluate:async(event,context)=>({appraisal:await provider.appraise(event,context),metadata:{provider:provider.name,model:provider.model,promptVersion:provider.appraisalPromptVersion}})};
let runtime: Awaited<ReturnType<typeof createServer>> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let page: Page | undefined, stage: Page | undefined;
let sessionId: string | undefined;
const save = () => writeFile(resolve(directory, 'results.json'), JSON.stringify(record, (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2));

async function completed(id: string) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const rows = (await db.pool.query('SELECT id,status,cancel_reason,plan FROM response_runs WHERE session_id=$1 ORDER BY created_at DESC', [id])).rows;
    if (rows[0]?.status === 'completed') return rows[0];
    if (['failed', 'cancelled', 'interrupted'].includes(rows[0]?.status)) throw new Error(`response_${rows[0].cancel_reason}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('caption_completion_timeout');
}

try {
  const actual = (await db.pool.query('SELECT current_database() AS db')).rows[0].db;
  if (actual !== record.database) throw new Error('database_mismatch');
  if (!(await db.pool.query('SELECT 1 FROM characters WHERE id=$1', [CHARACTER_ID])).rowCount) throw new Error('existing_seed_required');
  await db.own(CHARACTER_ID, () => { void runtime?.app.close(); });
  // Apply the normal restart recovery only inside the dedicated synthetic DB.
  record.previousSession = (await store.currentSession())?.id ?? null;
  await store.recover();
  runtime = await createServer(store, provider, appraiser);
  if (provider.readiness().status !== 'ready') throw new Error(`model_${provider.readiness().preparationError}`);
  await runtime.app.listen({ host: '127.0.0.1', port: 3001 });
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  page = await context.newPage();
  page.on('pageerror', error => { (record.browserErrors ??= []).push(error.message); });
  await page.goto('http://127.0.0.1:3001/studio');
  await page.getByLabel('일회용 연결 코드').fill(runtime.studioCode);
  await page.getByRole('button', { name: '연결', exact: true }).click();
  await expect(page.getByRole('heading', { name: '캐릭터 작업실' })).toBeVisible();
  const inputs = ['잘했어. 네 풀이가 정말 좋았어.', '안녕. 다시 만났네.'];
  for (const [index, input] of inputs.entries()) {
    if(jev&&Number(record.estimatedCostUsd??0)>=jev.budget)throw new Error('jev_cost_budget_exhausted');
    await page.getByRole('button', { name: '새 만남 시작' }).click();
    await expect(page.getByRole('button', { name: '만남 종료' })).toBeVisible();
    sessionId = (await store.currentSession())!.id;
    if (!stage) {
      const popup = context.waitForEvent('page');
      await page.getByRole('button', { name: 'Stage 열기' }).click();
      stage = await popup;
      stage.on('pageerror', error => { (record.browserErrors ??= []).push(error.message); });
      stage.on('websocket', socket => {
        socket.on('framereceived', frame => {
          const packet = JSON.parse(String(frame.payload));
          if (['output.granted', 'response.start', 'speech.segment', 'response.cancel', 'command.result'].includes(packet.type)) {
            packets.push({ sessionId: packet.sessionId, type: packet.type, payload: packet.payload });
          }
        });
      });
      await stage.waitForLoadState();
    }
    await expect(page.getByRole('button', { name: '출력 선택' })).toBeEnabled();
    await page.getByRole('button', { name: '출력 선택' }).click();
    await expect(stage.locator('.stage-status')).toContainText('자막 출력 중');
    const start = performance.now();
    await page.getByLabel('할 말').fill(input);
    await page.getByRole('button', { name: '입력 보내기' }).click();
    await expect(page.getByLabel('할 말')).toHaveValue('');
    await expect(stage.locator('.caption')).not.toHaveText('', { timeout: 45000 });
    const caption = await stage.locator('.caption').innerText();
    const captionMs = Math.round(performance.now() - start);
    await stage.screenshot({ path: resolve(directory, `stage-${index + 1}.png`) });
    const response = await completed(sessionId!);
    const segments = (await db.pool.query('SELECT text,delivery_status,text_shown_at FROM speech_segments WHERE response_id=$1 ORDER BY segment_index', [response.id])).rows;
    const acknowledgements = (await db.pool.query("SELECT kind,payload FROM events WHERE session_id=$1 AND kind IN ('caption.shown','caption.finished') ORDER BY received_at", [sessionId])).rows;
    const appraisal = (await db.pool.query('SELECT result,provider,model,prompt_version,status,failure_code,provider_result,usage,latency_ms FROM appraisals WHERE event_id IN (SELECT id FROM events WHERE session_id=$1) ORDER BY created_at DESC LIMIT 1', [sessionId])).rows[0];
    expect(appraisal.provider).toBe(appraiser.name);
    expect(appraisal.prompt_version).toBe(appraiser.promptVersion);
    if(jev){record.inputTokens=Number(record.inputTokens??0)+appraisal.usage.input_tokens;record.estimatedCostUsd=record.inputTokens*0.042/1e6;record.accountBillingVerified=false;}
    expect(appraisal.failure_code).toBeNull();
    expect(segments.length).toBeGreaterThan(0);
    expect(acknowledgements.filter(a => a.kind === 'caption.shown')).toHaveLength(segments.length);
    expect(acknowledgements.filter(a => a.kind === 'caption.finished')).toHaveLength(segments.length);
    expect(segments.every(s => s.text_shown_at && s.delivery_status === 'finished')).toBe(true);
    record.meetings.push({ sessionId, input, caption, captionMs, response, segments, appraisal, acknowledgements });
    console.log(JSON.stringify({ meeting: index + 1, caption, captionMs, status: response.status }));
    await page.getByRole('button', { name: '만남 종료' }).click();
    await expect(page.getByRole('button', { name: '새 만남 시작' })).toBeVisible();
    sessionId = undefined;
    await save();
  }
  await page.screenshot({ path: resolve(directory, 'studio.png'), fullPage: true });
  expect(record.browserErrors ?? []).toEqual([]);
  record.status = 'PASS';
} catch (error) {
  record.status = 'FAIL'; record.failure = String(error); process.exitCode = 1;
  if (sessionId) {
    record.responses = (await db.pool.query('SELECT id,status,cancel_reason,plan FROM response_runs WHERE session_id=$1', [sessionId])).rows;
    record.appraisals = (await db.pool.query('SELECT result,prompt_version,failure_code FROM appraisals WHERE event_id IN (SELECT id FROM events WHERE session_id=$1)', [sessionId])).rows;
  }
  await stage?.screenshot({ path: resolve(directory, 'stage-failed.png') }).catch(() => {});
  await page?.screenshot({ path: resolve(directory, 'studio-failed.png'), fullPage: true }).catch(() => {});
} finally {
  if (sessionId && runtime) {
    await runtime.coordinator.cancelAll(sessionId, 'validation_cleanup');
    await store.stopSession(sessionId, crypto.randomUUID());
  }
  await browser?.close(); await runtime?.app.close(); await db.close();
  await provider.unloadOwnedModel().catch(error => { record.unloadError = String(error); });
  await save();
  console.log(JSON.stringify({ status: record.status, failure: record.failure, evidence: directory }));
}
