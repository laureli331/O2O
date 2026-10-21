'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),file=path.join(root,'previews/services.html');
function bundle(){const html=fs.readFileSync(file,'utf8'),ctx=vm.createContext({});vm.runInContext(html.match(/<script id="services-model">([\s\S]*?)<\/script>/)[1],ctx);return {html,m:ctx.ServicesModel};}
test('services centralizes both roles and has no personnel directory or remote side effects',()=>{
 const {html}=bundle();for(const s of ['我发布的','我承接的','通知中心','维修','跑腿','闲置','其它'])assert(html.includes(s),s);
 assert(!/找服务|服务人员目录|附近师傅|公开服务资料/.test(html));assert(!/fetch\(|XMLHttpRequest|localStorage|sessionStorage|src="https?:|href="https?:/.test(html));
 for(const match of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
});
test('role filters include only current user records and applications are not active orders',()=>{
 const {m}=bundle(),rows=m.records();for(const tab of ['published','accepted']){const result=m.filter(rows,{tab,kind:'all',status:'all',user:'me'});assert(result.length>=4);assert(result.every(x=>tab==='published'?x.owner==='me':x.provider==='me'||x.applicant==='me'||x.buyer==='me'));assert.equal(new Set(result.map(x=>x.kind)).size,4);}
 assert(!m.filter(rows,{tab:'accepted',status:'active',user:'me'}).some(x=>x.state==='applied'));assert(!m.filter(rows,{tab:'published',user:'me'}).some(x=>x.owner==='other'));
});
test('closing before selection requires confirmation, reopens without old assignees, and preserves original publication',()=>{
 const {m}=bundle(),row=m.records().find(x=>x.id==='PUB-REPAIR');const original=row.published;
 assert.throws(()=>m.manage(row,'close','other',''),/本人/);m.manage(row,'close','me','时间另约');assert.equal(row.state,'closed');m.manage(row,'reopen','me','');assert.equal(row.state,'open');assert.equal(row.published,original);assert.equal(row.provider,null);assert.equal(row.applications,0);assert(row.reopened);assert.equal(row.history.length,2);
});
test('active orders cannot be closed as an unselected post and sold items require a new post',()=>{
 const {m}=bundle(),rows=m.records(),active=rows.find(x=>x.id==='PUB-RUN'),sold=rows.find(x=>x.id==='PUB-IDLE');assert.throws(()=>m.manage(active,'close','me',''),/双方/);assert.throws(()=>m.manage(sold,'reopen','me',''),/新帖/);const draft=m.draft(sold);assert.equal(draft.kind,sold.kind);for(const key of ['provider','phone','address','evidence','due','id'])assert(!(key in draft),key);
});
test('all existing prototype service tabs route to the same center',()=>{
 for(const name of ['v01-v02','v04','v05','v06','v07'])assert(fs.readFileSync(path.join(root,'previews/'+name+'.html'),'utf8').includes('services.html'),name);
});
test('messages use a floating bottom-right target outside the mini-program capsule area',()=>{
 const {html}=bundle();assert(html.includes('class="floating-notices" id="notices"'));
 const head=html.match(/<header class="phone-head">([\s\S]*?)<\/header>/)[1];assert(!head.includes('id="notices"'));
 assert(html.includes('.floating-notices{position:absolute;right:16px;bottom:calc(90px + env(safe-area-inset-bottom,0px))'));
 assert(html.includes('.footer:not([hidden])~.floating-notices'));
});
test('current decision retires the directory without deleting legal history or enabling real services',()=>{
 const d=JSON.parse(fs.readFileSync(path.join(root,'docs/development-decisions.json'),'utf8')).serviceOrderCenterDecision;
 assert.equal(d.directoryRetentionReply,'不保留');assert.equal(d.personnelDirectoryRetained,false);assert.equal(d.directoryMovedElsewhere,false);assert.equal(d.historicalRecordsDeleted,false);assert.equal(d.realServicesEnabled,false);assert.equal(d.secondhandBuyerIncluded,true);assert.equal(d.notificationsEntry,'service-floating-bottom-right');
 for(const name of ['CONTEXT.md','docs/prd.md','docs/structured-design.md','docs/development-plan.md','docs/ascii-design-prd-2.1.md'])assert(fs.readFileSync(path.join(root,name),'utf8').includes('service-order-center-confirmed-20261021.md'),name);
});
