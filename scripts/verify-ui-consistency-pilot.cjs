/* Run against the local preview server. Only synthetic, in-memory interactions. */
'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PREVIEW_PLAYWRIGHT_PATH);
const output=path.resolve('.superpowers/ui-consistency-pilot-20261027');
const base=process.env.PREVIEW_BASE_URL||'http://127.0.0.1:8765';
const evidence={date:'2026-10-27',checks:[],errors:[],screenshots:[]};
fs.mkdirSync(output,{recursive:true});
async function note(name,fn){await fn();evidence.checks.push(name);console.log('PASS',name);}
async function styles(p,selector){return p.locator(selector).first().evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {radius:s.borderRadius,padding:s.padding,left:s.paddingLeft,right:s.paddingRight,font:s.fontSize,minHeight:s.minHeight,height:r.height,width:r.width,transform:s.transform,transition:s.transitionDuration};});}
async function overflow(p){const bad=await p.evaluate(()=>['#content','#desktop-queue','#footer','#actions'].flatMap(s=>[...document.querySelectorAll(s)].filter(e=>e.getClientRects().length&&e.clientWidth&&e.scrollWidth>e.clientWidth+1).map(e=>({id:e.id,width:e.clientWidth,scroll:e.scrollWidth}))));a.deepEqual(bad,[]);a(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
async function screenshot(p,label){const file=label+'.png';await p.screenshot({path:path.join(output,file),fullPage:true});evidence.screenshots.push(file);}
async function card(p,selector,padding){const s=await styles(p,selector);a.equal(s.radius,'12px');a.equal(s.padding,padding+'px');}
async function control(p,selector){const s=await styles(p,selector);a.equal(s.radius,'8px');a(s.height>=46);}
async function targets(p,selector){const bad=await p.locator(selector).evaluateAll(es=>es.filter(e=>e.getClientRects().length&&!e.disabled).map(e=>({text:e.textContent.slice(0,30),r:e.getBoundingClientRect()})).filter(({r})=>r.width<43.9||r.height<43.9).map(({text,r})=>({text,width:r.width,height:r.height})));a.deepEqual(bad,[]);}
async function open(p,file){await p.goto(base+'/'+file);await p.locator('#content').waitFor();}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PREVIEW_BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
 const context=await browser.newContext();context.on('page',p=>p.on('pageerror',e=>evidence.errors.push(e.message)));
 const p=await context.newPage();
 for(const width of [320,375,414]){
 await p.setViewportSize({width,height:900});
 await note('services '+width+' list sizes and safe scrolling',async()=>{
  await open(p,'services.html');a.equal((await styles(p,'#content')).left,'16px');await card(p,'.order',16);await control(p,'.order-actions .primary');await targets(p,'#service-phone button, #service-phone .tabbar a');await overflow(p);
  await p.locator('.order-copy h3').first().evaluate(e=>e.textContent='洗衣机无法启动，需要检查线路与维修时间，希望先沟通具体情况和费用');
  await p.locator('.order-actions button').first().evaluate(e=>e.textContent='核对这次申请并继续查看详情');await overflow(p);await control(p,'.order-actions button');
  await screenshot(p,'services-list-'+width);
 });
 await note('services '+width+' detail, sheet and editable form',async()=>{
  await p.locator('.order-open').first().click();a.equal(await p.locator('#page-title').textContent(),'需求详情');await card(p,'#content .panel',16);await targets(p,'#actions button, #actions a');
  await p.locator('#actions [data-action="more"]').click();a.equal((await styles(p,'.sheet-panel')).radius,'20px 20px 0px 0px');await targets(p,'.sheet-panel button');await p.locator('[data-action="dismiss-more"]').click();
  await p.locator('#actions [data-action="edit"]').click();await p.locator('#edit-title').fill('已修改的长标题，返回时需要保留这次填写内容');await p.locator('#edit-memo').fill('先检查再协商费用。');
  a.equal((await styles(p,'#edit-title')).radius,'8px');await overflow(p);await screenshot(p,'services-edit-'+width);
  await p.locator('#back').click();await p.locator('[data-action="keep-editing"]').click();a.match(await p.locator('#edit-title').inputValue(),/已修改/);
 });
 await note('services '+width+' notices mark read stays reachable',async()=>{
  await open(p,'services.html');await p.locator('#notices').click();const mark=p.locator('[data-action="mark-read"]');a(await mark.isVisible());const top=await mark.boundingBox();await p.locator('#scroll').evaluate(e=>e.scrollTop=e.scrollHeight);a.deepEqual(await mark.boundingBox(),top);await mark.click();a.equal(await p.locator('.notification .dot').count(),0);await overflow(p);
 });
 await note('V24 '+width+' form, checks and long labels',async()=>{
  await open(p,'v24.html');await p.locator('#scenario').selectOption('new');await card(p,'#content .panel',16);a.equal((await styles(p,'#content')).left,'16px');await control(p,'#f-name');await control(p,'#footer .primary');
  await p.locator('#f-name').fill('青禾生活馆');await p.locator('#f-category').fill('生活服务');await p.locator('#f-area').fill('社区及周边');await p.locator('input[data-field=consent]').check();
  await p.locator('#read-state').selectOption('failed');a.equal(await p.locator('#f-name').inputValue(),'青禾生活馆');a(await p.locator('#footer .primary').isDisabled());await p.locator('#read-state').selectOption('ready');
  const check=p.locator('label.check');a((await check.boundingBox()).height>=44);a((await p.locator('input[data-field=consent]').boundingBox()).width<30);await targets(p,'#device button');await overflow(p);await screenshot(p,'v24-form-'+width);
  await p.locator('#footer [data-action="review"]').click();a.match(await p.locator('#title').textContent(),/核对/);a.match(await p.locator('#content').innerText(),/青禾/);
 });
 await note('V24 '+width+' payment modal, failed and unknown outcomes',async()=>{
  await p.locator('#scenario').selectOption('approved');await p.locator('[data-view="D"]').click();await p.locator('#footer [data-action="pay"]').click();const d=p.locator('#confirm-dialog');await d.waitFor({state:'visible'});a.equal((await styles(p,'#confirm-dialog')).radius,'16px');await targets(p,'#confirm-dialog button');await screenshot(p,'v24-pay-'+width);await p.locator('#cancel-confirm').click();a(!(await d.isVisible()));
  await p.locator('#result').selectOption('failed');await p.locator('#footer [data-action="pay"]').click();await p.locator('#execute-confirm').click();a.match(await p.locator('#toast').innerText(),/失败|未完成/);a.match(await p.locator('#title').textContent(),/开通/);
  await p.locator('#result').selectOption('unknown');await p.locator('#footer [data-action="pay"]').click();await p.locator('#execute-confirm').click();a.match(await p.locator('#content').innerText(),/查询/);a(await p.locator('#footer button').first().isDisabled());await overflow(p);
 });
 }
 for(const width of [1280,1440]){
 await p.setViewportSize({width,height:1000});
 await p.evaluate(()=>sessionStorage.clear());
 await note('V15 '+width+' queue, materials, same-page form and dialog',async()=>{
  await open(p,'v15.html');await card(p,'#desktop-queue .queue-card',0);await p.locator('.queue-open[data-record="R-101"]').first().click();await card(p,'#content .source-panel',20);a.equal((await styles(p,'#content')).padding,'24px');a.equal((await styles(p,'#field-reason')).radius,'8px');
  await p.locator('.source-images button').first().click();await p.locator('#material-viewer').waitFor({state:'visible'});a.equal((await styles(p,'#material-viewer')).radius,'16px');await p.locator('#material-close').click();
  await p.locator('#field-action').selectOption('remove');await p.locator('.reason-shortcuts button').first().click();a((await p.locator('#field-reason').inputValue()).length>0);await targets(p,'.reason-shortcuts button');
  await p.locator('#field-reason').fill('已核对原文及举报材料，现有材料不足以确认违规，保留当前状态。');await p.locator('#footer [data-action="review"]').click();await p.locator('#operation-confirm').waitFor({state:'visible'});a.equal((await styles(p,'#operation-confirm')).radius,'16px');await targets(p,'.operation-modal-actions button');a.equal(await p.locator('#operation-back').evaluate(e=>e===document.activeElement),true);await screenshot(p,'v15-confirm-'+width);await p.locator('#operation-back').click();a.match(await p.locator('#field-reason').inputValue(),/已核对/);await overflow(p);await screenshot(p,'v15-detail-'+width);
 });
 await note('V15 '+width+' failed handling retains reason',async()=>{
  await p.locator('#result').selectOption('failed');await p.locator('#footer [data-action="review"]').click();await p.locator('#operation-confirm').waitFor({state:'visible'});await p.locator('#operation-execute').click();await p.locator('#field-reason').waitFor();a.match(await p.locator('#field-reason').inputValue(),/已核对/);
 });
 await note('V15 '+width+' unknown outcome requires query',async()=>{
  await p.locator('#result').selectOption('unknown');await p.locator('#footer [data-action=review]').click();await p.locator('#operation-confirm').waitFor({state:'visible'});await p.locator('#operation-execute').click();await p.locator('.pending-inline [data-action=query]').waitFor();a.equal(await p.locator('#field-reason').count(),0);await overflow(p);
 });
 }
 await note('press feedback and reduced motion',async()=>{
  await p.setViewportSize({width:375,height:900});await open(p,'services.html');const button=p.locator('.order-actions button').first();await button.scrollIntoViewIfNeeded();let r=await button.boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();await p.waitForTimeout(180);a.notEqual((await styles(p,'.order-actions button')).transform,'none');await p.mouse.move(0,0);await p.mouse.up();
  await p.emulateMedia({reducedMotion:'reduce'});await button.scrollIntoViewIfNeeded();r=await button.boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();a.equal((await styles(p,'.order-actions button')).transform,'none');await p.mouse.move(0,0);await p.mouse.up();await p.emulateMedia({reducedMotion:'no-preference'});
 });
 await note('commerce rollout shares approved tokens',async()=>{await open(p,'v25.html');a.equal(await p.locator('link[href*="ui-consistency.css"]').count(),1);a.equal(await p.locator('body[data-ui-profile=mobile]').count(),1);});
 a.deepEqual(evidence.errors,[]);
 }catch(error){evidence.failure=error.stack;throw error;}finally{await browser.close();fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(evidence,null,2));}
 console.log(JSON.stringify({passed:evidence.checks.length,errors:evidence.errors.length,output}));
})().catch(e=>{console.error(e);process.exitCode=1;});
