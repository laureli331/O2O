'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(path.join(root, p)));
const records = JSON.parse(read('docs/module-specs/decisions.json'));
const prd = read('docs/prd.md');
const documentPath = 'docs/module-specs/exception-finance-confirmed-20261015.md';
const document = read(documentPath);
const choices = [
  ['EA01', '服务已经交付，但客户拖欠款项，平台佣金怎么处理？', '允许纳入现有账单异议，争议部分暂缓催缴和欠费限制；核验结束后，需要缴纳的余额按既有补缴72小时规则处理。不自动免佣，客户欠款仍由交易双方解决。'],
  ['EA02', '平台故障导致用户无法及时提出异议，怎么保护受影响交易？', '暂停受影响交易的自动结束和计佣。恢复验收通过后，至少保留24小时提交异议；原有效到期更晚时仍等原到期。双方实际服务约定不改。'],
  ['EA03', '佣金是否允许分次缴纳，以及多收款怎么处理？', '允许分次缴纳，先抵最早到期应缴款；剩余逾期款仍适用欠费限制。多缴或重复实际收款核对后退回，不自动变为抵扣余额；应缴为0显示“无需缴纳”。'],
];
const expectedPolicy = {
  'enabled': false,
  'customerArrears.allowedAsCommissionBillIssue': true,
  'customerArrears.pauseScope': 'disputed-commission-only',
  'customerArrears.uncontestedDeadlineUnchanged': true,
  'customerArrears.automaticWaiver': false,
  'customerArrears.repaymentClock': 'balance-determined-and-supplemental-notice-created',
  'customerArrears.repaymentHours': 72,
  'customerArrears.customerDebtAdjudication': false,
  'customerArrears.customerPaymentTotalCollection': false,
  'platformOutage.requiresVerifiedPlatformLogs': true,
  'platformOutage.affectedObjectsOnly': true,
  'platformOutage.userOfflineEligible': false,
  'platformOutage.wechatNotificationFailureEligible': false,
  'platformOutage.pauseAutomaticCompletion': true,
  'platformOutage.pauseMainCommissionFormation': true,
  'platformOutage.recoveryRequiresPassedAcceptance': true,
  'platformOutage.minRecoveryProtectionHours': 24,
  'platformOutage.closeNotBefore': 'max-effective-service-deadline-and-recovery-acceptance-plus-24-hours',
  'platformOutage.strictlyAfterProtectionDeadline': true,
  'platformOutage.issueAtDeadlineTimely': true,
  'platformOutage.originalServiceTimeChanged': false,
  'platformOutage.duplicateEventRefreshesDeadline': false,
  'platformOutage.unrelatedBillClockChanged': false,
  'payments.partialPaymentAllowed': true,
  'payments.allocation': 'earliest-due-current-payable-first',
  'payments.suspendedDisputeAutomaticallyAllocated': false,
  'payments.partialClearsAllArrears': false,
  'payments.remainingDeadlineReset': false,
  'payments.duplicateCallbackIsNewMoney': false,
  'payments.actualExcess': 'verified-refund',
  'payments.excessAutomaticallyBecomesCredit': false,
  'payments.unknownRefundIsSuccessful': false,
  'payments.zeroDueLabel': '无需缴纳',
  'payments.zeroDuePaymentCreated': false,
  'payments.zeroDueClearsHistoricalArrears': false,
  'payments.refundChannel': null,
  'payments.realRefundVerified': false,
  'payments.approvedCommissionCreditsSeparate': true,
};
const valueAt = (object, key) => key.split('.').reduce((v, k) => v[k], object);
function validatePolicy(candidate) {
  for (const [key, value] of Object.entries(expectedPolicy)) assert.equal(valueAt(candidate, key), value, key);
  assert.deepEqual(candidate.platformOutage.affectedFunctions, ['login', 'delivery-issue-submission']);
}
const section = (text, start, end) => {
  const a = text.indexOf(start), b = text.indexOf(end, a);
  assert(a >= 0 && b > a, start); return text.slice(a, b);
};
function validateNarrative(text) {
  const areas = [
    [section(text, '### 6.5 ', '## 7.'), ['恢复验收成功时点＋24小时中较晚者', '严格超过保护截止', '同一故障/恢复事件重放不刷新', '不改双方服务开始/到期约定', '本条不新增全部缴款倒计时的自动顺延']],
    [section(text, '### 8.6 ', '### 8.7 '), ['只暂停争议部分', '无争议部分原期限', '不自动免佣', '补充缴款通知生成成功后', '不重开已结束交易']],
    [section(text, '### 8.7 ', '## 9.'), ['按最早到期的当前可缴应缴项分配', '未缴余额仍按其原期限', '同一支付交易的重复回调只记一次', '只有可核对的成功结果标已退回', '不创建0元支付', '本期0不解除其他历史逾期']],
  ];
  for (const [area, terms] of areas) for (const term of terms) assert(area.includes(term), term);
  for (let i = 13; i <= 18; i++) assert(new RegExp('^\\| BX' + i + ' \\|', 'm').test(text), 'BX' + i);
}

test('three all-A choices retain exact questions, both options and the user reply in both records and PRD', () => {
  const batches = records.exceptionFinanceDecisionBatches;
  assert.equal(batches.length, 1);
  const batch = batches[0];
  assert.equal(batch.userReply, '全A'); assert.equal(batch.implementationEnabled, false);
  assert.equal(batch.document, documentPath);
  assert.equal(batch.questions.length, 3); assert.equal(batch.answers.length, 3);
  choices.forEach(([id, question, answer], i) => {
    const q = batch.questions[i], a = batch.answers[i];
    assert.equal(q.id, id); assert.equal(q.question, question); assert.equal(q.options.A, answer);
    assert.equal(q.selected, 'A'); assert(q.options.B.length > 0);
    assert.deepEqual(a, { questionId: id, answer: 'A', selectedOption: answer });
    assert(document.includes('| ' + id + ' | ' + question + ' | ' + answer + ' | ' + q.options.B + ' | A |'));
    assert(prd.includes('| DEC-' + id + ' | A |'));
  });
  const handoff = JSON.parse(read('assets/ui/development-handoff-20261009/decisions.json'));
  for (const key of ['exceptionFinanceDecisionBatches', 'exceptionFinanceRules', 'prdConsolidation', 'currentPlanningFocus', 'remainingPlanningAudit']) assert.deepEqual(handoff[key], records[key], key);
});

test('approved exception policy and current PRD retain independent billing, outage and payment boundaries', () => {
  validatePolicy(records.exceptionFinanceRules); validateNarrative(prd);
  assert.equal(records.exceptionFinanceRules.document, documentPath);
  assert.equal(records.exceptionFinanceRules.sourceBatch, records.exceptionFinanceDecisionBatches[0].id);
});

test('53 historical choices remain intact while current discovery expands acceptance planning only', () => {
  const meta = records.prdConsolidation, current = records.remainingPlanningAudit;
  assert.equal(meta.version, '2.1'); assert.equal(meta.counts.originalCloseoutDecisions, 50);
  assert.equal(meta.counts.closeoutDecisions, 53); assert.equal(meta.counts.acceptanceCases, 74);
  assert.equal(current.totalQuestionCount, 53); assert.equal(current.answeredQuestionCount, 53);
  assert.equal(current.remainingQuestionCount, 0);
  assert.equal(records.currentPlanningFocus.planningComplete, false);
  assert.equal(meta.productImplemented, false); assert.equal(meta.realServicesEnabled, false);
  assert(records.prdConsolidationHistory.some(x => x.version === '2.0' && x.counts.closeoutDecisions === 50));
  assert(records.remainingPlanningAuditHistory.some(x => x.totalQuestionCount === 50 && x.answeredQuestionCount === 50));
  assert.equal(records.businessCloseoutQuestionInventory.totalQuestions, 45);
  assert.equal(records.sharedUnderstandingAudit.questions.length, 5);
  for (const [prefix, count] of [['M', 15], ['F', 22], ['V', 23]]) assert.equal([...prd.matchAll(new RegExp('^\\| ' + prefix + '\\d{2} \\|', 'gm'))].length, count);
  assert.equal(['T','RT','AT','DT','BX'].reduce((sum,prefix)=>sum+[...prd.matchAll(new RegExp('^\\| '+prefix+'\\d{2} \\|','gm'))].length,0),82);
});

test('remapped documents preserve all three exceptions while legacy validation names its historical archives', () => {
  for (const file of ['docs/development-plan.md', 'docs/structured-design.md']) {
    const text = read(file);
    for (const term of ['PRD 2.1', '文档重映射', 'EA01—EA03', 'BX13', 'BX18']) assert(text.includes(term), file + ': ' + term);
  }
  for (const file of ['tests/validate-development-plan.ps1', 'tests/validate-structured-design.ps1']) {
    const text = read(file); assert(text.includes('prd-v1.5-archive-20261015.md'));
    assert(text.includes('版本：2.1')); assert(text.includes('文档重映射'));
  }
});

// Documentation arithmetic, not production scheduling or payment implementation.
test('documented recovery examples compute the later deadline without changing the original service deadline', () => {
  const recovery = Date.parse('2026-10-16T19:00:00+08:00');
  for (const [original, expected, documented] of [
    ['2026-10-16T18:00:00+08:00', '2026-10-17T19:00:00+08:00', '保护截止10月17日19:00'],
    ['2026-10-20T18:00:00+08:00', '2026-10-20T18:00:00+08:00', '仍等10月20日18:00'],
  ]) {
    assert.equal(Math.max(Date.parse(original), recovery + 24 * 60 * 60 * 1000), Date.parse(expected));
    assert(document.includes(documented));
  }
  assert(document.includes('截止异议及时，严格超过且无阻断才收尾'));
  assert.equal(Date.parse('2026-10-20T10:00:00+08:00') + 72 * 60 * 60 * 1000, Date.parse('2026-10-23T10:00:00+08:00'));
  assert(document.includes('新截止为10月23日10:00'));
});

test('documented payment examples reconcile allocated, remaining and excess money separately from callbacks', () => {
  const partial = document.match(/逾期应缴先(\d+)元、后(\d+)元，核实收到部分缴款(\d+)元 \| 分别抵(\d+)元和(\d+)元，后项仍欠(\d+)元/);
  assert(partial, 'Partial-payment example remains inspectable');
  const [first, second, received, firstApplied, secondApplied, remaining] = partial.slice(1).map(Number);
  assert.equal(firstApplied, Math.min(first, received));
  assert.equal(firstApplied + secondApplied, received); assert.equal(second - secondApplied, remaining);
  const excess = document.match(/当前应缴(\d+)元，两个不同支付交易各实际收(\d+)元 \| 有效抵付(\d+)元、多收待退(\d+)元/);
  assert(excess, 'Excess-payment example remains inspectable');
  const [due, perReceipt, applied, refund] = excess.slice(1).map(Number);
  assert.equal(applied, due); assert.equal(2 * perReceipt, applied + refund);
  assert(document.includes('同一个20元支付回调重复到达'));
  assert(document.includes('实缴只记20元，无第二笔实际多收或退款'));
});

const mutations = [
  ['customerArrears.pauseScope', 'whole-bill'], ['customerArrears.automaticWaiver', true],
  ['customerArrears.customerDebtAdjudication', true], ['customerArrears.repaymentClock', 'original-bill-time'],
  ['platformOutage.requiresVerifiedPlatformLogs', false], ['platformOutage.affectedObjectsOnly', false],
  ['platformOutage.userOfflineEligible', true], ['platformOutage.wechatNotificationFailureEligible', true],
  ['platformOutage.recoveryRequiresPassedAcceptance', false], ['platformOutage.minRecoveryProtectionHours', 0],
  ['platformOutage.originalServiceTimeChanged', true], ['platformOutage.duplicateEventRefreshesDeadline', true],
  ['platformOutage.issueAtDeadlineTimely', false], ['platformOutage.unrelatedBillClockChanged', true],
  ['payments.allocation', 'newest-first'], ['payments.suspendedDisputeAutomaticallyAllocated', true],
  ['payments.partialClearsAllArrears', true], ['payments.remainingDeadlineReset', true],
  ['payments.duplicateCallbackIsNewMoney', true], ['payments.excessAutomaticallyBecomesCredit', true],
  ['payments.unknownRefundIsSuccessful', true], ['payments.zeroDuePaymentCreated', true],
  ['payments.zeroDueClearsHistoricalArrears', true], ['payments.realRefundVerified', true],
];
for (const [key, value] of mutations) test('policy regression rejected: ' + key, () => {
  const copy = structuredClone(records.exceptionFinanceRules), keys = key.split('.');
  const last = keys.pop(); keys.reduce((v, k) => v[k], copy)[last] = value;
  assert.throws(() => validatePolicy(copy), { message: new RegExp(key.replaceAll('.', '\\.')) });
});
test('removing a new acceptance case or weakening the current prose fails validation', () => {
  assert.throws(() => validateNarrative(prd.replace(/^\| BX18 \|[^\r\n]+\r?\n/m, '')), /BX18/);
  assert.throws(() => validateNarrative(prd.replace('本条不新增全部缴款倒计时的自动顺延', '所有账单都顺延')), /本条不新增/);
});

test('exception documentation, planning additions and their local links remain well formed', () => {
  for (const file of [documentPath, 'docs/development-plan.md', 'docs/structured-design.md', 'docs/planning-validation.md', 'docs/ui-development-handoff/implementation-checklist.md']) {
    const text = read(file); assert.equal((text.match(/^```/gm) || []).length % 2, 0, file);
    let width = 0;
    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith('|')) { width = 0; continue; }
      const next = (line.match(/\|/g) || []).length;
      if (width) assert.equal(next, width, file + ': ' + line);
      width = next;
    }
    for (const m of text.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^(https?:\/\/|#)/.test(m[1])) continue;
      assert(fs.existsSync(path.resolve(root, path.dirname(file), m[1].split('#')[0])), file + ': ' + m[1]);
    }
  }
});
