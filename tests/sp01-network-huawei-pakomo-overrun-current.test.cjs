'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const evidencePath = 'docs/sp01-network-huawei-pakomo-overrun-current-20261102.json';
const evidence = JSON.parse(fs.readFileSync(path.join(root, evidencePath), 'utf8'));
const readiness = JSON.parse(fs.readFileSync(path.join(root, 'docs/sp01-readiness-review-20261030.json'), 'utf8'));
const plan = JSON.parse(fs.readFileSync(path.join(root, 'docs/v1-executable-development-plan-20261027.json'), 'utf8'));

test('the latest Huawei Pakomo sample preserves the 60-second overrun as diagnostic-only evidence', () => {
  assert.equal(evidence.task, 'SP01');
  assert.equal(evidence.item, 'R04');
  assert.equal(evidence.authorization.maximumDurationMs, 60_000);
  assert.equal(evidence.sample.attempts, 30);
  assert.equal(evidence.sample.succeeded, 30);
  assert.equal(evidence.sample.failed, 0);
  assert.equal(evidence.sample.medianMs, 397);
  assert.equal(evidence.sample.p95Ms, 732);
  assert.equal(evidence.sample.maxMs, 3_046);
  assert.equal(evidence.sample.rawElapsedSamplesRetained, false);

  assert.equal(evidence.pakomo.startTimestampEpochMs, 1_793_605_710_543);
  assert.equal(evidence.pakomo.stopTimestampEpochMs, 1_793_606_078_894);
  assert.equal(evidence.pakomo.controlResponseIntervalMs, 368_351);
  assert.equal(evidence.pakomo.authorizationOverrunMs, 308_351);
  assert.equal(evidence.pakomo.withinAuthorizationWindow, false);
  assert.equal(evidence.pakomo.stopConfirmed, true);
  assert.equal(evidence.pakomo.activeAfterStop, false);

  assert.equal(evidence.afterRun.validatedWifi, true);
  assert.equal(evidence.afterRun.vpnNetworkAgentFound, false);
  assert.equal(evidence.afterRun.databaseWrites, 0);
  assert.equal(evidence.afterRun.storageWrites, 0);
  assert.equal(evidence.afterRun.cloudDeployments, 0);
  assert.equal(evidence.acceptance.r04Passed, false);
  assert.equal(evidence.acceptance.sp01Passed, false);
  assert.equal(evidence.acceptance.diagnosticOnly, true);
});

test('the later USB-only awake setting and evidence links are current without changing the ten-minute timeout', () => {
  assert.equal(evidence.followUpDeviceSetting.stayOnWhilePluggedIn, 2);
  assert.equal(evidence.followUpDeviceSetting.usbPowered, true);
  assert.equal(evidence.followUpDeviceSetting.mStayOn, true);
  assert.equal(evidence.followUpDeviceSetting.screenOffTimeoutMs, 600_000);

  const screenshotPath = path.join(root, evidence.summaryScreenshot.path);
  const screenshotHash = crypto.createHash('sha256').update(fs.readFileSync(screenshotPath)).digest('hex');
  assert.equal(screenshotHash, evidence.summaryScreenshot.sha256);

  const r04 = readiness.openItems.find((item) => item.id === 'R04');
  assert.equal(r04.state, 'pending');
  assert.equal(r04.latestPakomoDiagnosticOnlySampleEvidence, evidencePath);
  assert.ok(r04.evidence.split('; ').includes(evidencePath));
  assert.ok(readiness.sources.includes(evidencePath));
  assert.equal(readiness.sp01Passed, false);

  const sp01 = plan.tasks.find((item) => item.id === 'SP01');
  assert.equal(sp01.executionProgress.latestPakomoDiagnosticOnlySampleEvidence, evidencePath);
  assert.equal(sp01.productAcceptancePassed, false);
  assert.equal(plan.firstProductTask, 'SP07');
});
