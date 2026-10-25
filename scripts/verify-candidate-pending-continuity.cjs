'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
async function main(){
 const [base,out,executablePath]=process.argv.slice(2),{chromium}=require(process.env.PREVIEW_PLAYWRIGHT_PATH);
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{for(const width of [320,375,414,1280]){
 await page.setViewportSize({width,height:1000});await page.goto(base+'/v03.html');
 await page.locator('#scenario').selectOption('unknown');await page.locator('input[name=candidate][value=b]').check();await page.locator('#open-confirm').click();await page.locator('#confirm-selection').click();await page.keyboard.press('Escape');
 await page.locator('#scenario').selectOption('normal');assert.equal(await page.locator('#scenario').inputValue(),'unknown','scenario must retain the pending operation');assert(await page.locator('#result-modal').isVisible());await page.keyboard.press('Escape');
 await page.locator('[data-business=repair]').click();assert.equal(await page.locator('[data-business=errands]').getAttribute('aria-pressed'),'true');assert(await page.locator('#result-modal').isVisible());await page.keyboard.press('Escape');
 await page.locator('[data-profile=b]').click();assert(page.url().endsWith('/v03.html'));assert(await page.locator('#result-modal').isVisible());await page.keyboard.press('Escape');
 for(const id of ['note','amount','advance-limit','accept-time','accept-rules'])assert(await page.locator('#'+id).isDisabled(),id+' locked while pending');
 assert((await page.locator('#application-status').textContent()).includes('正在确认'));
 await page.evaluate(()=>{document.querySelector('input[name=candidate][value=c]').dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('application-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));document.getElementById('withdraw').dispatchEvent(new MouseEvent('click',{bubbles:true}));document.getElementById('confirm-selection').dispatchEvent(new MouseEvent('click',{bubbles:true}));});
 assert.equal(await page.locator('.candidate').count(),3);assert(await page.locator('input[name=candidate][value=b]').isChecked());assert((await page.locator('#selection-caption').textContent()).includes('先查询'));
 await page.locator('#open-confirm').click();assert((await page.locator('#result-title').textContent()).includes('已选定'));await page.keyboard.press('Escape');assert((await page.locator('#application-status').textContent()).includes('其他接单员'));assert(await page.locator('#open-confirm').isDisabled());assert(await page.locator('#note').isDisabled());
 await page.locator('#scenario').selectOption('normal');assert(await page.locator('#note').isEnabled());await page.locator('input[name=candidate][value=a]').check();await page.locator('#open-confirm').click();await page.locator('#confirm-selection').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#application-status').textContent(),'发布者已选定你。');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'chosen-'+width+'.png'),fullPage:true});
 }assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,widths:[320,375,414,1280],checks:['pending context retained','query original candidate','form and event guards','accurate applicant outcome','reset unlocks','no overflow or browser errors']},null,2));console.log('Candidate pending continuity passed');}finally{await browser.close();}
}main().catch(e=>{console.error(e);process.exitCode=1;});
