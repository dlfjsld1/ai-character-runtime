import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

// Run through scripts/e2e.ts: the fixture server answers the situation for "합격" and delays the reply 7 s.
test.skip(!process.env.TEST_FIRST_REACTION||!(Number(process.env.TEST_DIALOGUE_DELAY_MS)>4000),'needs TEST_FIRST_REACTION and a delayed reply');
const artifactRoot=resolve(process.env.TEST_ARTIFACT_ROOT||'runtime-data');
test('a first reaction appears within about a second, then the reply replaces it',async({page,context})=>{
  const setup=JSON.parse(await readFile(resolve(artifactRoot,'test-pairing.json'),'utf8'));expect(setup.fixture).toBe(true);
  await page.goto('/studio');await page.getByLabel('일회용 연결 코드').fill(setup.code);await page.getByRole('button',{name:'연결',exact:true}).click();
  await page.getByRole('button',{name:'새 만남 시작'}).click();
  const popup=context.waitForEvent('page');await page.getByRole('button',{name:'Stage 열기'}).click();const stage=await popup;await stage.waitForLoadState();
  await expect(page.getByRole('button',{name:'출력 선택'})).toBeEnabled({timeout:15000});await page.getByRole('button',{name:'출력 선택'}).click();
  await expect(stage.locator('.stage-status')).toContainText('자막 출력 중',{timeout:15000});
  const lines=JSON.parse(await readFile('packages/database/data/first-reactions-v1.json','utf8')).firstReactions.good_news.map((l:any)=>l.text);
  await page.getByLabel('할 말').fill('나 시험 합격했어!');const sent=Date.now();await page.getByRole('button',{name:'입력 보내기'}).click();
  const reaction=stage.locator('.caption.reaction');await expect(reaction).toBeVisible({timeout:4000});
  const shownAfter=Date.now()-sent;expect(lines).toContain((await reaction.innerText()).trim());
  await stage.screenshot({path:resolve(artifactRoot,'playwright-results/stage-first-reaction.png')});
  // No thinking cue after a reaction; the reply replaces it.
  await expect(stage.locator('.caption.thinking')).toHaveCount(0);
  await expect(stage.locator('.caption:not(.reaction):not(.thinking)')).not.toHaveText('',{timeout:15000});
  console.log(JSON.stringify({reactionShownAfterMs:shownAfter}));
});
