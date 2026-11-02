'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const evidencePath = 'docs/sp01-network-huawei-pakomo-screen-sleep-follow-up-20261102.json';
const evidence = require(path.join(root, evidencePath));
const plan = require(path.join(root, 'docs/v1-executable-development-plan-20261027.json'));
const review = require(path.join(root, 'docs/sp01-readiness-review-20261030.json'));

test('SP01 screen-sleep follow-up is reproducibly recorded as diagnostic-only', () => {
  assert.equal(evidence.task, 'SP01');
  assert.equal(evidence.item, 'R04');
  assert.equal(evidence.authorization.maximumDurationMs, 60000);
  assert.equal(evidence.pakomo.controlResponseIntervalMs, 72779);
  assert.equal(evidence.pakomo.authorizationOverrunMs, 12779);
  assert.equal(evidence.pakomo.withinAuthorizationWindow, false);
  assert.equal(evidence.pakomo.stopConfirmed, true);
  assert.equal(evidence.sample.attempts, 30);
  assert.equal(evidence.sample.succeeded, 30);
  assert.equal(evidence.sample.failed, 0);
  assert.equal(evidence.sample.medianMs, 401);
  assert.equal(evidence.sample.p95Ms, 726);
  assert.equal(evidence.sample.maxMs, 1897);
  assert.equal(evidence.afterRun.validatedWifi, true);
  assert.equal(evidence.afterRun.notVpnTransport, true);
  assert.equal(evidence.afterRun.vpnNetworkAgentFound, false);
  assert.equal(evidence.afterRun.databaseWrites, 0);
  assert.equal(evidence.afterRun.storageWrites, 0);
  assert.equal(evidence.afterRun.cloudDeployments, 0);
  assert.equal(evidence.displayPower.screenOffTimeoutBeforeMs, 1800000);
  assert.equal(evidence.displayPower.screenOffTimeoutAfterMs, 7200000);
  assert.equal(evidence.displayPower.usbPowered, true);
  assert.equal(evidence.displayPower.stayOn, true);
  assert.equal(evidence.interpretation.diagnosticOnly, true);
  assert.equal(evidence.interpretation.provesPerRequestShaping, false);
  assert.equal(evidence.interpretation.provesLinkRttThroughputJitterOrLoss, false);
  assert.equal(evidence.acceptance.r04Passed, false);
  assert.equal(evidence.acceptance.sp01Passed, false);

  for (const screenshot of evidence.screenshots) {
    const bytes = fs.readFileSync(path.join(root, screenshot.path));
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
    assert.equal(sha256, screenshot.sha256);
    assert.ok(plan.sources.includes(screenshot.path));
    assert.ok(review.sources.includes(screenshot.path));
  }
  assert.ok(plan.sources.includes(evidencePath));
  assert.ok(review.sources.includes(evidencePath));
  assert.ok(plan.tasks.find(x => x.id === 'SP01').executionProgress.completedChecks.some(x => x.includes('72779ms') && x.includes('12779ms')));
  assert.equal(plan.tasks.find(x => x.id === 'SP01').executionProgress.latestPakomoScreenSleepFollowUpDiagnosticEvidence, evidencePath);
  assert.equal(review.openItems.find(x => x.id === 'R04').state, 'pending');
  assert.equal(review.openItems.find(x => x.id === 'R04').latestScreenSleepRelatedDiagnosticEvidence, evidencePath);
  assert.equal(review.sp01Passed, false);
});
