'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
async function main(){
 const [base,out,executablePath]=process.argv.slice(2),{chromium}=require(process.env.PREVIEW_PLAYWRIGHT_PATH);fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath}),page=await browser.newPage(),reference=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const measure=()=>{const home=document.getElementById('home-phone'),origin=home.getBoundingClientRect(),result={};for(const s of ['.topbar','.search','.banner','.categories','.filterline','.tabbar']){const e=home.querySelector(s),r=e.getBoundingClientRect();result[s]=[r.x-origin.x,r.y-origin.y,r.width,r.height];}return result;};
 try{for(const width of [320,375,414]){
  await page.setViewportSize({width,height:1050});await page.goto(new URL('v11.html',base).href);await page.evaluate(()=>sessionStorage.clear());await page.reload();await page.locator('#scenario').selectOption('draft');
  const act=a=>page.locator('[data-action="'+a+'"]');await act('edit').click();await page.locator('#f-title').fill('本店周末好物');await page.locator('#f-phone').fill('000-1234');await page.locator('#public-phone').uncheck();
  const source=await page.locator('.banner-cover').getAttribute('src');await act('preview').click();await page.locator('.home-preview-frame[data-ready=true]').waitFor();const frame=page.frameLocator('.home-preview-frame');
  assert.equal(await frame.locator('.home-preview-ad img').getAttribute('src'),source);assert.equal(await page.locator('#preview-ad-details').getAttribute('open'),null);
  assert.equal(await frame.locator('.home-preview-skeleton .listing').count(),4);assert.deepEqual(await frame.locator('#categories .chip').allTextContents(),['全部','维修','跑腿','闲置','其它']);
  assert(await frame.locator('#search-form').evaluate(e=>e.inert));assert(await frame.locator('#sticky-filters').evaluate(e=>e.inert));assert(await frame.locator('.tabbar').evaluate(e=>e.inert));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await frame.locator('#home-phone').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  const nativeWidth=await page.locator('.home-preview-frame').evaluate(e=>e.clientWidth);assert.equal(nativeWidth,Math.min(390,await page.locator('#content').evaluate(e=>e.clientWidth)));await reference.setViewportSize({width:nativeWidth+24,height:1050});await reference.goto(new URL('v01-v02.html',base).href);
  const actual=await frame.locator('body').evaluate(measure),expected=await reference.evaluate(measure);for(const selector of Object.keys(expected))actual[selector].forEach((value,i)=>assert(Math.abs(value-expected[selector][i])<1.1,selector+' geometry '+i+': '+value+' vs '+expected[selector][i]));
  await frame.locator('#home-scroll').evaluate(e=>e.scrollTop=120);assert(await frame.locator('#home-scroll').evaluate(e=>e.scrollTop>0));await frame.locator('#home-scroll').evaluate(e=>e.scrollTop=0);
  await page.screenshot({path:path.join(out,'home-'+width+'.png'),fullPage:true});await frame.locator('.home-preview-ad').click();assert(await page.locator('#preview-ad-details').evaluate(e=>e.open));
  assert((await page.locator('#preview-ad-details').textContent()).includes('本店周末好物'));assert(!(await page.locator('#preview-ad-details').textContent()).includes('000-1234'));
  await page.locator('#preview-ad-details summary').press('Enter');assert(!(await page.locator('#preview-ad-details').evaluate(e=>e.open)));await act('edit').click();assert.equal(await page.locator('#f-title').inputValue(),'本店周末好物');
  await page.locator('#public-phone').check();await act('preview').click();await page.locator('.home-preview-frame[data-ready=true]').waitFor();await frame.locator('.home-preview-ad').focus();await frame.locator('.home-preview-ad').press('Enter');assert((await page.locator('#preview-ad-details').textContent()).includes('000-1234'));await act('submit').click();assert.equal(await page.locator('#scenario').inputValue(),'pending');
 }
 assert.deepEqual(errors,[]);console.log('PASS native V01 layout geometry, scroll, keyboard detail, privacy and submission at 320/375/414px');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
