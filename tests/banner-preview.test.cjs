'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),M=require('../previews/assets/banner-model.js');
test('banner payment follows review, confirmed schedule and valid reservation; unknown results cannot double pay',()=>{
 const s=M.create();assert.throws(()=>M.pay(s,'success'));M.submit(s,s.form);assert.equal(s.status,'pending');assert.throws(()=>M.submit(s,s.form));assert.throws(()=>M.pay(s,'success'));
 s.status='ready';M.pay(s,'unknown');assert.equal(s.status,'payment-unknown');assert.throws(()=>M.pay(s,'success'));M.queryPayment(s,'unknown');assert(!s.paid);M.queryPayment(s,'success');assert(s.paid);assert.equal(s.status,'scheduled');assert.equal(s.actualStart,null);assert.throws(()=>M.pay(s,'success'));
 const expired=M.create('ready');assert.throws(()=>M.pay(expired,'success',expired.reservedUntil));const failed=M.create('ready');M.pay(failed,'failed');assert.equal(failed.status,'ready');assert(!failed.paid);
});
test('draft requires complete public creative and explicit contact data only when authorized',()=>{
 const f=M.create().form;assert.deepEqual(M.errors(f),{});for(const key of ['name','title','description','region'])assert(M.errors({...f,[key]:''})[key]);assert(M.errors({...f,image:false}).image);assert(M.errors({...f,phone:'',publicPhone:true}).phone);assert(!M.errors({...f,phone:'',publicPhone:false}).phone);
});
test('refund uses exact remaining seconds and only rounds final cents; no double termination or automatic restart',()=>{
 assert.equal(M.refundCents(29900,20*M.DAY,30*M.DAY),19933);assert.equal(M.refundCents(19900,18*3600,30*M.DAY),498);assert.equal(M.refundCents(29900,1,30*M.DAY),0);assert.equal(M.refundCents(29900,0,30*M.DAY),0);assert.equal(M.refundCents(29900,40*M.DAY,30*M.DAY),29900);assert.throws(()=>M.refundCents(29900,-1,30*M.DAY));
 const scheduled=M.create('scheduled');assert.equal(M.quote(scheduled).cents,29900);assert.throws(()=>M.cancel(scheduled,false));assert.equal(scheduled.status,'scheduled');
 const s=M.create('live');const prior={status:'live'};s.previous=prior;M.cancel(s,true);assert.equal(s.refund.cents,19933);assert.equal(s.stopAt,M.NOW);assert.equal(s.status,'refund-pending');assert.equal(s.previous.status,'live');assert.throws(()=>M.cancel(s,true));M.queryRefund(s,'failed');assert.equal(s.status,'refund-unknown');assert.equal(s.stopAt,M.NOW);M.queryRefund(s,'unknown');assert.equal(s.status,'refund-unknown');M.queryRefund(s,'success');assert.equal(s.status,'refunded');assert.throws(()=>M.queryRefund(s,'success'));
});
test('report distinguishes zero from unknown and computes weighted aggregate CTR',()=>{
 const r=M.report();assert.equal(r.views,1158);assert.equal(r.clicks,75);assert.equal(r.rate,75/1158);assert.equal(M.report('today').views,164);const zero=M.report('7','zero');assert.equal(zero.views,0);assert.equal(zero.rate,null);assert.equal(M.report('7','unknown').views,null);
});
test('temporary demo records expire and reject unrelated malformed versions',()=>{
 const map=new Map(),store={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};const s=M.create('live');M.save(s,store,1000);assert.equal(M.load(store,1001).status,'live');assert.equal(M.load(store,1000+M.TTL),null);store.setItem(M.KEY,'{"version":9}');assert.equal(M.load(store,1000),null);
});
test('three pages use versioned current shared assets and local-only scripts',()=>{
 const root=path.join(__dirname,'../previews');for(const page of ['11','12','13']){const html=fs.readFileSync(path.join(root,'v'+page+'.html'),'utf8');assert(html.includes('data-page="'+page+'"'));assert(html.includes('合成示例'));for(const asset of ['banner-model.js','banner-preview.js','banner-preview.css']){const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'assets',asset),'utf8').replace(/\r\n/g,'\n')).digest('hex').slice(0,12);assert(html.includes('assets/'+asset+'?v='+hash));}}
 const app=fs.readFileSync(path.join(root,'assets/banner-preview.js'),'utf8');assert(!/fetch\(|XMLHttpRequest|https?:\/\//.test(app));
});
