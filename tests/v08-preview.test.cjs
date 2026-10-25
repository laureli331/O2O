'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),M=require('../previews/assets/v08-model.js');
const command=(s,id,action,key=id+'-'+action)=>({id,action,key,user:s.user,revision:M.get(s,id).revision});

test('fixture histories are chronological and do not imply a decision before submission',()=>{
 for(const row of M.create().records){assert(row.created<=row.changed);for(let i=1;i<row.history.length;i++)assert(row.history[i-1].at<=row.history[i].at);}
});

test('contact tabs show only current user records and exclude unsubmitted objects',()=>{
 const s=M.create();for(const tab of ['sent','received','history']){const rows=M.filter(s,{tab});assert(rows.length);assert(rows.every(r=>r.owner==='me'||r.applicant==='me'));assert(!rows.some(r=>r.id==='OUTSIDE'||r.state==='none'));}
 assert(M.filter(s,{tab:'sent'}).every(r=>r.applicant==='me'));assert(M.filter(s,{tab:'received'}).every(r=>r.owner==='me'));
 assert(!M.filter(s,{tab:'history'}).some(r=>r.state==='pending'));assert.equal(M.filter(s,{user:null}).length,0);assert.throws(()=>M.get(s,'OUTSIDE'),/本人/);
});
test('recipient approval is per request and does not grant full contacts',()=>{
 const s=M.create();assert.throws(()=>M.perform(s,{...command(s,'S1','approve'),user:'me'}),/状态/);
 M.perform(s,command(s,'R1','approve'));assert.equal(M.get(s,'R1').state,'approved');assert.equal(M.get(s,'R2').state,'approved');
 const view=M.view(s,'R1');assert.equal(view.phone,'138 **** 1020');assert.equal(view.wechat,'l****u');assert(!('address' in view));assert(!('code' in view));assert(M.actions(s,M.get(s,'R1')).includes('trade'));
});
test('withdrawal, rejection and revocation wait a full 24h and never reapply automatically',()=>{
 for(const [id,action] of [['S1','withdraw'],['R1','reject'],['R2','revoke']]){const s=M.create();M.perform(s,command(s,id,action));const row=M.get(s,id),state=row.state;s.user=row.applicant;s.now=row.retryAt-1;assert(!M.actions(s,row).includes('request'));s.now++;assert(M.actions(s,row).includes('request'));assert.equal(row.state,state);M.perform(s,command(s,id,'request'));assert.equal(row.state,'pending');}
});
test('self applications, duplicate pending requests and stale revisions cannot mutate state',()=>{
 const s=M.create(),r=M.get(s,'NEW');r.owner='alias';assert(!M.actions(s,r).includes('request'));assert.throws(()=>M.perform(s,command(s,'NEW','request')),/状态/);r.owner='seller';
 s.records.push({...r,id:'DUP',state:'pending'});assert.throws(()=>M.perform(s,command(s,'NEW','request')),/已有/);assert.equal(r.state,'none');
 const stale=command(s,'R1','approve');M.perform(s,command(s,'R1','reject'));assert.throws(()=>M.perform(s,stale),/更新/);assert.equal(M.get(s,'R1').state,'rejected');
});
test('active/disputed trades and invalid historical records cannot be unilaterally revoked or revived',()=>{
 const s=M.create();for(const id of ['R3','R4']){const row=M.get(s,id);assert(!M.actions(s,row).includes('revoke'));assert(M.actions(s,row).includes('order'));assert.throws(()=>M.perform(s,command(s,id,'revoke')),/状态/);}
 assert.deepEqual(M.actions(s,M.get(s,'OLD')),[]);const expired=M.get(s,'S4');expired.postState='unavailable';s.now+=100*M.HOUR;assert(!M.actions(s,expired).includes('request'));
});
test('unknown submission is query-only, idempotent and scoped to the actor',()=>{
 const s=M.create(),cmd=command(s,'R1','approve'),before=M.get(s,'R1').history.length;
 assert.equal(M.perform(s,cmd,{unknown:true}),'unknown');assert.equal(M.get(s,'R1').state,'pending');assert.equal(M.perform(s,cmd),'unknown');assert.throws(()=>M.perform(s,{...cmd,key:'repeat'}),/查询/);assert.throws(()=>M.query(s,cmd.key,'a'),/本人/);
 assert.equal(M.query(s,cmd.key),'done');assert.equal(M.query(s,cmd.key),'done');assert.equal(M.get(s,'R1').history.length,before+1);assert.equal(M.perform(s,cmd),'done');assert.throws(()=>M.perform(s,{...cmd,action:'reject'}),/变化/);
});
test('unknown queries preserve changed records instead of overriding a newer state',()=>{
 const s=M.create(),cmd=command(s,'R1','approve');M.perform(s,cmd,{unknown:true});const r=M.get(s,'R1');r.state='invalid';r.revision++;assert.equal(M.query(s,cmd.key),'changed');assert.equal(r.state,'invalid');
});


test('request return targets only visible items, uses neighbor or tab fallback and bounds positions',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),html=fs.readFileSync(path.join(__dirname,'../previews/v08.html'),'utf8');
 const source=html.slice(html.indexOf(' function position(value)'),html.indexOf(' function tradeUrl('));
 let focused='',outer=-1;const scroll={scrollTop:0};const items=['S1','S2'].map(id=>({dataset:{detail:id},focus(options){assert.equal(options.preventScroll,true);focused=id;}}));let visible=items;
 const ctx=vm.createContext({Number,listContext:{id:'S2',index:1,outer:130},offset:120,settings:{tab:'sent'},$:id=>id==='content'?{querySelectorAll:()=>visible}:scroll,document:{querySelector:selector=>{assert.equal(selector,'[data-tab="sent"]');return {focus(){focused='tab';}};}},scrollTo(_x,y){outer=y;}});
 vm.runInContext(source+'restoreRequest()',ctx);assert.equal(focused,'S2');assert.equal(scroll.scrollTop,120);assert.equal(outer,130);
 ctx.listContext={id:'OUTSIDE',index:99,outer:-1};vm.runInContext('restoreRequest()',ctx);assert.equal(focused,'S2');assert.equal(outer,0);
 visible=[];vm.runInContext('restoreRequest()',ctx);assert.equal(focused,'tab');
 for(const value of ['Infinity','bad',-1,100001]){ctx.value=value;assert.equal(vm.runInContext('position(value)',ctx),0);}ctx.value='250';assert.equal(vm.runInContext('position(value)',ctx),250);
});
