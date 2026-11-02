'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const evidencePath = 'docs/sp01-pakomo-current-attempt-20261102.json';
const evidence = JSON.parse(fs.readFileSync(path.join(root, evidencePath), 'utf8'));
const readiness = JSON.parse(fs.readFileSync(path.join(root, 'docs/sp01-readiness-review-20261030.json'), 'utf8'));
const plan = JSON.parse(fs.readFileSync(path.join(root, 'docs/v1-executable-development-plan-20261027.json'), 'utf8'));
const markdown = fs.readFileSync(path.join(root, 'docs/v1-executable-development-plan-20261027.md'), 'utf8');

test('the current Pakomo attempt records a preflight pause without claiming a sample', () => {
  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.task, 'SP01');
  assert.equal(evidence.item, 'R04');
  assert.equal(evidence.authorization.sampleCount, 30);
  assert.equal(evidence.authorization.durationLimitSeconds, 60);
  assert.equal(evidence.profile.name, '轻度弱网');
  assert.equal(evidence.profile.scope, 'WeChat only');
  assert.equal(evidence.device.model, 'HUAWEI SEA-AL10');
  assert.equal(evidence.observation.lockScreenVisible, false);
  assert.equal(evidence.observation.vpnActive, false);
  assert.equal(evidence.sample.performed, false);
  assert.equal(evidence.sample.cloudCalls, 0);
  assert.equal(evidence.sample.databaseWrites, 0);
  assert.equal(evidence.sample.storageWrites, 0);
  assert.equal(evidence.acceptance.r04Passed, false);
  assert.equal(evidence.acceptance.sp01Passed, false);
});

test('the readiness review and executable plan link the paused attempt as evidence', () => {
  const r04 = readiness.openItems.find((item) => item.id === 'R04');
  assert.equal(r04.latestPausedPakomoAttemptEvidence, evidencePath);
  assert.ok(readiness.sources.includes(evidencePath));
  const sp01 = plan.tasks.find((task) => task.id === 'SP01');
  assert.equal(sp01.executionProgress.latestPausedPakomoAttemptEvidence, evidencePath);
  assert.equal(sp01.productAcceptancePassed, false);
  assert.match(markdown, /2026-11-02 Pakomo 弱网采样暂停/);
  assert.match(markdown, /VPN未启动、0次调用/);
});
