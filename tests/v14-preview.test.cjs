'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),M=require('../previews/assets/v14-model.js');
test('read and all-read preserve notifications; expired projection never recovers old private material',()=>{
 const s=M.create(),count=s.notices.length;s.notices[2].summary='secret old address';assert(!M.notice(s,'n3').summary.includes('secret'));assert(!M.visible(s,'all')[2].summary.includes('secret'));M.markAll(s);assert.equal(M.visible(s,'unread').length,0);assert.equal(s.notices.length,count);s.logged=false;assert.throws(()=>M.markAll(s));assert.throws(()=>M.visible(s,'all'));
});
test('reason, other explanation, appeal text and attachment limits validate meaningful constraints',()=>{
 assert(M.errors('report',{reason:'',description:'',images:0}).reason);assert(M.errors('report',{reason:'其他',description:' ',images:0}).description);assert.deepEqual(M.errors('report',{reason:'虚假信息',description:'',images:0}),{});assert(M.errors('appeal',{description:'',images:0}).description);assert(M.errors('appeal',{description:'字'.repeat(1001),images:0}).description);assert(M.errors('report',{reason:'虚假信息',description:'',images:10}).images);
});
test('unknown submission blocks repeats, persists for query, and creates exactly one own record when verified',()=>{
 const s=M.create(),form={reason:'其他',description:'合成说明',images:2},before=s.records.length;M.submit(s,'report',form,null,'unknown','token');assert(s.pending);assert.equal(s.records.length,before);assert.throws(()=>M.submit(s,'report',form));assert.equal(M.query(s,'unknown'),null);const r=M.query(s,'success');assert.equal(s.records.length,before+1);assert.equal(r.status,'submitted');assert.equal(r.firstReply,null);assert.equal(M.submit(s,'report',form,null,'success','token').id,r.id);assert.equal(s.records.length,before+1);assert.throws(()=>M.query(s,'success'));
});
test('failed submissions keep data retryable and private records reject other actors and ineligible actions',()=>{
 const s=M.create(),f={reason:'违规内容',description:'',images:0},before=s.records.length;M.submit(s,'report',f,null,'failed');assert.equal(s.records.length,before);s.records.push({...s.records[0],id:'foreign',owner:'other'});assert.throws(()=>M.record(s,'foreign'));assert.throws(()=>M.submit(s,'appeal',{description:'说明',images:0},null));assert.throws(()=>M.submit(s,'appeal',{description:'说明',images:0},'r1'));assert.throws(()=>M.submit(s,'supplement',{description:'说明',images:0},'r2'));const r=M.submit(s,'supplement',{description:'补充事实',images:0},'r1');assert.equal(r.status,'processing');assert.equal(r.firstReply,'2026-10-21 14:00');assert.equal(r.events.at(-1).title,'补充材料已提交');
});
test('saved text drafts and session records retain no file content and expire',()=>{
 const s=M.create(),map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};M.saveDraft(s,'report',null,{reason:'其他',description:'草稿',images:2,file:'secret'});assert.equal(s.drafts['report:'].images,0);assert(!('file' in s.drafts['report:']));M.save(s,storage,1000);assert(M.load(storage,1001));assert.equal(M.load(storage,1000+M.TTL),null);assert.notEqual(M.snapshot({description:'a'}),M.snapshot({description:'b'}));
});
test('V14 includes all five page groups and current content versions without real network submissions',()=>{
 const root=path.join(__dirname,'../previews'),html=fs.readFileSync(path.join(root,'v14.html'),'utf8');for(const code of ['A','B','C','D','E'])assert(html.includes('data-page="'+code+'"'));
 for(const asset of ['v14-model.js','v14-preview.js','v14.css']){const source=fs.readFileSync(path.join(root,'assets',asset),'utf8'),hash=crypto.createHash('sha256').update(source.replace(/\r\n/g,'\n')).digest('hex').slice(0,12);assert(html.includes('assets/'+asset+'?v='+hash));if(asset.endsWith('.js'))assert(!/fetch\(|XMLHttpRequest|https?:\/\//.test(source));}
 assert(html.includes('E03'));assert(!html.includes('class="tabbar"'));
});
