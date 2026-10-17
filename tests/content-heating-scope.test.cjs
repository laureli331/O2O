'use strict';
// Document contract checks only. No posts, promotions, reviews or financial operations are executed.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),recordPath="docs/merchant-pricing-confirmed-20261016.json",entries=["docs/merchant-pricing-confirmed-20261016.md","docs/prd.md","docs/development-plan.md","docs/structured-design.md","docs/v2-roadmap.md","docs/ascii-design-prd-2.1.md","docs/module-specs/current-development-basis-20261015.md","docs/module-specs/merchant-banner-direction-20261015.md","CONTEXT.md"];
const read=p=>new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(path.join(root,p))),load=()=>JSON.parse(read(recordPath));
const at=(rev,p)=>cp.execFileSync('git',['show',rev+':'+p],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n');
const expectedResponses=[{"questionItemId":"[\"request_user_input_async\",\"call_63b3df810bbc4b709d465673c5a148bd\",0]","id":"content-heating-target-surface","selected":"A","question":"接下来讨论第二版“内容加热”，候选价仍为49元／30天、进入共享推广池。本题只选展示位置：起步在哪个页面提供加热？","answer":"A（推荐）：仅“发现页”的商家帖子主信息流；首页轮播、搜索结果及居民跑腿／二手列表不包含在内，便于说明交付范围。"},{"questionItemId":"[\"request_user_input_async\",\"call_63b3df810bbc4b709d465673c5a148bd\",1]","id":"content-heating-eligible-content","selected":"A","question":"内容加热共享池，起步允许推广哪些内容？具体穿插密度、轮换和退款规则仍另行确认。","answer":"A（推荐）：仅当前合规且可展示的商家主帖，另经推广审核后加入；居民交易信息和评论不进入这个池。"},{"questionItemId":"[\"request_user_input_async\",\"call_63b3df810bbc4b709d465673c5a148bd\",2]","id":"content-heating-purchase-after-tool-membership-expiry","selected":"A","question":"已有合规且仍可展示的商家主帖，其发布者在工具会员到期后，是否仍可单独购买内容加热？已确认旧帖可继续展示；本题不增加新发帖权限。","answer":"A（推荐）：可以单独购买，只取得对应帖子的推广权益；不附带新增发帖、活动工具或AI额度。"}],expectedHeating={"release":"v2","candidateMonthlyPricesCents":[4900],"pool":"shared","densityPolicy":"unified","globalOrganicInterval":null,"perMerchantFixedIntervalPromised":false,"targetSurface":"discovery-merchant-main-feed","rotationRulesComplete":false,"excludedSurfaces":["home-carousel","search-results","resident-errand-list","resident-secondhand-list"],"eligibleContent":{"type":"merchant-main-post","requiresCurrentlyCompliant":true,"requiresCurrentlyDisplayable":true,"requiresSeparatePromotionApproval":true,"excludedTypes":["resident-transaction-information","comments"]},"purchaseEligibility":{"activeToolMembershipRequired":false,"expiredToolMembersWithEligibleExistingPostsMayPurchase":true,"entitlement":"corresponding-post-promotion-only","includesNewMainPosting":false,"includesCampaignTools":false,"includesAiAllowance":false}};
function validate(r){
 const scoped=structuredClone(r.contentHeating);for(const key of ['purchaseUnit','deliveryCommitment','purchaseSequence','activation','densityTrialPolicy','rotationPolicy','poolCapacityPolicy','refundRule'])delete scoped[key];assert.deepEqual(scoped,expectedHeating);
 assert.deepEqual(r.contentHeatingScopeDecision.responses,expectedResponses);
 assert.equal(r.contentHeatingScopeDecision.realSalesAuthorized,false);
 assert.equal(r.membership.lifecycle.expiry.approvedPosts,'retain-public-visibility');
 assert.equal(r.membership.lifecycle.expiry.newMainPostsAllowed,false);
 assert.equal(r.membership.lifecycle.expiry.exclusiveToolsAllowed,false);
 assert.equal(r.membership.lifecycle.expiry.separatelyPurchasedPromotions,'own-validity-period');
 assert.equal(r.prepaidServices.reviewPaymentOrder,null);
 assert.equal(r.servicePeriods.activationRule,null);
 for(const value of Object.values(r.execution))assert.equal(value,false);
 return true;
}
test('three scope approvals preserve exact questions replies and provenance without enabling sales',()=>{
 const r=load(),d=r.contentHeatingScopeDecision;assert.equal(validate(r),true);
 assert.equal(d.date,'2026-10-17');assert.equal(d.sourceCommit,'d7e87778f1030445b408b8d615f75cbb7bbe9f79');
 assert.equal(d.responseType,'structured-question-replies');assert.equal(d.scope,'v2-content-heating-surface-eligible-posts-and-independent-purchase-after-membership-expiry');assert.equal(Object.hasOwn(d,'userReply'),false);
});
test('only content heating scope and its separate approval change; all earlier contracts stay intact',()=>{
 const live=load(),r=JSON.parse(at(live.contentHeatingDeliveryAndActivationDecision.sourceCommit,recordPath)),prior=JSON.parse(at(r.contentHeatingScopeDecision.sourceCommit,recordPath));
 delete r.contentHeatingScopeDecision;r.contentHeating=structuredClone(prior.contentHeating);assert.deepEqual(r,prior);
 for(const p of ['docs/merchant-banner-refund-confirmed-20261017.json','docs/merchant-banner-refund-confirmed-20261017.md','docs/merchant-membership-refund-confirmed-20261017.json','docs/merchant-membership-refund-confirmed-20261017.md','docs/merchant-membership-refund-proposal-20261016.md'])assert.equal(read(p).replace(/\r\n/g,'\n'),at('d7e87778f1030445b408b8d615f75cbb7bbe9f79',p),p);
});
test('all nine current entries agree on discovery only merchant post review and independent promotion rights',()=>{
 for(const p of entries){const line=read(p).split(/\r?\n/).find(x=>x.startsWith('内容加热范围及购买资格确认'));
 for(const phrase of ['逐题选择A、A、A','第二版','仅用于“发现页”商家帖子主信息流','不含首页轮播、搜索结果及居民跑腿/二手列表','当前合规且可展示的商家主帖','另经推广审核后加入共享池','居民交易信息和评论不入池','工具会员到期后','旧帖单独购买加热','不附带新增发帖、活动工具或AI额度','49元/连续30天','密度候选/人工调整、公平轮换及容量原则按后续确认，轮换实现、容量人数与退款执行等尚待确认'])assert(line&&line.includes(phrase),p+': '+phrase);
 const target=line.match(/\[内容加热确认第4\.1节\]\(([^)]+)\)/)[1];assert(fs.existsSync(path.resolve(root,path.dirname(p),target)),p+': local confirmation link');
 }
 const doc=read('docs/merchant-pricing-confirmed-20261016.md');for(const x of expectedResponses){assert(doc.includes(x.question));assert(doc.includes(x.answer));}
 for(const phrase of ['#### 4.1','现按第4.3节确认单档案1个名额','原帖审核通过不自动等于推广审核通过','不照搬Banner位置、24小时保留、审核目标或退款政策'])assert(doc.includes(phrase),phrase);
 assert(!doc.includes('待确认：适用页面/内容、全站或分流的统计范围'));
});
test('PRD and roadmap record scope in VP05 while first release tasks and deferred work remain unchanged',()=>{
 for(const p of ['docs/prd.md','docs/v2-roadmap.md']){const row=read(p).match(/^\| VP05 \|[^\r\n]+/m)[0];for(const phrase of ['仅发现页商家主帖主信息流','居民交易信息/评论不入池','会员到期可为合格旧帖单独购买','不附新增发帖/活动工具/AI额度','计费对象'])assert(row.includes(phrase),p+': '+phrase);}
 assert.equal([...read('docs/development-plan.md').matchAll(/^\| DP\d{2} \|/gm)].length,57);
 assert.deepEqual(JSON.parse(read('docs/development-remapping-20261015.json')).deferredTaskIds,['DP30','DP31','DP32','DP33','DP34','DP35']);
});
test('scope cannot expand to other feeds resident transactions comments or bypass separate promotion review',()=>{
 for(const change of [r=>r.contentHeating.targetSurface='all-feeds',r=>r.contentHeating.excludedSurfaces=[],r=>r.contentHeating.eligibleContent.type='all-posts',r=>r.contentHeating.eligibleContent.requiresCurrentlyCompliant=false,r=>r.contentHeating.eligibleContent.requiresCurrentlyDisplayable=false,r=>r.contentHeating.eligibleContent.requiresSeparatePromotionApproval=false,r=>r.contentHeating.eligibleContent.excludedTypes=[]]){const r=load();change(r);assert.throws(()=>validate(r));}
});
test('independent promotion purchase cannot require membership or grant posting tools AI or unknown delivery rules',()=>{
 for(const change of [r=>r.contentHeating.purchaseEligibility.activeToolMembershipRequired=true,r=>r.contentHeating.purchaseEligibility.expiredToolMembersWithEligibleExistingPostsMayPurchase=false,r=>r.contentHeating.purchaseEligibility.includesNewMainPosting=true,r=>r.contentHeating.purchaseEligibility.includesCampaignTools=true,r=>r.contentHeating.purchaseEligibility.includesAiAllowance=true,r=>r.contentHeating.globalOrganicInterval=9,r=>r.contentHeating.rotationRulesComplete=true,r=>r.execution.realSalesEnabled=true]){const r=load();change(r);assert.throws(()=>validate(r));}
});
