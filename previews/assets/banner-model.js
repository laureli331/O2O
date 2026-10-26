'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BannerModel=factory();})(globalThis,()=>{
 const DAY=86400,NOW=Date.parse('2026-10-22T10:00:00+08:00')/1000,KEY='o2o-banner-preview-v1',TTL=1800000;
 const merchant=Object.freeze({name:'青禾生活馆',region:'演示社区'});
 const periods=[7,14,30],prices={7:[9900,6900,4900],14:[17900,12900,8900],30:[29900,21900,14900]},positions=[{name:'首位（默认显示）',price:29900},{name:'次位',price:21900},{name:'末位',price:14900}];
 const INVENTORY_KEY='o2o-banner-inventory-preview-v2';
 function price(position,days=30){if(!positions[position]||!periods.includes(Number(days)))throw Error('请选择有效的位置和周期');return prices[days][position];}
 function amount(s){return s.quotedCents??price(s.position,s.days||30);}
 function id(){return 'DEMO-AD-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);}
 const states=['empty','draft','needs-schedule','pending','rejected','ready','payment-unknown','scheduled','live','ended','refund-pending','refund-unknown','refunded'];
 function create(status='draft'){
  if(!states.includes(status))throw Error('未知演示状态');
  const live=['live','ended','refund-pending','refund-unknown','refunded'].includes(status),start=NOW+(status==='ended'?-30:live?-10:2)*DAY;
  const record={id:id(),merchantId:'DEMO-MERCHANT-QINGHE',days:30,quotedCents:['ready','payment-unknown','scheduled','live','ended','refund-pending','refund-unknown','refunded'].includes(status)?29900:null,pricingVersion:'2026-10-26',materialApproved:!['empty','draft','pending','rejected'].includes(status),paymentStatus:status==='payment-unknown'?'unknown':['scheduled','live','ended','refund-pending','refund-unknown','refunded'].includes(status)?'paid':'unpaid',status,position:0,start,end:start+30*DAY,reservedUntil:NOW+DAY,paid:['scheduled','live','ended','refund-pending','refund-unknown','refunded'].includes(status),actualStart:live?start:null,stopAt:status.startsWith('refund')?NOW:null,refund:null,modified:false,form:{name:'青禾生活馆',title:'把日常，过得更有滋味',description:'社区日用好物与生活用品，欢迎邻里来逛逛。',region:'演示社区',hours:'09:00—20:00',address:'演示街道 18 号（合成）',phone:'000-0000-0000',publicPhone:false,publicAddress:false,image:true}};
  if(status==='empty'){record.start=null;record.end=null;record.reservedUntil=null;record.form={name:merchant.name,title:'',description:'',region:merchant.region,hours:'',address:'',phone:'',publicPhone:false,publicAddress:false,image:false};}
  record.form.days=30;record.form.desiredStart=status==='empty'?'':localTime(start);return record;
 }
 function localTime(t){return new Date((t+8*3600)*1000).toISOString().slice(0,16);}
 function parseStart(value){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value||''))return null;const t=Date.parse(value+':00+08:00')/1000;return Number.isFinite(t)&&localTime(t)===value?t:null;}
 function errors(form,{schedule=true,minStart=NOW}={}){const out={};for(const [key,label]of [['name','经营名称'],['title','广告标题'],['description','广告说明'],['region','经营或服务区域']])if(!String(form[key]||'').trim())out[key]='请填写'+label;if(!form.image)out.image='请选择广告首图';if(form.publicPhone&&!String(form.phone||'').trim())out.phone='请填写需要公开的经营电话';if(form.publicAddress&&!String(form.address||'').trim())out.address='请填写需要公开的地址';if(!periods.includes(Number(form.days||30)))out.days='请选择7、14或30天';if(schedule){const t=parseStart(form.desiredStart);if(!t||t<=NOW)out.desiredStart='请选择未来的期望开始时间';else if(t<minStart)out.desiredStart='下期开始时间不能早于当前期结束';}return out;}
 const copy=value=>JSON.parse(JSON.stringify(value));
 function normalizeForm(form){return {...copy(form),name:merchant.name};}
 function fingerprint(form,position,imageRevision=0){return JSON.stringify({form:Object.fromEntries(Object.keys(form).sort().map(k=>[k,form[k]])),position,imageRevision});}
 function saveDraft(s,form,position,modification=false){if(!positions[position])throw Error('请选择轮播位置');if(modification){if(s.status!=='live'||s.modified)throw Error('当前不能保存修改稿');s.materialDraft=normalizeForm(form);}else{if(!['empty','draft','needs-schedule','rejected'].includes(s.status))throw Error('当前不能保存草稿');s.form=normalizeForm(form);s.days=Number(form.days||30);s.position=position;s.quotedCents=null;if(s.status==='empty')s.status='draft';}s.savedAt=NOW;}
 function prepareNext(current){if(current.status!=='live')throw Error('当前期未在投放');if(!current.next){const next=create('draft');next.position=current.position;next.days=current.days||30;next.form=copy(current.form);next.form.desiredStart=localTime(current.end);next.start=current.end;next.end=next.start+next.days*DAY;current.next=next;}return current.next;}
 function submit(s,form,minStart=NOW){if(!['empty','draft','needs-schedule','rejected'].includes(s.status))throw Error('当前不能重复提交');const normalized=normalizeForm(form);if(Object.keys(errors(normalized,{minStart})).length)throw Error('请补齐标记的内容');s.form=normalized;s.days=Number(normalized.days||30);s.quotedCents=null;s.materialApproved=false;s.customAssetApproved=false;s.status='pending';s.submittedAt=NOW;s.rejection=null;delete s.scheduleOffer;}
 function submitChange(s,form){if(s.status!=='live'||s.modified)throw Error('当前不能重复提交修改');const normalized=normalizeForm(form);if(Object.keys(errors(normalized,{schedule:false})).length)throw Error('请补齐标记的内容');s.modified=true;normalized.desiredStart=s.form.desiredStart;normalized.days=s.days;s.changeForm=normalized;s.changeStatus='pending';s.changeSubmittedAt=NOW;s.changeRejection=null;delete s.materialDraft;}
 function reject(s){const reason={field:'image',text:'首图文字不够清晰，请更换清晰素材后重新提交。'};if(s.modified){s.modified=false;s.changeStatus='rejected';s.changeRejection=reason;s.materialDraft=copy(s.changeForm);delete s.changeForm;}else if(s.status==='pending'){s.status='rejected';s.rejection=reason;}else throw Error('没有待审内容');}
 function approve(s,proposedStart,pool=[],now=NOW){
  if(s.modified){s.form=copy(s.changeForm);delete s.changeForm;s.modified=false;s.changeStatus=null;s.changeRejection=null;return;}
  if(!['pending','needs-schedule'].includes(s.status))throw Error('没有待审内容');if(s.form.customJobId&&!s.customAssetApproved)throw Error('请先审核商家确认的定制素材');s.materialApproved=true;
  const desired=parseStart(s.form.desiredStart),start=proposedStart??desired;
  if(!Number.isFinite(start)||start<=now)throw Error('排期已过，请重新确认未来日期');
  if(proposedStart!==undefined&&start!==desired){s.scheduleOffer={start,end:start+(s.days||30)*DAY};return;}
  const result=availability(s,start,pool,now);if(!result.available){s.status='needs-schedule';s.scheduleProblem=result.reason;s.alternatives=suggestions(s,start,pool,now);return;}establishOrder(s,start,now);syncReservation(s,pool);
 }
 function establishOrder(s,start,now=NOW){s.start=start;s.end=start+(s.days||30)*DAY;s.quotedCents=price(s.position,s.days||30);s.pricingVersion='2026-10-26';s.paymentStatus='unpaid';s.status='ready';s.reservedUntil=now+DAY;s.rejection=null;delete s.scheduleOffer;delete s.scheduleProblem;delete s.alternatives;}
 function acceptSchedule(s){if(s.status!=='pending'||!s.scheduleOffer)throw Error('没有待确认的排期');if(s.scheduleOffer.start<=NOW)throw Error('排期已过，请重新确认');establishOrder(s,s.scheduleOffer.start);}
 function hasOrder(s){return ['ready','payment-unknown','scheduled','live','ended','refund-pending','refund-unknown','refunded'].includes(s.status);}
 function pay(s,result,now=NOW){if(s.status!=='ready'||s.paid||s.reservedUntil<=now||s.start<=now)throw Error('请先核对审核、排期及保留状态');if(!['success','unknown','failed'].includes(result))throw Error('未知付款结果');if(result==='success'){s.paid=true;s.paymentStatus='paid';s.status='scheduled';}if(result==='unknown'){s.paymentStatus='unknown';s.status='payment-unknown';}return result;}
 function queryPayment(s,result){if(s.status!=='payment-unknown')throw Error('当前无需核实付款');if(result==='success'){s.paid=true;s.paymentStatus='paid';s.status='scheduled';}else if(result==='unpaid'){s.paid=false;s.paymentStatus='unpaid';s.status='ready';}else if(result!=='unknown')throw Error('未知查询结果');}
 function refundCents(paid,remaining,total){if(!Number.isSafeInteger(paid)||paid<0||!Number.isSafeInteger(total)||total<=0||!Number.isSafeInteger(remaining)||remaining<0)throw Error('退款计算参数无效');const r=BigInt(Math.min(total,remaining)),t=BigInt(total);return Number((BigInt(paid)*r*2n+t)/(2n*t));}
 function quote(s,now=s.previewNow??NOW){if(!s.paid||!['scheduled','live'].includes(s.status))throw Error('当前购买期不能申请退订');const paid=amount(s),remaining=Math.min(s.end-s.start,Math.max(0,s.end-now));return {cents:refundCents(paid,remaining,s.end-s.start),at:now,remaining};}
 function cancel(s,confirmed,now=s.previewNow??NOW){if(!confirmed)throw Error('请确认终止影响');const q=quote(s,now);s.stopAt=now;s.refund=q;s.status='refund-pending';return q;}
 function queryRefund(s,result){if(!['refund-pending','refund-unknown'].includes(s.status))throw Error('当前无待处理退款');if(result==='success')s.status='refunded';else if(result==='unknown'||result==='failed')s.status='refund-unknown';else throw Error('未知退款结果');}
 function overlap(a,b){return a.start<b.end&&b.start<a.end;}
 function blocks(row,now=NOW){return row.payment==='unknown'||row.payment==='paid'||row.until>now;}
 function availability(s,start,pool=[],now=NOW){
  const slot={start,end:start+(s.days||30)*DAY};if(!Number.isFinite(start)||start<=now)return {available:false,reason:'开始时间已过，请重新选期'};
  const conflicts=pool.filter(r=>r.adId!==s.id&&blocks(r,now)&&overlap(slot,r));
  if(conflicts.some(r=>r.merchantId===s.merchantId))return {available:false,reason:'本经营主体在这段时间已有广告，请选择不重叠的时间'};
  if(conflicts.some(r=>r.position===s.position))return {available:false,reason:'这个位置在所选时间已被占用'};
  return {available:true,reason:'当前可申请，素材审核后系统再次核对'};
 }
 function suggestions(s,start,pool=[],now=NOW){const out=[];for(let day=0;day<95&&out.length<3;day++){const t=Math.max(start,now+60)+day*DAY;if(availability(s,t,pool,now).available)out.push(t);}return out;}
 function syncReservation(s,pool){
  const index=pool.findIndex(r=>r.adId===s.id);if(index>=0)pool.splice(index,1);
  if(['ready','payment-unknown','scheduled','live'].includes(s.status))pool.push({adId:s.id,merchantId:s.merchantId,position:s.position,start:s.start,end:s.end,until:s.reservedUntil,payment:s.paid?'paid':s.paymentStatus==='unknown'?'unknown':'unpaid'});
 }
 function advance(s,pool,now=NOW){
  s.previewNow=now;
  if(s.status==='ready'&&s.paymentStatus==='unpaid'&&s.reservedUntil<=now){s.status='needs-schedule';s.scheduleProblem='原预留已到期，请重新选择可售档期';s.reservedUntil=null;syncReservation(s,pool);}
  if(s.status==='scheduled'&&s.start<=now&&s.paid&&s.materialApproved&&s.form.image&&(!s.form.customJobId||s.customAssetApproved)){s.status=now>=s.end?'ended':'live';s.actualStart??=s.start;}
  if(s.status==='live'&&now>=s.end)s.status='ended';syncReservation(s,pool);
 }
 function loadInventory(storage,now=Date.now()){try{const v=JSON.parse(storage.getItem(INVENTORY_KEY));return v?.expires>now&&v.expires<=now+TTL&&Array.isArray(v.rows)?v.rows:[];}catch{return [];}}
 function saveInventory(rows,storage,now=Date.now()){storage.setItem(INVENTORY_KEY,JSON.stringify({expires:now+TTL,rows}));}
 function report(mode='7',condition='normal'){if(condition==='unknown')return {views:null,clicks:null,rate:null,days:[]};const all=[{date:'10-16',views:128,clicks:8},{date:'10-17',views:153,clicks:9},{date:'10-18',views:176,clicks:12},{date:'10-19',views:142,clicks:8},{date:'10-20',views:208,clicks:15},{date:'10-21',views:187,clicks:13},{date:'10-22',views:164,clicks:10}],days=(mode==='today'?all.slice(-1):all).map(d=>({...d,...(condition==='zero'?{views:0,clicks:0}:{})})),views=days.reduce((n,d)=>n+d.views,0),clicks=days.reduce((n,d)=>n+d.clicks,0);return {views,clicks,rate:views?clicks/views:null,days};}
 function save(s,storage,now=Date.now()){storage.setItem(KEY,JSON.stringify({version:2,expires:now+TTL,state:s}));}
 function load(storage,now=Date.now()){try{const v=JSON.parse(storage.getItem(KEY));if(![1,2].includes(v?.version)||v.expires<=now||v.expires>now+TTL||!states.includes(v.state?.status)||!positions[v.state.position]||typeof v.state.form?.name!=='string')return null;let s=v.state;if(s.previous?.status==='live'){const next=copy(s);delete next.previous;s=copy(s.previous);s.next=next;}for(const r of [s,s.next,...(s.history||[])].filter(Boolean)){r.id??=id();r.merchantId??='DEMO-MERCHANT-QINGHE';r.days??=30;r.form.days??=r.days;r.materialApproved??=hasOrder(r);r.paymentStatus??=r.status==='payment-unknown'?'unknown':r.paid?'paid':'unpaid';if(v.version===1&&hasOrder(r)&&r.quotedCents===undefined){r.quotedCents=[29900,24900,19900][r.position];r.pricingVersion='legacy';}}s.form.name=merchant.name;if(s.form.desiredStart===undefined)s.form.desiredStart=s.start?localTime(s.start):'';if(s.next){s.next.form.name=merchant.name;if(s.next.form.desiredStart===undefined)s.next.form.desiredStart=localTime(s.next.start);}return s;}catch(e){return null;}}
 return {DAY,NOW,KEY,TTL,merchant,positions,states,create,errors,fingerprint,saveDraft,prepareNext,submit,submitChange,reject,approve,pay,queryPayment,refundCents,quote,cancel,queryRefund,report,save,load,hasOrder,localTime,parseStart,acceptSchedule,periods,prices,price,amount,availability,suggestions,syncReservation,advance,loadInventory,saveInventory,INVENTORY_KEY};
});
