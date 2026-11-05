'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const load = () => JSON.parse(read('docs/sp06-resource-and-batch-plan-20261104.json'));
const plan = () => JSON.parse(read('docs/v1-executable-development-plan-20261027.json'));

test('SP06 closes the preparation plan and records the confirmed operations-only partner role', () => {
  const record = load();

  assert.equal(record.task, 'SP06');
  assert.equal(record.status, 'complete');
  assert.equal(record.productAcceptancePassed, false);
  assert.equal(record.qd03SignedOff, false);
  assert.equal(record.sp07Started, false);
  assert.deepEqual(record.confirmedAvailability, {
    ownerHoursPerWeekLowerBound: 8,
    ownerHoursPerWeekUpperBound: null,
    partnerOperationsShift: '09:00-17:00',
    partnerEngineeringOrAcceptanceRole: 'operations-only',
    partnerEngineeringHoursCounted: 0,
    serviceWindow: '09:00-22:00',
  });
  assert.equal(record.planAcceptance.partnerRole, 'operations-only');
  assert.equal(record.planAcceptance.dependencyBatchSequenceAccepted, true);
  assert.equal(record.planAcceptance.estimationMethodAccepted, true);
  assert.equal(record.effortEstimate.status, 'not-quantified');
  assert.equal(record.effortEstimate.totalHours, null);
  assert.equal(record.schedule.calendarDatesAssigned, false);
  assert.equal(record.riskReserve.fixedPercentage, null);
  assert.match(record.effortEstimate.reason, /no measured delivery baseline/i);
  assert.equal(record.budget.actualFeasibility, 'unverified');
  assert.equal(record.budget.purchaseAuthorization, false);
  assert.deepEqual(record.openEvidenceGates, ['E05']);
  assert.equal(record.completion.scope, 'task-preparation-only');
  assert.match(record.completion.scopeNote, /E05.*remains? open/i);
});

test('SP06 execution batches cover SP07-SP36 exactly once and respect dependency order', () => {
  const record = load();
  const executablePlan = plan();
  const tasks = new Map(executablePlan.tasks.map((task) => [task.id, task]));
  const seen = [];

  assert.equal(record.executionBatches.length, 8);
  assert.equal(record.planAcceptance.dependencyBatchSequenceAccepted, true);
  assert.equal(record.schedule.planningRuleAccepted, true);
  for (const [batchIndex, batch] of record.executionBatches.entries()) {
    assert.equal(batch.order, batchIndex + 1);
    assert.ok(batch.taskIds.length > 0);
    for (const taskId of batch.taskIds) {
      assert.ok(tasks.has(taskId), `unknown task ${taskId}`);
      assert.ok(!seen.includes(taskId), `duplicate task ${taskId}`);
      seen.push(taskId);
    }
  }
  assert.deepEqual(seen.slice().sort(), Array.from({ length: 30 }, (_, index) => `SP${String(index + 7).padStart(2, '0')}`).sort());

  const batchOf = new Map(record.executionBatches.flatMap((batch) => batch.taskIds.map((taskId) => [taskId, batch.order])));
  for (const taskId of seen) {
    for (const predecessor of tasks.get(taskId).dependsOn) {
      if (batchOf.has(predecessor)) {
        assert.ok(batchOf.get(predecessor) <= batchOf.get(taskId), `${predecessor} must precede ${taskId}`);
      }
    }
  }
  assert.equal(record.executionBatches.some((batch) => batch.taskIds.includes('SP01')), false);
  assert.equal(record.executionBatches.some((batch) => batch.taskIds.includes('SP06')), false);
});

test('SP06 budget record separates observed evidence, published rates, and unresolved actual costs', () => {
  const record = load();

  assert.equal(record.budget.monthlyCashCeilingYuan, 500);
  assert.equal(record.budget.actualFeasibility, 'unverified');
  assert.equal(record.budget.actualMonthlySpendYuan, null);
  assert.equal(record.budget.autoRenewalEnabled, false);
  assert.equal(record.budget.payAsYouGoEnabled, false);
  assert.equal(record.budget.actualInvoiceVerified, false);
  assert.ok(record.budget.costItems.length >= 5);
  for (const item of record.budget.costItems) {
    assert.ok(item.category && item.actualAmountYuan === null && item.status);
  }
  assert.ok(record.references.some((reference) => reference.url === 'https://cloudbase.cloud.tencent.com/pricing'));
  assert.ok(record.references.some((reference) => reference.url === 'https://cloud.tencent.com/document/product/876/127357'));
});

test('SP06 gate leaves later product measurements with their assigned task cards', () => {
  const record = load();
  const productPlan = plan();
  const sp06 = productPlan.tasks.find((task) => task.id === 'SP06');
  const sp07 = productPlan.tasks.find((task) => task.id === 'SP07');
  const doc = read('docs/sp06-resource-and-batch-plan-20261104.md');

  assert.equal(sp06.productAcceptancePassed, false);
  assert.equal(sp07.status, 'complete');
  assert.equal(sp07.executionProgress.scope, 'bounded-local-foundation-only');
  assert.equal(sp07.executionProgress.productModulesImplemented, false);
  assert.equal(sp07.productAcceptancePassed, false);
  assert.equal(productPlan.firstProductTask, 'SP07');
  assert.equal(record.productAcceptancePassed, false);
  assert.equal(record.qd03SignedOff, false);
  assert.match(doc, /正式产品模块图及工程目录属于 SP07\/SP08/);
  assert.match(doc, /真实页面性能、帧率、内存和耐久数据属于产品实现后的质量任务/);
  assert.match(doc, /SP07.*QD03/);
  assert.match(doc, /QP05/);
  assert.match(doc, /QP08/);
  assert.match(doc, /QP10/);
  assert.match(doc, /不得据此标记通过/);
});

test('SP06 plan source is linked from both machine-readable and human-readable plans', () => {
  const executablePlan = plan();
  const sp06 = executablePlan.tasks.find((task) => task.id === 'SP06');
  const pathInPlan = 'docs/sp06-resource-and-batch-plan-20261104.md';
  const source = 'docs/sp06-resource-and-batch-plan-20261104.json';
  const mainDoc = read('docs/v1-executable-development-plan-20261027.md');

  assert.ok(executablePlan.sources.includes(pathInPlan));
  assert.ok(executablePlan.sources.includes(source));
  assert.equal(sp06.status, 'complete');
  assert.equal(sp06.productAcceptancePassed, false);
  assert.equal(sp06.executionProgress.executionBatches, 8);
  assert.equal(sp06.executionProgress.partnerEngineeringParticipation, 'operations-only');
  assert.equal(sp06.executionProgress.dependencyBatchSequenceAccepted, true);
  assert.equal(sp06.executionProgress.estimationMethodAccepted, true);
  assert.equal(sp06.executionProgress.actualBudgetFeasibilityVerified, false);
  assert.deepEqual(sp06.executionProgress.preparationBlockers, []);
  assert.deepEqual(sp06.executionProgress.openEvidenceGates, ['E05']);
  assert.equal(sp06.executionProgress.sp07Started, false);
  assert.equal(sp06.executionProgress.qd03SignedOff, false);
  assert.equal(sp06.completion.scope, 'task-preparation-only');
  assert.match(sp06.completion.scopeNote, /E05.*remains? open/i);
  assert.deepEqual(sp06.executionProgress.remainingForAcceptance, []);
  assert.match(mainDoc, /SP06资源、预算与依赖批次记录/);
  assert.match(mainDoc, /SP06准备交付已完成/);
  assert.ok(fs.existsSync(path.join(root, pathInPlan)));
  assert.ok(fs.existsSync(path.join(root, source)));
});
