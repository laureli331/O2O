'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),file=path.join(root,'previews/services.html');
function bundle(){const html=fs.readFileSync(file,'utf8'),ctx=vm.createContext({});vm.runInContext(html.match(/<script id="services-model">([\s\S]*?)<\/script>/)[1],ctx);return {html,m:ctx.ServicesModel};}
test('services centralizes both roles and has no personnel directory or remote side effects',()=>{
 const {html}=bundle();for(const s of ['我发布的','我承接的','通知中心','维修','跑腿','闲置','其它'])assert(html.includes(s),s);
 assert(!/找服务|服务人员目录|附近师傅|公开服务资料/.test(html));assert(!/fetch\(|XMLHttpRequest|localStorage|src="https?:|href="https?:/.test(html));
 for(const match of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
});
test('role filters include only current user records and applications are not active orders',()=>{
 const {m}=bundle(),rows=m.records();for(const tab of ['published','accepted']){const result=m.filter(rows,{tab,kind:'all',status:'all',user:'me'});assert(result.length>=4);assert(result.every(x=>tab==='published'?x.owner==='me':x.provider==='me'||x.applicant==='me'||x.buyer==='me'));assert.equal(new Set(result.map(x=>x.kind)).size,4);}
 assert(!m.filter(rows,{tab:'accepted',status:'active',user:'me'}).some(x=>x.state==='applied'));assert(!m.filter(rows,{tab:'published',user:'me'}).some(x=>x.owner==='other'));
});
test('order previews provide local first images and valid agreed time ranges',()=>{
 const {m}=bundle();
 for(const row of m.records()){
  assert(['repair','errand','desk','storage'].includes(row.cover));
  const cover=path.join(root,'previews/assets/service-'+row.cover+'.svg');
  assert(fs.existsSync(cover));assert(fs.readFileSync(cover,'utf8').includes('viewBox="0 0 180 180"'));
  const start=Date.parse(row.start.replace(' ','T')+':00+08:00'),due=Date.parse(row.due.replace(' ','T')+':00+08:00');
  assert(Number.isFinite(start)&&Number.isFinite(due)&&due>start);
  const copied=m.draft(row);assert(!('cover' in copied));assert(!('due' in copied));
 }
});

test('closing before selection requires confirmation, reopens without old assignees, and preserves original publication',()=>{
 const {m}=bundle(),row=m.records().find(x=>x.id==='PUB-REPAIR');const original=row.published;
 assert.throws(()=>m.manage(row,'close','other',''),/本人/);m.manage(row,'close','me','时间另约');assert.equal(row.state,'closed');m.manage(row,'reopen','me','');assert.equal(row.state,'open');assert.equal(row.published,original);assert.equal(row.provider,null);assert.equal(row.applications,0);assert(row.reopened);assert.equal(row.history.length,2);
});
test('active orders cannot be closed as an unselected post and sold items require a new post',()=>{
 const {m}=bundle(),rows=m.records(),active=rows.find(x=>x.id==='PUB-RUN'),sold=rows.find(x=>x.id==='PUB-IDLE');assert.throws(()=>m.manage(active,'close','me',''),/双方/);assert.throws(()=>m.manage(sold,'reopen','me',''),/新帖/);const draft=m.draft(sold);assert.equal(draft.kind,sold.kind);for(const key of ['provider','phone','address','evidence','due','id'])assert(!(key in draft),key);
});
test('all existing prototype service tabs route to the same center',()=>{
 for(const name of ['v01-v02','v04','v05','v23','v07'])assert(fs.readFileSync(path.join(root,'previews/'+name+'.html'),'utf8').includes('services.html'),name);
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

function noticeReturnHarness(snapshot, token='return-a') {
 const {html}=bundle();
 const controller=html.match(/ function consumeNoticeReturn\(\)\{[^\n]*\n/)[0];
 const values=new Map([['o2o-services-notice-return',JSON.stringify(snapshot)]]);
 const select={value:'normal'};
 const initial=[{id:'N1',title:'固定维修通知',record:'PUB-REPAIR',read:false},{id:'N2',title:'固定跑腿通知',record:'PUB-RUN',read:false}];
 let cleaned='';
 const ctx=vm.createContext({params:new URLSearchParams('noticeReturn='+token),sessionStorage:{getItem:k=>values.get(k)||null,removeItem:k=>values.delete(k)},URL,location:{href:'http://127.0.0.1/services.html?view=notices&noticeReturn='+token},history:{replaceState(_s,_t,url){cleaned=url;}},$:()=>select,initialNotices:initial,notices:initial.map(x=>({...x})),noticeContext:null,noticeFilter:'all',detailOrigin:'list'});
 return {ok:vm.runInContext(controller+'consumeNoticeReturn()',ctx),ctx,values,cleaned};
}
function noticeSnapshot(){return {token:'return-a',demo:'many',filter:'unread',context:{id:'N26',index:24,top:1700,outer:0},reads:Array.from({length:30},(_,i)=>['N'+(i+1),i===24||i===25])};}
test('notification return consumes one matching snapshot without restoring orders or arbitrary content',()=>{
 const {html}=bundle();
 assert.deepEqual([...new Set([...html.matchAll(/sessionStorage\.(?:setItem|getItem|removeItem)\('([^']+)'/g)].map(m=>m[1]))],['o2o-services-notice-return']);
 const snapshot=noticeSnapshot();snapshot.orders=[{id:'OUTSIDE'}];snapshot.title='不得导入的标题';
 const r=noticeReturnHarness(snapshot);
 assert.equal(r.ok,true);assert.equal(r.values.size,0);assert(!new URL(r.cleaned).searchParams.has('noticeReturn'));
 assert.equal(r.ctx.notices.length,30);assert.equal(r.ctx.notices[24].read,true);assert.equal(r.ctx.notices[0].read,false);assert.equal(r.ctx.notices[24].title,'固定维修通知');assert.equal(r.ctx.noticeFilter,'unread');assert.equal(r.ctx.noticeContext.id,'N26');
});
test('notification return rejects mismatches and malformed read or position data without importing state',()=>{
 const wrong=noticeReturnHarness({...noticeSnapshot(),token:'return-b'});assert.equal(wrong.ok,false);assert.equal(wrong.values.size,1);
 for(const mutate of [s=>s.reads[0][1]='false',s=>s.reads[0][0]='UNKNOWN',s=>s.context.top=-1,s=>s.context.index=99,s=>s.demo='guest',s=>s.filter='private',s=>s.reads.pop()]){
  const snapshot=noticeSnapshot();mutate(snapshot);const r=noticeReturnHarness(snapshot);assert.equal(r.ok,false);assert.equal(r.ctx.notices.length,2);assert.equal(r.ctx.notices[0].read,false);assert.equal(r.ctx.noticeContext,null);
 }
});


test('order return restores only a visible card trigger and bounds incoming scroll positions',()=>{
 const {html}=bundle(),helpers=html.slice(html.indexOf(' function position(value)'),html.indexOf(' function backUrl()'));
 let focused='',selector='',outer=-1;const scroll={scrollTop:0};
 const row={dataset:{record:'PUB-REPAIR'},querySelector(value){selector=value;return {focus(options){assert.equal(options.preventScroll,true);focused='record';}};}};
 const context=vm.createContext({Number,listContext:{id:'PUB-REPAIR',action:'main',outer:321},listOffset:120,settings:{tab:'published'},$:id=>id==='content'?{querySelectorAll:()=>[row]}:scroll,document:{querySelector:()=>({focus(){focused='fallback';}})},scrollTo(_x,y){outer=y;}});
 vm.runInContext(helpers+'restoreOrder()',context);assert.equal(focused,'record');assert.equal(selector,'.order-open');assert.equal(scroll.scrollTop,120);assert.equal(outer,321);
 context.listContext.action='action';vm.runInContext('restoreOrder()',context);assert.equal(selector,'.order-actions button');
 context.listContext={id:'OUTSIDE',action:'main',outer:-1};vm.runInContext('restoreOrder()',context);assert.equal(focused,'fallback');assert.equal(outer,0);
 for(const value of ['Infinity','NaN',-1,100001]){context.value=value;assert.equal(vm.runInContext('position(value)',context),0);}
 context.value='234';assert.equal(vm.runInContext('position(value)',context),234);
});
