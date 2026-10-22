'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
async function main(){
 const [url,outDir,browserPath]=process.argv.slice(2),{chromium}=require(process.env.PREVIEW_PLAYWRIGHT_PATH);
 fs.mkdirSync(outDir,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:browserPath});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:1080}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Existing browser caches expose the old module contract without qualificationStep.
  const legacy=fs.readFileSync(path.join(__dirname,'../previews/assets/v10-flow.js'),'utf8').replace(',qualificationStep,TTL',',TTL');
  await page.route('**/assets/v10-flow.js',route=>route.fulfill({contentType:'application/javascript',body:legacy}));
  page.on('request',request=>{if(request.url().includes('/assets/v10-flow.js'))requests.push(request.url());});
  await page.goto(new URL('v05.html?from=provider',url).href);
  assert.deepEqual(errors,[],'qualification initialization must survive previously cached asset URLs');
  assert(await page.locator('#verify-name').isVisible(),'direct identity form must render');
  assert(await page.locator('#my-phone').isHidden(),'only the active qualification page is shown');
  assert(requests.some(value=>new URL(value).searchParams.has('v')),'updated HTML must request a versioned script');
  await page.locator('#identity-consent').check();await page.locator('#verify-identity').click();
  await page.locator('#continue-operation').click();assert(new URL(page.url()).pathname.endsWith('/v10.html'));
  await page.locator('[data-action=qualify]').click();await page.locator('#continue-operation').waitFor({state:'visible'});
  assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(outDir,'qualification-cache-fixed.png'),fullPage:true});
  console.log(JSON.stringify({passed:true,checks:['legacy unversioned asset cannot break updated HTML','identity form renders','explicit consent and return','effective qualification reuse'],requests}));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
