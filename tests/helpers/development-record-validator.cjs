'use strict';

// Validates development records only. This is not a production feature gate.
const assert = require('node:assert/strict');

const taskStates = new Set([
  '未开始', '资料准备中', '待用户确认', '待外部依据', '执行中', '待验收', '已完成',
]);

function validateDevelopmentRecord(record, plan) {
  assert.equal(record.schemaVersion, 1, 'Unsupported development record version');
  assert.equal(record.approval.reply, '采用', 'Actual user adoption must be recorded');
  const approvedChoices = {
    frontend: 'native-wechat-typescript',
    backend: 'node-cloud-functions',
    database: 'cloudbase',
    storage: 'cloudbase-storage',
    scheduler: 'cloud-timer-with-recovery',
    operations: 'miniapp-two-independent-equal-role-accounts',
    developmentScope: 'local-and-controlled-tests',
    purchasePolicy: 'confirm-cost-before-purchase',
  };
  for (const [choice, expected] of Object.entries(approvedChoices)) {
    assert.equal(record.approval[choice], expected, `Approved choice changed: ${choice}`);
  }

  const tasks = new Map();
  for (const match of plan.matchAll(/^\| (DP\d{2}) \|[^\r\n]+/gm)) {
    const cells = match[0].split('|').map(cell => cell.trim());
    assert(!tasks.has(match[1]), `Duplicate task: ${match[1]}`);
    tasks.set(match[1], [...cells[4].matchAll(/DP\d{2}/g)].map(item => item[0]));
  }
  assert.equal(tasks.size, 40, 'Original forty-task plan must be retained');
  for (const [id, status] of Object.entries(record.tasks)) {
    assert(tasks.has(id), `Unknown task: ${id}`);
    assert(taskStates.has(status), `Invalid task status: ${id}`);
    // Material preparation may proceed independently, as allowed by the plan.
    if (['执行中', '待验收', '已完成'].includes(status)) {
      for (const dependency of tasks.get(id)) {
        assert.equal(record.tasks[dependency], '已完成', `Incomplete dependency: ${id} requires ${dependency}`);
      }
    }
  }

  const gateIds = ['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'QG01'];
  assert.deepEqual(record.externalGates.map(gate => gate.id).sort(), gateIds, 'All seven external conditions must be tracked exactly once');
  for (const gate of record.externalGates) {
    assert(['待外部依据', '待用户确认', '已完成'].includes(gate.status), `Invalid condition status: ${gate.id}`);
    assert(Array.isArray(gate.evidence), `Evidence must be a list: ${gate.id}`);
    if (gate.status === '已完成') {
      assert(gate.evidence.length > 0, `Completed condition lacks project evidence: ${gate.id}`);
      for (const evidence of gate.evidence) {
        assert.equal(evidence.kind, 'project-verification', `General documentation is not project evidence: ${gate.id}`);
        for (const field of ['source', 'date', 'scope', 'result', 'reviewer']) {
          assert(typeof evidence[field] === 'string' && evidence[field].trim(), `Missing evidence field ${field}: ${gate.id}`);
        }
        assert.equal(evidence.result, 'passed', `Evidence did not pass: ${gate.id}`);
      }
    }
  }
  assert.equal(typeof record.productionEnabled, 'boolean', 'Production state must be explicit');
  if (record.productionEnabled) {
    assert(record.externalGates.every(gate => gate.status === '已完成'), 'Unverified conditions cannot enable production');
    assert.equal(record.tasks.DP40, '已完成', 'Production requires final acceptance');
  }
  if (['执行中', '待验收', '已完成'].includes(record.tasks.DP07)) {
    assert.equal(record.prerequisites.dataHandlingConfirmed, true, 'Data handling decision is not confirmed');
    assert.equal(record.prerequisites.businessConfigurationConfirmed, true, 'Business configuration is not confirmed');
  }
  return true;
}

module.exports = { validateDevelopmentRecord };
