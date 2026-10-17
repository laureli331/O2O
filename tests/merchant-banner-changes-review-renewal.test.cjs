'use strict';
// Planning contract checks only; does not execute advertising, payment or live review.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),recordPath="docs/merchant-pricing-confirmed-20261016.json",entries=["docs/merchant-pricing-confirmed-20261016.md","docs/prd.md","docs/development-plan.md","docs/structured-design.md","docs/v2-roadmap.md","docs/ascii-design-prd-2.1.md","docs/module-specs/current-development-basis-20261015.md","docs/module-specs/merchant-banner-direction-20261015.md","CONTEXT.md"];
const read=p=>new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(path.join(root,p))),load=()=>JSON.parse(read(recordPath));
const at=(rev,p)=>cp.execFileSync('git',['show',rev+':'+p],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n');
const expectedResponses=[{"questionItemId":"[\"request_user_input_async\",\"call_3f6818017bac42abb8f3b75a9582fb8a\",0]","id":"banner-ordinary-change-count-and-pending-request-limit","selected":"A","question":"已开始投放的Banner，其普通素材修改次数与待审数量，是否采用以下起步试行规则？普通审核和替换仍不另收费，修改仍须审核通过后再展示。","answer":"A（推荐）：普通修改总次数暂不限；同一购买期同时最多1份待审修改申请，要换新稿先撤回原申请再提交。原合规广告在修改待审期间继续展示。"},{"questionItemId":"[\"request_user_input_async\",\"call_3f6818017bac42abb8f3b75a9582fb8a\",1]","id":"banner-internal-ordinary-material-review-target","selected":"A","question":"平台内部普通素材审核，采用什么处理目标？适用于首次上架和修改，从完整有效素材及必要授权提交成功时起算；异常须在原期限内说明原因、进度并继续处理。已有广告修改待审时仍保留原合规版本。","answer":"A（推荐）：24连续小时内给出审核结果；这是平台内部处理目标，不代表素材一定通过。"},{"questionItemId":"[\"request_user_input_async\",\"call_3f6818017bac42abb8f3b75a9582fb8a\",2]","id":"banner-active-period-manual-advance-next-period-purchase","selected":"A","question":"Banner当前购买期仍有效时，是否允许商家主动提前购买下一期30天？本题不提供自动扣费，也不改变此前已有有效保留和已付款排期的保护规则。","answer":"A（推荐）：允许；按既定规则审核并确认可用排期后再付款，拟接续时间以确认排期为准。提前付款不提前起算，不享有挤占他人有效保留或已付款排期的优先权。"}];
const expectedSubmission={"appliesTo":"ordinary-material-changes-after-advertising-start","policy":"launch-trial","totalChangeCountPolicy":"temporarily-unlimited","totalChangeCountLimit":null,"maxPendingRequestsPerPurchasePeriod":1,"newDraftRequiresWithdrawExistingPending":true,"previousCompliantVersionVisibleDuringReview":true},expectedReview={"scope":["initial-publication","ordinary-material-changes"],"unit":"continuous-hours","hours":24,"start":"complete-valid-materials-and-necessary-authorizations-submitted-successfully","target":"review-result","platformInternalTarget":true,"approvalGuaranteed":false,"exceptionUpdate":"reason-and-progress-within-original-deadline-and-continue-handling"},expectedRenewal={"allowedWhileCurrentPeriodValid":true,"nextPeriodDays":30,"reviewAndScheduleBeforePayment":true,"start":"confirmed-schedule","advancePaymentStartsClock":false,"automaticDebit":false,"protectExistingEffectiveReservations":true,"protectConfirmedPaidSchedules":true,"advancePurchaseDisplacementPriority":false};
function validate(r){
 assert.deepEqual(r.banner.materialChangeSubmission,expectedSubmission);
 assert.deepEqual(r.banner.ordinaryMaterialReviewTarget,expectedReview);
 assert.deepEqual(r.banner.advanceRenewal,expectedRenewal);
 assert.deepEqual(r.bannerChangeReviewAndRenewalDecision.responses,expectedResponses);
 assert.equal(r.bannerChangeReviewAndRenewalDecision.realSalesAuthorized,false);
 for(const value of Object.values(r.execution))assert.equal(value,false);
 assert.equal(r.banner.materialChanges.reviewBeforeReplacement,true);
 assert.equal(r.banner.materialChanges.restartsAdvertisingPeriod,false);
 assert.equal(r.banner.ordinaryMaterialServices.extraFeeCents,0);
 assert.equal(r.banner.activation.requiresActuallyDisplayable,true);
 assert.equal(r.banner.scheduling.protectConfirmedPaidSchedules,true);
 assert.equal(r.banner.pendingDetails.materialChangeSubmissionExecutionAndRateLimits,null);
 assert.equal(r.banner.pendingDetails.expiryAndRenewalExecution,null);
 assert.equal(Object.hasOwn(r.banner.pendingDetails,'materialChangeQuotaAndFrequency'),false);
 assert.equal(Object.hasOwn(r.banner.pendingDetails,'expiryAndRenewalRule'),false);
 return true;
}
test('latest three approvals retain exact questions, replies, scope and provenance',()=>{
 const r=load(),d=r.bannerChangeReviewAndRenewalDecision;assert.equal(validate(r),true);
 assert.equal(d.sourceCommit,'4a869ef4ec80dfeb5ad9af9f28960df5f0a90577');assert.equal(d.date,'2026-10-17');
 assert.equal(d.responseType,'structured-question-replies');assert.equal(d.scope,'banner-ordinary-change-count-pending-request-limit-internal-review-target-and-manual-advance-renewal');
 assert.equal(Object.hasOwn(d,'userReply'),false);
});
test('this approval preserves all earlier prices, raw answers, privacy, billing and execution gates',()=>{
 const r=load(),prior=JSON.parse(at(r.bannerChangeReviewAndRenewalDecision.sourceCommit,recordPath));
 delete r.bannerChangeReviewAndRenewalDecision;
 for(const key of ['materialChangeSubmission','ordinaryMaterialReviewTarget','advanceRenewal'])delete r.banner[key];
 r.banner.pendingDetails=structuredClone(prior.banner.pendingDetails);assert.deepEqual(r,prior);
 for(const p of ['docs/merchant-banner-refund-confirmed-20261017.json','docs/merchant-membership-refund-confirmed-20261017.json','docs/merchant-membership-refund-confirmed-20261017.md','docs/merchant-membership-refund-proposal-20261016.md'])assert.equal(read(p).replace(/\r\n/g,'\n'),at('4a869ef4ec80dfeb5ad9af9f28960df5f0a90577',p),p);
});
test('all nine current document entries carry the same current business rules',()=>{
 for(const p of entries){const line=read(p).split(/\r?\n/).find(x=>x.startsWith('Banner修改、审核与提前续购确认'));
 const target=line.match(/\[本组确认\]\(([^)]+)\)/)[1];assert(fs.existsSync(path.resolve(root,path.dirname(p),target)),p+': local confirmation link');
 for(const phrase of ['逐题选择A、A、A','普通修改总次数暂不限','同一购买期同时最多1份待审','换新稿先撤回原申请再提交','先审后换、不重算30天','完整有效素材及必要授权提交成功','24连续小时内给出审核结果','不保证通过','异常在原期限内说明原因、进度并继续处理','主动提前购买下一期30天','提前付款不提前起算','无自动扣费','无挤占既有有效保留或已付排期的优先权','第二版','正式价格及真实销售未开启'])assert(line&&line.includes(phrase),p+': '+phrase);
 }
});
test('full source text and historical scope flags are explained without treating earlier questions as latest approval',()=>{
 const s=read('docs/merchant-pricing-confirmed-20261016.md');for(const x of expectedResponses){assert(s.includes(x.question));assert(s.includes(x.answer));}
 for(const phrase of ['### 3.9','旧ordinaryMaterialServices内decidesChangeCountOrFrequency/decidesReviewTimeLimit','历史范围标记','具体防重复/并发','最多预购多少期','微信官方审核时限','制作服务提供及报价仍待确认'])assert(s.includes(phrase),phrase);
 const refund=read('docs/merchant-banner-refund-confirmed-20261017.md');assert(refund.includes('第三组当时未决定数量与审核目标，后续已独立确认'));
});
test('F08 definitions match and distinguish approved direction from remaining execution details',()=>{
 const row=p=>read(p).match(/^\| F08 \| 商家Banner方向 \|[^\r\n]+/m)[0],a=row('docs/prd.md');assert.equal(a,row('docs/structured-design.md'));
 for(const phrase of ['普通修改总次数暂不限','同期最多1份待审','24连续小时给结果','主动提前购下期30天','授权交互/审核操作及提交频率控制','续购执行与真实通道仍未定'])assert(a.includes(phrase),phrase);
});
test('change requests cannot acquire multiple pending drafts, a total quota or immediate replacement',()=>{
 for(const change of [r=>r.banner.materialChangeSubmission.maxPendingRequestsPerPurchasePeriod=2,r=>r.banner.materialChangeSubmission.totalChangeCountLimit=3,r=>r.banner.materialChangeSubmission.newDraftRequiresWithdrawExistingPending=false,r=>r.banner.materialChanges.reviewBeforeReplacement=false,r=>r.banner.materialChanges.restartsAdvertisingPeriod=true]){const r=load();change(r);assert.throws(()=>validate(r));}
});
test('internal review cannot silently become work-hours, first-response-only, guaranteed approval or a new deadline',()=>{
 for(const change of [r=>r.banner.ordinaryMaterialReviewTarget.unit='working-hours',r=>r.banner.ordinaryMaterialReviewTarget.target='first-response',r=>r.banner.ordinaryMaterialReviewTarget.hours=72,r=>r.banner.ordinaryMaterialReviewTarget.approvalGuaranteed=true,r=>r.banner.ordinaryMaterialReviewTarget.start='payment-success']){const r=load();change(r);assert.throws(()=>validate(r));}
});
test('advance renewal cannot start at payment, enable automatic debit, displace schedules or enable sales',()=>{
 for(const change of [r=>r.banner.advanceRenewal.advancePaymentStartsClock=true,r=>r.banner.advanceRenewal.automaticDebit=true,r=>r.banner.advanceRenewal.protectExistingEffectiveReservations=false,r=>r.banner.advanceRenewal.advancePurchaseDisplacementPriority=true,r=>r.execution.realSalesEnabled=true]){const r=load();change(r);assert.throws(()=>validate(r));}
});
