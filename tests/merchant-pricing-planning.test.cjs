'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const read=p=>new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(path.join(root,p)));
const recordPath='docs/merchant-pricing-confirmed-20261016.json';
function bundle(){return {r:JSON.parse(read(recordPath)),doc:read('docs/merchant-pricing-confirmed-20261016.md'),prd:read('docs/prd.md'),plan:read('docs/development-plan.md'),design:read('docs/structured-design.md')};}
function validate(b){
 const r=b.r;
 assert.equal(r.date,'2026-10-16');
 assert.equal(r.approvalReply,'按你的建议来');
 assert.equal(r.bannerClarification,'banner是在首页的轮播图');
 assert.equal(r.banner.surface,'home-carousel','Home carousel');
 assert.equal(r.banner.independentSimultaneousAreas,false,'Not separate simultaneous areas');
 assert.deepEqual(r.banner.candidateMonthlyPricesCents,[29900,24900,19900],'Candidate Banner prices');
 assert.equal(r.banner.defaultSlide,'first');
 assert.equal(r.banner.requiresMembership,false,'No forced membership');
 assert.equal(r.banner.release,'v2','Banner release is second version');
 assert.equal(r.bannerReleaseDecision.userReply,'a','Actual release choice');
 assert.equal(r.bannerReleaseDecision.selected,'A');
 assert.equal(r.bannerReleaseDecision.previousRelease,null);
 assert.equal(r.bannerReleaseDecision.release,'v2');
 assert.equal(r.banner.rotationSeconds,null,'Rotation remains unconfirmed');
 assert.equal(r.banner.maxAdvertisersPerTier,null,'Capacity remains unconfirmed');
 assert.equal(r.banner.monthDefinition,'30-continuous-days','Banner period is 30 days');
 assert.equal(r.membership.candidateMonthlyPriceCents,9900);
 assert.equal(r.membership.release,'v2','Membership release');
 assert.deepEqual(r.membership.includedDirections,['discovery-posting','basic-tools','basic-campaign-tools','defined-ai-allowance']);
 assert.equal(r.membership.aiAllowance,null,'AI allowance pending');
 assert.equal(r.membership.postLimit,null,'Post limit pending');
 assert.equal(r.membership.billingUnit,'single-store-or-independent-provider-profile','Membership billing unit');
 assert.equal(r.membership.entitlementOwner,'business-profile','Rights attach to the business profile');
 assert.deepEqual(r.membership.lifecycle,{activation:{requiresQualificationApproved:true,requiresPaymentSucceeded:true,requiresEntitlementsActuallyEnabled:true,start:'actual-entitlement-enablement-after-qualification-and-payment',failedActivationConsumesTime:false},expiry:{approvedPosts:'retain-public-visibility',canUnpublish:true,newMainPostsAllowed:false,exclusiveToolsAllowed:false,separatelyPurchasedPromotions:'own-validity-period',postEditingRule:null,existingCampaignRule:null,issuedCouponRule:null}},'Approved membership activation and expiry');
 assert.deepEqual(r.membership.aiAllowancePolicy,{includedUnusedExpiry:'end-of-current-allowance-period',carryForward:false,discloseBeforePurchase:true,grantCycle:null,extraPurchasedValidity:null},'Included AI expiry and separate purchased quota');
 assert.equal(r.membershipLifecycleDecision.userReply,'全A','Actual membership lifecycle reply');
 assert.deepEqual(r.membershipLifecycleDecision.choices.map(x=>[x.id,x.selected]),[['membership-activation','A'],['membership-expiry','A'],['included-ai-expiry','A']]);
 assert.deepEqual(r.servicePeriods,{unit:'continuous-days',monthlyDays:30,quarterlyDays:90,purchasePageDisplaysDays:true,products:{membership:[30,90],banner:[30],contentHeating:[30]},activationRule:null},'Approved service periods, offers and pending activation');
 assert.equal(r.periodAndDiscountDecision.userReply,'全a','Actual period and discount reply');
 assert.deepEqual(r.periodAndDiscountDecision.choices.map(x=>[x.id,x.selected]),[['membership-billing-unit','A'],['service-period','A'],['quarter-discount-scope','A']]);
 assert.equal(r.contentHeating.release,'v2');
 assert.deepEqual(r.contentHeating.candidateMonthlyPricesCents,[4900],'Single initial heating tier');
 assert.equal(r.contentHeating.pool,'shared');
 assert.equal(r.contentHeating.densityPolicy,'unified');
 assert.equal(r.contentHeating.globalOrganicInterval,null,'No inferred interval');
 assert.equal(r.contentHeating.perMerchantFixedIntervalPromised,false,'No per-merchant fixed cadence');
 assert.equal(r.searchHeating.status,'deferred-v2-candidate');
 assert.equal(r.searchHeating.priceCents,null,'Search price pending');
 assert.equal(r.searchHeating.implementationCommitted,false,'Search is not committed');
 assert.equal(r.discounts.monthMultiplier,1);
 assert.equal(r.discounts.quarterMonths,3);
 assert.equal(r.discounts.quarterMultiplier,0.9);
 assert.equal(r.discounts.halfYearOffered,false,'Half-year deferred');
 assert.equal(r.discounts.yearOffered,false,'Year deferred');
 assert.deepEqual(r.discounts.eligibleProducts,['membership'],'Quarter discount only for membership');
 assert.equal(r.discounts.autoApplyToCommission,false);
 assert.equal(r.discounts.autoApplyToAiOverage,false);
 assert.deepEqual(r.billing,{month:'previous-calendar-month',scheduledDay:1,scheduledTime:'00:10',timezone:'Asia/Shanghai',paymentHours:72,start:'actual-bill-issued-successfully',customerFundsCollected:false,notificationStartsClock:false,scopeChanged:false},'Retained billing contract');
 assert.equal(r.prepaidServices.mode,'per-purchase-period-prepayment');
 assert.equal(r.prepaidServices.reviewPaymentOrder,null);
 assert.equal(r.prepaidServices.automaticDebit,false);
 assert.equal(r.execution.formalSalePricesApproved,false,'No approved formal sale price');
 for(const k of ['realSalesEnabled','paidDemandVerified','merchantPermissionVerified','technicalDetailingResumed','visualDesignResumed','automationChanged'])assert.equal(r.execution[k],false,k);
 assert.equal(r.originalProposal.billing.statedMonthlyDay,25,'Original proposal preserved without inventing a billing origin');
 assert.equal(r.originalProposal.billing.overdueHours,48);
 assert.equal(r.originalProposal.discounts.yearMultiplier,0.6);
 assert.deepEqual(r.originalProposal.contentHeating.map(x=>x.statedInterval),[9,5,3]);
 assert(b.doc.includes('拟定试价已采纳')&&b.doc.includes('原提案与评估结果'),'Explicit proposal boundary');
 for(const text of [b.prd,b.plan,b.design])assert(text.includes('merchant-pricing-confirmed-20261016.md'),'Current source link');
 assert(b.prd.includes('首页同一轮播图')&&b.prd.includes('299/249/199元'),'PRD carousel and prices');
 assert(b.prd.includes('实际出账成功起连续72小时'),'PRD retained billing');
 assert.equal([...b.plan.matchAll(/^\| DP\d{2} \|/gm)].length,57,'No new first-release tasks');
 return true;
}
test('approved merchant trial pricing, carousel, package, discounts and retained billing agree',()=>assert.equal(validate(bundle()),true));
const changes=[
 ['Banner moved to first release',b=>b.r.banner.release='v1',/Banner release/],
 ['Banner release left unconfirmed',b=>b.r.banner.release=null,/Banner release/],
 ['carousel replaced with independent areas',b=>b.r.banner.independentSimultaneousAreas=true,/simultaneous/],
 ['unknown rotation invented',b=>b.r.banner.rotationSeconds=5,/Rotation/],
 ['capacity invented',b=>b.r.banner.maxAdvertisersPerTier=1,/Capacity/],
 ['calendar month replaces continuous days',b=>b.r.banner.monthDefinition='calendar-month',/Banner period/],
 ['all stores share one membership',b=>b.r.membership.billingUnit='all-stores-under-entity',/Membership billing unit/],
 ['rights attach to the person instead of business profile',b=>b.r.membership.entitlementOwner='user-account',/Rights attach/],
 ['quarter changes to calendar months',b=>b.r.servicePeriods.quarterlyDays=null,/Approved service periods/],
 ['Banner quarterly offer enabled',b=>b.r.servicePeriods.products.banner=[30,90],/Approved service periods/],
 ['heating quarterly offer enabled',b=>b.r.servicePeriods.products.contentHeating=[30,90],/Approved service periods/],
 ['activation inferred from payment',b=>b.r.servicePeriods.activationRule='payment-success',/Approved service periods/],
 ['membership starts without qualification approval',b=>b.r.membership.lifecycle.activation.requiresQualificationApproved=false,/membership activation/],
 ['membership starts without confirmed payment',b=>b.r.membership.lifecycle.activation.requiresPaymentSucceeded=false,/membership activation/],
 ['payment alone starts membership',b=>b.r.membership.lifecycle.activation.requiresEntitlementsActuallyEnabled=false,/membership activation/],
 ['failed activation consumes membership time',b=>b.r.membership.lifecycle.activation.failedActivationConsumesTime=true,/membership activation/],
 ['membership expiry hides approved posts',b=>b.r.membership.lifecycle.expiry.approvedPosts='hide',/membership activation/],
 ['expired member can create main posts',b=>b.r.membership.lifecycle.expiry.newMainPostsAllowed=true,/membership activation/],
 ['expiry prevents unpublishing',b=>b.r.membership.lifecycle.expiry.canUnpublish=false,/membership activation/],
 ['expired member can use exclusive tools',b=>b.r.membership.lifecycle.expiry.exclusiveToolsAllowed=true,/membership activation/],
 ['separate promotions expire with membership',b=>b.r.membership.lifecycle.expiry.separatelyPurchasedPromotions='membership-expiry',/membership activation/],
 ['unused included AI rolls forward',b=>b.r.membership.aiAllowancePolicy.carryForward=true,/Included AI expiry/],
 ['included AI expiry not disclosed before purchase',b=>b.r.membership.aiAllowancePolicy.discloseBeforePurchase=false,/Included AI expiry/],
 ['purchased AI expiry inferred from included quota',b=>b.r.membership.aiAllowancePolicy.extraPurchasedValidity='membership-expiry',/Included AI expiry/],
 ['quarterly AI grant cycle invented',b=>b.r.membership.aiAllowancePolicy.grantCycle=30,/Included AI expiry/],
 ['discount extended to Banner',b=>b.r.discounts.eligibleProducts.push('banner'),/Quarter discount/],
 ['discount extended to heating',b=>b.r.discounts.eligibleProducts.push('contentHeating'),/Quarter discount/],
 ['membership required to advertise',b=>b.r.banner.requiresMembership=true,/membership/],
 ['candidate prices treated as effective sales',b=>b.r.execution.formalSalePricesApproved=true,/formal sale/],
 ['membership moved to first release',b=>b.r.membership.release='v1',/Membership release/],
 ['AI allowance invented',b=>b.r.membership.aiAllowance=100,/AI allowance/],
 ['three heating tiers enabled',b=>b.r.contentHeating.candidateMonthlyPricesCents=[4900,9900,14900],/Single initial/],
 ['individual fixed cadence promised',b=>b.r.contentHeating.perMerchantFixedIntervalPromised=true,/fixed cadence/],
 ['global interval silently defaults to nine',b=>b.r.contentHeating.globalOrganicInterval=9,/inferred interval/],
 ['search fee invented',b=>b.r.searchHeating.priceCents=9900,/Search price/],
 ['annual offer activated',b=>b.r.discounts.yearOffered=true,/Year deferred/],
 ['discount applied to commission',b=>b.r.discounts.autoApplyToCommission=true,/Expected values/],
 ['bill changed to day 25',b=>b.r.billing.scheduledDay=25,/billing contract/],
 ['deadline changed to 48 hours',b=>b.r.billing.paymentHours=48,/billing contract/],
 ['clock starts when popup is viewed',b=>b.r.billing.start='popup-viewed',/billing contract/],
 ['actual sales enabled',b=>b.r.execution.realSalesEnabled=true,/realSalesEnabled/],
];
for(const [name,change,error] of changes)test('pricing rejects '+name,()=>{const b=bundle();change(b);assert.throws(()=>validate(b),error);});
test('original monetization decisions and all historical replies remain unchanged',()=>{
 const b=bundle(),file='docs/monetization-decisions-20261015.json',old=JSON.parse(cp.execFileSync('git',['show',b.r.sourceCommit+':'+file],{cwd:root,encoding:'utf8'})),now=JSON.parse(read(file));
 for(const k of Object.keys(old))assert.deepEqual(now[k],old[k],'Original '+k);
 assert.equal(now.pricingSupplement.record,recordPath);
});
test('retained billing, dispute, arrears and cancellation-credit contracts are unchanged',()=>{
 const b=bundle(),prior=cp.execFileSync('git',['show',b.r.sourceCommit+':docs/prd.md'],{cwd:root,encoding:'utf8'});
 const billing=s=>s.replace(/\r\n/g,'\n').match(/### 8\.3[\s\S]*?(?=### 8\.6)/)[0];
 assert.equal(billing(b.prd),billing(prior));
});
test('Banner release approval changes only the prior pending release and preserves the proposal',()=>{
 const b=bundle(),prior=JSON.parse(cp.execFileSync('git',['show',b.r.bannerReleaseDecision.sourceCommit+':'+recordPath],{cwd:root,encoding:'utf8'}));
 assert.equal(prior.banner.release,null);
 const current=JSON.parse(cp.execFileSync('git',['show',b.r.periodAndDiscountDecision.sourceCommit+':'+recordPath],{cwd:root,encoding:'utf8'}));delete current.bannerReleaseDecision;current.banner.release=null;
 assert.deepEqual(current,prior);
 for(const text of [b.prd,b.plan,b.design,b.doc,read('docs/v2-roadmap.md')])assert(text.includes('Banner放到第二版'),'Explicit release scope');
 assert.deepEqual(JSON.parse(read('docs/development-remapping-20261015.json')).deferredTaskIds,['DP30','DP31','DP32','DP33','DP34','DP35']);
});

test('three A choices change only their approved fields and retain every other pricing decision',()=>{
 const live=bundle().r,r=JSON.parse(cp.execFileSync('git',['show',live.membershipLifecycleDecision.sourceCommit+':'+recordPath],{cwd:root,encoding:'utf8'})),prior=JSON.parse(cp.execFileSync('git',['show',r.periodAndDiscountDecision.sourceCommit+':'+recordPath],{cwd:root,encoding:'utf8'}));
 const expected=structuredClone(prior);
 expected.banner.monthDefinition='30-continuous-days';
 expected.membership.billingUnit='single-store-or-independent-provider-profile';
 expected.membership.entitlementOwner='business-profile';
 expected.discounts.eligibleProducts=['membership'];
 expected.servicePeriods={unit:'continuous-days',monthlyDays:30,quarterlyDays:90,purchasePageDisplaysDays:true,products:{membership:[30,90],banner:[30],contentHeating:[30]},activationRule:null};
 const current=structuredClone(r);delete current.periodAndDiscountDecision;
 assert.deepEqual(current,expected,'Only approved billing unit, periods and discount scope change');
});

test('current document entry points state the approved unit, days and membership-only discount',()=>{
 for(const file of ['docs/merchant-pricing-confirmed-20261016.md','docs/prd.md','docs/development-plan.md','docs/structured-design.md','docs/v2-roadmap.md','docs/ascii-design-prd-2.1.md','docs/module-specs/current-development-basis-20261015.md','docs/module-specs/merchant-banner-direction-20261015.md','CONTEXT.md']){
  const s=read(file);
  for(const phrase of ['单个门店或独立服务者经营档案','连续30天','连续90天','季付九折仅适用于工具会员','Banner与内容加热起步只提供30天'])assert(s.includes(phrase),file+': '+phrase);
  assert(!/月计法[/、]优惠|适用商品[仍未待]/.test(s),file+': no stale pending period or discount scope');
 }
 const doc=read('docs/merchant-pricing-confirmed-20261016.md');
 assert(doc.includes('267.30元／90天')&&doc.includes('广告实际排期另行确认'),'Candidate price and advertising activation remain separate');
});

test('membership lifecycle approval preserves every prior price, period, original reply and release decision',()=>{
 const {r}=bundle(),prior=JSON.parse(cp.execFileSync('git',['show',r.membershipLifecycleDecision.sourceCommit+':'+recordPath],{cwd:root,encoding:'utf8'}));
 const current=structuredClone(r);delete current.membershipLifecycleDecision;delete current.membership.lifecycle;delete current.membership.aiAllowancePolicy;
 assert.deepEqual(current,prior,'Only the approved membership lifecycle and included AI policy are added');
});

test('membership lifecycle appears in current documents without silently setting editing, coupons or AI grants',()=>{
 for(const file of ['docs/merchant-pricing-confirmed-20261016.md','docs/prd.md','docs/development-plan.md','docs/structured-design.md','docs/v2-roadmap.md','CONTEXT.md']){
  const s=read(file);
  for(const phrase of ['资格审核通过、付款成功且权益实际开通后起算','开通失败不消耗期限','已审核通过的帖子继续展示','单购推广按自身期限','会员赠送AI额度当期有效、不结转'])assert(s.includes(phrase),file+': '+phrase);
 }
 const s=read('docs/merchant-pricing-confirmed-20261016.md');
 for(const phrase of ['季度会员的额度发放周期','旧帖编辑','已发券的兑现与核销'])assert(s.includes(phrase),'Unresolved detail: '+phrase);
 assert(!s.includes('不确定实际启用起点'),'Membership activation no longer left wholly pending');
});
test('current documents have consistent field contracts and valid supplement links',()=>{
 const b=bundle();
 assert.equal(b.prd.match(/^\| F08 \|[^\r\n]+/m)[0],b.design.match(/^\| F08 \|[^\r\n]+/m)[0]);
 for(const file of ['docs/merchant-pricing-confirmed-20261016.md','docs/monetization-decisions-20261015.md','docs/prd.md','docs/structured-design.md','docs/v2-roadmap.md','CONTEXT.md']){
  const text=read(file);let width=0;
  for(const line of text.split(/\r?\n/)){if(!line.startsWith('|')){width=0;continue;}const n=(line.match(/\|/g)||[]).length;if(width)assert.equal(n,width,file);width=n;}
  for(const m of text.matchAll(/\]\(([^)]+)\)/g)){if(/^(https?:\/\/|#)/.test(m[1]))continue;assert(fs.existsSync(path.resolve(root,path.dirname(file),m[1].split('#')[0])),file+': '+m[1]);}
 }
});
