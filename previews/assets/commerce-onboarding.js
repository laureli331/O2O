'use strict';
(()=>{const U=CommerceUI,{M,esc,action:A,link:L,panel:P,notice:N,row:R,menu:Menu,field:F,select:S,check:C,fmt,empty:E}=U;
 const pages=[['A','申请入驻'],['B','核对申请'],['C','申请进度'],['D','开通与续费'],['E','入驻管理'],['F','入驻订单'],['G','异常申请'],['H','异常进度'],['I','必要更正']];
 const name=()=>U.state.merchant.draft.name||'你的商家档案';
 const summary=()=>{const d=U.state.merchant.draft;return P(`<div class="subject"><img src="assets/service-repair.svg" alt="经营资料合成配图"><div><h3>${esc(name())}</h3><p>${esc(d.category)} · ${esc(d.area)}</p></div></div>${R('经营地址',d.address||'未填写')}${R('联系电话',d.phone||'未填写')}${R('营业时段',d.hours||'未填写')}`);};
 const order=()=>{const o=U.state.merchant.order;return o?P(`<h3>入驻服务 · ¥99.00</h3>${R('实际付款',fmt(o.paidAt))}${R('实际开通',fmt(o.activatedAt))}${R('本期有效至',fmt(o.end))}<details><summary>订单记录</summary>${R('订单号',o.id)}</details>`):E('还没有入驻订单','审核通过后，可在这里开通入驻。');};
 function render(v){const s=U.state,m=s.merchant,d=m.draft,p=M.permissions(s,U.now());
  if(v==='A'){
   if(!['new','draft','supplement','rejected'].includes(m.status)){U.show('商家入驻',summary()+N(m.status==='active'?'你已有商家档案，无需重复申请。':'已有申请正在处理，请查看本次进度。'),A(m.status==='active'?'进入入驻管理':'查看申请进度',m.status==='active'?'manage':'progress',true));return;}
   U.show('申请入驻',`<div class="intro"><h3>让邻居找到你的生意。</h3><p class="muted">先填写经营资料，审核通过后开通。</p></div>${m.reason?N(esc(m.reason),true):''}${P(S('subjectType','经营身份',d.subjectType,[['licensed','持照商家'],['natural','独立服务者']])+`<div class="notice">本预览使用已核验的合成主体，不收集真实身份证或执照。正式材料标准另行确认。</div>`+R('主体依据','合成主体 · 当前申请人')+F('name','经营名称',d.name,'填写对外展示的名称')+F('category','经营类别',d.category,'如维修、生活服务')+F('area','经营或服务区域',d.area,'填写可服务的区域')+F('address','经营地址',d.address,'选填')+F('phone','联系电话',d.phone,'选填')+F('hours','营业时段',d.hours,'选填')+C('consent','我确认以上经营名称、区域、地址、电话和时段可用于公开展示。',d.consent))}${N('入驻 ¥99／连续30天。审核通过后再付款；不自动续费。')}`,A('保存草稿','save')+A('核对申请','review',true),'merchant');
  }else if(v==='B'){
   if(Object.keys(M.validateMerchant(d,s)).length){U.show('核对入驻申请',E('先完善经营资料','填写完成后，在这里核对公开信息。',A('去填写','apply',true)));return;}
   U.show('核对入驻申请',summary()+P(`<h3>主体核对</h3>${R('主体类型',d.subjectType==='licensed'?'持照经营主体':'已核验自然人')}${R('核验依据','合成主体 · 仅审核使用')}<p class="muted">该部分不在公开主页展示。</p>`)+N('本次只提交审核，不收费、不立即开通。'),A('返回修改','apply')+A('提交入驻申请','submit',true));
  }else if(v==='C'){
   const text={new:'还未提交申请',draft:'申请尚未提交',review:'申请审核中',supplement:'需要补充资料',rejected:'申请未通过',approved:'审核已通过',active:'已成功开通',paid:'已付款，正在开通'}[m.status]||'申请处理中';
   let body=P(`<h3 class="status-large">${text}</h3><p>${esc(name())}</p>${m.reason?N(esc(m.reason),true):''}${m.status==='review'?'<p class="muted">处理结果会通过站内消息通知。</p>':''}${m.status==='approved'?(m.notifiedAt?R('支付截止',fmt(m.notifiedAt+72*M.HOUR))+N(U.now()>=m.notifiedAt+72*M.HOUR?'支付期限已过，请申请重新核对。':'通知已成功生成，请在截止时间前开通。'):N('审核通知正在生成，支付期限尚未开始。')):''}`);
   const id=m.status==='paid'?'order':m.status==='active'?'manage':['new','draft','supplement','rejected'].includes(m.status)?'apply':m.status==='approved'&&p.pay?'payment':null;
   U.show('申请进度',body,id?A(id==='order'?'查看付款订单':id==='apply'?'完善申请':id==='payment'?'查看开通费用':'进入入驻管理',id,true):m.status==='approved'&&m.notifiedAt&&U.now()>=m.notifiedAt+72*M.HOUR?A('申请重新核对','recheck',true):A('刷新进度','refresh'));
  }else if(v==='D'){
   if(m.status==='paid'){U.show('开通入驻',N('已收到本次入驻付款，正在开通，请勿重复支付。'),A('查看付款订单','order',true));return;}
   U.show(m.status==='active'?'续费入驻':'开通入驻',P(`<h3>${esc(name())}</h3><div class="price">¥99<small>／连续30天</small></div><p>经营主页、帖子管理、活动与优惠宣传。</p>${R('生效时间',m.status==='active'&&m.activeUntil>U.now()?'付款并成功续期后，接续当前到期时间':'付款并实际开通后起算')}${R('自动续费','不开启')}`)+N('成功开通后，因个人原因退出或未使用，不按剩余时间退款。<br>重复付款、未能开通或平台未交付，可申请核对。',true)+(m.status==='approved'?N(m.notifiedAt?'本次支付截止：'+fmt(m.notifiedAt+72*M.HOUR):'审核通知尚未成功生成，请等待通知。'):''),A('演示微信支付 ¥99','pay',true,!p.pay));
  }else if(v==='E'){
   if(m.status!=='active'){U.show('入驻管理',E('先完成入驻申请','有了商家档案后，在这里管理经营事务。',A('查看申请','progress',true)));return;}
   U.show('入驻管理',P(`<h3>${esc(name())}</h3><span class="tag">${p.expired?'已到期':'入驻有效'}</span>${R('有效至',fmt(m.activeUntil))}${A(p.expired?'续费继续经营':'续费入驻','payment',true)}`)+(p.expired?N('旧主页和合规帖子仍展示。暂停新增内容与领券，已领有效券可继续核销。',true):'')+P(Menu('活动与优惠券','activities')+Menu('帖子管理','posts')+Menu('广告与Banner定制','ads')+Menu('必要信息更正','correction')+Menu('入驻订单','order')+Menu('异常核对进度','anomaly-progress')));
  }else if(v==='F'){
   U.show('入驻订单详情',order()+N('开通费用与广告位费、Banner定制费分别记录。'),m.order?(m.status==='paid'?A('查询开通状态','activation',true)+A('申请异常核对','anomaly'):A('申请异常核对','anomaly',false)):A('返回申请进度','progress',true));
  }else if(v==='G'){
   if(!m.order){U.show('申请异常核对',E('没有可核对的订单','请从本人的入驻订单发起。',A('查看入驻订单','order')));return;}
   if(m.anomaly&&!['supplement'].includes(m.anomaly.status)){U.show('申请异常核对',N('你已提交申请，可查看同一事项的进度。'),A('查看进度','anomaly-progress',true));return;}
   const f=s.forms?.anomaly||{};U.show('申请异常核对',order()+P(S('kind','遇到什么问题',f.kind||'付款后未开通',[['付款后未开通','付款后未开通'],['重复付款','重复付款'],['平台未按约交付','平台未按约交付']])+F('reason','补充说明',f.reason||'','描述付款及开通情况','textarea')+N('请在正式接入后按核对要求补充凭证；本预览不上传真实付款或身份材料。'))+N('收到申请后24小时内首次回应。完整有效材料提交成功后72小时内核对，并发起符合条件的退款；到账时间以渠道结果为准。'),A('提交核对申请','submit-anomaly',true),'anomaly');
  }else if(v==='H'){
   const x=m.anomaly;U.show('异常处理进度',x?P(`<h3>${({'review':'正在核对','supplement':'请补充材料','resolved':'已记录核对结果','refund-processing':'退款已发起'})[x.status]||'处理中'}</h3>${R('异常类型',x.kind)}<p>${esc(x.reason)}</p>${x.reply?N(esc(x.reply)):''}${R('首次回应目标',fmt(x.receivedAt+24*M.HOUR))}${R('完整材料核对目标',x.completeAt?fmt(x.completeAt+72*M.HOUR):'完整有效材料提交后起算')}${x.refundAmount?R('发起退款金额','¥'+x.refundAmount.toFixed(2)):''}<p class="muted">发起退款不代表已经到账。</p>`):E('还没有核对申请','入驻订单遇到异常，可从订单发起。'),x?.status==='supplement'?A('补充原申请','anomaly',true):A('查看原订单','order'));
  }else if(v==='I'){
   if(!p.correction){U.show('必要信息更正',E('暂无可更正的档案','先完成商家入驻。',A('查看进度','progress')));return;}
   if(m.correction?.status==='review'){U.show('必要信息更正',N('更正审核中，现有合规公开信息仍保留。')+P(R('申请电话',m.correction.phone||'不变')+R('申请地址',m.correction.address||'不变')),A('刷新结果','refresh'));return;}
   const f=s.forms?.correction||{};U.show('必要信息更正',summary()+P(F('phone','更正联系电话',f.phone||'','不修改可留空')+F('address','更正经营地址',f.address||'','不修改可留空')+F('businessStatus','营业状态说明',f.businessStatus||'','如暂时停业')+F('reason','更正原因',f.reason||'','请说明本次变化','textarea'))+N('审核通过后更新。入驻到期后暂停营销性修改，必要更正仍可申请。'),A('提交更正','submit-correction',true),'correction');
  }
 }
 U.boot({pages,scenarios:[['new','未申请／空表单'],['review','审核中'],['supplement','需要补充'],['rejected','审核未通过'],['unnotified','通过／通知未生成'],['approved','通过／可付款'],['payment-expired','通过／支付期限已过'],['activation-waiting','已付款／正在开通'],['active','入驻有效'],['expired','入驻已到期'],['anomaly','异常核对中']],render,actions:{
  activation:()=>U.write({type:'activate'},'F'),recheck:()=>U.write({type:'recheck'},'C'),apply:()=>U.go('A'),manage:()=>U.go('E'),progress:()=>U.go('C'),payment:()=>U.go('D'),order:()=>U.go('F'),anomaly:()=>U.go('G'),'anomaly-progress':()=>U.go('H'),correction:()=>U.go('I'),refresh:()=>render(U.view),
  review:()=>{if(!U.errors(M.validateMerchant(U.state.merchant.draft,U.state)))U.go('B');},save:()=>{if(U.state.merchant.status==='new')U.state.merchant.status='draft';U.persist();U.toast('草稿已保留在当前标签页');},submit:()=>U.write({type:'submitMerchant'},'C'),pay:()=>U.confirm('核对入驻费用',P(R('商家',name())+R('本次金额','¥99.00')+R('服务期','连续30天'))+N('本次仅演示，不会实际扣款。'),()=>U.write({type:'pay'},'F'),'演示确认付款'),
  activities:()=>location.href='v25.html?from=onboarding',posts:()=>location.href='v23.html',ads:()=>location.href='v11.html','submit-anomaly':()=>{const f=U.getForm();if(!f.reason?.trim()){U.errors({reason:'请说明本次异常'});return;}U.write({type:'anomaly',...f,kind:f.kind||'付款后未开通',complete:false},'H');},'submit-correction':()=>{const f=U.getForm();U.confirm('核对本次更正',P(R('联系电话',f.phone||'不变')+R('经营地址',f.address||'不变')+R('营业状态',f.businessStatus||'不变')),()=>U.write({type:'correct',...f},'I'),'提交审核');}
 },start:['active'].includes(U.state.merchant.status)?'E':['review','approved','supplement','rejected','paid'].includes(U.state.merchant.status)?'C':'A'});
})();
