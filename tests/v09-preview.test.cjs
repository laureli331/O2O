'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),M=require('../previews/assets/v09-model.js');
const address=()=>({name:'邻居',phone:'01234567890',region:'演示社区',detail:'合成地址',note:'',isDefault:false});
test('all private tools isolate users, including direct ID mutations and transfers',()=>{
 const s=M.create();for(const key of ['addresses','favorites','drafts','sources']){assert(M.rows(s,key).every(r=>r.owner==='me'));assert.throws(()=>M.get(s,key,key==='addresses'?'PRIVATE':'FOREIGN'),/本人/);}assert.throws(()=>M.remove(s,'addresses','PRIVATE'),/本人/);assert.throws(()=>M.transfer(s,'FOREIGN','draft'),/本人/);s.user=null;assert.deepEqual(M.rows(s,'addresses'),[]);assert.throws(()=>M.saveAddress(s,null,address()),/登录/);
});
test('invalid favorite projection cannot disclose cached titles, covers, contacts or public IDs',()=>{
 const s=M.create();for(const type of ['info','legacy']){const invalid=M.favorites(s,type).filter(r=>!r.active);assert(invalid.length);for(const r of invalid){assert(!r.title.includes('私密'));assert(!('cover'in r));assert(!('publicId'in r));assert(!('phone'in r));}}M.remove(s,'favorites','F1');assert(!M.favorites(s).some(r=>r.id==='F1'));assert(M.favorites(s).some(r=>r.id==='F2'));
});
test('address validation enforces configured community and all field boundaries without claiming phone verification',()=>{
 assert.deepEqual(M.issues(address()),{});for(const [field,value]of [['name',''],['name','字'.repeat(21)],['phone','1380000102'],['phone','1380000102a'],['region','未配置社区'],['detail',''],['detail','字'.repeat(201)],['note','字'.repeat(101)]])assert(M.issues({...address(),[field]:value})[field],field);
 assert.deepEqual(M.issues({...address(),name:'字'.repeat(20),detail:'字'.repeat(200),note:'字'.repeat(100)}),{});const s=M.create(),before=JSON.stringify(s.addresses);assert.throws(()=>M.saveAddress(s,null,{...address(),phone:''}));assert.equal(JSON.stringify(s.addresses),before);
});
test('explicit saves enforce at most one default per user, never altering another user default',()=>{
 const s=M.create(),saved=M.saveAddress(s,null,{...address(),isDefault:true});assert.equal(M.rows(s,'addresses').filter(r=>r.isDefault).length,1);assert.equal(s.addresses.find(r=>r.id==='PRIVATE').isDefault,true);assert.equal(M.get(s,'addresses','A1').isDefault,false);M.saveAddress(s,saved.id,{...saved,isDefault:false});assert.equal(M.rows(s,'addresses').filter(r=>r.isDefault).length,0);M.remove(s,'addresses',saved.id);assert(!M.rows(s,'addresses').some(r=>r.id===saved.id));
});
test('chosen task address is a deep snapshot and survives address editing or deletion',()=>{
 const s=M.create(),picked=M.choose(s,'A1'),before=JSON.stringify(s.snapshot);picked.detail='outside mutation';M.saveAddress(s,'A1',{...address(),detail:'已改地址'});M.remove(s,'addresses','A1');assert.equal(JSON.stringify(s.snapshot),before);assert.notEqual(s.snapshot.detail,'已改地址');
});
test('drafts can save incomplete fields explicitly and transfer without sharing object references',()=>{
 const s=M.create(),before=M.rows(s,'drafts').length,data={title:'',note:'',phone:'13800001020'};data.note='未保存输入';assert.equal(M.rows(s,'drafts').length,before);const d=M.saveDraft(s,null,'other',data);data.note='外部修改';assert.equal(M.get(s,'drafts',d.id).data.note,'未保存输入');const copy=M.transfer(s,d.id,'draft');assert.equal(copy.data.phone,'13800001020');copy.data.phone='changed';assert.equal(M.get(s,'drafts',d.id).data.phone,'13800001020');M.remove(s,'drafts',d.id);assert.equal(M.rows(s,'drafts').length,before);
});
test('templates and reposts transfer only public descriptive fields into a new form',()=>{
 const s=M.create();s.sources[1].data={...s.sources[1].data,code:'secret',address:'private',fee:'12',start:'old',aiRequest:'old',transaction:'old',images:['private']};const t=M.transfer(s,'P1','copy');assert.equal(t.mode,'copy');assert(t.data.title);for(const k of ['phone','authorization','code','address','fee','price','start','aiRequest','transaction','images'])assert(!(k in t.data),k);assert(!('id'in t));
});
