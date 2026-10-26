'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
async function main(){
 const [base,out,executablePath]=process.argv.slice(2),{chromium}=require(process.env.PREVIEW_PLAYWRIGHT_PATH);fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath}),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{for(const width of [320,375,414]){
  await page.setViewportSize({width,height:1050});await page.goto(new URL('v11.html',base).href);await page.evaluate(()=>sessionStorage.clear());await page.reload();await page.locator('#scenario').selectOption('draft');
  const act=a=>page.locator('[data-action="'+a+'"]');await act('edit').click();await page.locator('#f-title').fill('本店周末好物');await page.locator('#f-phone').fill('000-1234');await page.locator('#public-phone').uncheck();
  const source=await page.locator('.banner-cover').getAttribute('src');await act('preview').click();
  assert.equal(await page.locator('.home-ad-open .banner-cover').getAttribute('src'),source);assert.equal(await page.locator('#preview-ad-details').getAttribute('open'),null);
  assert.equal(await page.locator('.home-sk-card').count(),2);assert.equal(await page.locator('.home-sk-categories span').count(),5);assert.deepEqual(await page.locator('.home-sk-categories span').allTextContents(),['全部','维修','跑腿','闲置','其它']);assert((await page.locator('.home-sk-filters').textContent()).includes('全部村 / 社区'));assert((await page.locator('.home-sk-filters').textContent()).includes('最新发布'));assert.equal(await page.locator('.home-sk-filters .home-sk-bar').count(),0);
  assert(await page.locator('.home-placement-preview').evaluate(e=>{const q=s=>e.querySelector(s).getBoundingClientRect().top;return q('.home-sk-search')<q('.home-ad-open')&&q('.home-ad-open')<q('.home-sk-categories')&&q('.home-sk-categories')<q('.home-sk-feed');}));
  assert.equal(await page.locator('.home-sk-context button,.home-sk-context input,.home-sk-context a').count(),0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await page.locator('#banner-phone').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  assert.equal(await page.locator('.home-ad-open .banner-cover').evaluate(e=>getComputedStyle(e).objectFit),'contain');
  await page.screenshot({path:path.join(out,'home-'+width+'.png'),fullPage:true});await act('preview-details').click();assert(await page.locator('#preview-ad-details').evaluate(e=>e.open));
  assert((await page.locator('#preview-ad-details').textContent()).includes('本店周末好物'));assert(!(await page.locator('#preview-ad-details').textContent()).includes('000-1234'));
  await page.locator('#preview-ad-details summary').press('Enter');assert(!(await page.locator('#preview-ad-details').evaluate(e=>e.open)));await act('edit').click();assert.equal(await page.locator('#f-title').inputValue(),'本店周末好物');
  await page.locator('#public-phone').check();await act('preview').click();await act('preview-details').click();assert((await page.locator('#preview-ad-details').textContent()).includes('000-1234'));await act('submit').click();assert.equal(await page.locator('#scenario').inputValue(),'pending');
 }
 assert.deepEqual(errors,[]);console.log('PASS home context preview, authorised detail disclosure, return and submission at 320/375/414px');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
