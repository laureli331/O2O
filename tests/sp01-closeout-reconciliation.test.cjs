'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const readText = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('SP01 post-review reconciliation closes preparation facts without changing product gates', () => {
  const reconciliationPath = 'docs/sp01-closeout-reconciliation-20261104.json';
  const reconciliation = readJson(reconciliationPath);
  const priorReview = readJson('docs/sp01-closeout-review-20261103.json');
  const plan = readJson('docs/v1-executable-development-plan-20261027.json');
  const quality = readJson('docs/v1-quality-acceptance-20261027.json');
  const planText = readText('docs/v1-executable-development-plan-20261027.md');
  const reviewText = readText('docs/sp01-closeout-review-20261103.md');
  const reconciliationText = readText('docs/sp01-closeout-reconciliation-20261104.md');
  const sp01 = plan.tasks.find((task) => task.id === 'SP01');
  const sp07 = plan.tasks.find((task) => task.id === 'SP07');

  assert.equal(reconciliation.date, '2026-11-04');
  assert.equal(reconciliation.review, 'docs/sp01-closeout-review-20261103.json');
  assert.equal(reconciliation.e06Evidence, 'docs/sp01-e06-closeout-20261104.json');
  assert.equal(reconciliation.conclusion.currentSP01DecisionBlockers.length, 0);
  assert.equal(reconciliation.conclusion.sp01SignoffAuthorizedByThisRecord, false);
  assert.equal(reconciliation.conclusion.sp01StatusChanged, false);
  assert.equal(reconciliation.conclusion.sp07Started, false);
  assert.equal(reconciliation.conclusion.productAcceptancePassed, false);

  const currentItems = Object.fromEntries(reconciliation.currentItems.map((item) => [item.id, item]));
  assert.deepEqual(Object.fromEntries(Object.entries(currentItems).map(([id, item]) => [id, item.classification])), {
    R01: 'D', R02: 'D', R03: 'C', R04: 'D', R05: 'C', R06: 'D', QD03: 'C', MA01: 'D'
  });
  assert.equal(currentItems.R06.e06PreparationSatisfied, true);
  assert.equal(currentItems.R06.realBusinessRestorePerformed, false);
  assert.match(currentItems.R06.remainingLimitations.join(' '), /QR06.*not-executed/);
  assert.match(currentItems.QD03.blocks, /SP07.*SP01.*SP06.*QD03/);
  assert.equal(currentItems.MA01.testFilePreserved, true);
  assert.equal(currentItems.MA01.evidenceJsonPresent, false);
  assert.equal(currentItems.MA01.testPassed, false);
  assert.equal(currentItems.MA01.trigger, 'only-if-a-future-task-selects-remote-archive-template-execution');

  assert.equal(priorReview.date, '2026-11-03');
  assert.equal(priorReview.items.find((item) => item.id === 'R06').classification, 'A');
  assert.equal(priorReview.requiredUserDecisions.some((decision) => decision.id === 'R06'), true);
  assert.equal(priorReview.postReviewUpdate.latestReconciliation, reconciliationPath);
  assert.equal(priorReview.postReviewUpdate.historicalSnapshotPreserved, true);
  assert.equal(priorReview.postReviewUpdate.currentR06UserInputStillRequired, false);

  assert.equal(sp01.status, 'in-progress');
  assert.equal(sp01.productAcceptancePassed, false);
  assert.equal(sp07.status, 'planned');
  assert.equal(sp07.productAcceptancePassed, false);
  assert.equal(plan.sp01StageBoundaryClarification.latestCloseoutReconciliation.document, reconciliationPath);
  assert.equal(plan.sp01StageBoundaryClarification.latestCloseoutReconciliation.currentDecisionBlockerCount, 0);
  assert.equal(plan.sp01StageBoundaryClarification.latestCloseoutReconciliation.taskStatusesChanged, false);

  const criterion = (id) => quality.criteria.find((entry) => entry.id === id);
  assert.equal(criterion('QP05').expected, '每段平均≥55FPS且无>100ms应用可归因卡顿、视觉跳变/错触；高刷和空闲段不替代');
  assert.equal(criterion('QP05').productResult, 'not-executed');
  assert.equal(criterion('QP07').method, '按SP01冻结限速/延迟/丢包配置在读/写/查询/图片前后注入，逐场景3轮');
  assert.equal(criterion('QP07').productResult, 'not-executed');
  assert.equal(criterion('QP08').method, 'SP01/SP05确认时长、循环数、资源/内存观测和增长预算后，执行相同混合用户循环');
  assert.equal(criterion('QP08').productResult, 'not-executed');
  assert.equal(criterion('QS02').expected, '当前无权文件后端拒绝；公开只合法版，元数据无定位等；不声称收回用户已保存副本');
  assert.equal(criterion('QS02').productResult, 'not-executed');
  assert.equal(criterion('QR06').expected, '恢复可用且对象关系/授权/资金/库存/版本/消息一致；不复活取消/过期/撤权，不重计或重退');
  assert.equal(criterion('QR06').productResult, 'not-executed');

  assert.equal(fs.existsSync(path.join(root, 'tests/sp01-taro-malicious-archive.test.cjs')), true);
  assert.equal(fs.existsSync(path.join(root, 'docs/sp01-taro-malicious-archive-20261103.json')), false);
  for (const evidence of reconciliation.evidence) {
    assert.equal(fs.existsSync(path.join(root, evidence)), true, `reconciliation evidence exists: ${evidence}`);
  }
  assert.match(reviewText, /后续复核附记/);
  assert.match(planText, /SP01收口复核（2026-11-04）/);
  assert.match(reconciliationText, /不改任务状态/);
});
