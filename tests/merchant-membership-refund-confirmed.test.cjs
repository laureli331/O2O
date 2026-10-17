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
 assert.equal(r.status,'nine-business-decisions-approved-execution-details-pending');
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
 assert.deepEqual(r.unconfirmed,{paymentChannel:null,arrivalTimeLimit:null,concurrentUsageAndRefundHandling:null,manualAppealRemedy:null},'Unasked rules stay pending');
 assert.deepEqual(rule.selfServiceWithdrawal,{"enabledAtLaunch":false,"preSubmissionDisclosure":["termination-consequences","refund-amount"],"secondConfirmationRequired":true,"manualAppealAllowed":true,"manualRemedyDecided":false},'Approved self-service boundary');
 assert.deepEqual(rule.applicationValidation,{"beforeSubmissionCheckFailure":{"takesEffect":false,"suspendsRights":false},"afterEffectiveInformationNeedsVerification":{"notifyReason":true,"continueVerification":true,"keepTerminationEffective":true,"autoResumeBilling":false,"unverifiedRefundMeansComplete":false},"securityIssues":"existing-security-rules"},'Approved application validation');
 assert.deepEqual(rule.otherPurchasedPeriodSchedule,{"keepOriginalStart":true,"keepOriginalEnd":true,"advanceAiGrant":false,"cancelOtherPeriods":false,"refundScope":"application-specified-purchase-period"},'Approved other-period schedule');
 assert.deepEqual(rule.processingTimeLimit,{"unit":"continuous-hours","firstResponseHours":24,"firstResponseStart":"request-received","incompleteRequestAction":"state-necessary-missing-materials","reviewAndInitiateHours":72,"reviewAndInitiateStart":"complete-valid-application-submitted-successfully","initiateOnlyIfEligible":true,"arrivalTimeGuaranteed":false,"arrivalTimeLimit":null,"exceptionUpdate":"reason-and-progress-within-original-deadline-and-continue-handling","unknownResultMeansCompleted":false},'Approved membership handling target');
 assert.deepEqual(rule.unstartedPurchasePeriodRefundRule,{"verifiedActualPaymentRequired":true,"eligiblePeriods":["not-actually-activated","early-renewal-period-not-started"],"scope":"application-specified-purchase-period","amount":"full-verified-actual-payment-for-that-period","cancelRequestedPeriod":true,"cancelOtherPurchasedPeriods":false},'Approved unstarted purchase-period refunds');
 assert.deepEqual(rule.failedOrUnknownRefundHandling,{"keepTerminationEffective":true,"autoRestoreOrdinaryRights":false,"termTimeConsumed":false,"aiConsumed":false,"continueRefundHandling":true,"unknownOutcomeRequiresVerification":true,"blindDuplicateRefundAllowed":false,"failureMeansRefundSucceeded":false,"unknownMeansRefundSucceeded":false,"decidesWithdrawal":false},'Approved failed and unknown refund continuity');
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
 ['manual remedy silently assumed',r=>r.unconfirmed.manualAppealRemedy='always-restore'],
 ['approved membership handling target extended',r=>r.rules.processingTimeLimit.reviewAndInitiateHours=120],
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

test('approved examples retain prior arithmetic and add now-approved unstarted refunds',()=>{
 const r=load(),proposal=JSON.parse(read(proposalPath));
 const old=[...proposal.examples.filter(x=>!x.id.startsWith('unstarted-')),...proposal.examples.filter(x=>x.id.startsWith('unstarted-'))];
 assert.deepEqual(r.examples,old);
 const byId=Object.fromEntries(r.examples.map(x=>[x.id,x.expectedRefundCents]));
 assert.equal(byId['month-day-1-ai-exhausted'],6225);
 assert.equal(byId['month-day-10-used-20-text-6-images'],7061);
 assert.equal(byId['quarter-day-45-first-batch-exhausted'],14299);
 assert.equal(byId['quarter-day-45-first-batch-unused'],14299);
 assert.equal(byId['unstarted-month'],9900);
 assert.equal(byId['unstarted-quarter'],26730);
 for(const term of r.rules.allocation.candidateTerms){
  assert.equal(term.toolAllocationCents+term.aiAllocationCents,term.actualPaidCents);
  assert.equal(term.aiAllocationPerBatchCents*(term.days/30),term.aiAllocationCents);
 }
});

test('current entries state the new confirmation ahead of historical gift and draft wording',()=>{
 for(const file of ['docs/merchant-pricing-confirmed-20261016.md','docs/prd.md','docs/development-plan.md','docs/structured-design.md','docs/v2-roadmap.md','docs/ascii-design-prd-2.1.md','docs/module-specs/current-development-basis-20261015.md','docs/module-specs/merchant-banner-direction-20261015.md','CONTEXT.md']){
  const s=read(file),paragraph=s.split(/\r?\n/).find(line=>line.startsWith('会员退款三项确认（2026-10-17）'));
  for(const phrase of ['会员退款三项确认（2026-10-17）','用户逐题选择A、A、A','工具64.40元＋AI34.60元','工具173.88元＋AI93.42元','每个30天AI批次31.14元','当前有效及未来未开始批次','过去已过期未用批次','不伪记为已生成','审核期间不再消耗该期时间或AI额度','会员包含AI额度','仍待确认'])assert(paragraph.includes(phrase),file+': '+phrase);
  assert(s.includes('该2026-10-16授权时点尚未修改会员规则或赠送表述'),file+': preserve historical timeline');
  for(const m of s.matchAll(/\]\(([^)]+)\)/g)){if(/^(https?:\/\/|#)/.test(m[1]))continue;assert(fs.existsSync(path.resolve(root,path.dirname(file),m[1].split('#')[0])),file+': '+m[1]);}
 }
});

test('confirmed document distinguishes remaining execution choices from business approval',()=>{
 const s=read(load().document);
 for(const phrase of ['金额分摊与购买前说明','过期会员AI批次退款边界','退订的生效时刻','64.40×n×k×r','0.049×U文案＋0.99×U图片','最低0、累计不超过本购买期实付','不收退款手续费，不额外补款','人工申诉后的具体补救','会员也采用相同处理目标','实际通道与到账时效','142.992元','原草案“未开通购买期全退”现已通过第二组明确答复确认'])assert(s.includes(phrase),phrase);
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

test('second execution batch preserves exact questions and answers without deciding withdrawal',()=>{
 const r=load(),d=r.refundExecutionDecision;assert.equal(d.date,'2026-10-17');assert.equal(d.responseType,'structured-question-replies');
 assert.deepEqual(d.responses,[
 {
  "questionItemId": "[\"request_user_input_async\",\"call_956c0f5d8811433594283df5774d48d3\",0]",
  "id": "membership-refund-processing-target",
  "selected": "A",
  "question": "会员退款的处理时限选哪种？两种方案均要求收到申请后24连续小时内首次回应，资料不全时告知必要补充项；以下时限是审核及发起退款的目标，不代表保证到账，异常须在原期限内说明原因和进度并继续处理。",
  "answer": "A（推荐）：完整有效申请成功提交后72连续小时内完成审核，并对符合条件的申请发起退款，与AI增购处理目标一致。"
 },
 {
  "questionItemId": "[\"request_user_input_async\",\"call_956c0f5d8811433594283df5774d48d3\",1]",
  "id": "unstarted-purchase-period-refund",
  "selected": "A",
  "question": "已经付款，但会员尚未实际开通，或提前续购的购买期尚未开始时，如何退款？",
  "answer": "A（推荐）：核实实际付款后，允许取消申请中指明的购买期并退全部实付；不连带取消其他已购期。"
 },
 {
  "questionItemId": "[\"request_user_input_async\",\"call_956c0f5d8811433594283df5774d48d3\",2]",
  "id": "failed-or-unknown-refund-continuity",
  "selected": "A",
  "question": "已生效的会员退订遇到退款失败或结果未知时，如何处理？这一步不决定是否允许撤回退订申请。",
  "answer": "A（推荐）：保持退订生效，不自动恢复普通权益或继续消耗该期时间、AI；继续核实办理退款，结果未知先查证，避免重复退款。"
 }
]);
 assert.equal(d.withdrawalDecisionIncluded,false);assert.equal(d.realExecutionAuthorized,false);
 assert.equal(Object.hasOwn(d,'userReply'),false);
});
test('execution approval changes only its three rules, examples, current status and provenance',()=>{
 const live=load(),r=JSON.parse(at(live.refundBoundaryDecision.sourceCommit,recordPath)),prior=JSON.parse(at(r.refundExecutionDecision.sourceCommit,recordPath));
 const current=structuredClone(r);delete current.refundExecutionDecision;current.status='three-business-decisions-approved-execution-details-pending';
 for(const key of ['processingTimeLimit','unstartedPurchasePeriodRefundRule','failedOrUnknownRefundHandling']){delete current.rules[key];current.unconfirmed[key]=null;}
 current.examples=current.examples.filter(x=>!x.id.startsWith('unstarted-'));assert.deepEqual(current,prior);
});
test('all entry points put the current execution decisions ahead of historical pending status',()=>{
 for(const file of ["docs/merchant-pricing-confirmed-20261016.md","docs/prd.md","docs/development-plan.md","docs/structured-design.md","docs/v2-roadmap.md","docs/ascii-design-prd-2.1.md","docs/module-specs/current-development-basis-20261015.md","docs/module-specs/merchant-banner-direction-20261015.md","CONTEXT.md"]){
  const s=read(file),first=s.split(/\r?\n/).find(line=>line.startsWith('会员退款执行三项确认（2026-10-17）'));for(const phrase of ['会员退款执行三项确认（2026-10-17）','24连续小时内首次回应','72连续小时内完成审核','不代表保证到账','异常须在原期限内','不连带取消其他已购期','保持退订生效','未知先查证','该第二组当时不决定撤回申请'])assert(first.includes(phrase),file+': '+phrase);
  assert(!s.includes('未开通期退款、撤回/恢复、失败/未知、跨续购期衔接、会员退款处理时限与实际通道仍待确认'),file+': obsolete blanket pending status');
 }
});
test('execution rule rejects membership first response doubled',()=>{const r=load();r.rules.processingTimeLimit.firstResponseHours=48;assert.throws(()=>validate(r));});
test('execution rule rejects membership SLA uses working hours',()=>{const r=load();r.rules.processingTimeLimit.unit='working-hours';assert.throws(()=>validate(r));});
test('execution rule rejects membership arrival guaranteed',()=>{const r=load();r.rules.processingTimeLimit.arrivalTimeGuaranteed=true;assert.throws(()=>validate(r));});
test('execution rule rejects first response clock starts only after complete application',()=>{const r=load();r.rules.processingTimeLimit.firstResponseStart='complete-application';assert.throws(()=>validate(r));});
test('execution rule rejects unverified payment refunded',()=>{const r=load();r.rules.unstartedPurchasePeriodRefundRule.verifiedActualPaymentRequired=false;assert.throws(()=>validate(r));});
test('execution rule rejects unstarted refund uses list price',()=>{const r=load();r.rules.unstartedPurchasePeriodRefundRule.amount='list-price';assert.throws(()=>validate(r));});
test('execution rule rejects other purchased periods cancelled',()=>{const r=load();r.rules.unstartedPurchasePeriodRefundRule.cancelOtherPurchasedPeriods=true;assert.throws(()=>validate(r));});
test('execution rule rejects failed refund reopens membership',()=>{const r=load();r.rules.failedOrUnknownRefundHandling.autoRestoreOrdinaryRights=true;assert.throws(()=>validate(r));});
test('execution rule rejects failed refund consumes more time',()=>{const r=load();r.rules.failedOrUnknownRefundHandling.termTimeConsumed=true;assert.throws(()=>validate(r));});
test('execution rule rejects unknown refund consumes more AI',()=>{const r=load();r.rules.failedOrUnknownRefundHandling.aiConsumed=true;assert.throws(()=>validate(r));});
test('execution rule rejects unknown refund blindly repeated',()=>{const r=load();r.rules.failedOrUnknownRefundHandling.blindDuplicateRefundAllowed=true;assert.throws(()=>validate(r));});
test('execution rule rejects unknown outcome recorded as refunded',()=>{const r=load();r.rules.failedOrUnknownRefundHandling.unknownMeansRefundSucceeded=true;assert.throws(()=>validate(r));});
test('execution rule rejects failure stops refund handling',()=>{const r=load();r.rules.failedOrUnknownRefundHandling.continueRefundHandling=false;assert.throws(()=>validate(r));});
test('execution rule rejects withdrawal assumed from failure decision',()=>{const r=load();r.rules.failedOrUnknownRefundHandling.decidesWithdrawal=true;assert.throws(()=>validate(r));});

test('third batch preserves exact questions and answers without authorizing manual remedies',()=>{
 const d=load().refundBoundaryDecision;assert.equal(d.date,'2026-10-17');assert.equal(d.responseType,'structured-question-replies');
 assert.deepEqual(d.responses,[
 {
  "questionItemId": "[\"request_user_input_async\",\"call_c1713b5839d84400a9bc929254d1109a\",0]",
  "id": "self-service-withdrawal-entry",
  "selected": "A",
  "question": "会员退订已经生效后，是否提供用户自行撤回的入口？这里先决定是否有自助入口，人工申诉后的补救规则仍单独确认。",
  "answer": "A（推荐）：起步不提供自行撤回；提交前明确展示终止影响和退款金额并二次确认，误操作可提出人工申诉。实现简单，但操作灵活性较低。"
 },
 {
  "questionItemId": "[\"request_user_input_async\",\"call_c1713b5839d84400a9bc929254d1109a\",1]",
  "id": "application-validation-and-information-verification",
  "selected": "A",
  "question": "申请未通过必要校验，或退订生效后发现资料、付款信息仍需核实时，采用哪种处理原则？身份盗用等安全问题继续按已有安全规则处理。",
  "answer": "A（推荐）：提交时未通过校验则不生效、不暂停权益；已生效后发现待核实问题则告知原因并继续核实，保持终止，不自动恢复计费，也不把未核实退款标为完成。"
 },
 {
  "questionItemId": "[\"request_user_input_async\",\"call_c1713b5839d84400a9bc929254d1109a\",2]",
  "id": "other-paid-renewal-period-schedule",
  "selected": "A",
  "question": "退订当前会员购买期后，其他已付款但尚未开始的续购期是否保持原排期？例如下一期原本还要十天才开始，这只是情境示例。",
  "answer": "A（推荐）：保持其他购买期原定开始和结束时间，不提前发放AI，不连带取消；只处理本次申请指明的购买期。"
 }
]);
 assert.equal(d.manualRemedyApproved,false);assert.equal(d.realExecutionAuthorized,false);assert.equal(Object.hasOwn(d,'userReply'),false);
});
test('third batch adds only the confirmed boundaries and preserves both earlier batches',()=>{
 const r=load(),prior=JSON.parse(at(r.refundBoundaryDecision.sourceCommit,recordPath));
 const current=structuredClone(r);delete current.refundBoundaryDecision;current.status='six-business-decisions-approved-execution-details-pending';
 for(const key of ['selfServiceWithdrawal','applicationValidation','otherPurchasedPeriodSchedule'])delete current.rules[key];
 delete current.unconfirmed.manualAppealRemedy;for(const key of ['withdrawalAndReinstatement','invalidApplicationHandling','crossPurchasedPeriodContinuity'])current.unconfirmed[key]=null;assert.deepEqual(current,prior);
});
test('current document entries state the third batch before earlier history',()=>{
 for(const file of ["docs/merchant-pricing-confirmed-20261016.md","docs/prd.md","docs/development-plan.md","docs/structured-design.md","docs/v2-roadmap.md","docs/ascii-design-prd-2.1.md","docs/module-specs/current-development-basis-20261015.md","docs/module-specs/merchant-banner-direction-20261015.md","CONTEXT.md"]){
  const first=read(file).split(/\r?\n/)[2];for(const phrase of ['会员退订边界三项确认（2026-10-17）','起步不提供生效退订的自行撤回入口','二次确认','人工补救仍待单独确认','不生效、不暂停权益','不自动恢复计费','不把未核实退款标为完成','身份盗用等按已有安全规则处理','保持原定起止时间','不提前发放AI、不连带取消'])assert(first.includes(phrase),file+': '+phrase);
 }
});
test('confirmed record distinguishes appeal access from restoration or compensation approval',()=>{
 const r=load();assert.equal(r.rules.selfServiceWithdrawal.manualAppealAllowed,true);assert.equal(r.unconfirmed.manualAppealRemedy,null);assert.equal(r.rules.selfServiceWithdrawal.manualRemedyDecided,false);
 const s=read(r.document);for(const phrase of ['用户分三组','第2.2节','原本十天后开始','这是情境示例，不是真实排期','人工核实后是否恢复、顺延或补偿及具体金额仍待单独确认','不再整体列为待确认'])assert(s.includes(phrase),phrase);
});
test('refund boundary rejects self-service withdrawal enabled',()=>{const r=load();r.rules.selfServiceWithdrawal.enabledAtLaunch=true;assert.throws(()=>validate(r));});
test('refund boundary rejects second confirmation removed',()=>{const r=load();r.rules.selfServiceWithdrawal.secondConfirmationRequired=false;assert.throws(()=>validate(r));});
test('refund boundary rejects refund amount hidden before submission',()=>{const r=load();r.rules.selfServiceWithdrawal.preSubmissionDisclosure=['termination-consequences'];assert.throws(()=>validate(r));});
test('refund boundary rejects manual appeal blocked',()=>{const r=load();r.rules.selfServiceWithdrawal.manualAppealAllowed=false;assert.throws(()=>validate(r));});
test('refund boundary rejects manual remedy marked decided',()=>{const r=load();r.rules.selfServiceWithdrawal.manualRemedyDecided=true;assert.throws(()=>validate(r));});
test('refund boundary rejects failed check stops membership',()=>{const r=load();r.rules.applicationValidation.beforeSubmissionCheckFailure.suspendsRights=true;assert.throws(()=>validate(r));});
test('refund boundary rejects failed check takes effect',()=>{const r=load();r.rules.applicationValidation.beforeSubmissionCheckFailure.takesEffect=true;assert.throws(()=>validate(r));});
test('refund boundary rejects verification issue resumes billing',()=>{const r=load();r.rules.applicationValidation.afterEffectiveInformationNeedsVerification.autoResumeBilling=true;assert.throws(()=>validate(r));});
test('refund boundary rejects unverified refund marked complete',()=>{const r=load();r.rules.applicationValidation.afterEffectiveInformationNeedsVerification.unverifiedRefundMeansComplete=true;assert.throws(()=>validate(r));});
test('refund boundary rejects security rules bypassed',()=>{const r=load();r.rules.applicationValidation.securityIssues='ignore-identity-theft';assert.throws(()=>validate(r));});
test('refund boundary rejects other term start moved',()=>{const r=load();r.rules.otherPurchasedPeriodSchedule.keepOriginalStart=false;assert.throws(()=>validate(r));});
test('refund boundary rejects other term end moved',()=>{const r=load();r.rules.otherPurchasedPeriodSchedule.keepOriginalEnd=false;assert.throws(()=>validate(r));});
test('refund boundary rejects future AI granted early',()=>{const r=load();r.rules.otherPurchasedPeriodSchedule.advanceAiGrant=true;assert.throws(()=>validate(r));});
test('refund boundary rejects other term cancelled',()=>{const r=load();r.rules.otherPurchasedPeriodSchedule.cancelOtherPeriods=true;assert.throws(()=>validate(r));});
