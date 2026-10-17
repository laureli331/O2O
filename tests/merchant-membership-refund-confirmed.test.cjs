'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const read=p=>new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(path.join(root,p)));
const recordPath='docs/merchant-membership-refund-confirmed-20261017.json';
const pricingPath='docs/merchant-pricing-confirmed-20261016.json';
const proposalPath='docs/merchant-membership-refund-proposal-20261016.json';
const load=()=>JSON.parse(read(recordPath));
const at=(rev,p)=>cp.execFileSync('git',['show',rev+':'+p],{cwd:root,encoding:'utf8'});
const approvedAnswers=[
 'A（推荐）：99元分摊为工具64.40元＋AI34.60元，季度同比九折；工具按剩余时间退、AI按可退未用次数退，购买前明确标注“包含AI额度”及分摊。',
 'A（推荐）：过去已过期批次不退；当前有效批次未用部分及未来未开始批次可退。',
 'A（推荐）：用户确认立即终止并成功提交完整有效申请时停止，审核期间不再消耗该期时间或AI额度。'
];
function validate(r){
 assert.equal(r.date,'2026-10-17');assert.equal(r.timezone,'Asia/Shanghai');
 assert.equal(r.status,'three-business-decisions-approved-execution-details-pending');
 assert.equal(r.responseType,'structured-question-replies');
 assert(!Object.hasOwn(r,'userReply'),'No invented aggregate reply');
 assert.deepEqual(r.responses.map(x=>x.selected),['A','A','A']);
 assert.deepEqual(r.responses.map(x=>x.answer),approvedAnswers,'Exact structured answers');
 assert.deepEqual(r.responses.map(x=>x.id),['allocation-and-prepurchase-disclosure','expired-included-allowance','immediate-termination-cutoff']);
 const rule=r.rules;
 assert.equal(rule.allocation.kind,'contract-apportionment-not-api-cost');
 assert.deepEqual(rule.allocation.candidateTerms,[
  {days:30,actualPaidCents:9900,toolAllocationCents:6440,aiAllocationCents:3460,aiAllocationPerBatchCents:3460},
  {days:90,actualPaidCents:26730,toolAllocationCents:17388,aiAllocationCents:9342,aiAllocationPerBatchCents:3114}
 ]);
 assert.equal(rule.allocation.textAllocationPer30DaysCents,490);
 assert.equal(rule.allocation.imageAllocationPer30DaysCents,2970);
 assert.equal(rule.allocation.quarterDiscountAppliesProportionally,true);
 assert.equal(rule.allocation.repriceUsedUnits,false);
 assert.deepEqual(rule.calculation,{scale:'actual-paid-cents/(9900*number-of-30-day-batches)',toolRefundCents:'actual-paid-cents*6440*remaining-seconds/(9900*total-term-seconds)',aiRefundCents:'scale*(49*eligible-unused-text-units+990*eligible-unused-image-units)/10',timingUnit:'actual-seconds',rounding:'sum-exact-rational-components-then-nearest-cent-half-up-once',feeCents:0,totalRefundCap:'actual-payment-for-that-purchase-period',extraPaymentRequired:false});
 assert.equal(rule.eligibleUnusedAi,'current-valid-batch-and-all-future-unstarted-batches');
 assert.equal(rule.pastExpiredUnusedAiRefundableUnderVoluntaryPolicy,false);
 assert.equal(rule.expiredUnusedUnitsCountAsActuallyGenerated,false);
 assert.deepEqual(rule.termination,{cutoff:'user-confirms-immediate-termination-and-complete-valid-application-submission-succeeds',previewOnlyTerminates:false,incompleteInquiryTerminates:false,ordinaryToolsContinueDuringReview:false,termTimeConsumedDuringReview:false,aiConsumedDuringReview:false,stopsOnlyRequestedPurchasePeriod:true});
 assert.deepEqual(rule.disclosure,{wording:'membership-includes-defined-ai-allowance',allocationDisclosedBeforePurchase:true,refundExamplesDisclosedBeforePurchase:true,purchaseTermsSnapshotRequired:true,retroactiveGiftClawback:false});
 assert.deepEqual(rule.retained,['issued-coupon-original-validity-and-fulfillment','necessary-redemption','complaint-handling','authorized-existing-history-and-purchased-promotion-report-query']);
 assert.equal(rule.separatePurchasedAiPackPolicyChanged,false);
 assert.equal(rule.nonconformingDeliveryHandledSeparately,true);
 assert.deepEqual(r.unconfirmed,{unstartedPurchasePeriodRefundRule:null,withdrawalAndReinstatement:null,invalidApplicationHandling:null,failedOrUnknownRefundHandling:null,crossPurchasedPeriodContinuity:null,processingTimeLimit:null,paymentChannel:null,arrivalTimeLimit:null,concurrentUsageAndRefundHandling:null},'Unasked rules stay pending');
 for(const [key,value] of Object.entries(r.execution))assert.equal(value,false,key+' gate stays closed');
 return true;
}
test('three exact A replies confirm only the named membership business rules',()=>assert.equal(validate(load()),true));

for(const [name,mutate] of [
 ['price allocation changed',r=>r.rules.allocation.candidateTerms[0].aiAllocationCents=4000],
 ['expired unused member batch becomes refundable',r=>r.rules.pastExpiredUnusedAiRefundableUnderVoluntaryPolicy=true],
 ['expired unused quota faked as generated',r=>r.rules.expiredUnusedUnitsCountAsActuallyGenerated=true],
 ['future batch excluded from refund',r=>r.rules.eligibleUnusedAi='current-only'],
 ['time keeps running during review',r=>r.rules.termination.termTimeConsumedDuringReview=true],
 ['AI remains usable during review',r=>r.rules.termination.aiConsumedDuringReview=true],
 ['preview immediately stops rights',r=>r.rules.termination.previewOnlyTerminates=true],
 ['incomplete inquiry stops rights',r=>r.rules.termination.incompleteInquiryTerminates=true],
 ['termination delayed until approval',r=>r.rules.termination.cutoff='review-approved'],
 ['all purchase periods cancelled',r=>r.rules.termination.stopsOnlyRequestedPurchasePeriod=false],
 ['coupon redemption removed',r=>r.rules.retained.splice(1,1)],
 ['past gifts clawed back',r=>r.rules.disclosure.retroactiveGiftClawback=true],
 ['extra payment charged',r=>r.rules.calculation.extraPaymentRequired=true],
 ['all original draft boundaries assumed approved',r=>r.unconfirmed.unstartedPurchasePeriodRefundRule='full-refund'],
 ['AI-pack SLA copied to membership',r=>r.unconfirmed.processingTimeLimit={firstResponseHours:24,reviewHours:72}],
 ['refund channel invented',r=>r.unconfirmed.paymentChannel='wechat'],
 ['real sales enabled',r=>r.execution.realSalesEnabled=true],
 ['all answers replaced with fabricated aggregate',r=>r.userReply='全A']
])test('confirmed refund rejects '+name,()=>{const r=load();mutate(r);assert.throws(()=>validate(r));});

test('pricing changes only by adding this dated decision and its scoped rule reference',()=>{
 const r=JSON.parse(read(pricingPath)),a=load(),prior=JSON.parse(at(a.sourceCommit,pricingPath));
 assert.deepEqual(r.membership.refundRule,{record:recordPath,businessRulesApproved:true,executionReady:false});
 assert.deepEqual(r.membershipRefundDecision,{date:'2026-10-17',sourceCommit:a.sourceCommit,responseType:'structured-question-replies',selected:['A','A','A'],record:recordPath});
 delete r.membership.refundRule;delete r.membershipRefundDecision;assert.deepEqual(r,prior);
});

test('original draft authorization and all its proposed details remain historically intact',()=>{
 const r=load(),p=JSON.parse(read(proposalPath)),prior=JSON.parse(at(r.sourceCommit,proposalPath));
 assert.equal(p.status,'historical-draft-three-decisions-confirmed-separately');
 assert.deepEqual(p.followUpConfirmation,{date:'2026-10-17',record:recordPath,originalDesignAuthorizationPreserved:true,allDraftDetailsApproved:false});
 p.status='draft-awaiting-user-review';delete p.followUpConfirmation;assert.deepEqual(p,prior);
 const oldDoc='docs/merchant-membership-refund-proposal-20261016.md';
 const content=read(oldDoc).replace(/\r\n/g,'\n').split('## 2026-10-16原草案全文\n\n');
 assert.equal(content.length,2);assert.equal(content[1],at(r.sourceCommit,oldDoc).replace(/\r\n/g,'\n'));
});

test('approved examples retain verified arithmetic while unstarted refunds stay outside confirmation',()=>{
 const r=load(),proposal=JSON.parse(read(proposalPath));
 const old=proposal.examples.filter(x=>!x.id.startsWith('unstarted-'));
 assert.deepEqual(r.examples,old);
 const byId=Object.fromEntries(r.examples.map(x=>[x.id,x.expectedRefundCents]));
 assert.equal(byId['month-day-1-ai-exhausted'],6225);
 assert.equal(byId['month-day-10-used-20-text-6-images'],7061);
 assert.equal(byId['quarter-day-45-first-batch-exhausted'],14299);
 assert.equal(byId['quarter-day-45-first-batch-unused'],14299);
 assert(!r.examples.some(x=>x.id.startsWith('unstarted-')));
 for(const term of r.rules.allocation.candidateTerms){
  assert.equal(term.toolAllocationCents+term.aiAllocationCents,term.actualPaidCents);
  assert.equal(term.aiAllocationPerBatchCents*(term.days/30),term.aiAllocationCents);
 }
});

test('current entries state the new confirmation ahead of historical gift and draft wording',()=>{
 for(const file of ['docs/merchant-pricing-confirmed-20261016.md','docs/prd.md','docs/development-plan.md','docs/structured-design.md','docs/v2-roadmap.md','docs/ascii-design-prd-2.1.md','docs/module-specs/current-development-basis-20261015.md','docs/module-specs/merchant-banner-direction-20261015.md','CONTEXT.md']){
  const s=read(file),paragraph=s.split(/\r?\n/)[2];
  for(const phrase of ['会员退款三项确认（2026-10-17）','用户逐题选择A、A、A','工具64.40元＋AI34.60元','工具173.88元＋AI93.42元','每个30天AI批次31.14元','当前有效及未来未开始批次','过去已过期未用批次','不伪记为已生成','审核期间不再消耗该期时间或AI额度','会员包含AI额度','仍待确认'])assert(paragraph.includes(phrase),file+': '+phrase);
  assert(s.includes('该2026-10-16授权时点尚未修改会员规则或赠送表述'),file+': preserve historical timeline');
  for(const m of s.matchAll(/\]\(([^)]+)\)/g)){if(/^(https?:\/\/|#)/.test(m[1]))continue;assert(fs.existsSync(path.resolve(root,path.dirname(file),m[1].split('#')[0])),file+': '+m[1]);}
 }
});

test('confirmed document distinguishes remaining execution choices from business approval',()=>{
 const s=read(load().document);
 for(const phrase of ['金额分摊与购买前说明','过期会员AI批次退款边界','退订的生效时刻','64.40×n×k×r','0.049×U文案＋0.99×U图片','最低0、累计不超过本购买期实付','不收退款手续费，不额外补款','未实际开通或续购未开始购买期的退款规则','仅属于此前AI增购规则','不自动扩大到会员','142.992元','原草案“未开通购买期全退”算例继续保留为待确认提案'])assert(s.includes(phrase),phrase);
 let width=0;for(const line of s.split(/\r?\n/)){if(!line.startsWith('|')){width=0;continue;}const count=(line.match(/\|/g)||[]).length;if(width)assert.equal(count,width);width=count;}
 for(const m of s.matchAll(/\]\(([^)]+)\)/g))assert(fs.existsSync(path.resolve(root,path.dirname(load().document),m[1])),'Confirmed doc link '+m[1]);
});

test('separate AI-package refunds and all first-release task IDs remain unchanged',()=>{
 const r=JSON.parse(read(pricingPath));
 assert.equal(r.aiAddOnPackages.validity.days,180);
 assert.equal(r.aiAddOnPackages.refundRule.expiredPackagesEligible,true);
 assert.equal(r.aiAddOnPackages.refundRule.processingTimeLimit.firstResponseHours,24);
 assert.equal(r.aiAddOnPackages.refundRule.processingTimeLimit.reviewAndInitiateHours,72);
 assert.equal(r.membership.aiAllowance,null);
 assert.equal(r.membership.aiTrial.finalAllowanceApproved,false);
 assert.equal([...read('docs/development-plan.md').matchAll(/^\| DP\d{2} \|/gm)].length,57);
 assert.deepEqual(JSON.parse(read('docs/development-remapping-20261015.json')).deferredTaskIds,['DP30','DP31','DP32','DP33','DP34','DP35']);
});
