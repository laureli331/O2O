'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CommerceModel=factory();})(globalThis,()=>{
 const HOUR=3600000,DAY=24*HOUR,KEY='o2o-commerce-v1',TTL=30*60000;
 const beijing=t=>new Date(t+8*HOUR).toISOString().slice(0,16);
 const time=v=>typeof v==='number'?v:Date.parse(v+':00+08:00');
 function createState(now=Date.now()){
  return {version:1,clock:now,account:'resident-demo',merchantId:'shop-demo',existingSubjects:[],pending:null,events:[],
   merchant:{status:'new',notifiedAt:null,activeUntil:null,draft:{name:'',category:'',area:'',phone:'',address:'',hours:'',subjectType:'licensed',subject:'entity-demo',consent:false},reason:'',order:null,correction:null,anomaly:null},
   activity:{id:'campaign-demo',status:'draft',safety:'unknown',reason:'',stopped:false,draft:{title:'邻里到店优惠',threshold:'50',discount:'5',quantity:'100',start:beijing(now- HOUR),end:beijing(now+7*DAY),usage:'到店消费满50元可用，不与其他优惠叠加。'}},coupons:[]};
 }
 function permissions(s,now){const m=s.merchant,has=m.status==='active',valid=has&&m.activeUntil>now;return {create:valid,redeem:has,ads:has||m.status==='approved',correction:has,pay:has||(m.status==='approved'&&Number.isFinite(m.notifiedAt)&&now<m.notifiedAt+72*HOUR),expired:has&&!valid};}
 function validateMerchant(d,s){const e={};for(const [k,label]of [['name','经营名称'],['category','经营类别'],['area','服务区域']])if(!d[k]?.trim())e[k]='请填写'+label;if(!d.consent)e.consent='请确认公开资料';if(s.existingSubjects.includes(d.subjectType+':'+d.subject))e.subject='该经营主体已有档案';return e;}
 function validateActivity(d,now){const e={},money=v=>/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(String(v))&&Number(v)>0;if(!d.title?.trim())e.title='请填写活动名称';if(!money(d.threshold))e.threshold='请填写大于0的金额，最多两位小数';if(!money(d.discount)||Number(d.discount)>Number(d.threshold))e.discount='优惠金额须大于0且不超过使用门槛';if(!/^[1-9]\d*$/.test(String(d.quantity))||!Number.isSafeInteger(Number(d.quantity)))e.quantity='请填写正整数';const start=time(d.start),end=time(d.end);if(!Number.isFinite(start))e.start='请选择开始时间';if(!Number.isFinite(end)||end<=start||end<=now)e.end='结束时间须晚于开始时间和当前时间';if(!d.usage?.trim())e.usage='请填写使用说明';return e;}
 const fail=message=>({ok:false,message});
 function couponStatus(c,now){return c.usedAt?'used':now>=c.end?'expired':'available';}
 function claimable(s,account,now){const a=s.activity,p=permissions(s,now),d=a.draft;if(!account)return '请先微信登录';if(a.status!=='published')return '活动暂未开放';if(a.stopped||!p.create)return '已停止领取';if(now<time(d.start))return '活动尚未开始';if(now>=time(d.end))return '活动已结束';if(s.coupons.some(c=>c.account===account&&c.activityId===a.id))return '你已经领过这张券';if(s.coupons.filter(c=>c.activityId===a.id).length>=Number(d.quantity))return '已领完';return '';}
 function redeemable(s,code,merchant,now){const c=s.coupons.find(c=>c.code===code);if(!c)return '没有找到这张券，请核对券码';if(c.merchantId!==merchant)return '这不是本店的优惠券';if(c.usedAt)return '这张券已经核销';if(now<c.start)return '还未到使用时间';if(now>=c.end)return '这张券已经过期';if(!permissions(s,now).redeem)return '请使用所属商家的管理身份';return '';}
 function apply(s,c,now=s.clock){
  if(c.type==='query'){if(!s.pending)return fail('没有待核实操作');const original=s.pending;s.pending=null;return apply(s,{...original,result:'success',settledRequest:true},now);}
  if(s.pending)return fail('上次操作结果待核实，请先查询');
  const m=s.merchant,a=s.activity,p=permissions(s,now),account=Object.hasOwn(c,'account')?c.account:s.account;
  let error='';
  switch(c.type){
   case 'submitMerchant': if(!['new','draft','supplement','rejected'].includes(m.status))error='当前申请不能重复提交';else if(Object.keys(validateMerchant(m.draft,s)).length)error='请完善入驻资料';break;
   case 'reviewMerchant': if(!['review','supplement'].includes(m.status))error='该申请已更新，请刷新核对';if(c.decision==='approved'&&s.existingSubjects.includes(m.draft.subjectType+':'+m.draft.subject))error='该主体已有档案，不能重复开通';if(c.decision!=='approved'&&!c.reason?.trim())error='请填写具体原因';break;
   case 'recheck': if(m.status!=='approved'||!m.notifiedAt||now<m.notifiedAt+72*HOUR)error='当前无需重新核对';break;
   case 'notify': if(m.status!=='approved')error='申请尚未通过';break;
   case 'pay': if(!p.pay&&!(c.settledRequest&&m.status==='approved'&&m.notifiedAt!==null&&c.requestedAt<m.notifiedAt+72*HOUR))error='本次审核已失效或尚未通知，请重新核对';break;
   case 'submitActivity': if(!p.create)error='续费后可发布新活动';else if(!['draft','rejected'].includes(a.status))error='该活动不能重复提交';else if(Object.keys(validateActivity(a.draft,now)).length)error='请检查活动条件';break;
   case 'reviewActivity': if(a.status!=='review')error='该活动已更新，请刷新核对';else if(c.decision==='approved'&&a.safety!=='passed')error='须先完成内容安全检测';else if(c.decision==='approved'&&time(a.draft.end)<=now)error='活动有效期已结束，请退回修改';else if(c.decision!=='approved'&&!c.reason?.trim())error='请填写具体原因';break;
   case 'claim': error=claimable(s,account,now);break;
   case 'redeem': error=redeemable(s,c.code,c.merchant||s.merchantId,now);break;
   case 'stop': if(a.status!=='published'||a.stopped)error='当前活动无需停止';break;
   case 'correct': if(!p.correction)error='尚无可更正的经营档案';else if(m.correction?.status==='review')error='上一项更正正在审核';else if(!c.phone?.trim()&&!c.address?.trim()&&!c.businessStatus?.trim())error='请填写需要更正的信息';break;
   case 'reviewCorrection': if(m.correction?.status!=='review')error='没有待审核更正';else if(c.decision!=='approved'&&!c.reason?.trim())error='请填写具体原因';break;
   case 'anomaly': if(!m.order)error='请从原入驻订单申请';else if(m.anomaly&&!['supplement'].includes(m.anomaly.status))error='本事项正在处理，请查看进度';else if(!c.reason?.trim())error='请描述本次异常';break;
   case 'reviewAnomaly': if(!m.anomaly||!['review','supplement'].includes(m.anomaly.status))error='没有待核对事项';else if(!c.reason?.trim())error='请填写核对结果或所需材料';break;
   case 'refund': if(!m.anomaly||m.anomaly.status!=='review'||!c.verified||!/^\d+(\.\d{1,2})?$/.test(c.amount)||Number(c.amount)<=0||Number(c.amount)>99)error='请核实原收款并填写本订单可退金额';break;
   default:error='未知操作';
  }
  if(error)return fail(error);
  if(c.result==='failed')return fail('未完成，请重试；填写内容已保留');
  if(c.result==='unknown'){s.pending={...c,result:undefined,account,requestedAt:now};return {ok:true,unknown:true,message:'结果正在核实，请查询本次操作'};}
  switch(c.type){
   case 'submitMerchant':m.status='review';m.reason='';break;
   case 'reviewMerchant':m.status=c.decision;m.reason=c.reason||'';if(c.decision==='approved')m.notifiedAt=null;break;
   case 'recheck':m.status='review';m.notifiedAt=null;break;
   case 'notify':if(m.notifiedAt===null)m.notifiedAt=now;break;
   case 'pay':{const until=Math.max(now,m.activeUntil||0)+30*DAY;m.order={id:'JOIN-'+(s.events.length+1),paidAt:now,activatedAt:now,amount:99,end:until};m.activeUntil=until;m.status='active';if(!s.existingSubjects.includes(m.draft.subjectType+':'+m.draft.subject))s.existingSubjects.push(m.draft.subjectType+':'+m.draft.subject);break;}
   case 'submitActivity':a.status='review';a.safety='unknown';a.reason='';break;
   case 'reviewActivity':a.status=c.decision==='approved'?'published':c.decision;a.reason=c.reason||'';break;
   case 'claim':s.coupons.push({id:'coupon-'+(s.coupons.length+1),code:'DEMO-'+String(s.coupons.length+1).padStart(6,'0'),account,activityId:a.id,merchantId:s.merchantId,merchant:m.draft.name||'合成商店',title:a.draft.title,threshold:a.draft.threshold,discount:a.draft.discount,usage:a.draft.usage,start:time(a.draft.start),end:time(a.draft.end),claimedAt:now,usedAt:null});break;
   case 'redeem':s.coupons.find(x=>x.code===c.code).usedAt=now;break;
   case 'stop':a.stopped=true;break;
   case 'correct':m.correction={status:'review',phone:c.phone,address:c.address,businessStatus:c.businessStatus,reason:c.reason||'',original:{phone:m.draft.phone,address:m.draft.address},at:now};break;
   case 'reviewCorrection':m.correction.status=c.decision;m.correction.reply=c.reason||'';if(c.decision==='approved'){for(const key of ['phone','address','businessStatus'])if(m.correction[key])m.draft[key]=m.correction[key];}break;
   case 'anomaly':m.anomaly={status:'review',kind:c.kind,reason:c.reason,receivedAt:now,completeAt:c.complete?now:null,reply:'',history:[...(m.anomaly?.history||[])]};break;
   case 'reviewAnomaly':m.anomaly.status=c.decision;m.anomaly.reply=c.reason;m.anomaly.history.push({at:now,text:c.reason});break;
   case 'refund':m.anomaly.status='refund-processing';m.anomaly.reply=c.reason||'核对后已发起退款，到账以渠道结果为准';m.anomaly.refundAmount=Number(c.amount);break;
  }
  s.events.push({type:c.type,at:now,summary:c.reason||''});return {ok:true,message:'已完成'};
 }
 function save(storage,s,now=Date.now()){try{storage.setItem(KEY,JSON.stringify({version:1,savedAt:now,state:s}));return true;}catch{return false;}}
 function load(storage,now=Date.now()){try{const p=JSON.parse(storage.getItem(KEY));if(!p||p.version!==1||!Number.isFinite(p.savedAt)||now-p.savedAt>=TTL||now<p.savedAt||!p.state?.merchant?.draft||!p.state?.activity?.draft||!Array.isArray(p.state.coupons))return null;return p.state;}catch{return null;}}
 return {HOUR,DAY,TTL,KEY,beijing,time,createState,permissions,validateMerchant,validateActivity,couponStatus,claimable,redeemable,apply,load,save};
});
