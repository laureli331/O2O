const {test}=require('node:test');
const a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'docs/superpowers/specs');
const stem='2026-10-27-ui-consistency-design';
const load=()=>JSON.parse(fs.readFileSync(path.join(dir,stem+'-tokens.json'),'utf8'));
const evidence=JSON.parse(fs.readFileSync(path.join(dir,stem+'-audit.json'),'utf8'));
function validate(p){
 a.equal(p.status,'approved-all-active-delivered');a.equal(p.implementationStarted,true);a.equal(p.rollout,'all-active-pages');a.equal(p.pilotVisualAccepted,true);a.equal(p.rolloutApproval.confirmed,true);a.equal(p.rolloutApproval.reply,'没问题, 可以推广到全部有效HTML了');a.equal(p.authorization.prototypeOnly,true);a.equal(p.authorization.realServicesEnabled,false);a.equal(p.approval.confirmed,true);a.equal(p.approval.reply,'开始下一步');
 a.deepEqual(p.radius,{tag:4,button:8,field:8,card:12,dialog:16,sheetTop:20});
 a.deepEqual(p.spacingScale,[4,8,12,16,20,24,32]);
 a.equal(p.mobile.primaryMinHeight,46);a.equal(p.mobile.touchMinWidth,44);a.equal(p.mobile.touchMinHeight,44);
 for(const env of [p.mobile,p.admin])for(const key of ['pageInset','cardInset','cardGap','sectionGap'])a(p.spacingScale.includes(env[key]));
 a.deepEqual(p.activePages,evidence.pages.filter(x=>x.status==='active').map(x=>x.file));
 a.equal(p.activePages.length,33);a.equal(evidence.pages.length,39);
 a.deepEqual([...p.activePages,...Object.keys(p.excludedPages)].sort(),fs.readdirSync(path.join(root,'previews')).filter(x=>x.endsWith('.html')).sort());
 for(const [f,status]of Object.entries(p.excludedPages)){a(!p.activePages.includes(f));a.equal(evidence.pages.find(x=>x.file===f).status,status);}
 a.deepEqual(p.representativePages,['services.html','v24.html','v15.html']);
 a(p.representativePages.every(x=>p.activePages.includes(x)));
 a.deepEqual(p.approvalRequiredBefore,[]);
 return true;
}
test('candidate tokens preserve explicit approval gates, scope and role-based dimensions',()=>a(validate(load())));
test('measurement evidence identifies source version and separates samples from proposals',()=>{
 a.equal(evidence.status,'read-only-measurement');a.match(evidence.sourceCommit,/^[a-f0-9]{40}$/);
 a.equal(evidence.measurements.length,9);a.deepEqual(evidence.browserErrors,[]);
 for(const m of evidence.measurements){a(fs.existsSync(path.join(root,'previews',m.file.split('#')[0])));a(m.viewport.width>0);for(const v of m.values){a(v.found);a(v.borderRadius);a(v.padding);a(!['input','select'].includes(v.selector));}}
});
test('written proposal has resolvable links and records limitations and protected behavior',()=>{
 const doc=fs.readFileSync(path.join(dir,stem+'.md'),'utf8');
 for(const [,target]of doc.matchAll(/\]\(([^)]+)\)/g))if(!/^https?:/.test(target))a(fs.existsSync(path.resolve(dir,target)),target);
 for(const phrase of ['验证方案','33个有效HTML已实施','AAA','不是其它平台最新版应用','明确例外','未知结果查询','不能作为已经验收','原SVG轮廓填绿'])a(doc.includes(phrase),phrase);
});
for(const [label,mutate]of [
 ['unauthorized scope',p=>p.rollout='include-archives'],
 ['archive restored',p=>p.activePages.push('v17.html')],
 ['wrong touch target',p=>p.mobile.touchMinHeight=32],
 ['unapproved radius',p=>p.radius.card=18],
 ['missing rollout approval',p=>p.rolloutApproval.confirmed=false],
 ['missing human approval',p=>p.approval.confirmed=false]
])test('rejects '+label,()=>{const p=load();mutate(p);a.throws(()=>validate(p));});
