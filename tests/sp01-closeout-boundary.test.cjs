'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const readText = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('SP01 boundary clarification preserves task and acceptance gates', () => {
  const plan = readJson('docs/v1-executable-development-plan-20261027.json');
  const quality = readJson('docs/v1-quality-acceptance-20261027.json');
  const review = readJson('docs/sp01-closeout-review-20261103.json');
  const planText = readText('docs/v1-executable-development-plan-20261027.md');
  const qualityText = readText('docs/v1-quality-acceptance-20261027.md');
  const reportText = readText('docs/sp01-closeout-review-20261103.md');

  assert.equal(plan.taskCount, 36);
  assert.equal(plan.firstProductTask, 'SP07');
  assert.deepEqual(plan.firstProductTaskPrerequisites, ['SP01', 'SP02', 'SP03', 'SP04', 'SP05', 'SP06']);
  assert.equal(plan.status, 'execution-backlog-preconditions-open');
  assert.equal(plan.tasks.find((task) => task.id === 'SP01').status, 'in-progress');
  assert.equal(plan.tasks.find((task) => task.id === 'SP01').productAcceptancePassed, false);
  assert.equal(quality.productValidationPerformed, false);
  assert.equal(quality.releaseGate.applicablePassPercent, 100);
  assert.equal(quality.releaseGate.knownUnresolvedDefectsAllowed, 0);
  assert.equal(quality.releaseGate.unverifiedPassAllowed, 0);
  assert.equal(quality.releaseGate.requiredUserVisualApproval, true);
  assert.equal(quality.criteria.find((criterion) => criterion.id === 'QP05').expected,
    '每段平均≥55FPS且无>100ms应用可归因卡顿、视觉跳变/错触；高刷和空闲段不替代');
  assert.equal(quality.criteria.find((criterion) => criterion.id === 'QP08').method,
    'SP01/SP05确认时长、循环数、资源/内存观测和增长预算后，执行相同混合用户循环');

  assert.equal(review.statusSnapshot.sp01Status, 'in-progress');
  assert.equal(review.statusSnapshot.sp01Passed, false);
  assert.equal(review.statusSnapshot.e06GatePassed, false);
  assert.equal(review.statusSnapshot.sp07Started, false);
  assert.equal(review.statusSnapshot.productAcceptancePassed, false);
  assert.equal(review.sourceEvidenceReviewReadOnly, true);
  assert.equal(review.planDocumentationClarificationApplied, true);
  assert.equal(review.projectCodeOrCloudResourcesChanged, false);
  assert.equal(review.statusChangesMade, false);
  assert.equal(review.thresholdsChanged, false);

  const classifications = Object.fromEntries(review.items.map((item) => [item.id, item.classification]));
  assert.deepEqual(classifications, {
    R01: 'B',
    R02: 'D',
    R03: 'C',
    R04: 'B',
    R05: 'C',
    R06: 'A',
    QD03: 'A',
    MA01: 'B'
  });
  assert.deepEqual(review.statusSnapshot.firstProductTaskPrerequisites,
    ['SP01', 'SP02', 'SP03', 'SP04', 'SP05', 'SP06']);
  assert.deepEqual(review.boundary.formalProductModuleGraphOwnerTasks, ['SP07', 'SP08']);
  assert.equal(review.boundary.futureProductMeasurementsAreNotSp01Evidence, true);
  assert.equal(review.boundary.futureAcceptanceCannotBeMarkedPassedEarly, true);
  assert.equal(review.items.find((item) => item.id === 'R03').assignedTasks.includes('SP35'), true);
  assert.equal(review.items.find((item) => item.id === 'R05').assignedTasks.includes('SP35'), true);
  for (const item of review.items) {
    for (const evidence of item.evidence ?? []) {
      const evidencePath = evidence.split('#')[0];
      assert.equal(fs.existsSync(path.join(root, evidencePath)), true, `${item.id} evidence exists: ${evidencePath}`);
    }
  }

  assert.match(planText, /SP01阶段边界澄清/);
  assert.match(qualityText, /SP01阶段边界说明/);
  assert.match(reportText, /SP01 收口审查/);
  assert.match(qualityText, /QP05/);
  assert.match(qualityText, /QP08/);
  assert.match(qualityText, /QP09/);
  assert.match(qualityText, /≥55FPS/);
  assert.match(qualityText, />100ms/);
});

test('unfinished malicious-archive test and its missing evidence remain visible', () => {
  assert.equal(fs.existsSync(path.join(root, 'tests/sp01-taro-malicious-archive.test.cjs')), true);
  const evidenceExists = fs.existsSync(path.join(root, 'docs/sp01-taro-malicious-archive-20261103.json'));
  const review = readJson('docs/sp01-closeout-review-20261103.json');
  assert.equal(review.items.find((item) => item.id === 'MA01').evidenceFileCurrentlyPresent, evidenceExists);
});
