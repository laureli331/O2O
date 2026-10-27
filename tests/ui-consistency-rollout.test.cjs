const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const manifest=JSON.parse(read('docs/ui-consistency-pages-20261027.json')),baseline=JSON.parse(read('tests/fixtures/ui-consistency-baseline-20261027.json'));
test('every active HTML loads the shared versioned standard and maps product roots',()=>{
 const version=hash(read('previews/assets/ui-consistency.css')).slice(0,12);
 a.equal(manifest.pages.length,33);a.equal(new Set(manifest.pages.map(x=>x.file)).size,33);
 for(const p of manifest.pages){const html=read('previews/'+p.file);a(html.includes('assets/ui-consistency.css?v='+version),p.file);a(html.includes('data-ui-page="'+p.page+'"'),p.file);a(html.includes('data-ui-profile="'+p.profile+'"'),p.file);a(html.includes('data-ui-content'),p.file);a(p.roots.length>0&&p.cards.length>0);}
});
test('visual adoption preserves all business scripts and excluded HTML snapshots',()=>{
 for(const [f,h]of Object.entries(baseline.controllers)){const scripts=[...read('previews/'+f).matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].map(x=>x[0]).join('\n');a.equal(hash(scripts),h,f);}
 for(const [f,h]of Object.entries(baseline.excluded))a.equal(hash(read('previews/'+f)),h,f);
});
test('inventory is exhaustive and no archived comparison is reintroduced',()=>{
 a.deepEqual([...manifest.pages.map(x=>x.file),...Object.keys(manifest.excludedPages)].sort(),fs.readdirSync(path.join(root,'previews')).filter(x=>x.endsWith('.html')).sort());
 for(const f of Object.keys(manifest.excludedPages)){a(!manifest.pages.some(x=>x.file===f));a(!read('previews/'+f).includes('assets/ui-consistency.css'));}
 for(const p of manifest.pages)for(const [outer,inner]of Object.entries(p.edgeCards))a(outer.startsWith('.')&&inner.startsWith('.'));
 a(manifest.exceptions.calendar&&manifest.exceptions.nestedMoney&&manifest.exceptions.sideDrawer);
});

test('shared CSS token dimensions match the approved design and remain colour-neutral',()=>{
 const css=read('previews/assets/ui-consistency.css'),tokens=JSON.parse(read('docs/superpowers/specs/2026-10-27-ui-consistency-design-tokens.json'));
 for(const [key,role]of Object.entries({tag:'tag',button:'button',field:'field',card:'card',dialog:'dialog',sheetTop:'sheet'}))a(css.includes('--ui-radius-'+role+': '+tokens.radius[key]+'px'),role);
 a(css.includes('--ui-page-inset: '+tokens.mobile.pageInset+'px'));a(css.includes('--ui-card-inset: '+tokens.admin.cardInset+'px'));a(!/!important|fill:|stroke:|#[0-9a-f]{3,8}\b/.test(css));
 a.equal(tokens.rolloutApproval.confirmed,true);a.equal(tokens.authorization.realServicesEnabled,false);
});

test('durable browser evidence covers every active page and the exact delivered CSS',()=>{
 const e=JSON.parse(read('docs/ui-consistency-verification-20261027.json'));
 a.equal(e.stylesheetSha256,hash(read('previews/assets/ui-consistency.css')));a.equal(e.layoutStateChecks,423);a.deepEqual(e.issues,[]);a.deepEqual(e.pageErrors,[]);
 a.equal(e.pilotInteractionChecks,23);a.equal(e.realMiniProgramTested,false);a.equal(e.livePaymentTested,false);
 a.deepEqual(e.pages.map(p=>p.file),manifest.pages.map(p=>p.file));a.equal(e.pages.reduce((sum,p)=>sum+p.checks,0),423);
 for(const p of e.pages)a.deepEqual(p.viewports,p.profile==='admin'?[1280,1440]:[320,375,414],p.file);
 a(e.pages.find(p=>p.file==='v07.html').states.includes('focused-service-order'));
});
