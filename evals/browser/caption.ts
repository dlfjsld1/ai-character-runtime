import {expect,type Page} from '@playwright/test';

// Capture during playback. Completion clears the caption, so an ACK alone must
// never be presented as a screenshot containing the generated text.
export async function captureStageCaption(stage:Page,path:string){
 const caption=stage.locator('.caption');
 await expect(caption).not.toHaveText('',{timeout:90000});
 const text=await caption.innerText();
 if(!text.trim())throw new Error('empty_caption_capture');
 await stage.screenshot({path});
 expect(await caption.innerText()).toBe(text);
 return text;
}
