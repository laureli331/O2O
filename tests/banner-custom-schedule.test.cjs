'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),C=require('../previews/assets/banner-custom-model.js'),M=require('../previews/assets/banner-model.js');
const input={name:'合成商家',title:'周末新品',subtitle:'邻里好物',notes:'自然风格',style:'natural'};
test('custom generation is separately priced, exactly once per verified success, and unknown cannot start another request',()=>{
 const s=C.create(),id=C.start(s,input);assert.equal(C.PRICE,290);assert.throws(()=>C.start(s,input));assert.equal(s.chargedCents,0);C.finish(s,'unknown');assert.equal(s.request.id,id);assert.throws(()=>C.start(s,input));assert.equal(s.chargedCents,0);C.finish(s,'unknown');C.finish(s,'success');assert.equal(s.chargedCents,290);assert.equal(s.versions.length,1);assert.throws(()=>C.finish(s,'success'));assert.equal(s.chargedCents,290);
 C.edit(s,{title:'改标题',subtitle:'改价格',layout:'center'});assert.equal(C.current(s).artwork.title,'改标题');assert.equal(s.chargedCents,290);
 C.start(s,input);C.finish(s,'failed');assert.equal(s.chargedCents,290);assert.equal(C.current(s).artwork.title,'改标题');assert.equal(s.versions.length,1);
 C.start(s,input);C.finish(s,'unknown');C.finish(s,'failed');assert.equal(s.chargedCents,290);C.start(s,input);C.finish(s,'success');assert.equal(s.chargedCents,580);C.select(s,id);assert.equal(C.current(s).artwork.title,'改标题');assert.equal(s.chargedCents,580);
});
test('custom reload retains generated work and changes interrupted generation to query-only unknown',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)},s=C.create();C.start(s,input);C.finish(s,'success');C.start(s,input);C.save(s,storage,1000);const loaded=C.load(storage,1001);assert.equal(loaded.status,'unknown');assert.equal(loaded.chargedCents,290);assert.equal(loaded.versions.length,1);assert.throws(()=>C.start(loaded,input));C.finish(loaded,'success');assert.equal(loaded.chargedCents,580);assert.equal(C.load(storage,1000+C.TTL),null);
});
test('synthetic artwork escapes user text and has deterministic layout without executing markup',()=>{
 const svg=C.svg({...input,title:'<script>alert(1)</script>',subtitle:'" onload="x',layout:'center'});assert(!svg.includes('<script>'));assert(svg.includes('&lt;'));assert(svg.includes('text-anchor="middle"'));assert(C.source(input).startsWith('data:image/svg+xml;'));
});
test('Beijing dates validate strict calendar values, future times, and next-period boundary',()=>{
 const f=M.create().form;assert.equal(M.parseStart('2026-02-30T10:00'),null);assert.equal(M.parseStart('2026-10-30'),null);assert.equal(M.parseStart('2026-10-22T10:00'),M.NOW);assert(M.errors({...f,desiredStart:'2026-10-22T10:00'}).desiredStart);assert(M.errors({...f,desiredStart:''}).desiredStart);assert(M.errors(f,{minStart:M.parseStart(f.desiredStart)+1}).desiredStart);
 const current=M.create('live'),next=M.prepareNext(current);assert.equal(M.parseStart(next.form.desiredStart),current.end);assert(!M.errors(next.form,{minStart:current.end}).desiredStart);assert.throws(()=>M.submit(next,{...next.form,desiredStart:M.localTime(current.end-60)},current.end));assert.equal(next.status,'draft');
});
test('requested date reaches confirmed order; an alternative requires explicit acceptance and cannot change paid current dates',()=>{
 const s=M.create('empty'),f={...M.create().form,desiredStart:'2026-11-05T09:30'};M.submit(s,f);M.approve(s);assert.equal(s.start,M.parseStart(f.desiredStart));assert.equal(s.end-s.start,30*M.DAY);assert(M.hasOrder(s));
 const shifted=M.create('pending'),start=M.parseStart(shifted.form.desiredStart)+M.DAY;M.approve(shifted,start);assert.equal(shifted.status,'pending');assert(!M.hasOrder(shifted));assert.throws(()=>M.pay(shifted,'success'));M.acceptSchedule(shifted);assert.equal(shifted.start,start);assert.equal(shifted.status,'ready');assert.throws(()=>M.acceptSchedule(shifted));
 const live=M.create('live'),old={start:live.start,end:live.end,desired:live.form.desiredStart};M.submitChange(live,{...live.form,desiredStart:'2027-01-01T00:00'});M.approve(live);assert.equal(live.start,old.start);assert.equal(live.end,old.end);assert.equal(live.form.desiredStart,old.desired);
});
