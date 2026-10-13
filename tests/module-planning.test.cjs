'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const records = JSON.parse(read('docs/module-specs/decisions.json'));
const handoff = JSON.parse(read('assets/ui/development-handoff-20261009/decisions.json'));

test('monthly commission direction preserves the human purpose and does not select a rate or collection method', () => {
  assert.equal(records.commissionPlanningRequests.length, 1);
  const request = records.commissionPlanningRequests[0];
  assert.equal(request.date, '2026-10-13');
  assert.equal(request.status, 'user-planned-direction');
  assert.equal(request.userReply, '我计划的抽佣方式为，在每月月末，根据骑手及维修员的服务费，以及闲置卖家的成交价格，按比例抽佣。所以我担心有骑手，维修员以及卖家为了避开抽佣，会在确认进行交易后，与客户协商修改价格。\n所以我希望在修改价格时, 不能低于初始值. 你认为呢?');
  assert.deepEqual(request.statedPlan, {
    billing: 'each-month-end', method: 'proportional',
    bases: [{ actor: '骑手', amount: '服务费' }, { actor: '维修员', amount: '服务费' }, { actor: '闲置卖家', amount: '成交价格' }],
    priceFloorPurpose: 'prevent-post-confirmation-underreporting-for-commission'
  });
  assert.equal(request.readyForImplementation, false);
  assert(request.pending.length >= 6);
  assert.deepEqual(handoff.commissionPlanningRequests, records.commissionPlanningRequests);
  for (const key of ['rate', 'eligibleStatus', 'collectionMethod', 'automaticDebit', 'refundPolicy', 'appliesToOther']) {
    assert.equal(Object.hasOwn(request.statedPlan, key), false);
  }
  assert.equal(Object.hasOwn(records, 'priceFloorDecisionBatches'), false);
  assert.equal(records.priceFloorRequests[0].readyForImplementation, false);
});

test('commission evaluation keeps the old baseline, operational limitations and suggestions distinct', () => {
  const doc = read(records.commissionPlanningRequests[0].requestDocument);
  assert(doc.includes('建议方案，待用户确认'));
  assert(doc.includes('月底账单使用明确的计费记录，不读取可随时改动的当前展示价'));
  assert(doc.includes('初始就少报价格、虚假取消后线下成交'));
  assert(doc.includes('不确认实际资格或替用户选择支付方式'));
  assert(doc.includes('https://pay.wechatpay.cn/doc/v3/partner/4012072582'));
  assert(doc.includes('第十三轮8题'));
  assert(read('docs/prd.md').includes('平台不代收、不代结算、不抽跑腿佣金'));
  assert.equal(handoff.items.find(x => x.id === 'HD02').confirmed.business, '跑腿');
  for (const item of records.items) assert.equal(item.fullWorkflowReady, false);
});

const expectedFeeAgreement = {
  recordedInMiniapp: true,
  requiresBothPartiesConfirmation: true,
  confirmationTiming: 'before-each-charge-stage',
  itemization: {
    mode: 'separate-service-and-expenses', expenseExamples: ['材料', '配件', '商品'], showTotal: true,
    inspectionFeeCategory: 'service-fee', visitFeeCategory: 'service-fee', namedServiceItemsSeparatelyListed: true,
    minItems: 1, maxItems: 20,
    fields: {
      name: { required: true, minLength: 1, maxLength: 30 },
      category: { required: true, allowed: ['服务费', '实际支出'] },
      amount: { required: true, maxInput: 99999.99 }, remark: { required: false, maxLength: 300 }
    }
  },
  initiation: { allowedParties: ['发布者', '接单员'], submissionAcknowledgesVersion: true, effectiveAfterCounterpartyConfirmation: true, selectedWorkerOnly: true },
  changes: { addOrModifyItems: true, requiresBothPartiesConfirmation: true, previousVersionEffectiveUntilConfirmed: true },
  pendingProposalLimit: 1,
  noResponse: { remainsPending: true, reminderAllowed: true, withdrawableByInitiator: true, autoConsent: false },
  cancellation: { serviceMayBeCancelledBeforeExpenseAgreement: true, incurredExpensesNegotiatedSeparately: true, impliesSettled: false },
  receipts: {
    required: false, supported: ['票据', '照片'], maxCount: 3, countScope: 'per-expense-item',
    formats: ['JPEG', 'PNG'], maxSizeMB: 5, visibility: 'service-parties-while-ongoing',
    afterServiceEndVisibility: 'neither-party', public: false, operatorAccessGranted: false
  },
  advance: {
    voluntary: true, requiresPriorMutualConfirmation: true, confirmWhetherToAdvance: true, confirmLimit: true,
    recordedWithFeeProposal: true, limitRequiredWhenWilling: true, limitMustBePositive: false,
    zeroLimitMeansNoActualAdvance: true, emptyLimitIsUnlimited: false,
    notWillingLimitPolicy: { hide: true, clearCurrentFormValue: true, preserveHistoricalAgreements: true },
    overLimitPolicy: { requiresNewFeeProposalAndLimit: true, requiresBothPartiesConfirmation: true, pauseAffectedAdvanceUntilConfirmed: true, autoCancelService: false }
  },
  zeroServiceFeeAllowed: true,
  creationStage: 'after-successful-selection',
  formalAmountPolicy: { currentStageAmountsMustBeKnown: true, estimatedItemsAllowed: false, unknownFutureItems: 'omit-until-later-stage', unknownAmountsDefaultToZero: false },
  pendingVersionEditing: { mode: 'withdraw-before-resubmit', preserveHistory: true },
  refusalRules: { reasonRequired: false, endsPendingProposal: true, previousAgreementRemainsEffective: true, allowsNewProposal: true, endsService: false },
  stageName: { mode: 'preset-or-custom', presets: ['上门检查', '服务处理', '补充费用'], customName: { minLength: 1, maxLength: 30 } },
  postCompletionChanges: false,
  maxTotal: 99999.99,
  reopeningPolicy: {
    copyAsNewDraftAllowed: true, requiresNewSubmission: true, requiresNewPartiesConfirmation: true,
    inheritsAgreement: false, inheritsAdvanceAuthorization: false, oldReceiptAccessGranted: false,
    copyActors: 'new-service-parties-with-existing-old-proposal-access',
    copyFields: ['阶段', '费用项目文字', '金额', '备注'], copyAdvanceConditions: false, copyReceipts: false
  },
  completionWithPendingProposal: 'resolve-before-completion-confirmation',
  cancelPendingProposal: {
    onlyIncurredKeepsPending: true, containsUnincurredCloses: true, preserveClosedHistory: true,
    reproposalAllowed: true, blocksCancellation: false, autoConsent: false,
    incurredClassification: { mode: 'both-parties-agree-all-incurred', disagreementCloses: true, unknownCloses: true, preserveHistory: true, reproposalAllowed: true, blocksCancellation: false, approvesAmounts: false }
  },
  zeroExpenseAllowed: true,
  stageOrganization: { mode: 'independent-stages', modificationReplaces: 'same-stage-version', serviceTotal: 'sum-current-effective-stage-versions', pendingIncluded: false, oldVersionsIncluded: false },
  maxServiceTotal: 99999.99
};

const expectedApplicationRules = {
  activePerPersonPerRequest: 1, editableBeforeSelection: true, withdrawableBeforeSelection: true,
  repeatedSubmitCreatesNew: false, reapplication: { allowedWhenOpen: true, cooldownHours: 0 }, individualRejectionAllowed: false,
  visibility: { publisher: 'all-applications-on-own-demand', applicant: 'own-only', others: 'none', expandsContactOrAddressAccess: false },
  candidateDisplay: { fields: ['说明', '预估服务费', '申请时间'], hideEmptyDescription: true, missingFeeLabel: '待协商' },
  sorting: { field: 'effective-application-time', direction: 'ascending', modificationTimePolicy: 'keep-current-application-first-effective-submit', reapplicationTimePolicy: 'new-successful-submit-time' },
  openingDeadline: { scope: 'before-selection', autoExpires: false, publisherMayClose: true },
  publisherClosing: {
    scope: 'before-selection', allowedWithActiveApplications: true, endsActiveApplications: true, notifyApplicants: true, preserveHistory: true, impliesDeletion: false, allowsUnilateralServiceCancellation: false,
    reopening: { scope: 'closed-before-selection', initiator: 'publisher', sameRequest: true, freshApplicationsRequired: true, restoreOldApplications: false, productCountLimit: null, preserveEveryCloseAndReopen: true, latestListTime: 'successful-reopen-time', preserveOriginalPublicationTime: true, ordinaryEditBumpsList: false },
    reasonRules: { required: false, maxLength: 300 },
    selectionConflictPolicy: { mode: 'first-server-success-wins', laterOperationExecutes: false, promptRefresh: true, rollbackSuccessfulResult: false, clientClickOrderDecides: false }
  },
  versionHistory: { preserveSubmittedVersions: true, viewers: ['该需求发布者', '对应申请者'], public: false },
  editNotification: { notifyPublisher: true, listMark: '已修改' },
  invalidatedReapplication: { allowedWhenOpen: true, cooldownHours: 0, preserveInvalidatedHistory: true, selectInvalidatedApplication: false }
};
const expectedSelectionRules = {
  effectiveAfterPublisherSelectionSuccess: true, workerReconfirmationRequired: false,
  otherApplications: { end: true, notify: true, autoReplacement: false }
};
const expectedApplicationFields = {
  description: { required: false, maxLength: 300 },
  estimatedServiceFee: { required: false, missingLabel: '待协商', isFeeAgreement: false }
};
const expectedContactVisibility = {
  beforeSelection: 'masked', afterSuccessfulSelection: 'selected-parties-only', otherApplicants: 'masked',
  privateAddress: { optionalAtPublishing: true, public: false, releaseTo: 'selected-worker-only' },
  afterServiceEnd: { completedContact: 'masked', cancelledContact: 'masked', selectedWorkerFullAddressAccess: false, publisherMayManageOwnAddress: true }
};
const expectedPendingChangeEnd = { closePendingChanges: true, preserveHistory: true, impliesConsent: false, blocksServiceEnding: false };
const expectedDemandChanges = {
  beforeSelection: { watched: ['服务内容', '区域', '时间'], invalidateApplications: true, notifyApplicants: true, reapplyRequired: true, criticalFields: ['标题', '描述', '图片', '公开区域', '服务时间'] },
  afterSelection: {
    watched: ['服务内容', '区域'], requiresBothPartiesConfirmation: true, previousVersionEffectiveUntilConfirmed: true, onServiceEnd: expectedPendingChangeEnd,
    initiators: ['发布者', '接单员'], scope: 'after-successful-selection-before-service-end', pendingLimit: 1,
    editingPolicy: { initiatorWithdrawalAllowed: true, mode: 'withdraw-before-resubmit', preserveHistory: true, confirmedOutcomeWithdrawalAllowed: false },
    refusalRules: { reasonRequired: false, reasonMaxLength: 300, endsPendingProposal: true, preserveHistory: true, changesPreviousContent: false, endsService: false },
    noResponse: { remainsPending: true, autoConsent: false, autoClose: false, previousContentRemainsEffective: true }
  }
};
const expectedEvidenceFields = {
  description: { required: true, minLength: 1, maxLength: 500 },
  attachments: { required: false, minCount: 0, maxCount: 9, formats: ['JPEG', 'PNG'], maxSizeMB: 5 }
};
const expectedRefusalRules = {
  allowed: true, reasonRequired: true, endsService: false, nextActions: ['继续协商', '提出异议'], reasonMinLength: 1, reasonMaxLength: 500
};
const expectedCompletionRules = {
  initiator: 'selected-worker', requiresPublisherConfirmation: true,
  noResponse: { remainsPending: true, autoComplete: false, reminderAllowed: true, objectionAllowed: true },
  evidenceFields: expectedEvidenceFields, refusalRules: expectedRefusalRules, pendingPerService: 1
};
const expectedCancellationRules = {
  initiators: ['发布者', '接单员'], requiresCounterpartyConfirmation: true, scope: 'after-selection-before-completion',
  noResponse: { remainsPending: true, autoCancel: false, reminderAllowed: true, objectionAllowed: true },
  evidenceFields: expectedEvidenceFields, refusalRules: expectedRefusalRules, pendingPerService: 1
};
const expectedAppointmentRules = {
  required: false, requiresBothPartiesConfirmation: true, changesRequireBothPartiesConfirmation: true,
  initiators: ['发布者', '接单员'], pendingLimit: 1, scope: 'after-successful-selection-before-service-end', pendingChangesReplaceEffectiveTime: false,
  timeFields: { mode: 'single-start-time', precision: 'minute' },
  pastTimePolicy: { futureOnly: true, reference: 'server-time', allowHistoryBackfill: false, strictlyAfterCurrentTime: true },
  pendingTimePassedPolicy: { scope: 'pending-future-appointment', closeAt: 'proposed-start-time', preserveHistory: true, changesPreviousAppointment: false, changesServiceState: false, autoConsent: false },
  editingPolicy: { initiatorWithdrawalAllowed: true, mode: 'withdraw-before-resubmit', preserveHistory: true },
  refusalRules: { reasonRequired: false, reasonMaxLength: 300, endsPendingProposal: true, preserveHistory: true, changesPreviousAppointment: false, endsService: false },
  clearEffectiveAppointmentPolicy: {
    requiresBothPartiesConfirmation: true, preserveHistory: true, endsService: false,
    sharedPendingLimit: 1, sharedWith: ['预约', '改期', '清除预约'],
    noResponse: { remainsPending: true, autoClear: false, autoClose: false, previousAppointmentRemainsEffective: true },
    editingPolicy: { initiatorWithdrawalAllowed: true, mode: 'withdraw-before-resubmit', preserveHistory: true, confirmedOutcomeWithdrawalAllowed: false },
    refusalRules: { reasonRequired: false, reasonMaxLength: 300, endsPendingProposal: true, preserveHistory: true, changesPreviousAppointment: false, endsService: false }
  },
  onServiceEnd: expectedPendingChangeEnd,
  overduePolicy: { markTimePassed: true, autoComplete: false, autoCancel: false, autoReminder: false, newOverdueCharge: false, newPenalty: false }
};
const expectedReopeningRules = {
  afterConfirmedCancellation: true, initiator: 'publisher', sameRequest: true,
  freshApplicationsRequired: true, restoreOldApplications: false, preserveServiceAndFeeHistory: true
};
const expectedTerminationRequests = {
  completionAndCancellationMayCoexist: true, endingPolicy: 'first-effective-confirmation', closeOtherOnEnd: true, preserveOtherHistory: true,
  editingPolicy: { scope: 'pending-request-before-service-end', initiatorWithdrawalAllowed: true, mode: 'withdraw-before-resubmit', preserveHistory: true, confirmedOutcomeWithdrawalAllowed: false },
  refusedRequestPolicy: { mode: 'end-request-allow-resubmit', preserveHistory: true, serviceContinues: true }
};
const expectedDisputeRules = {
  recordOnly: true, partiesNegotiate: true, operatorServiceMediation: false, existingReportAndRatingAppealUnaffected: true,
  objectionFields: expectedEvidenceFields
};
const expectedRatingRules = business => ({
  business, usesExistingSystem: true, mutual: true,
  qualification: { trigger: 'publisher-confirmed-completion', requiresWorkerCompletionRequest: true, additionalExperienceConfirmationRequired: false, cancellationCreatesQualification: false },
  statistics: { business, byRatedRole: true, separateFromOtherBusinesses: true },
  preserveExistingValidQualificationsAndRatings: true
});

function verify(value) {
  assert.deepEqual(value.items.map(item => item.id), ['MP01', 'MP02']);
  const [other, repair] = value.items;
  assert.equal(other.userReply, '业务还包括"其它"');
  assert.equal(other.confirmed.businessModule, true);
  assert.equal(other.confirmed.name, '其它');
  assert.deepEqual(other.confirmed.excludeCategories, ['维修', '跑腿', '闲置']);
  assert.equal(other.confirmed.purpose, '整理其它需求数据，作为后续更新迭代依据');
  assert.equal(other.followUp[0].userReply, '除了"维修、跑腿、闲置", 方便为后续更新迭代整理数据');
  assert.equal(other.confirmed.publicPublishing, true);
  assert.equal(other.confirmed.applicationsAllowed, true);
  assert.equal(other.followUp[1].userReply, 'A');
  assert.equal(other.followUp[1].selectedOption, '公开发布并允许申请接单：用户可以实际找到人处理需求，同时积累分类数据');
  assert(!other.pending.includes('公开接单或仅收集需求'));
  assert.equal(other.confirmed.matchingMode, 'apply-then-publisher-selects');
  assert.equal(other.followUp[2].userReply, 'A');
  assert.equal(other.followUp[2].selectedOption, '先申请，发布者再选人：发布者比较申请者后决定，与维修的选人方向一致；报价规则另议');
  assert(!other.pending.includes('申请后的选人模式'));
  assert(other.pending.includes('申请同时间排序/历史展示/关闭理由可见范围、取消后重开排序及并发实现'));
  assert.equal(other.confirmed.quoteRequiredAtApplication, false);
  assert.equal(Object.hasOwn(other.confirmed, 'defaultServiceFee'), false);
  assert.equal(other.confirmed.selectedWorkerCount, 1);
  assert.equal(repair.userReply, 'A');
  assert.equal(repair.confirmed.matchingMode, 'apply-then-publisher-selects');
  assert.equal(repair.confirmed.quoteRequiredAtApplication, false);
  for (const item of value.items) {
    assert.equal(item.confirmed.selectedWorkerCount, 1);
    assert.deepEqual(item.confirmed.applicantLimit, { kind: 'no-product-cap' });
    assert.deepEqual(item.confirmed.applicationRules, expectedApplicationRules);
    assert.deepEqual(item.confirmed.selectionRules, expectedSelectionRules);
    assert.deepEqual(item.confirmed.applicationFields, expectedApplicationFields);
    assert.deepEqual(item.confirmed.contactVisibility, expectedContactVisibility);
    assert.deepEqual(item.confirmed.demandChanges, expectedDemandChanges);
    assert.deepEqual(item.confirmed.completionRules, expectedCompletionRules);
    assert.deepEqual(item.confirmed.cancellationRules, expectedCancellationRules);
    assert.deepEqual(item.confirmed.appointmentRules, expectedAppointmentRules);
    assert.deepEqual(item.confirmed.reopeningRules, expectedReopeningRules);
    assert.deepEqual(item.confirmed.terminationRequests, expectedTerminationRequests);
    assert.deepEqual(item.confirmed.disputeRules, expectedDisputeRules);
    assert.deepEqual(item.confirmed.ratingRules, expectedRatingRules(item.id === 'MP01' ? '其它' : '维修'));
    assert.deepEqual(item.confirmed.feeAgreement, expectedFeeAgreement);
    assert.deepEqual(item.confirmed.concurrentTaskLimit, { kind: 'no-product-cap' });
    assert.equal(item.fullWorkflowReady, false);
    assert(item.pending.length >= 5);
    assert.equal(handoff.items.find(row => row.id === item.handoffDecision).productionAllowed, false);
  }
}

test('actual answers include other business and repair application mode without approving unfinished workflows', () => {
  verify(records);
  const repair = handoff.items.find(item => item.id === 'HD01');
  assert.equal(repair.followUp[0].userReply, 'A');
  assert(repair.confirmed.includes('申请时不强制报价'));
  assert.equal(handoff.items.find(item => item.id === 'HD04').userReply, records.items[0].userReply);
  assert.equal(handoff.items.find(item => item.id === 'HD04').status, 'public-business-approved-rules-pending');
  for (const mutation of [
    data => { data.items[0].confirmed.businessModule = false; },
    data => { data.items[0].confirmed.excludeCategories = ['维修']; },
    data => { data.items[0].confirmed.purpose = '所有需求均可直接抢单'; },
    data => { data.items[0].confirmed.publicPublishing = false; },
    data => { data.items[0].confirmed.applicationsAllowed = false; },
    data => { data.items[0].followUp[1].selectedOption = '仅收集需求'; },
    data => { data.items[0].confirmed.matchingMode = 'first-come-first-served'; },
    data => { data.items[0].confirmed.quoteRequiredAtApplication = true; },
    data => { data.items[0].confirmed.defaultServiceFee = 0; },
    data => { data.items[0].confirmed.selectedWorkerCount = 2; },
    data => { data.items[1].confirmed.selectedWorkerCount = 2; },
    data => { data.items[0].confirmed.applicantLimit = { kind: 'fixed', count: 1 }; },
    data => { data.items[1].confirmed.applicantLimit = null; },
    data => { data.items[0].confirmed.concurrentTaskLimit = null; },
    data => { data.items[0].confirmed.applicationRules.activePerPersonPerRequest = 2; },
    data => { data.items[1].confirmed.applicationRules.withdrawableBeforeSelection = false; },
    data => { data.items[0].confirmed.applicationRules.repeatedSubmitCreatesNew = true; },
    data => { data.items[0].confirmed.contactVisibility.beforeSelection = 'full'; },
    data => { data.items[1].confirmed.contactVisibility.otherApplicants = 'full'; },
    data => { data.items[0].confirmed.contactVisibility.afterSuccessfulSelection = 'all-applicants'; },
    data => { data.items[0].confirmed.feeAgreement.recordedInMiniapp = false; },
    data => { data.items[1].confirmed.feeAgreement.requiresBothPartiesConfirmation = false; },
    data => { data.items[0].confirmed.feeAgreement.paid = true; },
    data => { data.items[0].confirmed.feeAgreement.itemization.mode = 'total-only'; },
    data => { data.items[1].confirmed.feeAgreement.itemization.showTotal = false; },
    data => { data.items[0].confirmed.feeAgreement.confirmationTiming = 'after-service-completion'; },
    data => { data.items[1].confirmed.feeAgreement.requiresPrepayment = true; },
    data => { data.items[0].pending = data.items[0].pending.filter(item => item !== '申请同时间排序/历史展示/关闭理由可见范围、取消后重开排序及并发实现'); },
    data => { data.items[1].confirmed.matchingMode = 'first-come-first-served'; },
    data => { data.items[1].confirmed.quoteRequiredAtApplication = true; },
    data => { data.items[0].fullWorkflowReady = true; }
  ]) {
    const changed = structuredClone(records);
    mutation(changed);
    assert.throws(() => verify(changed));
  }
});

test('fee recording and mutual confirmation are approved without inventing payment or individual entries', () => {
  const [other, repair] = records.items;
  const answer = other.followUp[8];
  assert.equal(answer.date, '2026-10-11');
  assert.equal(answer.userReply, 'A');
  assert.equal(answer.selectedOption, '维修和其它协商后的费用在小程序内记录并由双方确认；记录金额不代表已经付款；费用明细和确认时点另议');
  assert.deepEqual(repair.followUp[4], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD01').followUp[5], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD04').followUp[8], answer);
  for (const item of records.items) {
    assert.equal(Object.hasOwn(item.confirmed.feeAgreement, 'stage'), false);
    assert.equal(Object.hasOwn(item.confirmed.feeAgreement, 'items'), false);
    assert.equal(Object.hasOwn(item.confirmed.feeAgreement, 'paid'), false);
    assert(item.pending.some(text => text.includes('费用字段')));
  }
  const earnings = handoff.items.find(item => item.id === 'HD02').confirmed;
  assert.equal(earnings.business, '跑腿');
  assert.equal(earnings.wallet, false);
  assert(read('docs/module-specs/README.md').includes('不新增平台代收、余额或自动结算'));
});

test('original itemization answer is retained and inspection or visit charges now use approved service-fee classification', () => {
  const [other, repair] = records.items;
  const answer = other.followUp[9];
  assert.equal(answer.date, '2026-10-11');
  assert.equal(answer.userReply, 'A');
  assert.equal(answer.selectedOption, '维修和其它费用分项记录：服务费与材料、配件、商品等实际支出分开，页面同时显示合计；检查费、上门费等具体归类另议');
  assert.deepEqual(repair.followUp[5], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD01').followUp[6], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD04').followUp[9], answer);
  for (const item of records.items) {
    const fees = item.confirmed.feeAgreement;
    assert.equal(fees.itemization.inspectionFeeCategory, 'service-fee');
    assert.equal(fees.itemization.visitFeeCategory, 'service-fee');
    assert.equal(fees.itemization.namedServiceItemsSeparatelyListed, true);
    assert.equal(Object.hasOwn(fees.itemization, 'unknownAmountDefault'), false);
    assert.equal(Object.hasOwn(fees, 'stage'), false);
  }
  assert(read('docs/module-specs/README.md').includes('不是三项必填或封闭枚举'));
  assert(read('docs/ui-development-handoff/page-spec.md').includes('页面同时显示合计'));
});

test('contact and optional private address release follow selection and confirmed ending restricts access without deleting owner data', () => {
  const [other, repair] = records.items;
  const answer = other.followUp[7];
  assert.equal(answer.date, '2026-10-11');
  assert.equal(answer.userReply, 'A');
  assert.equal(answer.selectedOption, '维修和其它选定成功后，发布者与选中的接单员互看完整联系方式；其他申请者仍看打码信息');
  assert.deepEqual(repair.followUp[3], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD01').followUp[4], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD04').followUp[7], answer);
  for (const item of records.items) {
    assert.deepEqual(item.confirmed.contactVisibility.privateAddress, expectedContactVisibility.privateAddress);
    assert.deepEqual(item.confirmed.contactVisibility.afterServiceEnd, expectedContactVisibility.afterServiceEnd);
    assert(item.pending.some(text => text.includes('联系变更/撤销')));
  }
  assert(read('docs/module-specs/README.md').includes('不能把完整信息下发后仅在页面打码'));
  assert(read('docs/module-specs/README.md').includes('闲置、免费服务目录及其推广仍沿用原CT03'));
  assert(read('docs/ui-development-handoff/business-addendum.md').includes('旧流程切换和历史关系迁移待明确'));
});

test('planning references resolve and existing handoff points to the new confirmed decisions', () => {
  const entry = 'docs/module-specs/README.md';
  const document = read(entry);
  for (const match of document.matchAll(/\]\(([^)]+)\)/g)) {
    assert(fs.existsSync(path.resolve(root, path.dirname(entry), match[1])), match[1]);
  }
  assert(read('docs/prd.md').includes('module-specs/README.md'));
  assert(read('docs/ui-development-handoff/README.md').includes('../module-specs/README.md'));
  assert(read('docs/ui-development-handoff/business-addendum.md').includes('申请时不强制报价'));
  assert(read('docs/ui-development-handoff/page-spec.md').includes('其它属于业务模块'));
});

test('other publisher selection mode is synchronized while remaining visibility and workflow gaps are retained', () => {
  const other = handoff.items.find(item => item.id === 'HD04');
  assert.equal(other.followUp[0].userReply, records.items[0].followUp[0].userReply);
  assert(other.confirmed.includes('为后续更新迭代提供依据'));
  assert.deepEqual(other.followUp[1], records.items[0].followUp[1]);
  assert(other.confirmed.includes('允许公开发布并申请接单'));
  assert.deepEqual(other.followUp[2], records.items[0].followUp[2]);
  assert(other.confirmed.includes('先申请再由发布者选人'));
  assert(other.pending.includes('申请同时间排序/历史展示/关闭理由可见范围、取消后重开排序及并发实现'));
  assert(read('CONTEXT.md').includes('先申请再由发布者选1位接单员'));
  assert(read('docs/module-specs/README.md').includes('归类原则和整理数据目的已确认'));
  assert(read('docs/ui-development-handoff/business-addendum.md').includes('没有自动批准新增采集方案'));
});

test('other optional quote answer is retained and the approved estimate remains distinct from formal fee confirmation', () => {
  const other = records.items[0];
  const answer = other.followUp[5];
  assert.equal(answer.date, '2026-10-11');
  assert.equal(answer.userReply, 'A');
  assert.equal(answer.selectedOption, '其它申请时不强制填写服务费报价；允许先申请，金额后续协商');
  const handoffOther = handoff.items.find(item => item.id === 'HD04');
  assert.deepEqual(handoffOther.followUp[5], answer);
  assert(handoffOther.confirmed.includes('申请时不强制填写服务费报价'));
  assert(handoffOther.pending.some(text => text.includes('费用字段映射/阶段标识与排序')));
  assert.equal(Object.hasOwn(other.confirmed, 'feeAgreementStage'), false);
  assert.deepEqual(other.confirmed.applicationFields, expectedApplicationFields);
  assert(other.pending.some(text => text.includes('费用字段')));
  assert(read('docs/module-specs/README.md').includes('不强制报价不代表免费'));
});

test('phased confirmation precedes each charge stage without inventing prepayment or mandatory inspection charges', () => {
  const [other, repair] = records.items;
  const answer = other.followUp[10];
  assert.equal(answer.date, '2026-10-11');
  assert.equal(answer.userReply, 'A');
  assert.equal(answer.selectedOption, '维修和其它分阶段、收费前确认费用；上门检查若收费先确认该费用，诊断后再确认维修和配件费用');
  assert.deepEqual(repair.followUp[6], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD01').followUp[7], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD04').followUp[10], answer);
  for (const item of records.items) {
    assert.equal(item.confirmed.feeAgreement.confirmationTiming, 'before-each-charge-stage');
    assert.equal(Object.hasOwn(item.confirmed.feeAgreement, 'requiresPrepayment'), false);
    assert.equal(Object.hasOwn(item.confirmed.feeAgreement, 'mandatoryInspectionCharge'), false);
  }
  assert(read('docs/module-specs/README.md').includes('不代表付款必须预付'));
});

test('fee batch all-A reply is mapped to exactly the eight offered options and synchronized to handoff', () => {
  assert.equal(records.discussionFormat.questionsPerRound, 8);
  assert.equal(records.discussionFormat.userReply, '一次问我八个问题, 否则进度太慢了');
  const questions = read('docs/module-specs/fee-questions-20261011.md');
  assert(questions.includes('8题全部选择A'));
  assert.deepEqual([...questions.matchAll(/（(FQ\d{2})）/g)].map(match => match[1]), Array.from({length: 8}, (_, index) => `FQ${String(index + 1).padStart(2, '0')}`));
  assert(read('docs/module-specs/README.md').includes('每轮集中提出8个'));
  assert(read('docs/module-specs/README.md').includes('按钮轻微放大缩小等细微反馈'));
  assert.equal(records.feeDecisionBatches.length, 3);
  const batch = records.feeDecisionBatches[0];
  assert.equal(batch.userReply, '全A');
  assert.equal(batch.date, '2026-10-11');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  assert.equal(batch.questionDocument, 'docs/module-specs/fee-questions-20261011.md');
  assert.deepEqual(batch.answers.map(answer => answer.questionId), Array.from({ length: 8 }, (_, index) => `FQ${String(index + 1).padStart(2, '0')}`));
  const originalOptions = [...questions.matchAll(/（(FQ\d{2})）\r?\n\r?\nA：(.+?)B：/g)];
  for (const [index, answer] of batch.answers.entries()) {
    assert.equal(answer.answer, 'A');
    assert.equal(answer.selectedOption, originalOptions[index][2].trim().replace(/。$/, ''));
  }
  assert.deepEqual(handoff.feeDecisionBatches, records.feeDecisionBatches);
});

test('fee integrity checks reject unapproved unilateral version replacement, automatic consent, settlement and compulsory evidence or advances', () => {
  verify(records);
  for (const mutate of [
    fee => { fee.itemization.inspectionFeeCategory = 'expense'; },
    fee => { fee.itemization.namedServiceItemsSeparatelyListed = false; },
    fee => { fee.initiation.allowedParties = ['接单员']; },
    fee => { fee.initiation.submissionAcknowledgesVersion = false; },
    fee => { fee.initiation.effectiveAfterCounterpartyConfirmation = false; },
    fee => { fee.changes.requiresBothPartiesConfirmation = false; },
    fee => { fee.changes.previousVersionEffectiveUntilConfirmed = false; },
    fee => { fee.pendingProposalLimit = 2; },
    fee => { fee.noResponse.autoConsent = true; },
    fee => { fee.noResponse.autoCloseHours = 24; },
    fee => { fee.noResponse.withdrawableByInitiator = false; },
    fee => { fee.cancellation.serviceMayBeCancelledBeforeExpenseAgreement = false; },
    fee => { fee.cancellation.impliesSettled = true; },
    fee => { fee.receipts.required = true; },
    fee => { fee.advance.voluntary = false; },
    fee => { fee.advance.requiresPriorMutualConfirmation = false; },
    fee => { fee.advance.confirmLimit = false; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed.feeAgreement);
      assert.throws(() => verify(changed));
    }
  }
});

test('fifth-round all-A answer maps to its own eight questions and preserves prior decision history', () => {
  const questions = read('docs/module-specs/fee-detail-questions-20261011.md');
  assert(questions.includes('8题全部选择A'));
  assert.deepEqual([...questions.matchAll(/（(FQ\d{2})）/g)].map(match => match[1]), Array.from({length: 8}, (_, index) => `FQ${String(index + 9).padStart(2, '0')}`));
  const batch = records.feeDecisionBatches[1];
  assert.equal(batch.id, 'fee-detail-round-5-20261012');
  assert.equal(batch.date, '2026-10-12');
  assert.equal(batch.userReply, '全A');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  assert.equal(batch.questionDocument, 'docs/module-specs/fee-detail-questions-20261011.md');
  const offered = [...questions.matchAll(/（(FQ\d{2})）\r?\n\r?\nA：(.+?)B：/g)];
  assert.equal(batch.answers.length, 8);
  batch.answers.forEach((answer, index) => {
    assert.equal(answer.questionId, offered[index][1]);
    assert.equal(answer.answer, 'A');
    assert.equal(answer.selectedOption, offered[index][2].trim().replace(/。$/, ''));
  });
  assert.deepEqual(handoff.feeDecisionBatches, records.feeDecisionBatches);
  assert.equal(records.applicationDecisionBatches[0].answers[3].answer, 'B');
  assert.equal(records.exceptionRatingDecisionBatches[0].answers[4].answer, 'B');
  for (const id of ['HD01', 'HD04']) {
    assert(handoff.items.find(item => item.id === id).confirmed.includes('费用录入第五轮8题全部A'));
  }
});

test('fee-detail constraints reject wrong scope, unknown zero, estimates, live editing and forced refusal reasons', () => {
  verify(records);
  for (const mutate of [
    fee => { fee.advance.recordedWithFeeProposal = false; },
    fee => { fee.zeroServiceFeeAllowed = false; },
    fee => { fee.creationStage = 'before-selection'; },
    fee => { fee.initiation.selectedWorkerOnly = false; },
    fee => { fee.itemization.minItems = 0; },
    fee => { fee.itemization.maxItems = 50; },
    fee => { fee.itemization.fields.name.required = false; },
    fee => { fee.itemization.fields.name.maxLength = 50; },
    fee => { fee.itemization.fields.category.allowed.push('其它'); },
    fee => { fee.itemization.fields.amount.required = false; },
    fee => { fee.itemization.fields.remark.required = true; },
    fee => { fee.itemization.fields.remark.maxLength = 500; },
    fee => { fee.formalAmountPolicy.currentStageAmountsMustBeKnown = false; },
    fee => { fee.formalAmountPolicy.estimatedItemsAllowed = true; },
    fee => { fee.formalAmountPolicy.unknownAmountsDefaultToZero = true; },
    fee => { fee.pendingVersionEditing.mode = 'update-in-place'; },
    fee => { fee.pendingVersionEditing.preserveHistory = false; },
    fee => { fee.refusalRules.reasonRequired = true; },
    fee => { fee.refusalRules.endsPendingProposal = false; },
    fee => { fee.refusalRules.previousAgreementRemainsEffective = false; },
    fee => { fee.refusalRules.allowsNewProposal = false; },
    fee => { fee.refusalRules.endsService = true; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed.feeAgreement);
      assert.throws(() => verify(changed));
    }
  }
  const document = read('docs/module-specs/fee-detail-rules.md');
  assert(document.includes('不修改跑腿服务费必须大于0规则'));
  assert(document.includes('实际支出明确0值已由第七轮独立确认，未知金额仍不能默认为0'));
  assert(document.includes('没有实现或验证实际表单、权限、金额计算或并发行为'));
  assert.equal(handoff.items.find(item => item.id === 'HD02').confirmed.business, '跑腿');
  assert.equal(handoff.items.find(item => item.id === 'HD05').userReply, '只显示“服务时间”，暂不填值');
});

test('sixth-round mixed answers preserve exact reply, options and matching business scope', () => {
  const questions = read('docs/module-specs/fee-boundary-questions-20261012.md');
  assert(questions.includes('已确认1B、2B、3B、4A、5B、6B、7A、8B'));
  assert.deepEqual([...questions.matchAll(/（(FQ\d{2})）/g)].map(match => match[1]), Array.from({length: 8}, (_, index) => `FQ${String(index + 17).padStart(2, '0')}`));
  const batch = records.feeDecisionBatches[2];
  assert.equal(batch.id, 'fee-boundary-round-6-20261012');
  assert.equal(batch.date, '2026-10-12');
  assert.equal(batch.userReply, '1. B\n2. B\n3. B\n4. A\n5. B\n6. B\n7. A\n8. B');
  assert.equal(batch.questionDocument, 'docs/module-specs/fee-boundary-questions-20261012.md');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  const offered = [...questions.matchAll(/（(FQ\d{2})）\r?\n\r?\nA：(.+?)B：(.+?)\r?\n/g)];
  assert.equal(offered.length, 8);
  assert.deepEqual(batch.answers.map(x => x.answer), ['B', 'B', 'B', 'A', 'B', 'B', 'A', 'B']);
  assert.equal(batch.answers.length, 8);
  batch.answers.forEach((answer, index) => {
    assert.equal(answer.questionId, offered[index][1]);
    assert.equal(answer.selectedOption, offered[index][answer.answer === 'A' ? 2 : 3].trim().replace(/。$/, ''));
  });
  assert.deepEqual(handoff.feeDecisionBatches, records.feeDecisionBatches);
  assert.equal(records.feeDecisionBatches[1].userReply, '全A');
  for (const id of ['HD01', 'HD04']) {
    assert(handoff.items.find(x => x.id === id).confirmed.includes('费用边界第六轮1B、2B、3B、4A、5B、6B、7A、8B'));
  }
});

test('fee boundaries prevent completed-service edits, unlimited advances, public or ended receipts and inherited draft authorization', () => {
  verify(records);
  for (const mutate of [
    fee => { fee.stageName.mode = 'custom-only'; },
    fee => { fee.stageName.presets.push('必收上门费'); },
    fee => { fee.stageName.customName.maxLength = 300; },
    fee => { fee.postCompletionChanges = true; },
    fee => { fee.advance.limitRequiredWhenWilling = false; },
    fee => { fee.advance.limitMustBePositive = true; },
    fee => { fee.advance.zeroLimitMeansNoActualAdvance = false; },
    fee => { fee.advance.emptyLimitIsUnlimited = true; },
    fee => { fee.advance.overLimitPolicy.requiresNewFeeProposalAndLimit = false; },
    fee => { fee.advance.overLimitPolicy.requiresBothPartiesConfirmation = false; },
    fee => { fee.advance.overLimitPolicy.pauseAffectedAdvanceUntilConfirmed = false; },
    fee => { fee.advance.overLimitPolicy.autoCancelService = true; },
    fee => { fee.receipts.maxCount = 9; },
    fee => { fee.receipts.countScope = 'whole-proposal'; },
    fee => { fee.receipts.formats.push('GIF'); },
    fee => { fee.receipts.maxSizeMB = 10; },
    fee => { fee.receipts.visibility = 'all-applicants'; },
    fee => { fee.receipts.afterServiceEndVisibility = 'original-parties'; },
    fee => { fee.receipts.public = true; },
    fee => { fee.receipts.operatorAccessGranted = true; },
    fee => { fee.maxTotal = 199999.99; },
    fee => { fee.itemization.fields.amount.maxInput = 199999.99; },
    fee => { fee.reopeningPolicy.copyAsNewDraftAllowed = false; },
    fee => { fee.reopeningPolicy.requiresNewSubmission = false; },
    fee => { fee.reopeningPolicy.requiresNewPartiesConfirmation = false; },
    fee => { fee.reopeningPolicy.inheritsAgreement = true; },
    fee => { fee.reopeningPolicy.inheritsAdvanceAuthorization = true; },
    fee => { fee.reopeningPolicy.oldReceiptAccessGranted = true; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed.feeAgreement);
      assert.throws(() => verify(changed));
    }
  }
  const document = read('docs/module-specs/fee-boundary-rules.md');
  assert(document.includes('取消后已发生费用仍可另行协商'));
  assert(document.includes('同时涵盖完成和取消'));
  assert(document.includes('关闭访问不等于删除文件'));
  assert(document.includes('已有缓存或用户此前保存的副本不能被声称已远程删除'));
  assert(document.includes('没有实现或验证真实金额计算、文件访问撤销、草稿复制或服务端操作'));
  assert.equal(handoff.items.find(x => x.id === 'HD02').confirmed.business, '跑腿');
  for (const item of records.items) {
    assert.equal(item.fullWorkflowReady, false);
    assert.equal(item.confirmed.completionRules.evidenceFields.attachments.maxCount, 9);
  }
});

test('seventh-round mixed answers preserve the cancellation exception and the new table preference', () => {
  const questions = read('docs/module-specs/closing-questions-20261012.md');
  assert(questions.includes('已确认1A、2B、3A、4A、5A、6A、7A、8A'));
  assert.deepEqual([...questions.matchAll(/（(CQ\d{2})）/g)].map(match => match[1]), Array.from({length: 8}, (_, index) => `CQ${String(index + 1).padStart(2, '0')}`));
  assert.equal(records.closingDecisionBatches.length, 1);
  const batch = records.closingDecisionBatches[0];
  assert.equal(batch.id, 'closing-round-7-20261012');
  assert.equal(batch.date, '2026-10-12');
  assert.equal(batch.userReply, '1. A\n2. B\n3. A\n4. A\n5. A\n6. A\n7. A\n8. A');
  assert.equal(batch.questionDocument, 'docs/module-specs/closing-questions-20261012.md');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  const offered = [...questions.matchAll(/（(CQ\d{2})）\r?\n\r?\nA：(.+?)B：(.+?)\r?\n/g)];
  assert.equal(offered.length, 8);
  assert.deepEqual(batch.answers.map(x => x.answer), ['A', 'B', 'A', 'A', 'A', 'A', 'A', 'A']);
  assert.equal(batch.answers.length, 8);
  batch.answers.forEach((answer, index) => {
    assert.equal(answer.questionId, offered[index][1]);
    assert.equal(answer.selectedOption, offered[index][answer.answer === 'A' ? 2 : 3].trim().replace(/。$/, ''));
  });
  assert.deepEqual(handoff.closingDecisionBatches, records.closingDecisionBatches);
  assert.deepEqual(handoff.discussionFormat, records.discussionFormat);
  assert.equal(records.discussionFormat.questionsPerRound, 8);
  assert.equal(records.discussionFormat.presentation, 'table');
  assert.equal(records.discussionFormat.formatUserReply, '问题和选项以表格的形式问我');
  assert.equal(records.discussionFormat.userReply, '一次问我八个问题, 否则进度太慢了');
  for (const id of ['HD01', 'HD04']) {
    assert(handoff.items.find(x => x.id === id).confirmed.includes('费用收尾与履约申请第七轮1A、2B、3A、4A、5A、6A、7A、8A'));
  }
});

test('closing constraints reject automatic fee approval, duplicate stage accumulation and unilateral endings', () => {
  verify(records);
  for (const mutate of [
    item => { item.feeAgreement.completionWithPendingProposal = 'auto-approve-on-completion'; },
    item => { item.feeAgreement.cancelPendingProposal.onlyIncurredKeepsPending = false; },
    item => { item.feeAgreement.cancelPendingProposal.containsUnincurredCloses = false; },
    item => { item.feeAgreement.cancelPendingProposal.preserveClosedHistory = false; },
    item => { item.feeAgreement.cancelPendingProposal.reproposalAllowed = false; },
    item => { item.feeAgreement.cancelPendingProposal.blocksCancellation = true; },
    item => { item.feeAgreement.cancelPendingProposal.autoConsent = true; },
    item => { item.feeAgreement.zeroExpenseAllowed = false; },
    item => { item.feeAgreement.stageOrganization.mode = 'cumulative-whole-proposal'; },
    item => { item.feeAgreement.stageOrganization.modificationReplaces = 'all-stages'; },
    item => { item.feeAgreement.stageOrganization.serviceTotal = 'sum-all-history'; },
    item => { item.feeAgreement.stageOrganization.pendingIncluded = true; },
    item => { item.feeAgreement.stageOrganization.oldVersionsIncluded = true; },
    item => { item.feeAgreement.maxServiceTotal = 199999.99; },
    item => { item.completionRules.pendingPerService = 2; },
    item => { item.cancellationRules.pendingPerService = 2; },
    item => { item.terminationRequests.editingPolicy.initiatorWithdrawalAllowed = false; },
    item => { item.terminationRequests.editingPolicy.mode = 'update-in-place'; },
    item => { item.terminationRequests.editingPolicy.preserveHistory = false; },
    item => { item.terminationRequests.editingPolicy.confirmedOutcomeWithdrawalAllowed = true; },
    item => { item.terminationRequests.refusedRequestPolicy.mode = 'keep-pending'; },
    item => { item.terminationRequests.refusedRequestPolicy.preserveHistory = false; },
    item => { item.terminationRequests.refusedRequestPolicy.serviceContinues = false; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed);
      assert.throws(() => verify(changed));
    }
  }
  const document = read('docs/module-specs/closing-rules.md');
  assert(document.includes('而不是550元'));
  assert(document.includes('含未发生费用时关闭整份方案而非自动删掉部分费用并认可其余金额'));
  assert(document.includes('取消后的方案继续遵循双方确认'));
  assert(document.includes('费用未决阻止完成确认，不阻止符合既有规则的取消确认'));
  assert(read('docs/module-specs/README.md').includes('不能倒推为选人前必须报价'));
  assert(read('CONTEXT.md').includes('服务累计只取各阶段当前有效版本'));
  assert(document.includes('没有实现或验证真实累计计算、并发、权限或履约申请功能'));
  assert.equal(handoff.items.find(x => x.id === 'HD02').confirmed.business, '跑腿');
  assert.equal(handoff.items.find(x => x.id === 'HD05').userReply, '只显示“服务时间”，暂不填值');
});

test('eighth-round all-A answer maps to the eight table options and preserves previous mixed choices', () => {
  const questions = read('docs/module-specs/form-appointment-questions-20261012.md');
  assert(questions.includes('8题全部选择A'));
  assert(questions.includes('| 编号 | 问题 | A（推荐） | B |'));
  const offered = [...questions.matchAll(/^\| [1-8]（(DQ\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length, 8);
  assert.deepEqual(offered.map(x => x[1]), Array.from({length: 8}, (_, index) => `DQ${String(index + 1).padStart(2, '0')}`));
  assert.equal(records.formAppointmentDecisionBatches.length, 1);
  const batch = records.formAppointmentDecisionBatches[0];
  assert.equal(batch.id, 'form-appointment-round-8-20261012');
  assert.equal(batch.date, '2026-10-12');
  assert.equal(batch.userReply, '全A');
  assert.equal(batch.questionDocument, 'docs/module-specs/form-appointment-questions-20261012.md');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  assert.equal(batch.answers.length, 8);
  batch.answers.forEach((answer, index) => {
    assert.equal(answer.questionId, offered[index][1]);
    assert.equal(answer.answer, 'A');
    assert.equal(answer.selectedOption, offered[index][3].trim());
  });
  assert.deepEqual(handoff.formAppointmentDecisionBatches, records.formAppointmentDecisionBatches);
  assert.equal(records.closingDecisionBatches[0].answers[1].answer, 'B');
  assert.deepEqual(records.feeDecisionBatches[2].answers.map(x => x.answer), ['B', 'B', 'B', 'A', 'B', 'B', 'A', 'B']);
  for (const id of ['HD01', 'HD04']) {
    assert(handoff.items.find(x => x.id === id).confirmed.includes('费用表单与预约基础第八轮8题全部A'));
  }
});

test('form and appointment constraints reject unilateral incurred classification, copied authorization and unapproved appointment replacements', () => {
  verify(records);
  for (const mutate of [
    item => { item.feeAgreement.cancelPendingProposal.incurredClassification.mode = 'initiator-declares'; },
    item => { item.feeAgreement.cancelPendingProposal.incurredClassification.disagreementCloses = false; },
    item => { item.feeAgreement.cancelPendingProposal.incurredClassification.unknownCloses = false; },
    item => { item.feeAgreement.cancelPendingProposal.incurredClassification.preserveHistory = false; },
    item => { item.feeAgreement.cancelPendingProposal.incurredClassification.blocksCancellation = true; },
    item => { item.feeAgreement.cancelPendingProposal.incurredClassification.approvesAmounts = true; },
    item => { item.feeAgreement.reopeningPolicy.copyActors = 'any-new-worker'; },
    item => { item.feeAgreement.reopeningPolicy.copyFields.push('联系方式'); },
    item => { item.feeAgreement.reopeningPolicy.copyAdvanceConditions = true; },
    item => { item.feeAgreement.reopeningPolicy.copyReceipts = true; },
    item => { item.feeAgreement.advance.notWillingLimitPolicy.hide = false; },
    item => { item.feeAgreement.advance.notWillingLimitPolicy.clearCurrentFormValue = false; },
    item => { item.feeAgreement.advance.notWillingLimitPolicy.preserveHistoricalAgreements = false; },
    item => { item.completionRules.refusalRules.reasonMinLength = 0; },
    item => { item.completionRules.refusalRules.reasonMaxLength = 300; },
    item => { item.cancellationRules.refusalRules.reasonMaxLength = 300; },
    item => { item.completionRules.evidenceFields.attachments.maxSizeMB = 10; },
    item => { item.cancellationRules.evidenceFields.attachments.formats.push('GIF'); },
    item => { item.disputeRules.objectionFields.attachments.maxSizeMB = 10; },
    item => { item.appointmentRules.initiators = ['发布者']; },
    item => { item.appointmentRules.pendingLimit = 2; },
    item => { item.appointmentRules.scope = 'before-selection'; },
    item => { item.appointmentRules.pendingChangesReplaceEffectiveTime = true; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed);
      assert.throws(() => verify(changed));
    }
  }
  const document = read('docs/module-specs/form-appointment-rules.md');
  assert(document.includes('却仍未同意价格'));
  assert(document.includes('费用是否已发生不自动继承为新服务事实'));
  assert(document.includes('未提交并确认的新选择不撤销原有效垫付条件'));
  assert(document.includes('没有实现或验证实际文件上传、复制权限、字段清值或预约并发行为'));
  assert.equal(handoff.items.find(x => x.id === 'HD02').confirmed.business, '跑腿');
  assert.equal(handoff.items.find(x => x.id === 'HD05').userReply, '只显示“服务时间”，暂不填值');
  for (const item of records.items) {
    assert.equal(item.fullWorkflowReady, false);
    assert.equal(item.confirmed.feeAgreement.receipts.maxCount, 3);
    assert.equal(item.confirmed.completionRules.evidenceFields.attachments.maxCount, 9);
  }
});

test('ninth-round all-A answer matches only its eight table options and preserves preceding rule sources', () => {
  const questions = read('docs/module-specs/appointment-questions-20261012.md');
  assert(questions.includes('8题全部选择A'));
  assert(questions.includes('| 编号 | 问题 | A（推荐） | B |'));
  const offered = [...questions.matchAll(/^\| [1-8]（(TQ\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length, 8);
  assert.deepEqual(offered.map(x => x[1]), Array.from({length: 8}, (_, index) => `TQ${String(index + 1).padStart(2, '0')}`));
  assert.equal(records.appointmentDecisionBatches.length, 1);
  const batch = records.appointmentDecisionBatches[0];
  assert.equal(batch.id, 'appointment-round-9-20261012');
  assert.equal(batch.date, '2026-10-12');
  assert.equal(batch.userReply, '全A');
  assert.equal(batch.questionDocument, 'docs/module-specs/appointment-questions-20261012.md');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  assert.equal(batch.answers.length, 8);
  batch.answers.forEach((answer, index) => {
    assert.equal(answer.questionId, offered[index][1]);
    assert.equal(answer.answer, 'A');
    assert.equal(answer.selectedOption, offered[index][3].trim());
  });
  assert.deepEqual(handoff.appointmentDecisionBatches, records.appointmentDecisionBatches);
  assert.equal(records.formAppointmentDecisionBatches[0].userReply, '全A');
  assert.equal(records.closingDecisionBatches[0].answers[1].answer, 'B');
  for (const id of ['HD01', 'HD04']) {
    assert(handoff.items.find(x => x.id === id).confirmed.includes('预约细则第九轮8题全部A'));
  }
});

test('appointment constraints prevent past booking, stale confirmation, unilateral clearing and automatic service endings', () => {
  verify(records);
  for (const mutate of [
    item => { item.appointmentRules.timeFields.mode = 'start-end-window'; },
    item => { item.appointmentRules.timeFields.precision = 'day'; },
    item => { item.appointmentRules.pastTimePolicy.futureOnly = false; },
    item => { item.appointmentRules.pastTimePolicy.reference = 'client-time'; },
    item => { item.appointmentRules.pastTimePolicy.allowHistoryBackfill = true; },
    item => { item.appointmentRules.pastTimePolicy.strictlyAfterCurrentTime = false; },
    item => { item.appointmentRules.pendingTimePassedPolicy.scope = 'all-effective-appointments'; },
    item => { item.appointmentRules.pendingTimePassedPolicy.closeAt = 'never'; },
    item => { item.appointmentRules.pendingTimePassedPolicy.preserveHistory = false; },
    item => { item.appointmentRules.pendingTimePassedPolicy.changesPreviousAppointment = true; },
    item => { item.appointmentRules.pendingTimePassedPolicy.changesServiceState = true; },
    item => { item.appointmentRules.pendingTimePassedPolicy.autoConsent = true; },
    item => { item.appointmentRules.editingPolicy.mode = 'update-in-place'; },
    item => { item.appointmentRules.editingPolicy.initiatorWithdrawalAllowed = false; },
    item => { item.appointmentRules.editingPolicy.preserveHistory = false; },
    item => { item.appointmentRules.refusalRules.reasonRequired = true; },
    item => { item.appointmentRules.refusalRules.reasonMaxLength = 500; },
    item => { item.appointmentRules.refusalRules.endsPendingProposal = false; },
    item => { item.appointmentRules.refusalRules.changesPreviousAppointment = true; },
    item => { item.appointmentRules.refusalRules.endsService = true; },
    item => { item.appointmentRules.clearEffectiveAppointmentPolicy.requiresBothPartiesConfirmation = false; },
    item => { item.appointmentRules.clearEffectiveAppointmentPolicy.preserveHistory = false; },
    item => { item.appointmentRules.clearEffectiveAppointmentPolicy.endsService = true; },
    item => { item.appointmentRules.onServiceEnd.closePendingChanges = false; },
    item => { item.appointmentRules.onServiceEnd.impliesConsent = true; },
    item => { item.appointmentRules.onServiceEnd.blocksServiceEnding = true; },
    item => { item.demandChanges.afterSelection.onServiceEnd.closePendingChanges = false; },
    item => { item.demandChanges.afterSelection.onServiceEnd.preserveHistory = false; },
    item => { item.demandChanges.afterSelection.onServiceEnd.impliesConsent = true; },
    item => { item.appointmentRules.overduePolicy.autoComplete = true; },
    item => { item.appointmentRules.overduePolicy.autoCancel = true; },
    item => { item.appointmentRules.overduePolicy.autoReminder = true; },
    item => { item.appointmentRules.overduePolicy.newOverdueCharge = true; },
    item => { item.appointmentRules.overduePolicy.newPenalty = true; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed);
      assert.throws(() => verify(changed));
    }
  }
  const document = read('docs/module-specs/appointment-rules.md');
  assert(document.includes('清除请求的无回应处理不能默认套用未来预约到点关闭规则'));
  assert(document.includes('不能把过时申请确认成已生效的未来预约'));
  assert(document.includes('完成前仍必须处理待确认费用'));
  assert(document.includes('该规则不关闭取消后符合条件继续待确认的已发生费用方案'));
  assert(document.includes('没有实现或验证真实预约校验、到点任务、通知或并发状态变化'));
  for (const item of records.items) {
    assert.equal(item.confirmed.completionRules.noResponse.autoComplete, false);
    assert.equal(item.confirmed.cancellationRules.noResponse.autoCancel, false);
    assert.equal(item.confirmed.feeAgreement.completionWithPendingProposal, 'resolve-before-completion-confirmation');
    assert.equal(item.fullWorkflowReady, false);
  }
  assert.equal(handoff.items.find(x => x.id === 'HD02').confirmed.business, '跑腿');
  assert.equal(handoff.items.find(x => x.id === 'HD05').userReply, '只显示“服务时间”，暂不填值');
});

test('tenth-round all-A reply matches its eight options in both records', () => {
  const questions = read('docs/module-specs/change-questions-20261012.md');
  assert(questions.includes('8题全部选择A'));
  const offered = [...questions.matchAll(/^\| [1-8]（(CH\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length, 8);
  assert.equal(records.changeDecisionBatches.length, 1);
  const batch = records.changeDecisionBatches[0];
  assert.equal(batch.id, 'change-round-10-20261012');
  assert.equal(batch.date, '2026-10-12');
  assert.equal(batch.userReply, '全A');
  assert.equal(batch.questionDocument, 'docs/module-specs/change-questions-20261012.md');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  assert.equal(batch.answers.length, 8);
  batch.answers.forEach((answer, index) => {
    assert.equal(answer.questionId, 'CH' + String(index + 1).padStart(2, '0'));
    assert.equal(answer.questionId, offered[index][1]);
    assert.equal(answer.answer, 'A');
    assert.equal(answer.selectedOption, offered[index][3].trim());
  });
  assert.deepEqual(handoff.changeDecisionBatches, records.changeDecisionBatches);
  for (const id of ['HD01', 'HD04']) {
    assert(handoff.items.find(x => x.id === id).confirmed.includes('清除预约与内容变更第十轮8题全部A'));
  }
  assert.equal(records.applicationDecisionBatches[0].answers[3].answer, 'B');
  assert.equal(records.closingDecisionBatches[0].answers[1].answer, 'B');
  assert.equal(handoff.items.find(x => x.id === 'HD05').userReply, '只显示“服务时间”，暂不填值');
});

test('change integrity rejects separate clear slots, automatic expiry, unilateral changes and lost history', () => {
  for (const mutate of [
    c => { c.appointmentRules.clearEffectiveAppointmentPolicy.sharedPendingLimit = 2; },
    c => { c.appointmentRules.clearEffectiveAppointmentPolicy.sharedWith = ['清除预约']; },
    c => { c.appointmentRules.clearEffectiveAppointmentPolicy.noResponse.autoClear = true; },
    c => { c.appointmentRules.clearEffectiveAppointmentPolicy.noResponse.autoClose = true; },
    c => { c.appointmentRules.clearEffectiveAppointmentPolicy.noResponse.previousAppointmentRemainsEffective = false; },
    c => { c.appointmentRules.clearEffectiveAppointmentPolicy.editingPolicy.mode = 'overwrite'; },
    c => { c.appointmentRules.clearEffectiveAppointmentPolicy.editingPolicy.confirmedOutcomeWithdrawalAllowed = true; },
    c => { c.appointmentRules.clearEffectiveAppointmentPolicy.refusalRules.reasonRequired = true; },
    c => { c.appointmentRules.clearEffectiveAppointmentPolicy.refusalRules.changesPreviousAppointment = true; },
    c => { c.demandChanges.afterSelection.initiators = ['发布者']; },
    c => { c.demandChanges.afterSelection.pendingLimit = 2; },
    c => { c.demandChanges.afterSelection.editingPolicy.preserveHistory = false; },
    c => { c.demandChanges.afterSelection.editingPolicy.mode = 'overwrite'; },
    c => { c.demandChanges.afterSelection.refusalRules.reasonMaxLength = 500; },
    c => { c.demandChanges.afterSelection.refusalRules.endsService = true; },
    c => { c.demandChanges.afterSelection.noResponse.autoConsent = true; },
    c => { c.demandChanges.afterSelection.noResponse.autoClose = true; },
    c => { c.demandChanges.afterSelection.noResponse.previousContentRemainsEffective = false; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed);
      assert.throws(() => verify(changed));
    }
  }
  const rules = read('docs/module-specs/change-rules.md');
  assert(rules.includes('原预约时间已过也不触发清除'));
  assert(rules.includes('不是单独拒绝接单申请'));
  assert(rules.includes('没有实现或验证真实申请提交'));
  assert(read('docs/module-specs/appointment-rules.md').includes('清除请求无回应保持待确认且不自动关闭'));
});

test('eleventh-round all-A reply matches its eight original options without overriding earlier exceptions', () => {
  const questions = read('docs/module-specs/application-detail-questions-20261012.md');
  assert(questions.includes('8题全部选择A'));
  const offered = [...questions.matchAll(/^\| [1-8]（(AD\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length, 8);
  assert.equal(records.applicationDetailDecisionBatches.length, 1);
  const batch = records.applicationDetailDecisionBatches[0];
  assert.equal(batch.id, 'application-detail-round-11-20261012');
  assert.equal(batch.date, '2026-10-12');
  assert.equal(batch.userReply, '全A');
  assert.equal(batch.questionDocument, 'docs/module-specs/application-detail-questions-20261012.md');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  assert.equal(batch.answers.length, 8);
  batch.answers.forEach((answer, index) => {
    assert.equal(answer.questionId, 'AD' + String(index + 1).padStart(2, '0'));
    assert.equal(answer.questionId, offered[index][1]);
    assert.equal(answer.answer, 'A');
    assert.equal(answer.selectedOption, offered[index][3].trim());
  });
  assert.deepEqual(handoff.applicationDetailDecisionBatches, records.applicationDetailDecisionBatches);
  for (const id of ['HD01', 'HD04']) {
    assert(handoff.items.find(x => x.id === id).confirmed.includes('申请展示与历史第十一轮8题全部A'));
  }
  assert.equal(records.applicationDecisionBatches[0].answers[3].answer, 'B');
  assert.equal(records.feeDecisionBatches[2].answers[0].answer, 'B');
  assert.equal(handoff.items.find(x => x.id === 'HD02').confirmed.business, '跑腿');
});

test('application display integrity rejects public bids, stale selections, expiry, lost history and unilateral cancellation', () => {
  for (const mutate of [
    c => { c.applicationRules.visibility.applicant = 'all-applications'; },
    c => { c.applicationRules.visibility.others = 'all-applications'; },
    c => { c.applicationRules.visibility.expandsContactOrAddressAccess = true; },
    c => { c.applicationRules.candidateDisplay.hideEmptyDescription = false; },
    c => { c.applicationRules.candidateDisplay.missingFeeLabel = '免费'; },
    c => { c.applicationRules.sorting.field = 'estimated-fee'; },
    c => { c.applicationRules.sorting.direction = 'descending'; },
    c => { c.applicationRules.openingDeadline.autoExpires = true; },
    c => { c.applicationRules.publisherClosing.scope = 'after-selection'; },
    c => { c.applicationRules.publisherClosing.allowedWithActiveApplications = false; },
    c => { c.applicationRules.publisherClosing.endsActiveApplications = false; },
    c => { c.applicationRules.publisherClosing.notifyApplicants = false; },
    c => { c.applicationRules.publisherClosing.preserveHistory = false; },
    c => { c.applicationRules.publisherClosing.impliesDeletion = true; },
    c => { c.applicationRules.publisherClosing.allowsUnilateralServiceCancellation = true; },
    c => { c.applicationRules.versionHistory.preserveSubmittedVersions = false; },
    c => { c.applicationRules.versionHistory.viewers.push('其他申请者'); },
    c => { c.applicationRules.editNotification.notifyPublisher = false; },
    c => { c.applicationRules.invalidatedReapplication.cooldownHours = 24; },
    c => { c.applicationRules.invalidatedReapplication.selectInvalidatedApplication = true; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed);
      assert.throws(() => verify(changed));
    }
  }
  const rules = read('docs/module-specs/application-detail-rules.md');
  assert(rules.includes('不能向无权者下发完整申请后仅前端隐藏'));
  assert(rules.includes('不授予选人后单方取消权'));
  assert(rules.includes('保存期限不得默认无限'));
  assert(rules.includes('没有验证实际访问授权'));
  assert(read('docs/module-specs/application-rules.md').includes('[申请展示与历史](application-detail-rules.md)'));
});

test('twelfth-round answer preserves fourth B and records the price-floor request separately', () => {
  const questions = read('docs/module-specs/application-reopen-questions-20261012.md');
  assert(questions.includes('1A、2A、3A、4B、5A、6A、7A、8A'));
  const offered = [...questions.matchAll(/^\| [1-8]（(AR\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length, 8);
  assert.equal(records.applicationReopenDecisionBatches.length, 1);
  const batch = records.applicationReopenDecisionBatches[0];
  assert.equal(batch.id, 'application-reopen-round-12-20261013');
  assert.equal(batch.date, '2026-10-13');
  assert.equal(batch.userReply, '4. B\n\n其它全A');
  assert.equal(batch.questionDocument, 'docs/module-specs/application-reopen-questions-20261012.md');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  assert.deepEqual(batch.answers.map(x => x.answer), ['A', 'A', 'A', 'B', 'A', 'A', 'A', 'A']);
  batch.answers.forEach((answer, index) => {
    assert.equal(answer.questionId, 'AR' + String(index + 1).padStart(2, '0'));
    assert.equal(answer.questionId, offered[index][1]);
    assert.equal(answer.selectedOption, offered[index][answer.answer === 'B' ? 4 : 3].trim());
  });
  assert.deepEqual(handoff.applicationReopenDecisionBatches, records.applicationReopenDecisionBatches);
  for (const id of ['HD01', 'HD04']) {
    assert(handoff.items.find(x => x.id === id).confirmed.includes('申请排序与关闭重开第十二轮1A、2A、3A、4B'));
  }
  assert.equal(records.applicationDecisionBatches[0].answers[3].answer, 'B');
  assert.equal(records.applicationDetailDecisionBatches[0].date, '2026-10-12');
});

test('reopen integrity rejects edit bumping, stale application order, restored applications and two successful outcomes', () => {
  for (const mutate of [
    c => { c.applicationRules.sorting.modificationTimePolicy = 'last-edit-time'; },
    c => { c.applicationRules.sorting.reapplicationTimePolicy = 'original-first-application-time'; },
    c => { c.applicationRules.publisherClosing.reopening.scope = 'completed-service'; },
    c => { c.applicationRules.publisherClosing.reopening.sameRequest = false; },
    c => { c.applicationRules.publisherClosing.reopening.restoreOldApplications = true; },
    c => { c.applicationRules.publisherClosing.reopening.productCountLimit = 3; },
    c => { c.applicationRules.publisherClosing.reopening.preserveEveryCloseAndReopen = false; },
    c => { c.applicationRules.publisherClosing.reopening.latestListTime = 'original-publication-time'; },
    c => { c.applicationRules.publisherClosing.reopening.preserveOriginalPublicationTime = false; },
    c => { c.applicationRules.publisherClosing.reopening.ordinaryEditBumpsList = true; },
    c => { c.applicationRules.publisherClosing.reasonRules.required = true; },
    c => { c.applicationRules.publisherClosing.reasonRules.maxLength = 500; },
    c => { c.applicationRules.publisherClosing.selectionConflictPolicy.mode = 'client-first-click'; },
    c => { c.applicationRules.publisherClosing.selectionConflictPolicy.laterOperationExecutes = true; },
    c => { c.applicationRules.publisherClosing.selectionConflictPolicy.rollbackSuccessfulResult = true; },
    c => { c.applicationRules.publisherClosing.selectionConflictPolicy.promptRefresh = false; },
    c => { c.demandChanges.beforeSelection.criticalFields = ['标题', '描述', '公开区域', '服务时间']; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed);
      assert.throws(() => verify(changed));
    }
  }
  const rules = read('docs/module-specs/application-reopen-rules.md');
  assert(rules.includes('已完成服务不能通过本轮重开'));
  assert(rules.includes('其首页排序及其它细节不自动套用本轮'));
  assert(rules.includes('普通编辑不刷新该排序时间'));
  assert(rules.includes('仅替换图片也会使旧申请失效'));
  assert(rules.includes('未实现或验证真实排序'));
});

test('price-floor human intent is retained without inventing an initial price or idle transaction flow', () => {
  assert.equal(records.priceFloorRequests.length, 1);
  const request = records.priceFloorRequests[0];
  assert.equal(request.date, '2026-10-13');
  assert.equal(request.userReply, '新增规则: 确认进行交易后, 若骑手及维修员修改服务费, 闲置卖家修改金额, 不能低于初始金额');
  assert.deepEqual(request.confirmedIntent, { afterTransactionConfirmation: true, actors: ['骑手', '维修员', '闲置卖家'], lowerThanInitialAmountAllowed: false });
  assert.equal(request.readyForImplementation, false);
  assert(request.pending.length >= 6);
  assert.deepEqual(handoff.priceFloorRequests, records.priceFloorRequests);
  for (const key of ['initialAmountSource', 'freezeAt', 'comparisonScope', 'appliesToOther', 'idleTransactionFlow', 'allActorsBound']) {
    assert.equal(Object.hasOwn(request.confirmedIntent, key), false);
  }
  for (const item of records.items) {
    assert.equal(Object.hasOwn(item.confirmed.feeAgreement, 'priceFloor'), false);
    assert.equal(item.confirmed.feeAgreement.requiresBothPartiesConfirmation, true);
    assert.equal(item.confirmed.feeAgreement.postCompletionChanges, false);
    assert.equal(item.fullWorkflowReady, false);
  }
  const note = read(request.requestDocument);
  assert(note.includes(request.userReply));
  assert(note.includes('联系获准不等于成交'));
  assert(note.includes('原话没有提“其它”'));
  assert(note.includes('不授予单方涨价即生效权限'));
  assert(note.includes('不从禁止降低金额推出禁止退款'));
  assert.equal(handoff.items.find(x => x.id === 'HD02').confirmed.business, '跑腿');
});

test('thirteenth-round price-floor proposals stay pending and all planning document links resolve', () => {
  const questions = read('docs/module-specs/price-floor-questions-20261013.md');
  assert(questions.includes('8题全部待答'));
  const offered = [...questions.matchAll(/^\| [1-8]（(PF\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length, 8);
  assert.deepEqual(offered.map(x => x[1]), Array.from({length: 8}, (_, index) => 'PF' + String(index + 1).padStart(2, '0')));
  assert.equal(Object.hasOwn(records, 'priceFloorDecisionBatches'), false);
  assert.equal(Object.hasOwn(handoff, 'priceFloorDecisionBatches'), false);
  assert(questions.includes('不把第十二轮“其它全A”解释为本轮答案'));
  for (const file of fs.readdirSync(path.join(root, 'docs/module-specs')).filter(name => name.endsWith('.md'))) {
    const doc = read('docs/module-specs/' + file);
    for (const match of doc.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^https?:\/\//.test(match[1])) {
        const url = new URL(match[1]);
        assert.equal(url.protocol, 'https:', file + ': external references must use HTTPS');
        assert(url.hostname, file + ': external reference must have a host');
        continue;
      }
      assert(fs.existsSync(path.resolve(root, 'docs/module-specs', match[1])), file + ': ' + match[1]);
    }
  }
  assert(read('docs/module-specs/fee-rules.md').includes('当前仅运行文档一致性检查'));
});

test('exception batch preserves the fourth and fifth B answers and per-question business scope', () => {
  const [batch] = records.exceptionRatingDecisionBatches;
  assert.equal(records.exceptionRatingDecisionBatches.length, 1);
  assert.equal(batch.userReply, '全A, 4B, 5B');
  assert.equal(batch.date, '2026-10-11');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  assert.equal(batch.questionDocument, 'docs/module-specs/exception-rating-questions-20261011.md');
  const document = read(batch.questionDocument);
  assert(document.includes('1A、2A、3A、4B、5B、6A、7A、8A'));
  const offered = [...document.matchAll(/（(EQ\d{2})）\r?\n\r?\nA：(.+?)B：(.+?)\r?\n/g)];
  assert.equal(offered.length, 8);
  assert.deepEqual(batch.answers.map(answer => answer.questionId), Array.from({length: 8}, (_, index) => `EQ${String(index + 1).padStart(2, '0')}`));
  assert.deepEqual(batch.answers.map(answer => answer.answer), ['A', 'A', 'A', 'B', 'B', 'A', 'A', 'A']);
  batch.answers.forEach((answer, index) => {
    assert.equal(answer.selectedOption, offered[index][answer.answer === 'A' ? 2 : 3].trim().replace(/。$/, ''));
    assert.deepEqual(answer.scope, index === 5 ? ['维修'] : index === 6 ? ['其它'] : ['维修', '其它']);
  });
  assert.deepEqual(handoff.exceptionRatingDecisionBatches, records.exceptionRatingDecisionBatches);
  for (const id of ['HD01', 'HD04']) {
    assert(handoff.items.find(item => item.id === id).confirmed.includes('异常与评价第四轮4B/5B、其余A'));
  }
});

test('exception integrity prevents operator mediation, two endings, forced proof, cancelled-service scoring and cross-business mixing', () => {
  verify(records);
  for (const mutate of [
    item => { item.completionRules.evidenceFields.description.required = false; },
    item => { item.completionRules.evidenceFields.description.maxLength = 1000; },
    item => { item.completionRules.evidenceFields.attachments.required = true; },
    item => { item.cancellationRules.evidenceFields.description.required = false; },
    item => { item.cancellationRules.refusalRules.reasonRequired = false; },
    item => { item.cancellationRules.refusalRules.endsService = true; },
    item => { item.terminationRequests.completionAndCancellationMayCoexist = false; },
    item => { item.terminationRequests.endingPolicy = 'client-first-click'; },
    item => { item.terminationRequests.closeOtherOnEnd = false; },
    item => { item.terminationRequests.preserveOtherHistory = false; },
    item => { item.disputeRules.operatorServiceMediation = true; },
    item => { item.disputeRules.existingReportAndRatingAppealUnaffected = false; },
    item => { item.disputeRules.objectionFields.description.required = false; },
    item => { item.ratingRules.qualification.trigger = 'selected'; },
    item => { item.ratingRules.qualification.requiresWorkerCompletionRequest = false; },
    item => { item.ratingRules.qualification.additionalExperienceConfirmationRequired = true; },
    item => { item.ratingRules.qualification.cancellationCreatesQualification = true; },
    item => { item.ratingRules.mutual = false; },
    item => { item.ratingRules.statistics.separateFromOtherBusinesses = false; },
    item => { item.ratingRules.statistics.business = '跑腿'; },
    item => { item.ratingRules.preserveExistingValidQualificationsAndRatings = false; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed);
      assert.throws(() => verify(changed));
    }
  }
  assert(read('docs/module-specs/exception-rating-rules.md').includes('取消先有效时，服务只为已取消、完成申请关闭并留历史'));
  assert(read('docs/module-specs/exception-rating-rules.md').includes('接单申请仍不设单独拒绝'));
  assert(read('docs/module-specs/exception-rating-rules.md').includes('既有举报、内容审核、评分核查和评价申诉仍按原职责处理'));
  assert(read('docs/module-specs/exception-rating-rules.md').includes('没有实现或验证真实并发结束'));
  assert.equal(handoff.items.find(item => item.id === 'HD02').confirmed.business, '跑腿');
  assert.equal(handoff.items.find(item => item.id === 'HD02').confirmed.wallet, false);
});

test('fulfillment all-A answer maps only to the eight questions in its own round and is synchronized with handoff', () => {
  const [batch] = records.fulfillmentDecisionBatches;
  assert.equal(records.fulfillmentDecisionBatches.length, 1);
  assert.equal(batch.userReply, '全A');
  assert.equal(batch.date, '2026-10-11');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  assert.equal(batch.questionDocument, 'docs/module-specs/fulfillment-questions-20261011.md');
  const document = read(batch.questionDocument);
  assert(document.includes('8题全部选择A'));
  const offered = [...document.matchAll(/（(LQ\d{2})）\r?\n\r?\nA：(.+?)B：/g)];
  assert.equal(offered.length, 8);
  assert.deepEqual(batch.answers.map(answer => answer.questionId), Array.from({length: 8}, (_, index) => `LQ${String(index + 1).padStart(2, '0')}`));
  batch.answers.forEach((answer, index) => {
    assert.equal(answer.answer, 'A');
    assert.equal(answer.selectedOption, offered[index][2].trim().replace(/。$/, ''));
  });
  assert.deepEqual(handoff.fulfillmentDecisionBatches, records.fulfillmentDecisionBatches);
  assert.equal(records.applicationDecisionBatches[0].answers[3].answer, 'B');
  assert.equal(handoff.items.find(item => item.id === 'HD02').confirmed.business, '跑腿');
  assert.equal(handoff.items.find(item => item.id === 'HD05').userReply, '只显示“服务时间”，暂不填值');
  assert(read('docs/module-specs/fulfillment-rules.md').includes('原PRD跑腿24小时自动完成规则不受本轮影响'));
  assert(read('docs/module-specs/fulfillment-rules.md').includes('没有实现或验证真实履约功能'));
});

test('fulfillment integrity rejects automatic endings, unilateral changes, restored applicants and permanent contact access', () => {
  verify(records);
  for (const mutate of [
    item => { item.demandChanges.afterSelection.requiresBothPartiesConfirmation = false; },
    item => { item.demandChanges.afterSelection.previousVersionEffectiveUntilConfirmed = false; },
    item => { item.appointmentRules.required = true; },
    item => { item.appointmentRules.changesRequireBothPartiesConfirmation = false; },
    item => { item.completionRules.initiator = 'publisher'; },
    item => { item.completionRules.requiresPublisherConfirmation = false; },
    item => { item.completionRules.noResponse.autoComplete = true; },
    item => { item.completionRules.noResponse.autoCompleteHours = 24; },
    item => { item.cancellationRules.requiresCounterpartyConfirmation = false; },
    item => { item.cancellationRules.noResponse.autoCancel = true; },
    item => { item.cancellationRules.noResponse.autoCancelHours = 48; },
    item => { item.reopeningRules.afterConfirmedCancellation = false; },
    item => { item.reopeningRules.restoreOldApplications = true; },
    item => { item.reopeningRules.preserveServiceAndFeeHistory = false; },
    item => { item.contactVisibility.afterServiceEnd.completedContact = 'full'; },
    item => { item.contactVisibility.afterServiceEnd.cancelledContact = 'full'; },
    item => { item.contactVisibility.afterServiceEnd.selectedWorkerFullAddressAccess = true; },
    item => { item.contactVisibility.afterServiceEnd.publisherMayManageOwnAddress = false; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed);
      assert.throws(() => verify(changed));
    }
  }
  for (const item of records.items) {
    assert.equal(item.confirmed.feeAgreement.cancellation.impliesSettled, false);
  }
});

test('application batch preserves the exact reply and the fourth answer exception instead of treating it as all-A', () => {
  const [batch] = records.applicationDecisionBatches;
  assert.equal(records.applicationDecisionBatches.length, 1);
  assert.equal(batch.userReply, '全A, 4选B, 6皆不设同时接单上限,');
  assert.equal(batch.date, '2026-10-11');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  assert.equal(batch.questionDocument, 'docs/module-specs/application-questions-20261011.md');
  const questions = read(batch.questionDocument);
  assert(questions.includes('1A、2A、3A、4B、5A、6A'));
  assert(!questions.includes('8题全部待答'));
  const offered = [...questions.matchAll(/（(AQ\d{2})）\r?\n\r?\nA：(.+?)B：(.+?)\r?\n/g)];
  assert.equal(offered.length, 8);
  assert.deepEqual(batch.answers.map(answer => answer.questionId), Array.from({length: 8}, (_, index) => `AQ${String(index + 1).padStart(2, '0')}`));
  assert.deepEqual(batch.answers.map(answer => answer.answer), ['A', 'A', 'A', 'B', 'A', 'A', 'A', 'A']);
  batch.answers.forEach((answer, index) => {
    assert.equal(answer.selectedOption, offered[index][answer.answer === 'A' ? 2 : 3].trim().replace(/。$/, ''));
  });
  assert.equal(batch.answers[5].userClarification, '6皆不设同时接单上限');
  assert.deepEqual(handoff.applicationDecisionBatches, records.applicationDecisionBatches);
  for (const id of ['HD01', 'HD04']) {
    const item = handoff.items.find(row => row.id === id);
    assert(item.confirmed.includes('不设单独拒绝申请'));
    assert(item.confirmed.includes('维修和其它均不设同时接单上限'));
    assert(!item.pending.includes('接单员同时接单规则'));
  }
});

test('application integrity rejects secondary acceptance, rejection bans, compulsory quotes, public addresses and stale selection', () => {
  for (const mutate of [
    item => { item.selectionRules.workerReconfirmationRequired = true; },
    item => { item.selectionRules.effectiveAfterPublisherSelectionSuccess = false; },
    item => { item.selectionRules.otherApplications.end = false; },
    item => { item.selectionRules.otherApplications.notify = false; },
    item => { item.selectionRules.otherApplications.autoReplacement = true; },
    item => { item.applicationRules.reapplication.cooldownHours = 24; },
    item => { item.applicationRules.individualRejectionAllowed = true; },
    item => { item.applicationFields.description.required = true; },
    item => { item.applicationFields.description.maxLength = 1000; },
    item => { item.applicationFields.estimatedServiceFee.required = true; },
    item => { item.applicationFields.estimatedServiceFee.missingLabel = '0元'; },
    item => { item.applicationFields.estimatedServiceFee.isFeeAgreement = true; },
    item => { item.concurrentTaskLimit = { kind: 'fixed', count: 1 }; },
    item => { item.contactVisibility.privateAddress.optionalAtPublishing = false; },
    item => { item.contactVisibility.privateAddress.public = true; },
    item => { item.contactVisibility.privateAddress.releaseTo = 'all-applicants'; },
    item => { item.demandChanges.beforeSelection.invalidateApplications = false; },
    item => { item.demandChanges.beforeSelection.notifyApplicants = false; },
    item => { item.demandChanges.beforeSelection.reapplyRequired = false; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed);
      assert.throws(() => verify(changed));
    }
  }
  assert(read('docs/module-specs/application-rules.md').includes('草选、请求失败或结果未知不算成功'));
  assert(read('docs/module-specs/application-rules.md').includes('费用按[费用规则]'));
  assert.equal(handoff.items.find(item => item.id === 'HD02').confirmed.business, '跑腿');
  assert.equal(handoff.items.find(item => item.id === 'HD05').productionAllowed, true);
});

test('single selected worker approval is dated and synchronized for both businesses without imposing an applicant cap', () => {
  const [other, repair] = records.items;
  assert.equal(records.updatedAt, '2026-10-13');
  assert.equal(handoff.updatedAt, records.updatedAt);
  const answer = other.followUp[3];
  assert.equal(answer.date, '2026-10-11');
  assert.equal(answer.userReply, 'A');
  assert(answer.selectedOption.includes('申请人数另行讨论'));
  assert.deepEqual(repair.followUp[0], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD01').followUp[1], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD04').followUp[3], answer);
  assert(read('docs/module-specs/README.md').includes('每条需求最终选1位'));
  assert(read('docs/ui-development-handoff/business-addendum.md').includes('第6题明确两类同时接单均不设上限'));
});

test('applicant-cap answer is retained and independent approval now covers concurrent tasks without allowing duplicate applications', () => {
  const [other, repair] = records.items;
  const answer = other.followUp[4];
  assert.equal(answer.date, '2026-10-11');
  assert.equal(answer.userReply, 'A');
  assert.equal(answer.selectedOption, '维修和其它每条需求不设产品申请人数上限；允许多人申请，发布者最终选1位');
  assert.deepEqual(repair.followUp[1], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD01').followUp[2], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD04').followUp[4], answer);
  for (const item of records.items) {
    assert.deepEqual(item.confirmed.applicantLimit, { kind: 'no-product-cap' });
    assert.equal(item.confirmed.selectedWorkerCount, 1);
    assert.equal(item.confirmed.applicationRules.activePerPersonPerRequest, 1);
    assert(!item.pending.includes('接单员同时接单规则'));
    assert.deepEqual(item.confirmed.concurrentTaskLimit, { kind: 'no-product-cap' });
  }
  assert(read('CONTEXT.md').includes('用户已独立确认维修和其它均不设置此上限'));
});

test('one active editable application and immediate reapplication are synchronized without approving withdrawal after selection', () => {
  const [other, repair] = records.items;
  const answer = other.followUp[6];
  assert.equal(answer.date, '2026-10-11');
  assert.equal(answer.userReply, 'A');
  assert.equal(answer.selectedOption, '维修和其它同一人对同一需求只保留1份有效申请；选定前可修改或撤回；重复点击申请不新增记录');
  assert.deepEqual(repair.followUp[2], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD01').followUp[3], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD04').followUp[6], answer);
  for (const item of records.items) {
    assert.deepEqual(item.confirmed.applicationRules.reapplication, { allowedWhenOpen: true, cooldownHours: 0 });
    assert.equal(Object.hasOwn(item.confirmed.applicationRules, 'withdrawableAfterSelection'), false);
    assert(item.pending.some(text => text.includes('申请同时间排序/历史展示')));
  }
  assert(read('CONTEXT.md').includes('重复点击申请不新增记录'));
  assert(read('docs/module-specs/README.md').includes('选定前可撤回申请不代表选定后可单方取消服务'));
});
