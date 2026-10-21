'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function verify(){
 const [base,outDir,browserPath]=process.argv.slice(2),{chromium}=require(process.env.PREVIEW_PLAYWRIGHT_PATH);
 fs.mkdirSync(outDir,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:browserPath}),page=await browser.newPage({viewport:{width:375,height:1000}}),errors=[];
 page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const shot=name=>page.screenshot({path:path.join(outDir,name+'.png'),fullPage:true,animations:'disabled'});
 async function width(){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await page.evaluate(()=>[...document.querySelectorAll('.phone,.scroll')].every(e=>e.scrollWidth<=e.clientWidth+1)));}
 try{
 for(const name of ['v01-v02','v03','v04','v05','v06','v07','services'])for(const size of [320,375,414]){
  await page.setViewportSize({width:size,height:1000});await page.goto(new URL(name+'.html',base).href);
  assert(await page.evaluate(()=>[...document.styleSheets].some(s=>s.href?.endsWith('/assets/mobile-foundations.css'))));await width();
  const undersized=await page.locator('.phone button,.phone .back,.phone .tabbar a').evaluateAll(els=>els.filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.height<43.5||r.width<43.5);}).map(e=>({text:e.textContent.trim().slice(0,30),cls:e.className,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
  assert.deepEqual(undersized,[],name+' at '+size+'px');if(size===375)await shot(name+'-mobile');
 }
 await page.goto(new URL('v04.html',base).href);await page.locator('#f-title').fill('');await page.locator('#f-fee').fill('0');await page.locator('#f-pickup').fill('');await page.locator('#review-button').click();
 for(const field of ['title','fee','pickup']){assert(await page.locator('#issue-'+field).isVisible());assert.equal(await page.locator('#f-'+field).getAttribute('aria-invalid'),'true');}
 await page.locator('[data-error-field="pickup"]').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'f-pickup');assert(await page.locator('#f-pickup').evaluate(el=>{const r=el.getBoundingClientRect(),s=el.closest('.scroll').getBoundingClientRect();return r.top>=s.top&&r.bottom<=s.bottom;}));
 await page.locator('#f-pickup').fill('合成取件点');assert.equal(await page.locator('#issue-pickup').count(),0);assert.equal(await page.locator('#f-pickup').getAttribute('aria-invalid'),null);assert(await page.locator('#issue-title').isVisible());
 await shot('field-correction');await page.locator('[data-error-field="title"]').click();await page.locator('#f-title').fill('需要帮忙取快递');await page.locator('#f-fee').fill('12');assert(await page.locator('#form-errors').isHidden());
 await page.locator('[data-screen="A"]').click();await page.locator('[data-action="drafts"]').click();assert(await page.locator('.empty-illustration').isVisible());await shot('draft-empty');await page.locator('[data-action="back-form"]').click();assert(await page.locator('#f-title').isVisible());
 await page.goto(new URL('v06.html',base).href);await page.locator('.gallery-nav [data-gallery="1"]').click();assert.equal(await page.locator('.gallery-count').textContent(),'2 / 2');assert.equal(await page.locator('.gallery-nav [data-gallery="1"]').getAttribute('aria-pressed'),'true');
 for(const [state,text] of [['pending','审核中'],['rejected','重新提交'],['approved','内容已更新'],['risk-removed','内容暂不可见']]){await page.locator('[data-screen="'+state+'"]').click();const content=await page.locator('#main-content').textContent();assert(content.includes(text));assert(!/原子|版本\s*[12]|公开版本|审核版本/.test(content));assert.equal(await page.locator('#main-actions .primary').count(),1);await shot('merchant-'+state);}
 await page.locator('[data-screen="notices"]').click();assert.equal(await page.locator('.notification-item').count(),3);const top=await page.locator('#merchant-notice-tools').boundingBox();await page.locator('#main-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);assert.deepEqual(await page.locator('#merchant-notice-tools').boundingBox(),top);
 await page.locator('[data-action="notices-unread"]').click();assert.equal(await page.locator('.notification-item').count(),2);await page.locator('[data-notice-state="rejected"]').click();await page.locator('[data-screen="notices"]').click();assert.equal(await page.locator('.notification-item').count(),1);await page.locator('[data-action="clear-notices"]').click();assert.equal(await page.locator('.notification-item').count(),0);await page.locator('[data-action="notices-all"]').click();assert.equal(await page.locator('.notification-item').count(),3);assert.equal(await page.locator('#main-content .dot').count(),0);assert(await page.locator('[data-action="clear-notices"]').isDisabled());await shot('merchant-notices');
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('[data-action="notices-all"]').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');assert.deepEqual(errors,[]);
 const result={passed:true,checks:['seven HTML previews at 320/375/414','44px targets and no overflow','field-level error links and correction clearing','draft empty action','gallery real hit areas and aria state','user-facing review states without internal versions','fixed merchant notifications / filters / read without deletion','reduced motion and no browser errors']};fs.writeFileSync(path.join(outDir,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
}
verify().catch(e=>{console.error(e);process.exitCode=1;});
