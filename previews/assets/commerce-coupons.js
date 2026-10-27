'use strict';
(()=>{const U=CommerceUI,{M,esc,action:A,link:L,panel:P,notice:N,row:R,fmt,empty:E}=U;let tab='available',selected=null;
 const pages=[['A','活动与领券'],['B','我的优惠券'],['C','券详情']];
 const face=c=>`<div class="coupon-face"><div class="price"><small>¥</small>${esc(c.discount)}</div><div><h3>${esc(c.title)}</h3><p>满${esc(c.threshold)}元可用</p></div></div>`;
 const owned=()=>U.state.coupons.filter(c=>c.account===U.state.account);
 function render(v){const s=U.state,a=s.activity,d=a.draft;
  if(v==='A'){
   const requestedMerchant=new URLSearchParams(location.search).get('merchant');if(a.status!=='published'||requestedMerchant&&requestedMerchant!==s.merchant.draft.name){U.show('店铺优惠',E('暂时没有可领取的活动','可以先看看商家的公开作品。',L('返回发现','v23.html')));return;}
   const c=owned().find(c=>c.activityId===a.id),reason=M.claimable(s,s.account,U.now());U.show('店铺优惠',P(`<h3>${esc(s.merchant.draft.name||'合成商店')}</h3>`)+P(face(d)+R('有效期',d.start.replace('T',' ')+' 至 '+d.end.replace('T',' '))+'<p>'+esc(d.usage)+'</p>'+R('领取限制','每个微信账号每活动1张'))+(reason?N(esc(reason),!!(!c&&s.account)):N('免费领取，到店满足条件后出示，由商家核销。')),c?A('查看已领券','show-owned',true):!s.account?A('演示微信登录','login',true):A(reason||'免费领取','claim',true,!!reason));
  }else if(v==='B'){
   if(!s.account){U.show('我的优惠券',E('登录后查看你的券','登录后会回到这里，不会自动领券。',A('演示微信登录','login',true)));return;}
   const coupons=owned().filter(c=>M.couponStatus(c,U.now())===tab);U.show('我的优惠券',`<div class="tabs" role="tablist">${[['available','可用'],['used','已核销'],['expired','已过期']].map(([id,t])=>`<button role="tab" aria-selected="${tab===id}" data-action="tab-${id}">${t}</button>`).join('')}</div>`+(coupons.length?coupons.map(c=>P(face(c)+R('商家',c.merchant)+R('有效至',fmt(c.end))+`<div class="actions">${A(tab==='available'?'出示优惠券':'查看详情','coupon-'+c.id,true)}</div>`,'coupon')).join(''):E(tab==='available'?'还没有可用优惠券':'这里还没有优惠券记录','逛逛附近商家，看看有没有合适的优惠。',L('去发现看看','v23.html',true))));
  }else if(v==='C'){
   const c=owned().find(c=>c.id===selected)||owned().at(-1);if(!c){U.show('券详情',E('没有找到你的优惠券','请从我的优惠券进入。',A('查看我的券','wallet',true)));return;}selected=c.id;const status=M.couponStatus(c,U.now());
   U.show('券详情',P(face(c)+R('商家',c.merchant)+R('有效期',fmt(c.start)+' 至 '+fmt(c.end))+'<p>'+esc(c.usage)+'</p>')+P(status==='available'?`<h3 style="text-align:center">到店向商家出示</h3><div class="coupon-code">${esc(c.code)}</div><p class="hint" style="text-align:center">合成券码 · 不是真实付款码</p>`:`<h3>${status==='used'?'已经核销':'已过有效期'}</h3>${c.usedAt?R('核销时间',fmt(c.usedAt)):''}<p class="hint">${esc(c.title)} · 领券记录仍保留。</p>`)+N('停止新领取或商家入驻到期，不影响已领有效券按原条件使用。'),L('查看商家','v23.html')+L('帮助与申诉','v14.html'));
  }
 }
 const actions={wallet:()=>U.go('B'),claim:()=>U.write({type:'claim'},'C'),'show-owned':()=>{selected=owned().find(c=>c.activityId===U.state.activity.id)?.id;U.go('C');},login:()=>{U.state.account='resident-demo';U.persist();render(U.view);U.toast('已演示登录，请自行确认是否领券');}};
 for(const t of ['available','used','expired'])actions['tab-'+t]=()=>{tab=t;render('B');};
 document.addEventListener('click',e=>{const id=e.target.closest('[data-action]')?.dataset.action;if(id?.startsWith('coupon-')){selected=id.slice(7);U.go('C');}});
 U.boot({pages,scenarios:[['empty','我的券为空'],['guest','未登录'],['published','可领取'],['not-started','活动未开始'],['sold-out','已经领完'],['coupon-expired','券已过期'],['claimed','已领取'],['used','已核销'],['stopped','停领／已领可用'],['expired','入驻到期／已领可用']],render,actions,start:new URLSearchParams(location.search).get('entry')==='wallet'?'B':'A'});
})();
