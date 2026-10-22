'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BannerModel=factory();})(globalThis,()=>{
 const DAY=86400,NOW=Date.parse('2026-10-22T10:00:00+08:00')/1000,KEY='o2o-banner-preview-v1',TTL=1800000;
 const positions=[{name:'首图',price:29900},{name:'次图',price:24900},{name:'末图',price:19900}];
 const states=['draft','pending','rejected','ready','payment-unknown','scheduled','live','ended','refund-pending','refund-unknown','refunded'];
 function create(status='draft'){
  if(!states.includes(status))throw Error('未知演示状态');
  const live=['live','ended','refund-pending','refund-unknown','refunded'].includes(status),start=NOW+(status==='ended'?-30:live?-10:2)*DAY;
  return {status,position:0,start,end:start+30*DAY,reservedUntil:NOW+DAY,paid:['scheduled','live','ended','refund-pending','refund-unknown','refunded'].includes(status),actualStart:live?start:null,stopAt:status.startsWith('refund')?NOW:null,refund:null,modified:false,form:{name:'青禾生活馆',title:'把日常，过得更有滋味',description:'社区日用好物与生活用品，欢迎邻里来逛逛。',region:'演示社区',hours:'09:00—20:00',address:'演示街道 18 号（合成）',phone:'000-0000-0000',publicPhone:false,publicAddress:false,image:true}};
 }
 function errors(form){const out={};for(const [key,label]of [['name','经营名称'],['title','广告标题'],['description','广告说明'],['region','经营或服务区域']])if(!String(form[key]||'').trim())out[key]='请填写'+label;if(!form.image)out.image='请选择广告首图';if(form.publicPhone&&!String(form.phone||'').trim())out.phone='请填写需要公开的经营电话';if(form.publicAddress&&!String(form.address||'').trim())out.address='请填写需要公开的地址';return out;}
 function submit(s,form){if(!['draft','rejected'].includes(s.status))throw Error('当前不能重复提交');if(Object.keys(errors(form)).length)throw Error('请补齐标记的内容');s.form=JSON.parse(JSON.stringify(form));s.status='pending';}
 function pay(s,result,now=NOW){if(s.status!=='ready'||s.paid||s.reservedUntil<=now)throw Error('请先核对审核、排期及保留状态');if(!['success','unknown','failed'].includes(result))throw Error('未知付款结果');if(result==='success'){s.paid=true;s.status='scheduled';}if(result==='unknown')s.status='payment-unknown';return result;}
 function queryPayment(s,result){if(s.status!=='payment-unknown')throw Error('当前无需核实付款');if(result==='success'){s.paid=true;s.status='scheduled';}else if(result==='unpaid'){s.paid=false;s.status='ready';}else if(result!=='unknown')throw Error('未知查询结果');}
 function refundCents(paid,remaining,total){if(!Number.isSafeInteger(paid)||paid<0||!Number.isSafeInteger(total)||total<=0||!Number.isSafeInteger(remaining)||remaining<0)throw Error('退款计算参数无效');const r=BigInt(Math.min(total,remaining)),t=BigInt(total);return Number((BigInt(paid)*r*2n+t)/(2n*t));}
 function quote(s,now=NOW){if(!s.paid||!['scheduled','live'].includes(s.status))throw Error('当前购买期不能申请退订');const amount=positions[s.position].price,remaining=s.status==='scheduled'?s.end-s.start:Math.max(0,s.end-now);return {cents:refundCents(amount,remaining,s.end-s.start),at:now,remaining};}
 function cancel(s,confirmed,now=NOW){if(!confirmed)throw Error('请确认终止影响');const q=quote(s,now);s.stopAt=now;s.refund=q;s.status='refund-pending';return q;}
 function queryRefund(s,result){if(!['refund-pending','refund-unknown'].includes(s.status))throw Error('当前无待处理退款');if(result==='success')s.status='refunded';else if(result==='unknown'||result==='failed')s.status='refund-unknown';else throw Error('未知退款结果');}
 function report(mode='7',condition='normal'){if(condition==='unknown')return {views:null,clicks:null,rate:null,days:[]};const all=[{date:'10-16',views:128,clicks:8},{date:'10-17',views:153,clicks:9},{date:'10-18',views:176,clicks:12},{date:'10-19',views:142,clicks:8},{date:'10-20',views:208,clicks:15},{date:'10-21',views:187,clicks:13},{date:'10-22',views:164,clicks:10}],days=(mode==='today'?all.slice(-1):all).map(d=>({...d,...(condition==='zero'?{views:0,clicks:0}:{})})),views=days.reduce((n,d)=>n+d.views,0),clicks=days.reduce((n,d)=>n+d.clicks,0);return {views,clicks,rate:views?clicks/views:null,days};}
 function save(s,storage,now=Date.now()){storage.setItem(KEY,JSON.stringify({version:1,expires:now+TTL,state:s}));}
 function load(storage,now=Date.now()){try{const v=JSON.parse(storage.getItem(KEY));if(v?.version!==1||v.expires<=now||v.expires>now+TTL||!states.includes(v.state?.status)||!positions[v.state.position]||typeof v.state.form?.name!=='string')return null;return v.state;}catch(e){return null;}}
 return {DAY,NOW,KEY,TTL,positions,states,create,errors,submit,pay,queryPayment,refundCents,quote,cancel,queryRefund,report,save,load};
});
