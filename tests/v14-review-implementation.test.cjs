'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),M=require('../previews/assets/v14-model.js');
const form={reason:'其他',description:'合成新事实',images:9};
for(const kind of ['report','appeal','supplement'])for(const outcome of ['success','failed','unknown']){
 test(`${kind}: ${outcome} retains context and never duplicates a confirmed request`,()=>{
  const s=M.create(),parent=kind==='report'?null:kind==='appeal'?'r2':'r1',before=s.records.length,original=parent?structuredClone(M.record(s,parent)):null;
  let r=M.submit(s,kind,form,parent,outcome,'unique');
  if(outcome==='failed'){assert.equal(r,null);assert.equal(s.pending,null);assert.equal(s.records.length,before);if(parent)assert.deepEqual(M.record(s,parent),original);return;}
  if(outcome==='unknown'){
   assert.equal(s.records.length,before);assert.equal(s.pending.startedAt,M.NOW);assert.throws(()=>M.submit(s,kind,form,parent));
   const storage={value:null,setItem(k,v){this.value=v;},getItem(){return this.value;}};M.save(s,storage);const restored=M.load(storage);assert.equal(restored.pending.key,'unique');assert.equal(M.query(restored,'unknown'),null);r=M.query(restored,'success');Object.assign(s,restored);
  }
  assert.equal(r.receipts.at(-1).kind,kind);assert.equal(M.submit(s,kind,form,parent,'success','unique').id,r.id);assert.equal(s.records.length,before+(kind==='report'?1:0));
  if(parent){assert.equal(r.id,parent);assert.equal(r.firstReply,original.firstReply);assert.deepEqual(r.events.slice(0,original.events.length),original.events);}
  if(kind==='appeal'){assert.deepEqual(r.decision,original.decision);assert.equal(r.appeal.firstReply,null);assert.equal(r.allowAppeal,false);assert.throws(()=>M.submit(s,kind,form,parent,'success','different'));}
 });
}
test('appeals require explicit original fields; a missing reason is never inferred',()=>{const s=M.create();delete s.records[1].decision.reason;assert.throws(()=>M.submit(s,'appeal',form,'r2'));});
test('two independently persisted preferences preserve opposite settings',()=>{const s=M.create();s.reminderPreferences={expiry:false,reply:true};const storage={setItem(k,v){this.value=v;},getItem(){return this.value;}};M.save(s,storage);assert.deepEqual(M.load(storage).reminderPreferences,{expiry:false,reply:true});});
