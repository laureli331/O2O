'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
async function main(){
 const [base,out,executablePath]=process.argv.slice(2),{chromium}=require(process.env.PREVIEW_PLAYWRIGHT_PATH);
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath});const p=await browser.newPage();
 const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 const act=name=>p.locator('[data-action="'+name+'"]');
 const dirty=()=>p.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});dispatchEvent(e);return e.defaultPrevented;});
 try{for(const width of [320,375,414,1280]){for(const mode of ['create','edit','respond']){
  await p.setViewportSize({width,height:1000});await p.goto(base+'/v18.html');await p.evaluate(()=>sessionStorage.clear());
  await p.goto(base+'/v18.html'+(mode==='create'?'?source=S-NEW':mode==='edit'?'?record=MY-1':'?respond=IN-1'));
  if(mode==='edit')await act('edit').click();
  if(mode==='create')for(const dimension of ['attitude','efficiency','communication'])await p.locator('.star-option:has(input[name="'+dimension+'"][value="4"])').click();
  const text='查询失败后仍未提交的'+mode;await p.locator('#review-text').fill(text);
  await p.locator('#result').selectOption('unknown');await act('submit').click();if(mode==='edit')await p.locator('#discard').click();
  assert((await p.locator('#content').textContent()).includes('确认是否提交'));
  if(width===375)await p.reload();
  await p.locator('#result').selectOption('failed');await act('query').click();assert.equal(await p.locator('#review-text').inputValue(),text);assert(!(await p.locator('#review-error').textContent()).includes('图片'));if(mode==='respond')assert(!(await p.locator('#review-error').textContent()).includes('评分'));
  assert(await dirty(),'failed '+mode+' must still be treated as unsubmitted');
  const counts=await p.evaluate(()=>{const state=ReviewsUI.load();return {created:state.reviews.filter(r=>r.source==='S-NEW'&&r.author===ReviewsModel.ME).length,modified:ReviewsModel.item(state,'MY-1').modified,response:ReviewsModel.item(state,'IN-1').response};});assert.equal(counts.created,0);assert.equal(counts.modified,0);assert.equal(counts.response,null);
  await p.locator('#back').click();assert(await p.locator('#dialog').isVisible());assert.equal(await p.locator('#stay').textContent(),'继续填写');
  await p.locator('#stay').click();assert.equal(await p.locator('#review-text').inputValue(),text);
  await p.locator('#scenario').selectOption('empty');await p.keyboard.press('Escape');assert.equal(await p.locator('#review-text').inputValue(),text);assert.equal(await p.locator('#scenario').inputValue(),'normal');
  if(mode==='create')assert.equal(await p.locator('input[type=radio]:checked').count(),3);
  if(width===375)await p.screenshot({path:path.join(out,mode+'-375.png'),fullPage:true});
  if(width===375){await p.locator('#result').selectOption('success');await act('submit').click();if(mode==='edit')await p.locator('#discard').click();assert((await p.locator('#content').textContent()).includes('提交已记录'));assert(!(await dirty()));const result=await p.evaluate(()=>{const state=ReviewsUI.load();return {created:state.reviews.filter(r=>r.source==='S-NEW'&&r.author===ReviewsModel.ME).length,modified:ReviewsModel.item(state,'MY-1').modified,response:ReviewsModel.item(state,'IN-1').response};});if(mode==='create')assert.equal(result.created,1);if(mode==='edit')assert.equal(result.modified,1);if(mode==='respond')assert.equal(result.response.status,'pending');}else{await p.locator('#back').click();await p.locator('#discard').click();assert(!(await dirty()));assert.equal(await p.locator('#title').textContent(),'我的评价');}
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }}assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,widths:[320,375,414,1280],modes:['create','edit','respond'],checks:['unknown then failed retains dirty state','reload pending request','cancel keeps scores and text','scenario cancellation','explicit discard']},null,2));console.log('PASS review failed query protection');
 }finally{await browser.close();}
}main().catch(e=>{console.error(e);process.exitCode=1;});
