'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const records = JSON.parse(read('docs/module-specs/decisions.json'));
const handoff = JSON.parse(read('assets/ui/development-handoff-20261009/decisions.json'));

const expectedFeeAgreement = {
  recordedInMiniapp: true,
  requiresBothPartiesConfirmation: true,
  confirmationTiming: 'before-each-charge-stage',
  itemization: {
    mode: 'separate-service-and-expenses', expenseExamples: ['材料', '配件', '商品'], showTotal: true,
    inspectionFeeCategory: 'service-fee', visitFeeCategory: 'service-fee', namedServiceItemsSeparatelyListed: true
  },
  initiation: { allowedParties: ['发布者', '接单员'], submissionAcknowledgesVersion: true, effectiveAfterCounterpartyConfirmation: true },
  changes: { addOrModifyItems: true, requiresBothPartiesConfirmation: true, previousVersionEffectiveUntilConfirmed: true },
  pendingProposalLimit: 1,
  noResponse: { remainsPending: true, reminderAllowed: true, withdrawableByInitiator: true, autoConsent: false },
  cancellation: { serviceMayBeCancelledBeforeExpenseAgreement: true, incurredExpensesNegotiatedSeparately: true, impliesSettled: false },
  receipts: { required: false, supported: ['票据', '照片'] },
  advance: { voluntary: true, requiresPriorMutualConfirmation: true, confirmWhetherToAdvance: true, confirmLimit: true }
};

const expectedApplicationRules = {
  activePerPersonPerRequest: 1, editableBeforeSelection: true, withdrawableBeforeSelection: true,
  repeatedSubmitCreatesNew: false, reapplication: { allowedWhenOpen: true, cooldownHours: 0 }, individualRejectionAllowed: false
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
  privateAddress: { optionalAtPublishing: true, public: false, releaseTo: 'selected-worker-only' }
};
const expectedDemandChanges = {
  beforeSelection: { watched: ['服务内容', '区域', '时间'], invalidateApplications: true, notifyApplicants: true, reapplyRequired: true }
};

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
  assert(other.pending.includes('申请信息可见性/排序/开放期限、修改与重申历史细则、选人并发及取消后改选'));
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
    data => { data.items[0].pending = data.items[0].pending.filter(item => item !== '申请信息可见性/排序/开放期限、修改与重申历史细则、选人并发及取消后改选'); },
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

test('contact and optional private address release follow approved selection while end-of-service access remains unresolved', () => {
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
    assert.equal(Object.hasOwn(item.confirmed.contactVisibility, 'afterServiceEnd'), false);
    assert(item.pending.some(text => text.includes('联系变更/结束/撤销')));
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
  assert(other.pending.includes('申请信息可见性/排序/开放期限、修改与重申历史细则、选人并发及取消后改选'));
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
  assert(handoffOther.pending.some(text => text.includes('费用字段/阶段细则')));
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
  assert.equal(records.feeDecisionBatches.length, 1);
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

test('fulfillment batch stays pending without automatically approving completion, cancellation or address retention', () => {
  const questions = read('docs/module-specs/fulfillment-questions-20261011.md');
  assert(questions.includes('8题全部待答'));
  assert.deepEqual([...questions.matchAll(/（(LQ\d{2})）/g)].map(match => match[1]), Array.from({length: 8}, (_, index) => `LQ${String(index + 1).padStart(2, '0')}`));
  for (const item of records.items) {
    assert.equal(Object.hasOwn(item.confirmed, 'completionRules'), false);
    assert.equal(Object.hasOwn(item.confirmed, 'cancellationRules'), false);
    assert.equal(Object.hasOwn(item.confirmed, 'appointmentRules'), false);
    assert.equal(Object.hasOwn(item.confirmed.contactVisibility, 'afterServiceEnd'), false);
    assert.equal(Object.hasOwn(item.confirmed.demandChanges, 'afterSelection'), false);
  }
  for (const file of require('node:fs').readdirSync(path.join(root, 'docs/module-specs')).filter(name => name.endsWith('.md'))) {
    const doc = read(`docs/module-specs/${file}`);
    for (const match of doc.matchAll(/\]\(([^)]+)\)/g)) {
      assert(fs.existsSync(path.resolve(root, 'docs/module-specs', match[1])), `${file}: ${match[1]}`);
    }
  }
  assert(read('docs/module-specs/fee-rules.md').includes('当前仅运行文档一致性检查'));
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
  assert.equal(records.updatedAt, '2026-10-11');
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
    assert(item.pending.some(text => text.includes('修改与重申历史')));
  }
  assert(read('CONTEXT.md').includes('重复点击申请不新增记录'));
  assert(read('docs/module-specs/README.md').includes('选定前可撤回申请不代表选定后可单方取消服务'));
});
