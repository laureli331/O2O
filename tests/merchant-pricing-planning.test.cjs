'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const read=p=>new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(path.join(root,p)));
const recordPath='docs/merchant-pricing-confirmed-20261016.json';
const expectedAddOnValidity={unit:'continuous-days',days:180,start:'payment-succeeded-and-allowance-actually-usable',perPackage:true,repurchaseResetsOldExpiry:false,membershipExpiryAffects:false,stopNewUsageAtExpiry:true,unusedAtExpiryTreatedAsConsumed:false};
const expectedAddOnRefund={unusedPortionRefundable:true,partiallyUsedPackagesEligible:true,expiredPackagesEligible:true,feeCents:0,basis:'actual-package-payment',formula:'actual-paid-cents*remaining-units/original-purchased-units',rounding:'nearest-cent-half-up',totalRefundCap:'actual-package-payment',revokeRefundedUnits:true,refundSameUnitsMoreThanOnce:false,usedUnitsRepriced:false,nonconformingDeliveryHandledSeparately:true,paymentChannel:null,processingTimeLimit:null};
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
 assert.equal(r.membership.aiAllowance,null,'Formal AI allowance still pending validation');
 assert.equal(r.membership.postLimit,null,'Post limit pending');
 assert.equal(r.membership.billingUnit,'single-store-or-independent-provider-profile','Membership billing unit');
 assert.equal(r.membership.entitlementOwner,'business-profile','Rights attach to the business profile');
 assert.deepEqual(r.membership.toolsScope,{included:['business-publicity-profile-management','main-post-drafts-and-publication-management','campaign-management','coupon-management'],assetLibrary:'deferred',reuploadMaterialsPerPublication:true},'Approved tools exclude a material library');
 assert.deepEqual(r.membership.aiServiceScope,{included:['promotional-copy','real-photo-optimization','template-campaign-posters'],allowanceAccess:'included-member-allowance',usageCostPerService:null,copySource:'merchant-provided-factual-information',photoMustPreserve:['product-subject','quantity','key-characteristics'],posterPriceAndTermsConfirmedByMerchant:true,supplierAndEffectVerified:false},'Approved AI services and pending costs');
 assert.deepEqual(r.membership.basicEffectStats,{summaryPanelIncluded:true,scope:'own-content-and-campaigns',metrics:['views','favorites','coupon-claims','coupon-redemptions'],historicalRecordsReadableAfterExpiry:true,purchasedPromotionReportsReadableAfterExpiry:true,queryFeeCents:0,countsRepresentNewSales:false,metricDefinitions:null,dataRetention:null},'Approved basic effect statistics');
 assert.equal(r.membershipBenefitsDecision.userReply,'1b\n2a\n3a','Actual B A A reply');
 assert.deepEqual(r.membershipBenefitsDecision.choices.map(x=>[x.id,x.selected]),[['basic-tools-scope','B'],['included-ai-services','A'],['basic-effect-statistics','A']]);
 assert.deepEqual(r.membership.aiTrial,{status:'approved-trial-pending-validation',candidateAllowance:{periodDays:30,textGenerations:100,standardImageOutputs:30},posterProduction:{mode:'template-layout-with-on-demand-ai-assets',ordinaryEditsAndExportConsumeAiAllowance:false,newCopyUsesTextAllowance:true,newImageUsesImageAllowance:true,extraPosterGenerationAllowance:false},imageMetering:{unit:'successfully-returned-image',deductPerImage:1,technicalFailureDeducts:false,userRequestedRegenerationDeducts:true,noticeBeforeRegeneration:true,technicalOutcomeBoundary:null},supplier:null,textLimits:{inputMaxVisibleCharacters:1000,setsPerRequest:1,outputMaxVisibleCharacters:{title:30,body:300,posterTagline:30},counting:'visible-characters-including-text-digits-and-punctuation'},effectVerified:false,fullCostVerified:false,finalAllowanceApproved:false,paidEvaluationAuthorized:false,textMetering:{unit:'complete-successful-set',deductPerSet:1,technicalFailureDeducts:false,userRequestedRegenerationDeducts:true,noticeBeforeRegeneration:true,technicalOutcomeBoundary:null},standardImageSpec:{inputImagesPerRequest:1,inputFormats:['JPEG','PNG'],inputMaxSizeMB:5,outputImagesPerRequest:1,outputFormat:'PNG',sizes:{square:[1024,1024],portrait:[960,1280],landscape:[1280,960]}}},'Approved AI trial, poster production and image metering');
 assert.deepEqual(r.aiAddOnPackages,{release:'v2',products:[{kind:'text',textGenerations:100,priceCents:null,candidatePriceCents:490},{kind:'standard-images',standardImageOutputs:10,priceCents:null,candidatePriceCents:990}],nonMembersMayPurchaseAndUse:true,includes:'corresponding-ai-production-only',includesMainPosting:false,includesCampaignTools:false,includesAdvertisingExposure:false,validity:expectedAddOnValidity,refundRule:expectedAddOnRefund,realSalesEnabled:false},'Approved standalone AI package sizes and entitlement boundary');
 assert.equal(r.aiAddOnCommercialDecision.userReply,'全A','Actual add-on commercial reply');
 assert.deepEqual(r.aiAddOnCommercialDecision.choices.map(x=>[x.id,x.selected]),[['add-on-trial-prices','A'],['purchased-allowance-validity','A'],['unused-allowance-refunds','A']]);
 assert.equal(r.aiOutputAndAddOnDecision.userReply,'全a','Actual output and package reply');
 assert.deepEqual(r.aiOutputAndAddOnDecision.choices.map(x=>[x.id,x.selected]),[['text-generation-unit','A'],['standard-image-specification','A'],['ai-add-on-package-form','A']]);
 assert.equal(r.merchantAiTrialDecision.userReply,'全A','Actual AI trial reply');
 assert.deepEqual(r.merchantAiTrialDecision.choices.map(x=>[x.id,x.selected]),[['poster-production','A'],['candidate-ai-allowance','A'],['image-allowance-metering','A']]);
 assert.deepEqual(r.membership.lifecycle,{activation:{requiresQualificationApproved:true,requiresPaymentSucceeded:true,requiresEntitlementsActuallyEnabled:true,start:'actual-entitlement-enablement-after-qualification-and-payment',failedActivationConsumesTime:false},expiry:{approvedPosts:'retain-public-visibility',canUnpublish:true,newMainPostsAllowed:false,exclusiveToolsAllowed:false,separatelyPurchasedPromotions:'own-validity-period',postEditingRule:null,existingCampaignRule:{newCampaignsAllowed:false,newCouponClaimsAllowed:false,existingActivityPageDisplay:null},issuedCouponRule:{validity:'original-coupon-term',necessaryRedemptionAllowed:true,complaintHandlingRetained:true}}},'Approved membership activation and expiry');
 assert.deepEqual(r.membership.aiAllowancePolicy,{includedUnusedExpiry:'end-of-current-allowance-period',carryForward:false,discloseBeforePurchase:true,grantCycle:{unit:'continuous-days',days:30,grantsPerQuarter:3,unusedExpiry:'end-of-each-30-day-period'},extraPurchasedValidity:{record:'aiAddOnPackages.validity'}},'Included AI expiry and separate purchased quota');
 assert.deepEqual(r.membership.renewal,{mode:'manual-purchase',earlyRenewalAllowed:true,activeMembershipStart:'after-current-paid-term',expiredMembershipStart:'actual-reenablement-after-qualification-and-payment'},'Approved manual renewal and term continuity');
 assert.equal(r.membershipContinuationDecision.userReply,'全A','Actual membership continuation reply');
 assert.deepEqual(r.membershipContinuationDecision.choices.map(x=>[x.id,x.selected]),[['quarterly-ai-grants','A'],['early-renewal','A'],['campaign-coupon-expiry','A']]);
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
 ['add-on candidate text price silently raised',b=>b.r.aiAddOnPackages.products[0].candidatePriceCents=990,/standalone AI package/],
 ['add-on candidate image price silently raised',b=>b.r.aiAddOnPackages.products[1].candidatePriceCents=1490,/standalone AI package/],
 ['paid quota expires after 365 days',b=>b.r.aiAddOnPackages.validity.days=365,/standalone AI package/],
 ['paid quota expires after the gifted 30-day period',b=>b.r.aiAddOnPackages.validity.days=30,/standalone AI package/],
 ['payment alone starts add-on expiry clock',b=>b.r.aiAddOnPackages.validity.start='payment-succeeded',/standalone AI package/],
 ['repurchase refreshes earlier package expiry',b=>b.r.aiAddOnPackages.validity.repurchaseResetsOldExpiry=true,/standalone AI package/],
 ['membership expiry invalidates purchased allowance',b=>b.r.aiAddOnPackages.validity.membershipExpiryAffects=true,/standalone AI package/],
 ['expired allowance treated as consumed',b=>b.r.aiAddOnPackages.validity.unusedAtExpiryTreatedAsConsumed=true,/standalone AI package/],
 ['partially used packages barred from refunds',b=>b.r.aiAddOnPackages.refundRule.partiallyUsedPackagesEligible=false,/standalone AI package/],
 ['expired packages barred from refunds',b=>b.r.aiAddOnPackages.refundRule.expiredPackagesEligible=false,/standalone AI package/],
 ['refund handling fee invented',b=>b.r.aiAddOnPackages.refundRule.feeCents=50,/standalone AI package/],
 ['refund uses public list price instead of actual payment',b=>b.r.aiAddOnPackages.refundRule.basis='list-price',/standalone AI package/],
 ['refund cents rounded down',b=>b.r.aiAddOnPackages.refundRule.rounding='floor',/standalone AI package/],
 ['refund exceeds original actual payment',b=>b.r.aiAddOnPackages.refundRule.totalRefundCap=null,/standalone AI package/],
 ['refunded units remain usable',b=>b.r.aiAddOnPackages.refundRule.revokeRefundedUnits=false,/standalone AI package/],
 ['same units may be refunded twice',b=>b.r.aiAddOnPackages.refundRule.refundSameUnitsMoreThanOnce=true,/standalone AI package/],
 ['used units repriced at a higher single-use rate',b=>b.r.aiAddOnPackages.refundRule.usedUnitsRepriced=true,/standalone AI package/],
 ['nonconforming delivery excluded from separate review',b=>b.r.aiAddOnPackages.refundRule.nonconformingDeliveryHandledSeparately=false,/standalone AI package/],
 ['refund processing time silently promised',b=>b.r.aiAddOnPackages.refundRule.processingTimeLimit=7,/standalone AI package/],
 ['text input expanded beyond 1000 characters',b=>b.r.membership.aiTrial.textLimits.inputMaxVisibleCharacters=2000,/Approved AI trial/],
 ['single text request returns three sets',b=>b.r.membership.aiTrial.textLimits.setsPerRequest=3,/Approved AI trial/],
 ['body length exceeds 300 characters',b=>b.r.membership.aiTrial.textLimits.outputMaxVisibleCharacters.body=500,/Approved AI trial/],
 ['visible characters counted as tokens',b=>b.r.membership.aiTrial.textLimits.counting='tokens',/Approved AI trial/],
 ['technical text failure deducts quota',b=>b.r.membership.aiTrial.textMetering.technicalFailureDeducts=true,/Approved AI trial/],
 ['partial text output billed as a complete set',b=>b.r.membership.aiTrial.textMetering.unit='any-partial-output',/Approved AI trial/],
 ['text regeneration lacks advance notice',b=>b.r.membership.aiTrial.textMetering.noticeBeforeRegeneration=false,/Approved AI trial/],
 ['multiple original photos accepted per request',b=>b.r.membership.aiTrial.standardImageSpec.inputImagesPerRequest=3,/Approved AI trial/],
 ['image input limit silently becomes 10MB',b=>b.r.membership.aiTrial.standardImageSpec.inputMaxSizeMB=10,/Approved AI trial/],
 ['four candidates returned for a single image request',b=>b.r.membership.aiTrial.standardImageSpec.outputImagesPerRequest=4,/Approved AI trial/],
 ['standard square resolution doubled',b=>b.r.membership.aiTrial.standardImageSpec.sizes.square=[2048,2048],/Approved AI trial/],
 ['standard image output silently changes format',b=>b.r.membership.aiTrial.standardImageSpec.outputFormat='JPEG',/Approved AI trial/],
 ['nonmembers barred from purchased AI services',b=>b.r.aiAddOnPackages.nonMembersMayPurchaseAndUse=false,/standalone AI package/],
 ['text add-on becomes a 20-use pack',b=>b.r.aiAddOnPackages.products[0].textGenerations=20,/standalone AI package/],
 ['image add-on becomes a 30-output pack',b=>b.r.aiAddOnPackages.products[1].standardImageOutputs=30,/standalone AI package/],
 ['add-on price invented',b=>b.r.aiAddOnPackages.products[1].priceCents=990,/standalone AI package/],
 ['add-on expires with the 30-day allowance',b=>b.r.aiAddOnPackages.validity='membership-period-end',/standalone AI package/],
 ['AI purchase grants posting rights',b=>b.r.aiAddOnPackages.includesMainPosting=true,/standalone AI package/],
 ['AI purchase grants campaign tools',b=>b.r.aiAddOnPackages.includesCampaignTools=true,/standalone AI package/],
 ['AI purchase grants advertising exposure',b=>b.r.aiAddOnPackages.includesAdvertisingExposure=true,/standalone AI package/],
 ['add-on sales enabled from the scope decision',b=>b.r.aiAddOnPackages.realSalesEnabled=true,/standalone AI package/],
 ['trial treated as production-ready quota',b=>b.r.membership.aiTrial.finalAllowanceApproved=true,/Approved AI trial/],
 ['AI allowance trial extended beyond 30 days',b=>b.r.membership.aiTrial.candidateAllowance.periodDays=90,/Approved AI trial/],
 ['trial text quota silently increased',b=>b.r.membership.aiTrial.candidateAllowance.textGenerations=200,/Approved AI trial/],
 ['trial image quota silently increased',b=>b.r.membership.aiTrial.candidateAllowance.standardImageOutputs=50,/Approved AI trial/],
 ['poster-only extra AI quota gifted',b=>b.r.membership.aiTrial.posterProduction.extraPosterGenerationAllowance=true,/Approved AI trial/],
 ['ordinary price edits deduct AI allowance again',b=>b.r.membership.aiTrial.posterProduction.ordinaryEditsAndExportConsumeAiAllowance=true,/Approved AI trial/],
 ['new poster copy bypasses text quota',b=>b.r.membership.aiTrial.posterProduction.newCopyUsesTextAllowance=false,/Approved AI trial/],
 ['new poster image bypasses image quota',b=>b.r.membership.aiTrial.posterProduction.newImageUsesImageAllowance=false,/Approved AI trial/],
 ['technical failure deducts image quota',b=>b.r.membership.aiTrial.imageMetering.technicalFailureDeducts=true,/Approved AI trial/],
 ['successful requested regeneration is free',b=>b.r.membership.aiTrial.imageMetering.userRequestedRegenerationDeducts=false,/Approved AI trial/],
 ['regeneration deduction lacks advance notice',b=>b.r.membership.aiTrial.imageMetering.noticeBeforeRegeneration=false,/Approved AI trial/],
 ['supplier selected from the pricing example',b=>b.r.membership.aiTrial.supplier='aliyun',/Approved AI trial/],
 ['full costs verified from API prices alone',b=>b.r.membership.aiTrial.fullCostVerified=true,/Approved AI trial/],
 ['paid evaluation silently authorized',b=>b.r.membership.aiTrial.paidEvaluationAuthorized=true,/Approved AI trial/],
 ['material library silently included',b=>b.r.membership.toolsScope.assetLibrary='included',/tools exclude/],
 ['campaign management dropped from basic tools',b=>b.r.membership.toolsScope.included.splice(2,1),/tools exclude/],
 ['real photo optimization sold only as an extra',b=>b.r.membership.aiServiceScope.included.splice(1,1),/Approved AI services/],
 ['AI generation unit costs invented',b=>b.r.membership.aiServiceScope.usageCostPerService={image:1},/Approved AI services/],
 ['AI promotional information freely invented',b=>b.r.membership.aiServiceScope.copySource='model-invented',/Approved AI services/],
 ['AI supplier and quality treated as verified',b=>b.r.membership.aiServiceScope.supplierAndEffectVerified=true,/Approved AI services/],
 ['summary statistics postponed',b=>b.r.membership.basicEffectStats.summaryPanelIncluded=false,/basic effect statistics/],
 ['other merchants statistics exposed',b=>b.r.membership.basicEffectStats.scope='all-merchants',/basic effect statistics/],
 ['history inaccessible after membership expiry',b=>b.r.membership.basicEffectStats.historicalRecordsReadableAfterExpiry=false,/basic effect statistics/],
 ['purchased promotion reports inaccessible after expiry',b=>b.r.membership.basicEffectStats.purchasedPromotionReportsReadableAfterExpiry=false,/basic effect statistics/],
 ['basic statistics queries charged separately',b=>b.r.membership.basicEffectStats.queryFeeCents=100,/basic effect statistics/],
 ['coupon redemptions reported as new sales',b=>b.r.membership.basicEffectStats.countsRepresentNewSales=true,/basic effect statistics/],
 ['statistics data retention period invented',b=>b.r.membership.basicEffectStats.dataRetention=365,/basic effect statistics/],
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
 ['quarterly AI grants frontloaded',b=>b.r.membership.aiAllowancePolicy.grantCycle.grantsPerQuarter=1,/Included AI expiry/],
 ['AI grant windows changed to calendar months',b=>b.r.membership.aiAllowancePolicy.grantCycle.unit='calendar-months',/Included AI expiry/],
 ['AI grant cycle left pending',b=>b.r.membership.aiAllowancePolicy.grantCycle=null,/Included AI expiry/],
 ['batch allowance stays valid for 90 days',b=>b.r.membership.aiAllowancePolicy.grantCycle.unusedExpiry='end-of-90-day-term',/Included AI expiry/],
 ['early renewal disallowed',b=>b.r.membership.renewal.earlyRenewalAllowed=false,/Approved manual renewal/],
 ['early purchase overlaps current term',b=>b.r.membership.renewal.activeMembershipStart='payment-success',/Approved manual renewal/],
 ['lapsed membership backdated',b=>b.r.membership.renewal.expiredMembershipStart='old-term-end',/Approved manual renewal/],
 ['campaign creation continues after membership expiry',b=>b.r.membership.lifecycle.expiry.existingCampaignRule.newCampaignsAllowed=true,/membership activation/],
 ['new coupon claims continue after expiry',b=>b.r.membership.lifecycle.expiry.existingCampaignRule.newCouponClaimsAllowed=true,/membership activation/],
 ['issued coupons expire with membership',b=>b.r.membership.lifecycle.expiry.issuedCouponRule.validity='membership-expiry',/membership activation/],
 ['necessary coupon redemption blocked after expiry',b=>b.r.membership.lifecycle.expiry.issuedCouponRule.necessaryRedemptionAllowed=false,/membership activation/],
 ['coupon complaints blocked after expiry',b=>b.r.membership.lifecycle.expiry.issuedCouponRule.complaintHandlingRetained=false,/membership activation/],
 ['automatic membership debit enabled',b=>b.r.prepaidServices.automaticDebit=true,/Expected values/],
 ['discount extended to Banner',b=>b.r.discounts.eligibleProducts.push('banner'),/Quarter discount/],
 ['discount extended to heating',b=>b.r.discounts.eligibleProducts.push('contentHeating'),/Quarter discount/],
 ['membership required to advertise',b=>b.r.banner.requiresMembership=true,/membership/],
 ['candidate prices treated as effective sales',b=>b.r.execution.formalSalePricesApproved=true,/formal sale/],
 ['membership moved to first release',b=>b.r.membership.release='v1',/Membership release/],
 ['formal AI allowance activated from the trial',b=>b.r.membership.aiAllowance=100,/Formal AI allowance/],
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
 const live=bundle().r,r=JSON.parse(cp.execFileSync('git',['show',live.membershipContinuationDecision.sourceCommit+':'+recordPath],{cwd:root,encoding:'utf8'})),prior=JSON.parse(cp.execFileSync('git',['show',r.membershipLifecycleDecision.sourceCommit+':'+recordPath],{cwd:root,encoding:'utf8'}));
 const current=structuredClone(r);delete current.membershipLifecycleDecision;delete current.membership.lifecycle;delete current.membership.aiAllowancePolicy;
 assert.deepEqual(current,prior,'Only the approved membership lifecycle and included AI policy are added');
});

test('membership lifecycle appears in current documents and retains unconfirmed editing and AI quantities',()=>{
 for(const file of ['docs/merchant-pricing-confirmed-20261016.md','docs/prd.md','docs/development-plan.md','docs/structured-design.md','docs/v2-roadmap.md','CONTEXT.md']){
  const s=read(file);
  for(const phrase of ['资格审核通过、付款成功且权益实际开通后起算','开通失败不消耗期限','已审核通过的帖子继续展示','单购推广按自身期限','会员赠送AI额度当期有效、不结转'])assert(s.includes(phrase),file+': '+phrase);
 }
 const s=read('docs/merchant-pricing-confirmed-20261016.md');
 for(const phrase of ['每期数量和计量单位仍待','旧帖编辑','已发券的兑现与核销'])assert(s.includes(phrase),'Retained detail: '+phrase);
 assert(!s.includes('不确定实际启用起点'),'Membership activation no longer left wholly pending');
});

test('continuation decisions change only approved grant cycle, renewal and campaign expiry fields',()=>{
 const live=bundle().r,r=JSON.parse(cp.execFileSync('git',['show',live.membershipBenefitsDecision.sourceCommit+':'+recordPath],{cwd:root,encoding:'utf8'})),prior=JSON.parse(cp.execFileSync('git',['show',r.membershipContinuationDecision.sourceCommit+':'+recordPath],{cwd:root,encoding:'utf8'}));
 const current=structuredClone(r);delete current.membershipContinuationDecision;delete current.membership.renewal;
 current.membership.aiAllowancePolicy.grantCycle=null;
 current.membership.lifecycle.expiry.existingCampaignRule=null;
 current.membership.lifecycle.expiry.issuedCouponRule=null;
 assert.deepEqual(current,prior,'All prior prices, replies, releases and unresolved decisions preserved');
});

test('B A A benefits approval adds only scoped tools, AI services, statistics and provenance',()=>{
 const live=bundle().r,r=JSON.parse(cp.execFileSync('git',['show',live.merchantAiTrialDecision.sourceCommit+':'+recordPath],{cwd:root,encoding:'utf8'})),prior=JSON.parse(cp.execFileSync('git',['show',r.membershipBenefitsDecision.sourceCommit+':'+recordPath],{cwd:root,encoding:'utf8'}));
 const current=structuredClone(r);delete current.membershipBenefitsDecision;delete current.membership.toolsScope;delete current.membership.aiServiceScope;delete current.membership.basicEffectStats;
 assert.deepEqual(current,prior,'Prior rates, billing, quota uncertainties and releases preserved');
});

test('AI trial approval adds only the approved trial contract and its actual reply',()=>{
 const live=bundle().r,r=JSON.parse(cp.execFileSync('git',['show',live.aiOutputAndAddOnDecision.sourceCommit+':'+recordPath],{cwd:root,encoding:'utf8'})),prior=JSON.parse(cp.execFileSync('git',['show',r.merchantAiTrialDecision.sourceCommit+':'+recordPath],{cwd:root,encoding:'utf8'}));
 const current=structuredClone(r);delete current.merchantAiTrialDecision;delete current.membership.aiTrial;
 assert.deepEqual(current,prior,'Prior replies, candidate prices, releases, formal quota and billing retained');
});

test('output and add-on choices change only approved text, image and package definitions',()=>{
 const live=bundle().r,r=JSON.parse(cp.execFileSync('git',['show',live.aiAddOnCommercialDecision.sourceCommit+':'+recordPath],{cwd:root,encoding:'utf8'})),prior=JSON.parse(cp.execFileSync('git',['show',r.aiOutputAndAddOnDecision.sourceCommit+':'+recordPath],{cwd:root,encoding:'utf8'}));
 const current=structuredClone(r);delete current.aiOutputAndAddOnDecision;delete current.aiAddOnPackages;
 current.membership.aiTrial.textLimits=null;delete current.membership.aiTrial.textMetering;delete current.membership.aiTrial.standardImageSpec;
 assert.deepEqual(current,prior,'Earlier choices, candidate prices, formal quota, rates and schedules preserved');
});

test('current documents state the exact approved output sizes and independent package scope',()=>{
 for(const file of ['docs/merchant-pricing-confirmed-20261016.md','docs/prd.md','docs/development-plan.md','docs/structured-design.md','docs/v2-roadmap.md','docs/ascii-design-prd-2.1.md','docs/module-specs/current-development-basis-20261015.md','docs/module-specs/merchant-banner-direction-20261015.md','CONTEXT.md']){
  const s=read(file);
  for(const phrase of ['输入≤1000个可见字符','标题≤30＋正文≤300＋海报短句≤30','完整成功返回扣1次','JPEG/PNG且≤5MB','1024×1024、竖图960×1280、横图1280×960','100次文案包和10张标准图片包','非会员可单独购买并使用对应AI服务','不附带主帖发布、活动工具或广告曝光权益'])assert(s.includes(phrase),file+': '+phrase);
 }
 assert.deepEqual(bundle().r.membership.aiAllowancePolicy.extraPurchasedValidity,{record:'aiAddOnPackages.validity'},'Purchased expiry points to its separate approved contract');
});

test('add-on pricing, validity and refunds leave every earlier decision unchanged',()=>{
 const {r}=bundle(),prior=JSON.parse(cp.execFileSync('git',['show',r.aiAddOnCommercialDecision.sourceCommit+':'+recordPath],{cwd:root,encoding:'utf8'}));
 const current=structuredClone(r);delete current.aiAddOnCommercialDecision;
 for(const p of current.aiAddOnPackages.products)delete p.candidatePriceCents;
 current.aiAddOnPackages.validity=null;current.aiAddOnPackages.refundRule=null;current.membership.aiAllowancePolicy.extraPurchasedValidity=null;
 assert.deepEqual(current,prior,'Earlier replies, package units, membership allowance and billing preserved');
});

test('current documents explain candidate package prices, independent expiry and proportional refunds',()=>{
 for(const file of ['docs/merchant-pricing-confirmed-20261016.md','docs/prd.md','docs/development-plan.md','docs/structured-design.md','docs/v2-roadmap.md','docs/ascii-design-prd-2.1.md','docs/module-specs/current-development-basis-20261015.md','docs/module-specs/merchant-banner-direction-20261015.md','CONTEXT.md']){
  const s=read(file);
  for(const phrase of ['100次文案包候选4.90元','10张标准图片包候选9.90元','付款成功且额度实际可用后连续180天','复购不刷新旧包期限','部分使用或到期后仍可申请退未用部分','不收退款手续费','累计退款不超过该包实付','退款通道和处理时限仍待确认'])assert(s.includes(phrase),file+': '+phrase);
  assert(!s.includes('价格与另购额度有效期仍待确认'),'Superseded pending status: '+file);
 }
});

test('refund examples use actual fen and round once to the nearest cent',()=>{
 const s=read('docs/merchant-pricing-confirmed-20261016.md');
 const roundFraction=(paid,total,remaining)=>Number((2n*BigInt(paid)*BigInt(remaining)+BigInt(total))/(2n*BigInt(total)));
 assert.equal(roundFraction(990,10,7),693);
 assert.equal(roundFraction(490,100,1),5);
 assert.equal(roundFraction(490,100,99),485);
 for(const phrase of ['6.93元','0.05元','4.85元','该包实付金额×剩余次数÷该包购买总次数','不把赠送额度当作实付款','不是对99元工具会员退款规则的确认'])assert(s.includes(phrase),phrase);
});

test('current documents state the approved trial and the poster quota boundary',()=>{
 for(const file of ['docs/merchant-pricing-confirmed-20261016.md','docs/prd.md','docs/development-plan.md','docs/structured-design.md','docs/v2-roadmap.md','docs/ascii-design-prd-2.1.md','docs/module-specs/current-development-basis-20261015.md','docs/module-specs/merchant-banner-direction-20261015.md','CONTEXT.md']){
  const s=read(file);
  for(const phrase of ['每连续30天100次文案＋30张标准图片输出','模板排版＋商家照片＋可修改文字','普通改价/日期/排版及导出不重复扣AI额度','技术失败不扣','主动重新生成须提前提示并另扣','实测达标后再定稿'])assert(s.includes(phrase),file+': '+phrase);
 }
});

test('cost illustration retains token units and separates API-only costs from actual profitability',()=>{
 const s=read('docs/merchant-pricing-confirmed-20261016.md');
 const costPerCopy=(2000*0.15+1000*1.5)/1000000;
 assert.equal(costPerCopy,0.0018);
 assert.equal(Number((100*costPerCopy+30*0.2).toFixed(2)),6.18);
 assert.equal(Number((100*costPerCopy+30*0.5).toFixed(2)),15.18);
 for(const phrase of ['0.0018元','6.18元','15.18元','不是实测平均用量','不是净利润','不是30张满意成片','不计新人免费额度','尚未采购或付费调用'])assert(s.includes(phrase),phrase);
 for(const url of ['https://help.aliyun.com/zh/model-studio/model-pricing','https://console.volcengine.com/ark/region:cn-beijing/docs/model-pricing','https://cloud.tencent.cn/document/product/1668/90896','https://help.aliyun.com/zh/model-studio/bailian-service-notes'])assert(s.includes(url),'Evidence '+url);
});

test('current documents consistently state B A A benefits without reviving the library or treating counts as sales',()=>{
 for(const file of ['docs/merchant-pricing-confirmed-20261016.md','docs/prd.md','docs/development-plan.md','docs/structured-design.md','docs/v2-roadmap.md','docs/ascii-design-prd-2.1.md','docs/module-specs/current-development-basis-20261015.md','docs/module-specs/merchant-banner-direction-20261015.md','CONTEXT.md']){
  const s=read(file);
  for(const phrase of ['素材库暂缓，每次发布自行上传','宣传文案、实拍图片优化、模板式活动海报','浏览、收藏、领券和核销','已有历史记录和已购推广报告到期后仍可查看','不另收查询费','不把浏览、点击或核销写成新增成交额'])assert(s.includes(phrase),file+': '+phrase);
 }
 assert.equal(bundle().r.membership.entitlementDetailsComplete,false,'Limits and delivery rules still pending');
});

test('current documents explain grants, renewal and necessary coupon exceptions together',()=>{
 for(const file of ['docs/merchant-pricing-confirmed-20261016.md','docs/prd.md','docs/development-plan.md','docs/structured-design.md','docs/v2-roadmap.md','docs/ascii-design-prd-2.1.md','docs/module-specs/current-development-basis-20261015.md','docs/module-specs/merchant-banner-direction-20261015.md','CONTEXT.md']){
  const s=read(file);
  for(const phrase of ['每连续30天发放一次，共三次','新期限接在已购有效期之后','到期后停止创建活动及新领券','已领券按原定期限有效','保留必要核销和投诉处理'])assert(s.includes(phrase),file+': '+phrase);
  assert(!s.includes('季度会员的额度发放周期、每期数量和计量单位仍待'),'Grant cycle no longer pending');
 }
 assert.equal(bundle().r.membership.aiAllowance,null,'No quantity invented');
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
