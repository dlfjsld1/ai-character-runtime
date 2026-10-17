import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {testDatabase} from '../helpers.ts';

const artifactRoot=resolve(process.env.TEST_ARTIFACT_ROOT||'runtime-data');
test('H1 synthetic: selected file → explicit search → Stage citation; replacement, scoped UI and deletion stay coherent',async({page,context})=>{
 test.setTimeout(60000);
 const setup=JSON.parse(await readFile(resolve(artifactRoot,'test-pairing.json'),'utf8'));expect(setup.fixture).toBe(true);
 await page.goto('/studio');await page.getByLabel('일회용 연결 코드').fill(setup.code);await page.getByRole('button',{name:'연결',exact:true}).click();
 await expect(page.getByRole('heading',{name:'캐릭터 작업실'})).toBeVisible();await page.getByRole('button',{name:'새 만남 시작'}).click();
 await expect(page.getByLabel('대화 상대')).toHaveValue(/^[0-9a-f-]{36}$/);const originalIdentity=await page.getByLabel('대화 상대').inputValue();
 const name='합성 필터 설명서.md',original='오로라 미니 헤파 필터는 6개월마다 교체한다.',changed='오로라 미니 헤파 필터는 12개월마다 교체한다.';
 await page.getByLabel('가져올 자료 파일').setInputFiles({name,mimeType:'text/markdown',buffer:Buffer.from(original)});
 await expect(page.locator('.knowledge-documents')).toContainText(name);await expect(page.locator('.knowledge-documents')).toContainText('문서 버전 1');
 const popup=context.waitForEvent('page');await page.getByRole('button',{name:'Stage 열기'}).click();const stage=await popup;
 await expect(page.getByRole('button',{name:'출력 선택'})).toBeEnabled();await page.getByRole('button',{name:'출력 선택'}).click();
 await page.getByLabel('입력 종류').selectOption('knowledge');await page.getByLabel('할 말').fill('오로라 미니 헤파 필터 교체 주기는?');await page.getByRole('button',{name:'입력 보내기'}).click();
 await expect(stage.locator('.caption')).toContainText('6개월');await expect(stage.getByRole('list',{name:'답변 출처'})).toContainText(original);await expect(stage.getByRole('list',{name:'답변 출처'})).toContainText('문서 버전 1');
 await stage.screenshot({path:resolve(artifactRoot,'playwright-results/knowledge-stage.png'),fullPage:true});
 await expect(page.getByRole('article',{name:'최근 자료 답변'})).toContainText('6개월');
 const db=await testDatabase();try{
  await expect.poll(async()=> (await db.pool.query("SELECT status FROM response_runs WHERE plan->>'purpose'='knowledge_answer' ORDER BY created_at DESC LIMIT 1")).rows[0]?.status).toBe('completed');
  await expect(stage.getByRole('list',{name:'답변 출처'})).toHaveCount(0);
  const options=await page.getByLabel('대화 상대').locator('option').evaluateAll(nodes=>nodes.map(n=>(n as HTMLOptionElement).value));
  const otherIdentity=options.find(id=>id!==originalIdentity)!;expect(otherIdentity).toBeTruthy();await page.getByLabel('대화 상대').selectOption(otherIdentity);await expect(page.getByLabel('대화 상대')).toHaveValue(otherIdentity);
  await expect(page.locator('.knowledge-documents')).not.toContainText(name);await expect(page.getByRole('article',{name:'최근 자료 답변'})).toHaveCount(0);
  await page.getByLabel('대화 상대').selectOption(originalIdentity);await expect(page.locator('.knowledge-documents')).toContainText(name);
  const choose=page.waitForEvent('filechooser');await page.getByRole('button',{name:'자료 교체'}).click();await (await choose).setFiles({name,mimeType:'text/markdown',buffer:Buffer.from(changed)});
  await expect(page.locator('.knowledge-documents')).toContainText('문서 버전 2');await expect(page.getByRole('article',{name:'최근 자료 답변'})).toHaveCount(0);
  await page.getByLabel('할 말').fill('오로라 미니 헤파 필터 교체 주기는?');await page.getByRole('button',{name:'입력 보내기'}).click();await expect(stage.locator('.caption')).toContainText('12개월');await expect(stage.getByRole('list',{name:'답변 출처'})).toContainText('문서 버전 2');
  await page.getByRole('button',{name:'자료 삭제'}).click();await expect(page.locator('.knowledge-documents')).not.toContainText(name);await expect(stage.locator('.caption')).toHaveText('');await expect(stage.getByRole('list',{name:'답변 출처'})).toHaveCount(0);
  await expect(page.getByRole('article',{name:'최근 자료 답변'})).toHaveCount(0);await expect(page.getByRole('button',{name:'입력 보내기'})).toBeDisabled();
  await page.getByLabel('할 말').fill('오로라 미니 헤파 필터 교체 주기는?');await page.getByRole('button',{name:'입력 보내기'}).click();
  await expect(stage.locator('.caption')).toContainText('확인');await expect(stage.getByRole('list',{name:'답변 출처'})).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:resolve(artifactRoot,'playwright-results/knowledge-studio-mobile.png'),fullPage:true});
 }finally{await page.getByRole('button',{name:'만남 종료'}).click();await db.close();}
});
