'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BannerCustom=factory();})(globalThis,()=>{
 const PRICE=9900,KEY='o2o-banner-standard-service-v2',TTL=1800000;
 const goals={promotion:'优惠促销',service:'主打服务',store:'门店展示'},targets={'merchant-qinghe':'青禾生活馆 · 经营主页'};
 const labels={idle:'尚未申请',payment:'待付定制费','payment-unknown':'定制费核实中',queued:'等待制作',producing:'制作中',candidates:'待选方案',revising:'微调中',revised:'微调已交付',correction:'纠错处理中',confirmed:'待素材审核',approved:'素材已通过',rejected:'素材需修改',refund:'退款处理中',refunded:'已退款','refund-resolved':'退款处理已完成'};
 const clone=v=>JSON.parse(JSON.stringify(v)),xml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 function create(adId=''){return {adId,id:'CUSTOM-'+adId,status:'idle',brief:null,fee:{amount:PRICE,paid:false,refundCents:null},productionStarted:false,candidates:[],selected:null,revisionUsed:false,feedback:[],history:[],confirmed:false,qualityPassed:false};}
 function log(j,action,note=''){j.history.push({action,note,at:Date.now()});}
 function briefErrors(b){const e={};if(!goals[b?.goal])e.goal='请选择推广目标';if(!String(b?.name||'').trim())e.name='请核对店铺名称';if(!String(b?.selling||'').trim())e.selling='请填写真实服务卖点';if(Array.from(b?.selling||'').length>60)e.selling='请将卖点精简至60字，确保模板完整展示';if(Array.from(b?.title||'').length>30)e.title='标题请控制在30字以内';if(Array.from(b?.offer||'').length>20)e.offer='优惠说明请控制在20字以内';if(!targets[b?.target])e.target='请选择本店的广告跳转页面';if((b?.offerStart||b?.offerEnd)&&(!b.offerStart||!b.offerEnd||b.offerStart>=b.offerEnd))e.offerEnd='请补齐先后正确的活动起止时间';return e;}
 function submitBrief(j,b){if(!['idle','payment'].includes(j.status))throw Error('制作申请已提交，请通过反馈补充内容');if(Object.keys(briefErrors(b)).length)throw Error(Object.values(briefErrors(b))[0]);j.brief=clone(b);j.status='payment';log(j,'提交需求');}
 function recordPayment(j,result){
  if(!['payment','payment-unknown'].includes(j.status))throw Error('当前无需核对定制付款');
  if(result==='unknown'){j.status='payment-unknown';return;}
  if(result==='unpaid'){j.fee.paid=false;j.status='payment';return;}
  if(result!=='paid')throw Error('请核对付款记录');
  if(Object.keys(briefErrors(j.brief)).length)throw Error('必要资料不完整');j.fee.paid=true;j.status='queued';log(j,'合成定制付款记录','99元，不锁广告位');
 }
 function startProduction(j){if(j.status!=='queued'||!j.fee.paid)throw Error('先核对定制付款和完整需求');j.productionStarted=true;j.status='producing';j.method=j.brief.title?(j.brief.photo?'自备照片＋模板排版':'素材库＋模板排版'):'按需文案辅助＋模板排版（合成）';log(j,'开始制作',j.method);}
 function current(j){return j.candidates.find(c=>c.id===j.selected)||null;}
 function deliver(j){
  if(j.status!=='producing'||!j.fee.paid)throw Error('当前不能交付候选');
  const b=j.brief,title=(b.title||b.selling).slice(0,30),subtitle=[b.selling,b.offer,b.offerStart&&b.offerEnd?b.offerStart+'—'+b.offerEnd:''].filter(Boolean).join(' · ');
  j.candidates=[0,1,2].map((n)=>({id:j.id+'-'+n,version:1,artwork:{name:b.name,title,subtitle:b.selling,offer:b.offer||'',offerStart:b.offerStart||'',offerEnd:b.offerEnd||'',style:['natural','warm','clean'][n],layout:n===1?'center':'left',variant:n,goal:b.goal,button:b.button||''},versions:[]}));
  j.qualityPassed=j.candidates.every(c=>c.artwork.title.trim()&&c.artwork.name.trim());if(!j.qualityPassed)throw Error('文字检查未通过，请补充需求');j.status='candidates';log(j,'交付三个候选','仅合成模板，未实际调用AI');
 }
 function choose(j,id){if(!['candidates','revised','rejected'].includes(j.status))throw Error('当前不能更换方案');if(j.revisionUsed&&id!==j.selected)throw Error('已选方向锁定，换方向请申请评估');if(!j.candidates.some(c=>c.id===id))throw Error('请选择本订单的方案');j.selected=id;log(j,'选择方案',id);}
 function requestRevision(j,values,correction=false){
  if(!(correction?['candidates','revised','rejected','confirmed','approved']:['candidates','revised','rejected']).includes(j.status)||!current(j))throw Error('先选定一个候选方案');
  if(!correction&&j.revisionUsed)throw Error('一轮集中微调已使用，整体重做请申请评估');
  if(Array.from(values.title||'').length>30||Array.from(values.subtitle||'').length>60||Array.from(values.offer||'').length>20)throw Error('请精简文字，确保模板完整显示');if((values.offerStart||values.offerEnd)&&(!values.offerStart||!values.offerEnd||values.offerStart>=values.offerEnd))throw Error('请核对活动日期先后');if(!String(values.title||'').trim())throw Error('请保留明确的宣传标题');
  if(!correction)j.revisionUsed=true;j.feedback.push({values:clone(values),correction,at:Date.now()});j.status=correction?'correction':'revising';j.confirmed=false;log(j,correction?'提交平台纠错':'提交一轮集中微调','一次可修改多个字段');
 }
 function deliverRevision(j){
  if(!['revising','correction'].includes(j.status))throw Error('没有待交付的修改');const c=current(j),f=j.feedback.at(-1);c.versions.push({version:c.version,artwork:clone(c.artwork)});
  for(const k of ['title','subtitle','offer','offerStart','offerEnd','button'])if(k in f.values)c.artwork[k]=String(f.values[k]);c.version++;j.status='revised';j.qualityPassed=!!c.artwork.title.trim();log(j,'交付修改',f.correction?'免费平台纠错，不占微调次数':'保持已选构图和风格');
 }
 function confirm(j){if(!['candidates','revised'].includes(j.status)||!current(j)||j.candidates.length!==3||!j.qualityPassed||!j.fee.paid)throw Error('请先选择并核对已交付的三个方案');j.confirmed=true;j.status='confirmed';log(j,'商家确认最终素材');}
 function approve(j){if(j.status!=='confirmed'||!j.confirmed||!j.qualityPassed)throw Error('先由商家确认并通过检查');j.status='approved';log(j,'素材审核通过');}
 function reject(j,reason){if(j.status!=='confirmed')throw Error('没有待审核素材');if(!String(reason).trim())throw Error('请说明修改原因');j.status='rejected';j.confirmed=false;j.rejection=reason;log(j,'素材审核未通过',reason);}
 function refundQuote(j){if(!j.fee.paid||['refund','refunded','refund-resolved'].includes(j.status))throw Error('当前没有可申请退款的定制费用');return j.productionStarted?null:PRICE;}
 function requestRefund(j,reason){const cents=refundQuote(j);if(!String(reason||'').trim())throw Error('请说明取消原因');j.beforeRefund=j.status;j.status='refund';j.fee.refundCents=cents;log(j,'申请定制退款',reason);}
 function completeRefund(j,cents,reason){if(j.status!=='refund')throw Error('没有待处理退款');if(!Number.isSafeInteger(cents)||cents<0||cents>PRICE)throw Error('请核对0—99元的退款金额');if(!j.productionStarted&&cents!==PRICE)throw Error('未开始制作应退全额99元');if(!String(reason||'').trim())throw Error('请记录已完成工作与处理依据');j.fee.refundCents=cents;j.status=cents===0?'refund-resolved':'refunded';log(j,'合成退款处理结果',reason);}
 function scopeReview(j,reason){if(!String(reason||'').trim())throw Error('请说明希望改变的方向');j.scopeRequest=reason;log(j,'申请整体方向评估','不自动收费或重新制作：'+reason);}
 function readStore(storage,now=Date.now()){try{const v=JSON.parse(storage.getItem(KEY));return v?.expires>now&&v.expires<=now+TTL&&v.jobs&&typeof v.jobs==='object'?v.jobs:{};}catch{return {};}}
 function save(j,storage,now=Date.now()){const jobs=readStore(storage,now);jobs[j.adId]=j;storage.setItem(KEY,JSON.stringify({expires:now+TTL,jobs}));}
 function load(storage,adId,now=Date.now()){return readStore(storage,now)[adId]||null;}
 function all(storage){return Object.values(readStore(storage));}
 function svg(a){
  const palettes={natural:['#e9efde','#375d46','#8ba77b'],warm:['#f4e9d7','#6d4b37','#c59a65'],clean:['#e6eef0','#2e5362','#80a4af']},p=palettes[a.style]||palettes.natural,center=a.layout==='center',x=center?600:72,anchor=center?'middle':'start',goal=goals[a.goal]||'门店展示';
  const lines=(text,n)=>{const chars=Array.from(String(text||''));return Array.from({length:Math.ceil(chars.length/n)},(_,i)=>chars.slice(i*n,(i+1)*n).join(''));};
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="660" viewBox="0 0 1200 660"><rect width="1200" height="660" fill="'+p[0]+'"/><circle cx="'+(a.variant===2?150:1060)+'" cy="350" r="320" fill="'+p[2]+'" opacity=".18"/><path d="M900 630Q710 270 1020 70Q1230 400 1060 660Z" fill="'+p[2]+'" opacity=".3"/><g fill="'+p[1]+'" font-family="Microsoft YaHei,PingFang SC,sans-serif" text-anchor="'+anchor+'"><text x="'+x+'" y="90" font-size="'+(a.goal==='store'?38:28)+'">'+xml(a.name)+'</text><text x="'+x+'" y="140" font-size="22">'+xml(goal)+'</text>'+lines(a.title,15).map((t,i)=>'<text x="'+x+'" y="'+(240+i*72)+'" font-size="54" font-weight="600">'+xml(t)+'</text>').join('')+lines(a.subtitle,24).map((t,i)=>'<text x="'+x+'" y="'+(390+i*32)+'" font-size="24">'+xml(t)+'</text>').join('')+(a.offer?'<text x="'+x+'" y="530" font-size="'+(a.goal==='promotion'?38:28)+'" font-weight="600">'+xml(a.offer)+'</text>':'')+(a.offerStart&&a.offerEnd?'<text x="'+x+'" y="575" font-size="22">'+xml(a.offerStart+'—'+a.offerEnd)+'</text>':'')+'<text x="'+x+'" y="625" font-size="24">'+xml(a.button||'')+'</text></g></svg>';
 }
 function source(a){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg(a));}
 return {PRICE,KEY,TTL,goals,targets,labels,create,briefErrors,submitBrief,recordPayment,startProduction,current,deliver,choose,requestRevision,deliverRevision,confirm,approve,reject,refundQuote,requestRefund,completeRefund,scopeReview,save,load,all,svg,source};
});
