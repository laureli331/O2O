'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
async function main(){
 const [url,outDir,browserPath]=process.argv.slice(2),{chromium}=require(process.env.PREVIEW_PLAYWRIGHT_PATH);
 fs.mkdirSync(outDir,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:browserPath});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);
  for(const width of [320,375,414]){
   await page.setViewportSize({width,height:1000});
   for(const [scenario,label] of [['pending','完善接单资格'],['ready','已通过核验'],['phone','完善接单资格'],['unknown','查询核验进展'],['under16','查看资格说明'],['teen','查看资格说明'],['changing','身份资料核对']]){
    await page.locator('#scenario').selectOption(scenario);
    const entry=page.locator('#qualification-entry');assert((await entry.textContent()).includes(label));
    assert.equal(await page.locator('.account-states .login-status').textContent(),'微信已登录');
    assert.equal(await page.locator('.account-states button').count(),1);
    assert(await entry.evaluate(el=>{const r=el.getBoundingClientRect(),style=getComputedStyle(el);return r.height>=44&&parseFloat(style.fontSize)===12&&parseFloat(style.borderTopWidth)===0&&style.backgroundColor==='rgba(0, 0, 0, 0)';}));
    assert(await page.locator('.account-states').evaluate(el=>{const a=el.querySelector('.login-status'),b=el.querySelector('.qualification'),x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return x.top<y.bottom&&y.top<x.bottom;}),'status and action stay on the same row');
    assert.equal(await entry.locator('svg').count(),0);assert.equal(await page.locator('.account-separator').textContent(),'·');assert(await entry.evaluate(el=>{const left=getComputedStyle(document.querySelector('.login-status')),right=getComputedStyle(el);return ['fontFamily','fontSize','fontWeight','fontStyle','letterSpacing','lineHeight','color'].every(key=>left[key]===right[key]);}),'qualification typography matches login status');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(scenario==='pending'){await entry.scrollIntoViewIfNeeded();const box=await entry.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForFunction(()=>getComputedStyle(document.querySelector('#qualification-entry')).backgroundColor==='rgb(237, 242, 232)');await page.mouse.up();}
    await entry.click();
    const selectors={pending:'#verify-identity',ready:'#continue-operation',phone:'#verify-phone',unknown:'#query-identity',under16:'#verify-identity',teen:'#verify-identity',changing:'[data-open="identity-help"]'};
    assert(await page.locator('#detail-phone').locator(selectors[scenario]).isVisible(),scenario+' goes directly to its correct step');
    if(['under16','teen'].includes(scenario))assert(!(await page.locator('#verify-identity').isEnabled()));
    if(scenario==='pending'){
     await page.locator('#my-scroll').evaluate(el=>el.scrollTop=0);
     await page.locator('#my-phone').screenshot({path:path.join(outDir,'account-pending-'+width+'.png')});
     const rect=await page.locator('#detail-phone').boundingBox();assert(rect.y<1000,'mobile action reveals the destination');
    }
   }
   await page.locator('#scenario').selectOption('guest');assert.equal(await page.locator('#qualification-entry').count(),0);
   assert((await page.locator('#account-login').textContent()).includes('微信登录'));
   assert(await page.locator('#account-login').evaluate(el=>el.getBoundingClientRect().height>=44));
   await page.locator('#account-login').click();assert(await page.locator('#login-button').isVisible());
  }
  await page.locator('#scenario').selectOption('pending');await page.locator('#my-phone [data-open="settings"]').click();
  await page.locator('#detail-phone [data-open="B"]').click();assert(await page.locator('#continue-operation').isDisabled());
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks:['status is not a hidden button','clear action labels across seven qualification states','44px transparent targets and matching 12px status typography','no qualification icon or visible border','light green pressed feedback and unified status color','320/375/414px one-row layout','direct correct step and visible destination','guest login and settings management','no browser errors']}));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
