'use strict';
(()=>{const U=CommerceUI,{M,esc,action:A,link:L,panel:P,notice:N,row:R,menu:Menu,field:F,date:D,fmt,empty:E}=U;let filter='全部',code='',found=null,recordFilter='全部';
 const pages=[['A','活动列表'],['B','创建满减券'],['C','核对活动'],['D','活动详情'],['E','当面核销'],['F','核销记录']];
 const status=()=>{const s=U.state,a=s.activity;return a.status==='published'?(U.now()>=M.time(a.draft.end)?'已结束':a.stopped?'已停止新领取':U.now()<M.time(a.draft.start)?'未开始':'领取中'):({draft:'草稿',review:'审核中',rejected:'未通过',supplement:'需补充'})[a.status]||'待处理';};
 const face=()=>{const d=U.state.activity.draft;return `<div class="coupon-face"><div class="price"><small>¥</small>${esc(d.discount)}</div><div><h3>${esc(d.title)}</h3><p>满${esc(d.threshold)}元可用</p></div></div>${R('固定有效期',d.start.replace('T',' ')+' 至 '+d.end.replace('T',' '))}<p class="hint">${esc(d.usage)}</p>`;};
 function render(v){const s=U.state,a=s.activity,d=a.draft,p=M.permissions(s,U.now());
  if(v==='A'){
   const tabs=['全部','审核中','领取中','已结束'];const cards=!p.redeem?E('开通后可管理活动','先完成商家入驻。',L('查看入驻','v24.html',true)):s.hideActivities?E('还没有活动','创建一张免费满减券，让邻居来店里看看。'):filter!=='全部'&&filter!==status()?E('这里还没有活动','可切换到全部查看。'):P(`<div class="panel-head"><span class="tag">${status()}</span><span class="hint">免费领取</span></div>${face()}<div class="actions">${a.status==='draft'?'':A('查看详情','detail',true)}</div>`);
   U.show('活动与优惠券',P(Menu('当面核销','redeem','输入券码 ›')+Menu('核销记录','records'))+(p.expired?N('入驻已到期，不能新增活动与领券；原已领有效券仍可核销。',true):'')+`<div class="tabs">${tabs.map(x=>`<button data-action="filter-${x}" role="tab" aria-selected="${filter===x}">${x}</button>`).join('')}</div>`+cards,A('创建满减券','create',true,!p.create));
  }else if(v==='B'){
   if(!p.create){U.show('创建满减券',E('续费后可创建新活动','旧活动和已领券的核销不受影响。',L('查看入驻与续费','v24.html#E',true)));return;}
   if(!['draft','rejected','supplement'].includes(a.status)){U.show('创建满减券',N('该活动已提交，关键条件不能在这里改写。'),A('查看活动详情','detail',true));return;}
   U.show('创建满减券',P(`<h3>${esc(s.merchant.draft.name)}</h3><p class="muted">免费领取，到店由本商家核销。</p>`)+(a.reason?N(esc(a.reason),true):'')+P(F('title','活动名称',d.title,'如邻里到店优惠')+F('threshold','消费满多少元',d.threshold,'填写金额')+F('discount','优惠多少元',d.discount,'不得超过使用门槛')+F('quantity','发放总量',d.quantity,'正整数')+D('start','开始时间',d.start)+D('end','结束时间',d.end)+F('usage','使用说明',d.usage,'填写适用范围与使用方式','textarea'))+N('每个微信账号每活动可领1张；领取和核销都须在固定有效期内。'),A('保存草稿','save')+A('核对活动','review',true),'activity');
  }else if(v==='C'){
   if(!p.create||Object.keys(M.validateActivity(d,U.now())).length){U.show('核对活动',E('先完善活动内容','核对名称、金额、数量和有效期。',A('去填写','create',true)));return;}
   U.show('核对活动',P(face()+R('发行总量',d.quantity+'张')+R('每账号限领','1张'))+N('公开后，门槛、优惠额和有效期锁定。停止新领券或入驻到期，不影响已领券按原条件核销。')+N('提交后完成内容安全检测与人工审核，通过后公开；审核不会顺延有效期。'),A('返回修改','create')+A('提交活动审核','submit',true));
  }else if(v==='D'){
   U.show('活动详情',P(`<div class="panel-head"><span class="tag">${status()}</span></div>${face()}${a.reason?N(esc(a.reason),true):''}`)+P(`<h3>领取与使用</h3>${R('发放总量',d.quantity+'张')}${R('已领取',s.coupons.length+'张')}${R('已核销',s.coupons.filter(c=>c.usedAt).length+'张')}`)+P(Menu('当面核销','redeem')+Menu('核销记录','records')),(a.status==='published'&&!a.stopped&&U.now()<M.time(d.end)?A('停止新领取','stop'):['rejected','supplement'].includes(a.status)?A('修改后重提','create',true):A('返回活动列表','list')));
  }else if(v==='E'){
   if(!p.redeem){U.show('当面核销',E('请使用商家管理身份','只能核销本店的有效券。',L('查看入驻','v24.html')));return;}
   const f=s.forms?.redeem||{};code=f.code||code;found=f.lookupCode||found;let body=P(F('code','顾客出示的券码',code,'输入 DEMO- 开头的合成券码')+A('查找优惠券','lookup',true));
   const c=s.coupons.find(c=>c.code===found);if(c){const error=M.redeemable(s,c.code,s.merchantId,U.now());body+=P(`<h3>${esc(c.title)}</h3><div class="price">¥${esc(c.discount)}<small> · 满${esc(c.threshold)}元可用</small></div>${R('所属商家',c.merchant)}${R('有效至',fmt(c.end))}<p>${esc(c.usage)}</p>`)+(error?N(esc(error),true):N('请当面核对消费已满足以上条件，再确认核销。'));U.show('当面核销',body,c.usedAt?A('核销下一张','next',true):!error?A('确认符合条件并核销','execute-redeem',true):A('核销下一张','next'),'redeem');return;}
   U.show('当面核销',body+N('本预览不接真实扫码或支付。券码由居民券详情页出示。'),A('查看核销记录','records'),'redeem');
  }else if(v==='F'){
   const records=s.coupons.filter(c=>c.usedAt&&c.merchantId===s.merchantId&&(!recordFilter||recordFilter==='全部'||c.title.includes(recordFilter)));
   U.show('核销记录',P(F('search','按活动名称查找',recordFilter==='全部'?'':recordFilter,'输入活动名称')+A('查询记录','search'))+(records.length?records.map(c=>P(`<h3>${esc(c.title)}</h3>${R('优惠条件','满'+c.threshold+'减'+c.discount)}${R('核销时间',fmt(c.usedAt))}${R('合成券码',c.code)}`)).join(''):E(recordFilter==='全部'?'还没有核销记录':'没有匹配的核销记录','成功核销后，会在这里保留记录。')),A('继续核销','redeem',true),'record-search');
  }
 }
 const actions={list:()=>U.go('A'),create:()=>U.go('B'),detail:()=>U.go('D'),redeem:()=>U.go('E'),records:()=>U.go('F'),save:()=>{U.state.hideActivities=false;U.persist();U.toast('草稿已保留');},review:()=>{if(!U.errors(M.validateActivity(U.state.activity.draft,U.now())))U.go('C');},submit:()=>{U.state.hideActivities=false;U.write({type:'submitActivity'},'D');},stop:()=>U.confirm('停止新领取？','<p>停止后不再发新券，已经领到的券仍按原条件使用至到期。</p>',()=>U.write({type:'stop'},'D'),'停止新领取'),lookup:()=>{const f=U.getForm();code=f.code?.trim()||'';const c=U.state.coupons.find(c=>c.code===code);if(!c){U.toast('没有找到这张券，请核对券码');return;}found=c.code;f.lookupCode=c.code;U.persist();render('E');},'execute-redeem':()=>U.write({type:'redeem',code:found},'E'),next:()=>{code='';found=null;U.state.forms.redeem={};U.persist();render('E');},search:()=>{recordFilter=U.getForm().search?.trim()||'全部';render('F');}};
 for(const f of ['全部','审核中','领取中','已结束'])actions['filter-'+f]=()=>{filter=f;render('A');};
 U.boot({pages,scenarios:[['active','有效商家／草稿'],['empty','暂无活动'],['activity-review','活动审核中'],['published','公开领取中'],['claimed','已有一张券可核销'],['used','已有核销记录'],['stopped','已停止领取'],['expired','入驻已到期']],render,actions});
})();
