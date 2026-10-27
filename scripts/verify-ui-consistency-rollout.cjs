/* All pages use synthetic demo state. Does not submit real data or call external services. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),{chromium}=require(process.env.PREVIEW_PLAYWRIGHT_PATH);
const manifest=JSON.parse(fs.readFileSync('docs/ui-consistency-pages-20261027.json','utf8'));
const out=path.resolve('.superpowers/ui-consistency-rollout-20261027'),base=process.env.PREVIEW_BASE_URL||'http://127.0.0.1:8765';fs.mkdirSync(out,{recursive:true});
const report={date:'2026-10-27',pages:[],issues:[],errors:[]};
async function inspect(page,p,width,label){
 const result=await page.evaluate(({p,width,label})=>{
  const visible=e=>e.getClientRects().length&&e.getBoundingClientRect().width>0&&getComputedStyle(e).visibility!=='hidden';
  const roots=[...document.querySelectorAll('[data-ui-content]')].filter(visible);
  const cards=roots.flatMap(root=>[...root.querySelectorAll([...p.cards,...Object.keys(p.edgeCards)].join(','))]).filter(visible);
  const unique=[...new Set(cards)];const padding=p.profile==='admin'&&width>=1000?20:16;
  const issues=[];if(!roots.length)issues.push('no-visible-product-root');
  if(document.documentElement.scrollWidth>innerWidth+1)issues.push('document-horizontal-overflow:'+document.documentElement.scrollWidth);
  for(const root of roots)if(root.scrollWidth>root.clientWidth+1)issues.push('root-horizontal-overflow:'+(root.id||root.className)+':'+root.scrollWidth+'/'+root.clientWidth);
  const measurements=unique.map(e=>{const s=getComputedStyle(e);return {selector:e.tagName.toLowerCase()+'.'+String(e.className).trim().replace(/\s+/g,'.'),radius:s.borderRadius,padding:s.padding,edge:Object.keys(p.edgeCards).some(c=>e.matches(c))};});
  for(const m of measurements){if(m.radius!=='12px')issues.push('card-radius:'+JSON.stringify(m));if(m.edge&&m.padding!=='0px')issues.push('edge-card-padding:'+JSON.stringify(m));if(!m.edge&&m.padding!==padding+'px')issues.push('card-padding:'+JSON.stringify(m));}
  for(const [outer,inner]of Object.entries(p.edgeCards))for(const e of document.querySelectorAll(outer+' '+inner)){if(!visible(e))continue;const s=getComputedStyle(e);if(s.padding!==padding+'px'&&!(p.file==='v15.html'&&s.padding==='16px'))issues.push('edge-copy-padding:'+outer+':'+s.padding);}
  for(const e of document.querySelectorAll('dialog,.dialog-card,.replace-box,.profile-leave-box,.dialog-box,.sheet-panel')){
   const r=getComputedStyle(e).borderRadius;
   if(e.id==='metric-dialog'){const expected=width<=600?'0px':'16px 0px 0px 16px';if(r!==expected)issues.push('drawer-radius:'+r);}
   else {const bottom=e.matches('.profile-leave-box,.sheet-panel')||(e.matches('.dialog-box')&&p.profile==='mobile');const expected=bottom?'20px 20px 0px 0px':'16px';if(r!==expected)issues.push('dialog-radius:'+e.id+'.'+e.className+':'+r);}
  }
  for(const e of roots.flatMap(r=>[...r.querySelectorAll('.field .error,small.error[data-error]')])){if(!e.textContent.trim()&&getComputedStyle(e).display!=='none')issues.push('empty-inline-error-gap');if(e.textContent.trim()&&getComputedStyle(e).padding!=='0px')issues.push('padded-inline-error');}
  const fields=roots.flatMap(root=>[...root.querySelectorAll('.field input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]),.field textarea,.field select')]).filter(visible);
  for(const e of fields){if(e.closest('.money,.money-input,.amount-input,.search'))continue;const s=getComputedStyle(e);if(s.borderRadius!=='8px')issues.push('field-radius:'+(e.id||e.className)+':'+s.borderRadius);if(e.getBoundingClientRect().height<45.9)issues.push('field-height:'+(e.id||e.className));}
  const primary=[...document.querySelectorAll('[data-ui-surface] .primary,[data-ui-surface] .secondary,[data-ui-footer] > button,[data-ui-footer] > a')].filter(visible);
  for(const e of primary){const s=getComputedStyle(e),r=e.getBoundingClientRect();if(s.borderRadius!=='8px')issues.push('action-radius:'+(e.id||e.className)+':'+s.borderRadius);if(r.height<45.9)issues.push('action-height:'+(e.id||e.className)+':'+r.height);}
  const buttons=[...document.querySelectorAll('[data-ui-surface] button')].filter(visible).filter(e=>!e.closest('.date-days'));
  for(const e of buttons){const r=e.getBoundingClientRect();if(r.height<43.9||r.width<43.9)issues.push('touch-target:'+(e.id||e.className)+':'+r.width+'x'+r.height);}
  const listings=[...document.querySelectorAll('.cards .listing')].filter(visible).map(e=>e.getBoundingClientRect());
  for(let i=0;i<listings.length;i++)for(let j=i+1;j<listings.length;j++){const x=listings[i],y=listings[j];if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>1&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>1)issues.push('masonry-overlap:'+i+'/'+j);}
  return {file:p.file,width,label,roots:roots.length,cards:measurements,fields:fields.length,actions:primary.length,issues};
 },{p,width,label});
 report.pages.push(result);report.issues.push(...result.issues.map(issue=>({file:p.file,width,label,issue})));
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PREVIEW_BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
 if(process.argv.includes('--baseline')){
  const context=await browser.newContext(),page=await context.newPage();
  const oldCSS=cp.execFileSync('git',['show','01418e9:previews/assets/ui-consistency.css'],{encoding:'utf8'});
  await context.route('**/*',async route=>{const u=new URL(route.request().url()),f=u.pathname.slice(1);if(manifest.pages.some(p=>p.file===f))return route.fulfill({contentType:'text/html; charset=utf-8',body:fs.readFileSync(path.join(out,f),'utf8')});if(f==='assets/ui-consistency.css')return route.fulfill({contentType:'text/css',body:oldCSS});return route.continue();});
  for(const p of manifest.pages){await page.setViewportSize({width:p.profile==='admin'?1440:375,height:1000});await page.goto(base+'/'+p.file);await page.screenshot({path:path.join(out,'before-'+p.file+'.png'),fullPage:true});}
  await context.close();console.log('Captured',manifest.pages.length,'baseline pages');return;
 }
 for(const p of manifest.pages.filter(p=>!process.env.UI_ONLY_PAGES||process.env.UI_ONLY_PAGES.split(',').includes(p.file))){
  const context=await browser.newContext(),page=await context.newPage();page.setDefaultTimeout(6000);page.on('pageerror',e=>report.errors.push({file:p.file,error:e.message}));
  for(const width of p.profile==='admin'?[1280,1440]:[320,375,414]){
   await page.setViewportSize({width,height:1000});await page.goto(base+'/'+p.file);await page.waitForTimeout(80);await inspect(page,p,width,'default');
   await page.screenshot({path:path.join(out,'after-'+p.file+'-'+width+'.png'),fullPage:true});
   if(p.file==='v07.html'){await page.goto(base+'/v07.html?focus=order&from=services&kind=%E7%BB%B4%E4%BF%AE&role=provider&page=M');await inspect(page,p,width,'focused-service-order');const clearance=await page.locator('#detail-content').evaluate(e=>getComputedStyle(e).paddingBottom);if(clearance!=='100px')report.issues.push({file:p.file,width,label:'focused-service-order',issue:'lost-bottom-clearance:'+clearance});await page.locator('#detail-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);await page.screenshot({path:path.join(out,'focused-order-'+width+'.png'),fullPage:true});await page.goto(base+'/'+p.file);}

  }
  // Traverse reviewer navigation without sending forms. Each view reloads in clean demo state.
  const nav='#screen-index [data-view],.screen-nav button,.preview-nav button,.banner-nav button,#admin-nav button,.dash-nav button,.screens button';
  const controls=await page.locator(nav).evaluateAll(es=>es.filter(e=>e.getClientRects().length&&!e.disabled).map(e=>({text:e.textContent.trim(),page:e.dataset.page,view:e.dataset.view,screen:e.dataset.screen,id:e.id})).slice(0,22));
  for(let i=0;i<controls.length;i++){
   await page.goto(base+'/'+p.file);const buttons=page.locator(nav).filter({visible:true});
   if(await buttons.count()<=i)continue;try{await buttons.nth(i).click({timeout:3000});await page.waitForTimeout(40);if(new URL(page.url()).pathname.slice(1)===p.file)await inspect(page,p,page.viewportSize().width,'view:'+controls[i].text);}catch(error){report.issues.push({file:p.file,label:'view:'+controls[i].text,issue:error.message.slice(0,160)});}
  }
  await page.goto(base+'/'+p.file);
  await page.locator('details.preview-controls').evaluateAll(es=>es.forEach(e=>e.open=true));
  const demo=page.locator('#scenario,#demo-state');
  const values=await demo.evaluateAll(es=>es.filter(e=>e.getClientRects().length).flatMap(e=>[...e.options].filter(x=>!x.disabled&&x.value!=='').map(x=>({selector:'#'+e.id,value:x.value,text:x.textContent}))));
  for(const v of values){await page.goto(base+'/'+p.file);try{await page.locator('details.preview-controls').evaluateAll(es=>es.forEach(e=>e.open=true));await page.locator(v.selector).selectOption(v.value);await page.waitForTimeout(40);await inspect(page,p,page.viewportSize().width,'scenario:'+v.text);}catch(error){report.issues.push({file:p.file,label:'scenario:'+v.text,issue:error.message.slice(0,160)});}}
  if(p.file==='v04.html'){
   await page.goto(base+'/v04.html?mode=review');const count=await page.locator('#screen-nav button').count();
   for(let i=0;i<count;i++){await page.goto(base+'/v04.html?mode=review');await page.locator('#screen-nav button').nth(i).click();await inspect(page,p,page.viewportSize().width,'publish-review:'+i);}
  }
  console.log(p.file,'checked',report.pages.filter(x=>x.file===p.file).length,'views; issues',report.issues.filter(x=>x.file===p.file).length);await context.close();
 }
 }finally{await browser.close();fs.writeFileSync(path.join(out,process.env.UI_REPORT_NAME||'verification.json'),JSON.stringify(report,null,2));}
 console.log(JSON.stringify({checks:report.pages.length,issues:report.issues.length,errors:report.errors}));if(report.issues.length||report.errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
