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
  async function assertCompactCards(){
    const metrics=await page.locator('.listing').evaluateAll(cards=>cards.map(card=>{
      const title=card.querySelector('h3'),price=card.querySelector('.price'),meta=card.querySelector('.card-meta');
      return {id:card.dataset.item,titleHeight:title.getBoundingClientRect().height,lineHeight:parseFloat(getComputedStyle(title).lineHeight),gap:price.getBoundingClientRect().top-title.getBoundingClientRect().bottom,priceOverflow:price.scrollWidth>price.clientWidth+1,metaGap:meta.getBoundingClientRect().top-price.getBoundingClientRect().bottom};
    }));
    for(const m of metrics){assert(m.gap>=0&&m.gap<=7,m.id+' compact title/price gap');assert(m.metaGap>=0&&m.metaGap<=6,m.id+' compact metadata gap');assert(!m.priceOverflow,m.id+' price fits');assert(Math.abs(m.titleHeight/m.lineHeight-Math.round(m.titleHeight/m.lineHeight))<.05,m.id+' natural complete title lines');}
    return metrics;
  }
  async function assertStickyFilters(){
    await page.locator('#home-scroll').evaluate(el=>el.scrollTop=420);
    await page.waitForFunction(()=>Math.abs(document.getElementById('sticky-filters').getBoundingClientRect().top-document.getElementById('home-scroll').getBoundingClientRect().top)<2);
    const first=await page.locator('#sticky-filters').boundingBox();
    await page.locator('#home-scroll').evaluate(el=>el.scrollTop=650);
    await page.waitForFunction(()=>Math.abs(document.getElementById('sticky-filters').getBoundingClientRect().top-document.getElementById('home-scroll').getBoundingClientRect().top)<2);
    const second=await page.locator('#sticky-filters').boundingBox();assert(Math.abs(first.y-second.y)<2,'both filter rows stay pinned during list scrolling');
    assert(await page.locator('#open-region').evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'region filter remains above scrolled cards and clickable');
    assert.equal(await page.locator('#sticky-filters').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(252, 251, 247)','opaque backing prevents list text showing through filters');
    await page.locator('#open-region').click();assert(await page.locator('#region-modal').isVisible());await page.keyboard.press('Escape');
    await page.screenshot({path:path.join(outDir,'sticky-filters.png'),fullPage:true});
    await page.locator('#home-scroll').evaluate(el=>el.scrollTop=0);
  }
  async function assertMasonry(){
    await page.waitForFunction(()=>document.getElementById('cards').style.height!=='');
    const rects=await page.locator('#cards .listing').evaluateAll(cards=>cards.map(card=>({left:card.offsetLeft,top:card.offsetTop,width:card.offsetWidth,height:card.offsetHeight})));
    for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
      const a=rects[i],b=rects[j];assert(a.left+a.width<=b.left+1||b.left+b.width<=a.left+1||a.top+a.height<=b.top+1||b.top+b.height<=a.top+1,'masonry cards never overlap');
    }
    for(const left of [...new Set(rects.map(r=>r.left))]){
      const column=rects.filter(r=>r.left===left).sort((a,b)=>a.top-b.top);assert.equal(column[0].top,0);
      for(let i=1;i<column.length;i++)assert(Math.abs(column[i].top-column[i-1].top-column[i-1].height-12)<2,'masonry has no unused row gaps');
    }
    assert(rects[2].top!==rects[3].top,'different image ratios produce visibly staggered rows');
    await page.locator('#home-scroll').evaluate(el=>el.scrollTop=330);
    await page.screenshot({path:path.join(outDir,'masonry-'+page.viewportSize().width+'.png'),fullPage:true});
    await page.locator('#search-input').fill('不存在的关键词');assert(await page.locator('#empty').isVisible());assert.equal(await page.locator('#cards').evaluate(el=>el.clientHeight),0);
    await page.locator('#reset-filters').click();assert.equal(await page.locator('[data-item]').count(),8);
    await page.locator('[data-category="repair"]').click();assert.equal(await page.locator('[data-item]').count(),2);
    await page.locator('[data-category="all"]').click();
    assert.equal(await page.locator('[data-layout]').count(),0,'no grid toggle remains');
    assert.equal(await page.locator('#cards').evaluate(el=>getComputedStyle(el).display),'block');
    await page.locator('#home-scroll').evaluate(el=>el.scrollTop=0);
    const viewport=page.viewportSize();
    await page.setViewportSize({width:viewport.width===1280?700:375,height:viewport.height});
    await page.waitForFunction(()=>{const box=document.getElementById('cards'),card=box.children[1];return Math.abs(card.offsetLeft-(box.clientWidth+12)/2)<2;});
    await page.setViewportSize(viewport);
    await page.waitForFunction(()=>{const box=document.getElementById('cards'),card=box.children[1];return Math.abs(card.offsetLeft-(box.clientWidth+12)/2)<2;});
  }
  try{
    await page.goto(url);await page.locator('[data-item]').first().waitFor();assert.deepEqual(await page.locator('#home-phone .tabbar [data-tab]').evaluateAll(items=>items.map(item=>item.dataset.tab)),['首页','发现','发布','服务','我的']);assert.equal(await page.locator('#home-phone .tabbar [data-tab="消息"]').count(),0);assert.equal(await page.locator('#home-phone .tabbar use[href="#i-discover"]').count(),1);assert.equal(await page.locator('#home-phone [data-tab="发现"]').getAttribute('href'),'v06.html');
    await page.goto(url);await page.locator('[data-item]').first().waitFor();
    assert.equal(await page.locator('[data-item]').count(),8);
    await assertCompactCards();
    assert.equal(await page.locator('.sort-label').textContent(),'最新发布');
    assert.equal(await page.locator('.sort-label svg').count(),0,'no fake sort dropdown');
    assert.equal(await page.locator('#price-label').count(),0);
    assert.equal(await page.locator('#schedule-panel .panel-title').textContent(),'时间要求');
    const hierarchy=await page.locator('[data-item="washer"]').evaluate(card=>{
      const image=card.querySelector('.art'),tag=card.querySelector('.kind'),title=card.querySelector('h3'),price=card.querySelector('.price');
      return {image:image.getBoundingClientRect().height,card:card.getBoundingClientRect().height,tagParent:tag.parentElement.classList.contains('art'),tagBackground:getComputedStyle(tag).backgroundColor,titleFont:parseFloat(getComputedStyle(title).fontSize),priceFont:parseFloat(getComputedStyle(price).fontSize)};
    });
    assert(hierarchy.image/hierarchy.card>.58,'imagery is the dominant card region');
    assert(hierarchy.tagParent&&hierarchy.tagBackground!=='rgba(0, 0, 0, 0)','category is a visible image tag');
    assert(hierarchy.titleFont>hierarchy.priceFont,'negotiable text is subordinate to title');
    assert.equal(await page.locator('[data-item="parcel"] .price-number small').textContent(),'¥');
    await page.screenshot({path:path.join(outDir,'desktop.png'),fullPage:true});
    await assertStickyFilters();
    await assertMasonry();
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
    for(const [kind,button] of [['repair','申请接单'],['errands','申请接单'],['other','申请接单']]){
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
    await assertCompactCards();
    await assertStickyFilters();
    await page.screenshot({path:path.join(outDir,'mobile.png'),fullPage:true});
    await page.locator('[data-item="parcel"]').click();assert.equal(await page.locator('#detail-title').textContent(),'帮忙代取一个快递');
    await page.setViewportSize({width:320,height:800});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no 320px overflow');
    assert(await page.evaluate(()=>[...document.querySelectorAll('.phone,.scroll,.listing')].every(x=>x.scrollWidth<=x.clientWidth+1)),'no 320px card or inner overflow');
    const narrowTitles=await assertCompactCards();assert(narrowTitles.some(m=>m.titleHeight>m.lineHeight*1.5),'two-line titles remain naturally wrapped on narrow screens');
    await assertMasonry();
    await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.primary').first().evaluate(x=>getComputedStyle(x).transitionDuration),'0s');
    assert.deepEqual(errors,[],'no browser errors');
    const result={passed:true,checks:['desktop render','category union','keyword and region conjunction','empty/reset','four details','idle privacy and no scheduling','favorite persistence','review role and Escape','no transaction side effects','contact rows','footer layout','375px and 320px overflow','reduced motion','browser error log'],screenshots:['desktop.png','detail-contacts.png','mobile.png']};
    fs.writeFileSync(path.join(outDir,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
  }finally{await browser.close();}
}
verify().catch(error=>{console.error(error);process.exitCode=1;});
