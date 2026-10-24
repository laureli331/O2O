'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./v15-model.js'));else root.V22Model=factory(root.V15Model);})(globalThis,Original=>{
 const KEY='o2o-v22-synthetic-v1',TTL=1800000,NOW='2026-10-24T10:00:00+08:00',ISSUED='2026-10-22T10:00:00+08:00',DUE='2026-10-25T10:00:00+08:00';
 const clone=v=>JSON.parse(JSON.stringify(v)),money=n=>n===null?'待确定':(n/100).toFixed(2),plus=t=>new Date(Date.parse(t)+72*3600000).toISOString();
 function create(scene='normal'){
  const rows=[['T1','洗衣机启动故障检修','维修',20000,15,3000,'service-repair.svg'],['T2','帮忙代取一个快递','跑腿',10000,15,null,'service-errand.svg'],['T3','转让实木书桌','闲置',50000,1,2000,'service-desk.svg'],['T4','上门安装窗帘','其它',10000,10,2000,'service-lamp.svg']].map(([id,title,type,base,rate,cap,image])=>({id,title,type,base,agreed:base,rate,cap,image,amount:Original.commission(base,rate,cap),paid:0,credit:0,paused:0,due:DUE,month:'2026-09',date:'2026-09-22',version:'锁定标准 SYN-1'}));
  rows[0].paid=1000;rows[0].credit=200;rows[0].agreed=18000;
  const s={version:1,revision:1,scene,logged:true,issued:ISSUED,issueStatus:'issued',rows,history:[{...rows[0],id:'H1',title:'台灯线路检修',image:'service-lamp.svg',amount:1500,base:10000,agreed:10000,paid:1500,credit:0,month:'2026-08',due:'2026-09-04T10:00:00+08:00'}],payments:[{id:'SYN-P1',amount:1000,at:'2026-10-23T10:00:00+08:00',allocations:[{id:'T1',amount:1000}],excess:0},{id:'SYN-OLD',amount:2200,at:'2026-09-03T10:00:00+08:00',allocations:[{id:'H1',amount:1500}],excess:700}],credit:{approved:200,used:200,remaining:0},refund:{payment:'SYN-OLD',amount:700,status:'待退回',at:null,channel:true},disputes:[],adjustments:[],closure:null,pending:null,applied:{},requests:{},serial:0,drafts:{}};
  if(scene==='guest')s.logged=false;
  if(['unissued','issue-unknown'].includes(scene)){s.issued=null;s.issueStatus=scene;s.rows.forEach(r=>r.due=null);}
  if(scene==='zero')s.rows.forEach(r=>{r.paid=r.amount-r.credit;});
  if(scene==='credit'){s.rows.forEach(r=>{r.credit=r.amount;r.paid=0;});s.credit={approved:6500,used:6000,remaining:500};s.payments=s.payments.filter(p=>p.id!=='SYN-P1');}
  if(scene==='overdue'){s.issued='2026-10-19T10:00:00+08:00';s.rows.forEach(r=>r.due='2026-10-22T10:00:00+08:00');}
  if(scene==='empty')s.rows=[];
  if(scene==='unknown-fee'){s.rows[0].amount=null;s.rows[0].base=null;}
  if(['paused','need-material','resolved','notice-unknown'].includes(scene)){const r=s.rows[1];r.paused=1500;const d={id:'SYN-D1',row:r.id,amount:1500,reason:'客户尚未支付约定费用，申请核对对应佣金。',status:scene==='need-material'?'待补充':scene==='resolved'||scene==='notice-unknown'?'已有结果':'核验中',request:'请补充双方确认的费用约定或沟通记录。',materials:[],balance:['resolved','notice-unknown'].includes(scene)?1000:null,notice:scene==='resolved'?NOW:null,conclusion:['resolved','notice-unknown'].includes(scene)?'已核定争议余额10元；客户款纠纷不由平台代收。':null};s.disputes.push(d);if(d.notice){r.amount=1000;r.paused=0;r.due=plus(d.notice);}}
  if(scene==='refund-unknown')s.refund.status='结果未知';if(scene==='refund-failed')s.refund.status='失败';if(scene==='no-channel'){s.refund.channel=false;s.refund.status='人工核对中';}
  return s;
 }
 function access(s){if(!s.logged)throw Error('请先登录后查看本人账单。');}
 function item(s,id){access(s);const r=[...s.rows,...s.history].find(r=>r.id===id);if(!r)throw Error('没有这条本人交易记录。');return r;}
 function remaining(r){return r.amount===null?null:Math.max(0,r.amount-r.paid-r.credit);}
 function available(r){const n=remaining(r);return n===null||!r.due?0:Math.max(0,n-r.paused);}
 function totals(s,month='2026-09'){access(s);const rows=month==='2026-08'?s.history:s.rows,unknown=rows.some(r=>r.amount===null),sum=k=>rows.reduce((n,r)=>n+r[k],0);return {amount:unknown?null:sum('amount'),paid:sum('paid'),credit:sum('credit'),remaining:unknown?null:rows.reduce((n,r)=>n+remaining(r),0),paused:sum('paused'),payable:rows.reduce((n,r)=>n+available(r),0),unknown,rows};}
 function cents(value){if(!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(String(value)))throw Error('请输入正数金额，最多两位小数。');const n=Math.round(Number(value)*100);if(!Number.isSafeInteger(n)||n<=0)throw Error('请输入大于0的金额。');return n;}
 function allocation(s,amount){access(s);if(s.issueStatus!=='issued')throw Error('账单尚未成功出账，暂不能缴纳。');if(!Number.isSafeInteger(amount)||amount<=0||amount>totals(s).payable)throw Error('本次金额不能超过当前可缴金额。');let left=amount;const list=[];for(const r of [...s.rows].sort((a,b)=>Date.parse(a.due)-Date.parse(b.due)||a.id.localeCompare(b.id))){const n=Math.min(left,available(r));if(n){list.push({id:r.id,amount:n});left-=n;}}if(left)throw Error('分配发生变化，请重新核对。');return list;}
 function validate(s,kind,payload){access(s);if(kind==='pay')return allocation(s,payload.amount);if(kind==='closure'){if(s.closure)throw Error('注销申请已在处理中。');return [];}
  if(!['dispute','adjust','supplement','appeal'].includes(kind))throw Error('不支持的操作');const r=item(s,payload.row);if(!s.rows.includes(r))throw Error('历史已缴清账单不支持本次操作。');const text=String(payload.reason||'').trim();if(!text||text.length>500||/^(?:双方已确认降价|客户尚未付款|金额需要核对)[。\s]*$/.test(text))throw Error('请说明本次具体情况，填写1—500字。');
  if(payload.images!==undefined&&(!Number.isInteger(payload.images)||payload.images<0||payload.images>9))throw Error('最多添加9张证明图片。');if(/是：[\s。]*$/.test(text))throw Error('请在短句后补充本次具体事实。');
  if(kind==='dispute'){if(s.disputes.some(d=>d.row===r.id&&d.reason===text))throw Error('相同理由已提交，请查看原记录或补充新材料。');if(!Number.isSafeInteger(payload.amount)||payload.amount<=0||remaining(r)===null||payload.amount>remaining(r)-r.paused)throw Error('争议金额不能超过本单尚未暂缓的佣金。');}
  if(kind==='adjust'&&(r.base===null||r.agreed>=r.base||s.adjustments.some(d=>d.row===r.id)))throw Error('本单尚无可申请的新降价，或已有申请在处理中。');
  if(['supplement','appeal'].includes(kind)){const d=s.disputes.find(x=>x.id===payload.dispute&&x.row===r.id);if(!d||kind==='supplement'&&d.status!=='待补充'||kind==='appeal'&&d.status!=='已有结果')throw Error('当前记录不能执行此操作。');if(d.reason===text||d.materials.some(m=>m.reason===text))throw Error('请补充新的具体内容，不要重复原材料。');}return [];
 }
 function apply(s,kind,payload,key){if(s.applied[key])return clone(s.applied[key]);const list=validate(s,kind,payload);let result;
  if(kind==='pay'){for(const a of list)item(s,a.id).paid+=a.amount;result={id:key,kind,amount:payload.amount,at:NOW,allocations:list,excess:0};s.payments.unshift(result);}
  else if(kind==='closure'){s.closure={id:key,status:'受理并核对中',at:NOW,credit:s.credit.remaining,refund:s.refund.status==='已退回'?0:s.refund.amount};result=s.closure;}
  else if(kind==='dispute'){const d={id:key,row:payload.row,amount:payload.amount,reason:payload.reason.trim(),status:'已提交',imageCount:payload.images||0,materials:[],balance:null,notice:null,conclusion:null};s.disputes.unshift(d);item(s,payload.row).paused+=payload.amount;result=d;}
  else if(kind==='adjust'){const d={id:key,row:payload.row,reason:payload.reason.trim(),status:'已提交，等待核验',at:NOW};s.adjustments.unshift(d);result=d;}
  else {const d=s.disputes.find(d=>d.id===payload.dispute);d.materials.push({reason:payload.reason.trim(),imageCount:payload.images||0,at:NOW,kind});if(kind==='supplement')d.status='核验中';result={id:key,status:kind==='appeal'?'申诉已提交，等待受理':'补充已提交',row:d.row};}
  s.revision++;s.pending=null;s.applied[key]=clone(result);(s.requests||={})[key]=JSON.stringify({kind,payload});return clone(result);
 }
 function submit(s,kind,payload,result,key,revision){access(s);if(s.applied[key]){if(s.requests?.[key]!==JSON.stringify({kind,payload}))throw Error('同一请求不能更换提交内容。');return {status:'success',data:clone(s.applied[key])};}if(s.pending)throw Error('有提交结果待确认，请先查询。');if(revision!==s.revision)throw Error('账单已更新，请重新核对。');validate(s,kind,payload);if(result==='failed')return {status:'failed'};if(result==='unknown'){s.pending={kind,payload:clone(payload),key,revision};return {status:'unknown'};}if(result!=='success')throw Error('未知演示结果');return {status:'success',data:apply(s,kind,payload,key)};}
 function query(s,result){access(s);if(!s.pending)throw Error('没有待查询请求。');if(result==='unknown')return {status:'unknown'};const p=clone(s.pending);if(result==='failed'){s.pending=null;return {status:'failed',payload:p.payload,kind:p.kind};}if(s.revision!==p.revision)throw Error('账单已更新，需人工核对原请求，不能重复提交。');if(result!=='success')throw Error('未知演示结果');return {status:'success',data:apply(s,p.kind,p.payload,p.key)};}
 function refundQuery(s,result){access(s);if(['已退回','待核对','人工核对中'].includes(s.refund.status))return s.refund.status;if(!s.refund.channel)return s.refund.status='人工核对中';if(result==='success'){s.refund.status='已退回';s.refund.at=NOW;}else if(result==='failed')s.refund.status='失败';else s.refund.status='结果未知';return s.refund.status;}
 function overdue(s){access(s);return s.rows.some(r=>r.due&&Date.parse(r.due)<=Date.parse(NOW)&&available(r)>0);}
 function save(s,storage){storage.setItem(KEY,JSON.stringify({expires:Date.now()+TTL,state:s}));}
 function load(storage,now=Date.now()){try{const v=JSON.parse(storage.getItem(KEY));return v?.state?.version===1&&v.expires>now&&v.expires<=now+TTL&&Array.isArray(v.state.rows)?v.state:null;}catch{return null;}}
 return {KEY,TTL,NOW,ISSUED,DUE,create,clone,money,plus,access,item,remaining,available,totals,cents,allocation,validate,submit,query,refundQuery,overdue,save,load};
});
