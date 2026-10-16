'use strict';
// Run against the local preview server using an already installed Playwright and browser.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
async function verify(){
  const [url,outDir,browserPath]=process.argv.slice(2);
  if(!url||!outDir||!browserPath||!process.env.PREVIEW_PLAYWRIGHT_PATH)throw new Error('Provide URL, evidence directory, browser executable and PREVIEW_PLAYWRIGHT_PATH.');
  const {chromium}=require(process.env.PREVIEW_PLAYWRIGHT_PATH);
  fs.mkdirSync(outDir,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:browserPath});
  const page=await browser.newPage({viewport:{width:1280,height:1080},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
    await page.goto(url);await page.locator('[data-item]').first().waitFor();
    assert.equal(await page.locator('[data-item]').count(),8);
    await page.screenshot({path:path.join(outDir,'desktop.png'),fullPage:true});
    await page.locator('[data-category="repair"]').click();await page.locator('[data-category="errands"]').click();
    assert.equal(await page.locator('[data-item]').count(),4);
    assert.equal(await page.locator('[data-category="repair"]').getAttribute('aria-pressed'),'true');
    await page.locator('#open-region').click();await page.locator('input[name="region"][value="A"]').check();await page.locator('#apply-region').click();
    assert.equal(await page.locator('[data-item]').count(),2);
    await page.locator('#search-input').fill('洗衣机');assert.equal(await page.locator('[data-item]').count(),1);
    await page.locator('#search-input').fill('不存在的关键词');assert(await page.locator('#empty').isVisible());
    await page.locator('#reset-filters').click();assert.equal(await page.locator('[data-item]').count(),8);
    await page.locator('[data-item="chair"]').click();assert.equal(await page.locator('#detail-title').textContent(),'转让一把实木靠背椅');assert(await page.locator('#schedule-panel').isHidden());assert.equal(await page.locator('#primary-action').textContent(),'申请联系');assert((await page.locator('#privacy-note').textContent()).includes('联系申请获准后仍打码'));
    await page.locator('#favorite').click();assert.equal(await page.locator('#favorite').getAttribute('aria-pressed'),'true');
    await page.locator('#preview-switcher [data-kind="repair"]').click();await page.locator('#preview-switcher [data-kind="idle"]').click();assert.equal(await page.locator('#favorite').getAttribute('aria-pressed'),'true','favorite survives switching');
    await page.locator('#open-reviews').click();assert(await page.locator('#review-modal').isVisible());assert((await page.locator('#review-role').textContent()).includes('闲置卖方'));await page.keyboard.press('Escape');assert(await page.locator('#review-modal').isHidden());
    for(const [kind,button] of [['repair','申请接单'],['errands','去报价'],['other','申请接单']]){
      await page.locator(`#preview-switcher [data-kind="${kind}"]`).click();assert(await page.locator('#schedule-panel').isVisible());assert.equal(await page.locator('#primary-action').textContent(),button);assert((await page.locator('#published-time').textContent()).startsWith('发布时间：'));
    }
    await page.locator('#primary-action').click();assert((await page.locator('#action-message').textContent()).includes('未提交申请'));await page.keyboard.press('Escape');
    await page.locator('#preview-switcher [data-kind="repair"]').click();
    await page.evaluate(()=>document.getElementById('detail-scroll').scrollTop=9999);
    const contacts=await page.locator('.contact-row').evaluateAll(rows=>rows.map(x=>{const r=x.getBoundingClientRect();return {top:r.top,bottom:r.bottom};}));assert(contacts[1].top>=contacts[0].bottom,'contacts use separate rows');
    const actionBox=await page.locator('.detail-actions').boundingBox();const scrollBox=await page.locator('#detail-scroll').boundingBox();assert(scrollBox.y+scrollBox.height<=actionBox.y+1,'footer does not overlay scroll content');
    await page.screenshot({path:path.join(outDir,'detail-contacts.png'),fullPage:true});
    await page.locator('#detail-toast').waitFor({state:'hidden'});
    await page.setViewportSize({width:375,height:900});await page.evaluate(()=>{window.scrollTo(0,0);document.getElementById('home-scroll').scrollTop=0;document.getElementById('detail-scroll').scrollTop=0;});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no 375px page overflow');
    assert(await page.evaluate(()=>[...document.querySelectorAll('.phone,.scroll')].every(x=>x.scrollWidth<=x.clientWidth+1)),'no inner horizontal overflow');
    await page.screenshot({path:path.join(outDir,'mobile.png'),fullPage:true});
    await page.locator('[data-item="parcel"]').click();assert.equal(await page.locator('#detail-title').textContent(),'帮忙代取一个快递');
    await page.setViewportSize({width:320,height:800});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no 320px overflow');
    await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.primary').first().evaluate(x=>getComputedStyle(x).transitionDuration),'0s');
    assert.deepEqual(errors,[],'no browser errors');
    const result={passed:true,checks:['desktop render','category union','keyword and region conjunction','empty/reset','four details','idle privacy and no scheduling','favorite persistence','review role and Escape','no transaction side effects','contact rows','footer layout','375px and 320px overflow','reduced motion','browser error log'],screenshots:['desktop.png','detail-contacts.png','mobile.png']};
    fs.writeFileSync(path.join(outDir,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
  }finally{await browser.close();}
}
verify().catch(error=>{console.error(error);process.exitCode=1;});
