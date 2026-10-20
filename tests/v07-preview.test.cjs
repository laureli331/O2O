'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const file=path.join(__dirname,'../previews/v07.html');
function bundle(){const html=fs.readFileSync(file,'utf8'),ctx=vm.createContext({});vm.runInContext(html.match(/<script id="v07-model">([\s\S]*?)<\/script>/)[1],ctx);return {html,m:ctx.V07Model};}
test('V07 covers A–S in one offline preview with compilable scripts and unique IDs',()=>{
 const {html}=bundle();for(const letter of 'ABCDEFGHIJKLMNOPQRS')assert(html.includes("'"+letter+"':"),letter);
 for(const script of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
 const ids=[...html.split('<script')[0].matchAll(/\sid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length);
 assert(!/fetch\(|XMLHttpRequest|localStorage|sessionStorage|src="https?:|href="https?:/.test(html));
 assert(!/确认完成|提交完成|确认收到/.test(html));assert(html.includes('合成演示'));
});
test('money preserves exact cents, explicit zero and unknown as distinct values',()=>{const {m}=bundle();assert.equal(m.cents(''),null);assert.equal(m.cents('0'),0);assert.equal(m.cents('1.90'),190);for(const s of ['1.001','-1','1e2','100000'])assert.equal(m.cents(s),null);assert.equal(m.money(null),'待协商');});
test('automatic closing is strictly after deadline and blocked by disputes, outages and protection',()=>{
 const {m}=bundle(),s=m.create('维修');assert(!m.canClose(s,s.due));assert(m.canClose(s,s.due+1));s.dispute={version:1,text:'尚未处理'};assert(!m.canClose(s,s.due+1));s.dispute=null;s.outage=true;assert(!m.canClose(s,s.due+1));s.outage=false;s.protection=s.due+86400000;assert(!m.canClose(s,s.protection));assert(m.canClose(s,s.protection+1));s.status='cancelled';assert(!m.canClose(s,s.protection+1));
});
test('pending extension is not consent; own acceptance and out-of-range dates are rejected',()=>{
 const {m}=bundle(),s=m.create('跑腿'),old=s.due;assert.throws(()=>m.propose(s,'extension',{due:old+168*3600000+1},'provider'),/168/);m.propose(s,'extension',{due:old+3600000},'provider');assert.equal(s.due,old);assert.throws(()=>m.respond(s,'extension','accept','provider'),/另一方/);assert.throws(()=>m.propose(s,'extension',{due:old+7200000},'provider'),/待回复/);m.respond(s,'extension','accept','requester');assert.equal(s.due,old+3600000);
});
test('fee versions are separate and each service shares one commission cap',()=>{
 const {m}=bundle(),s=m.create('维修');const old=m.totals(s).service;m.propose(s,'fee',{stage:'检查',items:[{name:'检查费',type:'service',amount:10000}],advance:false,limit:null},'provider');assert.equal(m.totals(s).service,old);m.respond(s,'fee','accept','requester');assert.equal(m.totals(s).service,old+10000);assert.equal(m.commission(s),2700);m.propose(s,'fee',{stage:'处理',items:[{name:'人工',type:'service',amount:30000},{name:'配件',type:'expense',amount:50000}],advance:false},'requester');m.respond(s,'fee','accept','provider');assert.equal(m.commission(s),3000);
});
test('fee form validates rows, counts, cumulative cap, evidence and advance policy',()=>{
 const {m}=bundle(),s=m.create('维修'),p={stage:'处理',items:[{name:'材料',type:'expense',amount:1200}],advance:true,limit:0};assert.deepEqual(Array.from(m.feeErrors(s,p)),[]);assert(m.feeErrors(s,{...p,limit:null}).length);assert(m.feeErrors(s,{...p,items:[]}).length);assert(m.feeErrors(s,{...p,items:Array(21).fill(p.items[0])}).length);assert(m.feeErrors(s,{...p,items:[{name:'',type:'expense',amount:1200}]}).length);assert(m.feeErrors(s,{...p,items:[{name:'材料',type:'expense',amount:9999999}]}).length);
});
test('cancellation needs another party and keeps unsettled fees distinct from cash settlement',()=>{
 const {m}=bundle(),s=m.create('其它');m.propose(s,'cancel',{reason:'双方另行安排'},'requester');assert.equal(s.status,'active');m.respond(s,'cancel','reject','provider','暂时不同意');assert.equal(s.status,'active');m.propose(s,'cancel',{reason:'双方另行安排'},'provider');m.respond(s,'cancel','accept','requester');assert.equal(s.status,'cancelled');assert.equal(m.access(s,m.NOW).address,false);
});
test('supplemental disputes invalidate an old release proposal',()=>{
 const {m}=bundle(),s=m.create('维修');m.addDispute(s,'尚未维修');m.propose(s,'release',{version:s.dispute.version},'provider');m.addDispute(s,'补充未到场');assert.throws(()=>m.respond(s,'release','accept','requester'),/新增/);assert(s.dispute);assert(!s.pending.release);
});
test('pending generic requests close on normal ending; fee handling remains pending and unknown is not zero',()=>{
 const {m}=bundle(),s=m.create('其它');s.stages=[];m.propose(s,'extension',{due:s.due+3600000},'provider');m.propose(s,'fee',{stage:'处理',items:[{name:'服务',type:'service',amount:2000}],advance:false},'provider');assert.equal(m.totals(s).service,null);m.close(s,s.due+1);assert.equal(s.status,'ended');assert(!s.pending.extension);assert(s.pending.fee);assert.equal(m.commission(s),null);
});
test('only mutual fee phone consent opens 24 hours and never addresses or old evidence',()=>{
 const {m}=bundle(),s=m.create('维修');s.status='ended';m.propose(s,'phone',{consent:true},'provider');assert(!m.access(s,m.NOW).phone);m.respond(s,'phone','accept','requester');assert(m.access(s,m.NOW).phone);assert(!m.access(s,m.NOW).address);assert(!m.access(s,m.NOW).oldEvidence);assert(!m.access(s,m.NOW+86400000).phone);
});
test('secondhand agreement requires positive price, current buyer time and explicit buyer confirmation',()=>{
 const {m}=bundle(),s=m.create('闲置');s.status='unconfirmed';assert.throws(()=>m.propose(s,'trade',{price:0,due:s.due},'provider'),/正数/);m.propose(s,'trade',{price:8600,due:s.due},'provider');assert.equal(s.status,'unconfirmed');assert.throws(()=>m.respond(s,'trade','accept','provider'),/另一方/);m.respond(s,'trade','accept','requester');assert.equal(s.status,'active');assert.equal(s.price,8600);
});
test('the preview guide maps all 19 screens and documents synthetic-only state',()=>{
 const guide=fs.readFileSync(path.join(__dirname,'../docs/v07-html-preview.md'),'utf8');for(const letter of 'ABCDEFGHIJKLMNOPQRS')assert(guide.includes('| V07-'+letter+' |'));assert(guide.includes('页面内存状态刷新后重置'));
});
test('evidence accepts only bounded JPEG/PNG and established fees do not start a first-fee window',()=>{
 const {m}=bundle();assert.equal(m.fileErrors([{type:'image/png',size:5*1024*1024}],3),'');assert(m.fileErrors([{type:'image/gif',size:1}],3));assert(m.fileErrors([{type:'image/png',size:5*1024*1024+1}],3));assert(m.fileErrors(Array(4).fill({type:'image/png',size:1}),3));
 const s=m.create('维修');s.status='ended';m.propose(s,'fee',{stage:'已发生补充费',items:[{name:'人工',type:'service',amount:1000}],advance:false},'provider');m.respond(s,'fee','accept','requester');assert.equal(s.feeWindow,null);
});
