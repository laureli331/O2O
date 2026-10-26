'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const M=require('../previews/assets/banner-model.js'),C=require('../previews/assets/banner-custom-model.js');
const read=p=>fs.readFileSync(p,'utf8'),d=JSON.parse(read('docs/banner-standard-service-confirmed-20261026.json'));
test('confirmed nine prices, service scope and separated payment sequence match the executable models',()=>{
 assert.equal(d.customFeeCents,C.PRICE);assert.equal(d.candidateCount,3);assert.equal(d.includedRevisionRounds,1);assert.equal(d.lockDuringProduction,false);assert.equal(d.holdHours,24);
 for(const days of M.periods)assert.deepEqual(d.pricesCents[days],M.positions.map((p,i)=>M.price(i,days)));
 assert.equal(d.paymentSequence.indexOf('production')>d.paymentSequence.indexOf('custom-fee-if-selected'),true);
 assert.equal(d.paymentSequence.indexOf('ad-position-fee')>d.paymentSequence.indexOf('automatic-availability-check'),true);
 assert(d.actualReplies.every(r=>r.questionItemId&&r.answer));assert.equal(d.automaticSchedulingFollowUpReply,'没问题');
});
test('latest rules are linked from every current design entry and new desktop admin is reachable',()=>{
 for(const p of ['docs/prd.md','docs/ascii-design-prd-2.1.md','docs/structured-design.md','docs/development-plan.md','docs/v2-roadmap.md','CONTEXT.md'])assert(read(p).includes('banner-standard-service-confirmed-20261026.md'),p);
 assert(read('previews/v15.html').includes('href="banner-admin.html"'));assert(read('previews/banner-admin.html').includes('href="v15.html"'));
 const ascii=read('docs/ascii-design-prd-2.1.md').split('## V11 ')[1].split('## V14 ')[0];
 assert(!ascii.includes('2.90'));assert(ascii.includes('3个候选方案'));assert(ascii.includes('1轮集中微调'));assert(ascii.includes('系统自动检查'));
});
test('all four banner pages load content-addressed resources matching final saved files',()=>{
 for(const name of ['v11.html','v12.html','v13.html','banner-admin.html'])for(const m of read('previews/'+name).matchAll(/(?:src|href)="(assets\/banner-[^?" ]+)\?v=([a-f0-9]{12})"/g)){
  const digest=crypto.createHash('sha256').update(fs.readFileSync('previews/'+m[1]).toString().replace(/\r\n/g,'\n')).digest('hex').slice(0,12);assert.equal(m[2],digest,name+' '+m[1]);
 }
});
test('refunds follow observed demo time and remain proportional if a scheduled status has not advanced',()=>{
 const s=M.create('scheduled');M.advance(s,[],s.start+7*M.DAY);assert.equal(s.status,'live');assert.equal(M.quote(s).cents,Math.round(M.amount(s)*23/30));
 const original=M.create('scheduled');assert.equal(M.quote(original,original.start+15*M.DAY).cents,Math.round(M.amount(original)/2));
 const q=M.cancel(s,true);assert.equal(s.stopAt,s.previewNow);assert.equal(q.cents,Math.round(M.amount(s)*23/30));
});
