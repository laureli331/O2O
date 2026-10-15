'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateDevelopmentRecord } = require('./helpers/development-record-validator.cjs');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const records = JSON.parse(read('docs/module-specs/decisions.json'));
const handoff = JSON.parse(read('assets/ui/development-handoff-20261009/decisions.json'));
const audit = records.sharedUnderstandingAudit;

test('five additional boundaries have explicit original sources and no fabricated user answer', () => {
  assert.equal(audit.previousQuestionSet.total, 45);
  assert.equal(audit.previousQuestionSet.answered, 45);
  assert.equal(audit.previousQuestionSet.reopened, false);
  assert.equal(audit.newlyIdentifiedQuestionCount, 5);
  assert.deepEqual(audit.answers, []);
  assert.deepEqual(audit.questions.map(q => q.id), ['UA01', 'UA02', 'UA03', 'UA04', 'UA05']);
  const original = records.businessCloseoutQuestionInventory;
  assert.equal(original.totalQuestions, 45);
  assert.equal(original.answeredQuestions, 45);
  assert.equal(original.questions.filter(q => q.status === 'answered').length, 45);
  const rows = [...read(audit.questionDocument).matchAll(/^\| (\d+)（(UA\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(rows.length, 5);
  audit.questions.forEach((q, i) => {
    assert.equal(q.selected, null); assert.equal(q.status, 'pending');
    assert.equal(q.number, i + 1); assert.equal(q.id, rows[i][2]);
    assert.equal(q.question, rows[i][3].trim());
    assert.equal(q.options.A, rows[i][4].trim()); assert.equal(q.options.B, rows[i][5].trim());
    assert(read(q.source).includes(q.sourceAnchor), q.id + ' original gap anchor');
    assert(!original.questions.some(old => old.id === q.id));
  });
  assert.equal(audit.coreBusinessAligned, true);
  assert.equal(audit.developerReady, false);
  assert.equal(audit.implementationEnabled, false);
});

test('current audit counts the omissions transparently while preserving the completed original question set', () => {
  const p = records.currentPlanningFocus, a = records.remainingPlanningAudit;
  assert.deepEqual(p.pendingQuestionIds, audit.questions.map(q => q.id));
  assert.equal(p.remainingQuestionCount, 5); assert.equal(p.questionDocument, audit.questionDocument);
  assert.equal(p.planningComplete, false); assert.equal(p.implementationEnabled, false);
  assert.equal(a.totalQuestionCount, 50); assert.equal(a.answeredQuestionCount, 45);
  assert.equal(a.remainingQuestionCount, a.totalQuestionCount - a.answeredQuestionCount);
  assert.equal(a.originalQuestionSetResolved, true); assert.equal(a.currentTransactionQuestionSetResolved, false);
  assert.equal(records.remainingPlanningAuditHistory[5].remainingQuestionCount, 0);
  assert.deepEqual(audit.deferredWorkstreamIds, ['merchant-banner-commercial-planning']);
  assert.equal(audit.technicalAndExternalWorkExcludedFromQuestionCount, true);
  for (const key of ['sharedUnderstandingAudit', 'currentPolicyReferences', 'currentPlanningFocus', 'remainingPlanningAudit']) {
    assert.deepEqual(handoff[key], records[key], key);
  }
});

test('historical handoff text directs developers to current policy without deleting original approvals or implying a runtime migration', () => {
  for (const id of ['HD01', 'HD04']) {
    const item = handoff.items.find(x => x.id === id);
    assert.equal(item.recordSemantics.confirmedAndPendingText, 'historical-chronological-not-current-unanswered-question-list');
    assert.equal(item.recordSemantics.currentDevelopmentBasis, audit.guideDocument);
    assert.equal(item.recordSemantics.noRuntimeMigrationRequired, true);
    assert(item.confirmed.includes('接单员提交完成')); // Preserved history, explicitly not the current flow.
  }
  assert.equal(records.serviceExpiryRules.manualCompletion.customerConfirmationEnabled, false);
  assert.equal(records.serviceExpiryRules.manualCompletion.workerCompletionReportEnabled, false);
  assert.equal(records.serviceExpiryRules.expiry.additionalNormalCompletionGraceHours, 0);
  assert.equal(handoff.items.find(x => x.id === 'HD05').currentResolution.questionId, 'NE01');
  const guide = read(audit.guideDocument);
  for (const phrase of ['无接单员“已办完”或客户“确认完成/收到”', '99,999.99元', '跑腿15%不封顶', '本人和伙伴共用本人一个管理账号']) {
    assert(guide.includes(phrase), phrase);
  }
  for (const file of [audit.document, audit.questionDocument, audit.guideDocument]) {
    const text = read(file);
    for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^https:\/\//.test(match[1])) continue;
      assert(fs.existsSync(path.resolve(root, path.dirname(file), match[1])), file + ': ' + match[1]);
    }
    let width = 0;
    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith('|')) { width = 0; continue; }
      const count = (line.match(/\|/g) || []).length;
      if (width) assert.equal(count, width, file + ' table width');
      width = count;
    }
  }
});

test('current technology approval uses one shared account while preserving the initial two-account choice as history', () => {
  const technology = JSON.parse(read('docs/development-decisions.json'));
  assert.equal(technology.approval.operations, 'miniapp-two-independent-equal-role-accounts');
  const active = technology.currentOperationsApproval;
  assert.equal(active.sourceUserReply, records.operatorAccountRules.userReply);
  assert.equal(active.sourceDocument, records.operatorAccountRules.document);
  assert.equal(active.managementAccountCount, records.operatorAccountRules.managementAccountCount);
  assert.equal(active.operations, 'miniapp-shared-owner-management-account');
  const plan = read('docs/development-plan.md');
  assert.equal(validateDevelopmentRecord(technology, plan), true);
  for (const [key, value] of [['managementAccountCount', 2], ['separatePartnerAccountRequired', true], ['actualHumanOperatorAttribution', true], ['productionAccountConfigured', true]]) {
    const changed = structuredClone(technology); changed.currentOperationsApproval[key] = value;
    assert.throws(() => validateDevelopmentRecord(changed, plan), /operations|Shared login/);
  }
});

test('new proposals preserve refund, complaint and fee-accounting boundaries without enabling any option', () => {
  const q = read(audit.questionDocument);
  for (const phrase of ['A不免除服务者或平台依法应尽的职责', '不能因余额无限期拖延受理', '不代表每笔抵扣可直接换现金', '不按名字合并阶段', '全部待答']) assert(q.includes(phrase), phrase);
  assert.equal(records.operatorAccountRules.enabled, false);
  assert.equal(records.merchantBannerDirection.commercialRulesConfirmed, false);
  assert.equal(records.businessCloseoutFinalPartialRules.commissionReview.activationOccurred, false);
});
