const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n');
const originals={"services": "08bb2ec006bf288c805bb48d073b8ca532da613172fddc15482b98092b377847", "v15": "d89c45b3dd894772626e15d8cb97d9d8c5732a641a88aa77534ef049c80e0c2b", "v24": "3ceb89a785290cb01edca53cd1959c0dc2c82a23f0b49725ce60e9abb19679c9"};
test('only the three approved representatives opt into the unified stylesheet',()=>{
 const expected={'services.html':['mobile','services'],'v24.html':['mobile','onboarding'],'v15.html':['admin','operations']};
 const css=read('previews/assets/ui-consistency.css'),hash=crypto.createHash('sha256').update(css).digest('hex').slice(0,12);
 for(const f of fs.readdirSync(path.join(root,'previews')).filter(x=>x.endsWith('.html'))){const html=read('previews/'+f);if(expected[f]){a(html.includes('assets/ui-consistency.css?v='+hash),f);a(html.includes('data-ui-profile="'+expected[f][0]+'"'),f);a(html.includes('data-ui-page="'+expected[f][1]+'"'),f);}else a(!html.includes('assets/ui-consistency.css'),f);}
});
test('pilot preserves the complete inline controllers and external script references',()=>{
 for(const [f,hash]of Object.entries(originals)){const scripts=[...read('previews/'+f+'.html').matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].map(x=>x[0]).join('\n');a.equal(crypto.createHash('sha256').update(scripts).digest('hex'),hash,f);}
});
test('visual rollout keeps semantic tokens scoped and has no colour or SVG override',()=>{
 const css=read('previews/assets/ui-consistency.css');a(css.includes('--ui-radius-card: 12px'));a(css.includes('--ui-radius-button: 8px'));a(css.includes('--ui-touch: 44px'));a(css.includes('--ui-action-height: 46px'));
 a(!/!important|fill:|stroke:|#[0-9a-f]{3,8}\b/.test(css));
 for(const rule of css.matchAll(/([^{}]+)\{/g)){const selectors=rule[1].replace(/\/\*[\s\S]*?\*\//g,'').trim();if(!selectors||selectors.startsWith('@'))continue;for(const selector of selectors.split(','))a(selector.trim().startsWith('[data-ui-'),selector);}
 a(css.includes('prefers-reduced-motion: reduce'));
});
