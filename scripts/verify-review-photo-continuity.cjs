'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
async function main() {
 const [base,out,executablePath]=process.argv.slice(2),{chromium}=require(process.env.PREVIEW_PLAYWRIGHT_PATH);
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath});const p=await browser.newPage();
 const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 const png={name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlGQAAAAASUVORK5CYII=','base64')};
 const focused=selector=>p.locator(selector).evaluate(e=>e===document.activeElement);
 try{for(const width of [320,375,414,1280]){
  await p.setViewportSize({width,height:1000});await p.goto(base+'/v18.html');await p.evaluate(()=>sessionStorage.clear());await p.goto(base+'/v18.html?source=S-NEW');
  for(const k of ['attitude','efficiency','communication'])await p.locator('.star-option:has(input[name="'+k+'"][value="4"])').click();
  await p.locator('#review-text').fill('图片操作不能打断我填写的评价');
  const textarea=await p.locator('#review-text').elementHandle(),rating=await p.locator('#rating-attitude-4').elementHandle();
  await p.locator('#review-photos').scrollIntoViewIfNeeded();await p.locator('#review-photos').focus();
  const before=await p.evaluate(()=>({outer:scrollY,inner:document.getElementById('scroll').scrollTop}));
  assert(await focused('#review-photos'));const chooser=p.waitForEvent('filechooser');await p.locator('#review-photos').press('Space');await (await chooser).setFiles(png);
  assert(await textarea.evaluate(e=>e.isConnected),'adding photos must not replace the text editor');assert(await rating.evaluate(e=>e.isConnected));assert(await focused('#review-photos'));
  const after=await p.evaluate(()=>({outer:scrollY,inner:document.getElementById('scroll').scrollTop}));for(const k of Object.keys(before))assert(Math.abs(before[k]-after[k])<=2,k+' position retained');
  const first=await p.locator('.local-photo img').getAttribute('src'),input=await p.locator('#review-photos').elementHandle();
  const cancel=p.waitForEvent('filechooser');await p.locator('#review-photos').press('Space');await (await cancel).setFiles([]);
  assert(await input.evaluate(e=>e.isConnected),'cancel does not redraw');assert.equal(await p.locator('.local-photo').count(),1);
  await p.locator('#review-photos').setInputFiles({name:'too-large.png',mimeType:'image/png',buffer:Buffer.alloc(5*1024*1024+1)});
  assert.equal(await p.locator('#photo-error').textContent(),'图片超过5MB，请换一张不超过5MB的图片。');assert.equal(await p.locator('.local-photo img').getAttribute('src'),first);assert(await textarea.evaluate(e=>e.isConnected));
  if(width===375)await p.screenshot({path:path.join(out,'image-error-375.png'),fullPage:true});
  await p.locator('#review-photos').setInputFiles([{...png,name:'second.png'},{...png,name:'third.png'}]);
  assert.equal(await p.locator('.local-photo').count(),3);assert.equal(await p.locator('#review-photos').count(),0);assert(await focused('[data-remove="2"]'));assert(await p.locator('#scroll').evaluate(e=>e.scrollWidth<=e.clientWidth+1));if(width===375)await p.screenshot({path:path.join(out,'three-photos-375.png'),fullPage:true});
  await p.locator('[data-remove="1"]').click();assert(await focused('[data-remove="1"]'));
  await p.locator('[data-remove="1"]').click();assert(await focused('[data-remove="0"]'));
  await p.locator('[data-remove="0"]').click();assert(await focused('#review-photos'));
  assert(await textarea.evaluate(e=>e.isConnected));assert(await rating.evaluate(e=>e.isConnected));assert.equal(await p.locator('#review-text').inputValue(),'图片操作不能打断我填写的评价');assert.equal(await p.locator('input[type=radio]:checked').count(),3);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:path.join(out,'photos-'+width+'.png'),fullPage:true});
 }await p.goto(base+'/v18.html');await p.evaluate(()=>sessionStorage.clear());await p.goto(base+'/v18.html?source=S-NEW');await p.locator('[data-action=submit]').click();assert.equal(await p.locator('#review-error [data-error-field]').count(),3);await p.locator('#review-photos').setInputFiles(png);assert.equal(await p.locator('#review-error [data-error-field]').count(),3,'photo selection must not clear unresolved rating errors');await p.locator('.star-option:has(input[name=attitude][value="4"])').click();assert.equal(await p.locator('#review-error [data-error-field]').count(),2);assert.equal(await p.locator('.local-photo').count(),1);
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,widths:[320,375,414,1280],checks:['editor nodes retained','native keyboard file picker','cancel does not redraw','oversize retains existing photo','three-photo focus fallback','adjacent removal','scores text and position retained']},null,2));console.log('PASS review photo continuity');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
