'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.V08Model=factory();})(globalThis,()=>{
 const HOUR=3600000,NOW=Date.UTC(2026,9,21,2),labels={none:'尚未申请',pending:'等待处理',approved:'申请已获准',rejected:'已拒绝',withdrawn:'已撤回',revoked:'已撤销',invalid:'已失效'};
 const terminal=new Set(['rejected','withdrawn','revoked','invalid']);
 function create(){
  const people={me:{name:'演示用户',person:'self'},seller:{name:'木木邻居',person:'seller'},a:{name:'小满',person:'a'},b:{name:'阿青',person:'b'},c:{name:'林叔',person:'c'},d:{name:'小禾',person:'d'},alias:{name:'本人另一账号',person:'self'},publicChair:{name:'演示用户 C',person:'chair-owner'},publicLamp:{name:'演示用户 F',person:'lamp-owner'}};
  const records=[
   {id:'S1',owner:'seller',applicant:'me',title:'实木小书桌',cover:'desk',state:'pending'},
   {id:'S2',owner:'a',applicant:'me',title:'多层置物架',cover:'storage',state:'approved'},
   {id:'S3',owner:'b',applicant:'me',title:'折叠学习桌',cover:'desk',state:'rejected',changed:NOW-12*HOUR},
   {id:'S4',owner:'c',applicant:'me',title:'简约小书桌',cover:'desk',state:'withdrawn',changed:NOW-25*HOUR},
   {id:'R1',owner:'me',applicant:'a',title:'九成新折叠书桌',cover:'desk',state:'pending'},
   {id:'R2',owner:'me',applicant:'b',title:'小户型书桌',cover:'desk',state:'approved'},
   {id:'R3',owner:'me',applicant:'c',title:'书房置物架',cover:'storage',state:'approved',trade:'active'},
   {id:'R4',owner:'me',applicant:'d',title:'实木折叠书桌',cover:'desk',state:'approved',trade:'disputed'},
   {id:'OLD',owner:'seller',applicant:'me',title:'历史联系记录',cover:'repair',kind:'legacy',state:'invalid',postState:'unavailable'},
   {id:'OUTSIDE',owner:'a',applicant:'b',title:'无关用户记录',cover:'desk',state:'pending'},
   {id:'NEW',owner:'publicChair',applicant:'me',title:'转让一把实木靠背椅',cover:'chair',state:'none',amount:8000},
   {id:'LAMP',owner:'publicLamp',applicant:'me',title:'闲置台灯，价格面议',cover:'lamp',state:'none',amount:null}
  ].map((r,i)=>({...r,kind:r.kind||'idle',post:'POST-'+r.id,amount:r.amount===null?null:r.amount??8600,trade:r.trade||'none',postState:r.postState||'selling',created:r.changed?r.changed-HOUR:NOW-(i+1)*HOUR,changed:r.changed||NOW-(i+1)*HOUR,retryAt:0,revision:1,history:[]}));
  for(const r of records){if(['rejected','withdrawn','revoked'].includes(r.state))r.retryAt=r.changed+24*HOUR;r.history=[{at:r.created,text:'发起联系申请'},...(r.state!=='pending'&&r.state!=='none'?[{at:r.changed,text:labels[r.state]}]:[])];if(r.state==='none')r.history=[];}
  return {now:NOW,user:'me',people,records,operations:{}};
 }
 function participant(r,user){return r.owner===user||r.applicant===user;}
 function get(s,id,user=s.user){const r=s.records.find(r=>r.id===id);if(!r||!user||!participant(r,user))throw Error('只能查看本人相关申请');return r;}
 function filter(s,{tab='sent',status='all',user=s.user}={}){if(!user)return [];return s.records.filter(r=>participant(r,user)&&r.state!=='none'&&(tab==='sent'?r.applicant===user:tab==='received'?r.owner===user:r.state!=='pending')&&(status==='all'||r.state===status)).sort((a,b)=>b.changed-a.changed||a.id.localeCompare(b.id));}
 function available(r){return r.kind==='idle'&&r.postState==='selling'&&r.trade==='none';}
 function actions(s,r,user=s.user){if(!user||!participant(r,user)||r.kind==='legacy')return [];const owner=r.owner===user,result=[];
  if(r.state==='pending'&&available(r))result.push(owner?'reject':'withdraw',...(owner?['approve']:[]));
  if(owner&&r.state==='approved'&&r.trade==='none')result.push('revoke');
  if(!owner&&['none','rejected','withdrawn','revoked'].includes(r.state)&&available(r)&&s.now>=r.retryAt&&s.people[r.owner]?.person!==s.people[r.applicant]?.person)result.push('request');
  if(r.state==='approved'&&available(r))result.push('trade');
  if(r.state==='approved'&&['active','disputed'].includes(r.trade))result.push('order');
  return result;
 }
 function execute(s,cmd){const r=get(s,cmd.id,cmd.user);if(r.revision!==cmd.revision)throw Error('申请状态已更新，请核对最新内容后再操作');if(!actions(s,r,cmd.user).includes(cmd.action)||['trade','order'].includes(cmd.action))throw Error('当前状态不允许此操作');
  if(cmd.action==='request'){
   if(s.people[r.owner]?.person===s.people[r.applicant]?.person)throw Error('不能向本人发起联系申请');
   if(s.records.some(x=>x.id!==r.id&&x.post===r.post&&x.applicant===r.applicant&&x.state==='pending'))throw Error('已有一份待处理申请，请勿重复提交');
  }
  const next={request:'pending',approve:'approved',reject:'rejected',withdraw:'withdrawn',revoke:'revoked'}[cmd.action];
  r.state=next;r.changed=s.now;r.revision++;r.retryAt=['rejected','withdrawn','revoked'].includes(next)?s.now+24*HOUR:0;if(cmd.action==='request')r.created=s.now;
  r.history.push({at:s.now,text:{request:'发起联系申请',approve:'卖家同意申请',reject:'卖家拒绝申请',withdraw:'申请人撤回申请',revoke:'卖家撤销联系资格'}[cmd.action]});return r;
 }
 function perform(s,cmd,{unknown=false}={}){
  if(!cmd.user)throw Error('请先登录');if(!cmd.key)throw Error('请重新核对本次操作');const fingerprint=JSON.stringify([cmd.id,cmd.user,cmd.action,cmd.revision]),cached=s.operations[cmd.key];
  if(cached){if(cached.fingerprint!==fingerprint)throw Error('本次操作内容已变化，请重新核对');return cached.status;}
  if(Object.values(s.operations).some(op=>op.status==='unknown'&&op.cmd.id===cmd.id&&op.cmd.user===cmd.user))throw Error('结果正在核对，请先查询本次操作');
  const r=get(s,cmd.id,cmd.user);if(r.revision!==cmd.revision||!actions(s,r,cmd.user).includes(cmd.action))throw Error('申请状态已更新，请核对最新内容后再操作');
  const op={cmd:{...cmd},fingerprint,status:unknown?'unknown':'done'};if(!unknown)execute(s,cmd);s.operations[cmd.key]=op;return op.status;
 }
 function query(s,key,user=s.user){const op=s.operations[key];if(!op||op.cmd.user!==user)throw Error('只能查询本人的操作');if(op.status==='unknown'){try{execute(s,op.cmd);op.status='done';}catch(e){op.status='changed';op.message=e.message;}}return op.status;}
 function view(s,id,user=s.user){const r=get(s,id,user);return {id:r.id,title:r.title,cover:r.cover,kind:r.kind,state:r.state,amount:r.amount,owner:r.owner,applicant:r.applicant,trade:r.trade,postState:r.postState,created:r.created,changed:r.changed,retryAt:r.retryAt,revision:r.revision,history:r.history.map(h=>({...h})),phone:'138 **** 1020',wechat:'l****u'};}
 return {HOUR,NOW,labels,terminal,create,get,filter,actions,perform,query,view};
});
