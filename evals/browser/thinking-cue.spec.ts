import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {THINKING_CUES_V1} from '../../packages/database/src/seed.ts';

// Run with TEST_DIALOGUE_DELAY_MS=7000 so the fixture reply starts after the 4 s mark.
test.skip(!(Number(process.env.TEST_DIALOGUE_DELAY_MS)>4000),'needs TEST_DIALOGUE_DELAY_MS above 4000');
const artifactRoot=resolve(process.env.TEST_ARTIFACT_ROOT||'runtime-data');
test('a slow reply shows a thinking cue on Stage at about 4 s, then the reply replaces it',async({page,context})=>{
  const setup=JSON.parse(await readFile(resolve(artifactRoot,'test-pairing.json'),'utf8'));expect(setup.fixture).toBe(true);
  await page.goto('/studio');await page.getByLabel('일회용 연결 코드').fill(setup.code);await page.getByRole('button',{name:'연결',exact:true}).click();
  await page.getByRole('button',{name:'새 만남 시작'}).click();
  const popup=context.waitForEvent('page');await page.getByRole('button',{name:'Stage 열기'}).click();const stage=await popup;await stage.waitForLoadState();
  await expect(page.getByRole('button',{name:'출력 선택'})).toBeEnabled({timeout:15000});await page.getByRole('button',{name:'출력 선택'}).click();
  await expect(stage.locator('.stage-status')).toContainText('자막 출력 중',{timeout:15000});
  const caption=stage.locator('.caption');
  await page.getByLabel('할 말').fill('이 상자 여는 법 알려 줘.');const sent=Date.now();await page.getByRole('button',{name:'입력 보내기'}).click();
  // Nothing before the 4 s mark.
  await stage.waitForTimeout(2500);expect((await caption.innerText()).trim()).toBe('');
  await expect.poll(async()=>(await caption.innerText()).trim(),{timeout:6000}).toMatch(new RegExp(`^(${THINKING_CUES_V1.map(c=>c.replace('.','\\.')).join('|')})$`));
  const shownAfter=Date.now()-sent;expect(shownAfter).toBeGreaterThanOrEqual(3500);
  await stage.screenshot({path:resolve(artifactRoot,'playwright-results/stage-thinking-cue.png')});
  // The real reply replaces the cue.
  await expect.poll(async()=>{const t=(await caption.innerText()).trim();return !!t&&!(THINKING_CUES_V1 as readonly string[]).includes(t);},{timeout:15000}).toBe(true);
});
