'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { summarizeSamples } = require('../tools/sp01-network-probe/summarize.cjs');

const evidencePath = 'docs/sp01-network-huawei-pakomo-bounded-20261102.json';
const evidence = require(`../${evidencePath}`);
const review = require('../docs/sp01-readiness-review-20261030.json');
const r04 = review.openItems.find(item => item.id === 'R04');

test('R04 records the latest bounded Pakomo sample and its evidence boundaries', () => {
  assert.ok(review.sources.includes(evidencePath));
  assert.ok(fs.existsSync(path.resolve(__dirname, '..', evidence.summaryScreenshot)));
  assert.ok(r04.evidence.split('; ').includes(evidencePath));
  assert.equal(r04.latestBoundedPakomoSampleEvidence, evidencePath);
  assert.equal(evidence.authorization.maximumVpnDurationMs, 60_000);
  assert.equal(evidence.run.pakomo.startResponse.confirmed, true);
  assert.equal(evidence.run.pakomo.startResponse.active, true);
  assert.equal(evidence.run.pakomo.stopResponse.confirmedInactive, true);
  assert.equal(evidence.run.pakomo.stopResponse.active, false);
  assert.equal(evidence.run.pakomo.applicationScope, 'applications');
  assert.equal(evidence.run.pakomo.profile, 'light');
  assert.equal(evidence.run.sample.selectedPageAtStart, 'SP01 network sampling page');
  assert.equal(evidence.run.sample.databaseOrStorageWrites, false);
  assert.equal(evidence.run.after.validatedWifi, true);
  assert.equal(evidence.run.after.vpnNetworkAgentFound, false);
  assert.equal(evidence.run.after.internetReachabilitySeparatelyTested, false);

  const sample = evidence.run.sample;
  assert.equal(sample.rawElapsedMs.length, 30);
  assert.ok(sample.rawElapsedMs.every(value => Number.isFinite(value) && value >= 0));
  const recomputed = summarizeSamples(sample.rawElapsedMs.map(elapsedMs => ({ ok: true, elapsedMs })));
  assert.deepEqual(recomputed, sample.summary);
  assert.equal(sample.summary.succeeded, 30);
  assert.equal(sample.summary.failed, 0);
  assert.equal(sample.summary.medianMs, 405);
  assert.equal(sample.summary.p95Ms, 588);
  assert.equal(sample.summary.maxMs, 725);

  const run = evidence.run;
  assert.equal(run.pakomo.startResponse.timestampEpochMs, 1_793_597_561_298);
  assert.equal(run.pakomo.stopResponse.timestampEpochMs, 1_793_597_587_298);
  assert.equal(run.pakomo.stopResponse.timestampEpochMs - run.pakomo.startResponse.timestampEpochMs, 26_000);
  assert.equal(run.pakomo.controlResponseIntervalMs, 26_000);
  assert.equal(run.pakomo.controlResponseIntervalWithinAuthorization, true);
  assert.equal(evidence.previousOutOfWindowAttempt.observedControlResponseIntervalMs, 113_102);
  assert.equal(evidence.previousOutOfWindowAttempt.acceptanceEligible, false);
  assert.equal(evidence.interpretation.provesPerRequestShaping, false);
  assert.equal(evidence.interpretation.provesExactImpairmentParameters, false);
  assert.equal(evidence.r04Passed, false);
  assert.equal(evidence.sp01Passed, false);
  assert.equal(r04.state, 'pending');
  assert.match(r04.nextAction, /independent link measures.*interrupted-request behavior.*public[- ]Wi-Fi/i);

  const reviewMarkdown = fs.readFileSync(path.resolve(__dirname, '../docs/sp01-readiness-review-20261030.md'), 'utf8');
  assert.match(reviewMarkdown, /2026-11-02 后续限时关联采样：[\s\S]*?26秒[\s\S]*?30\/30[\s\S]*?405ms[\s\S]*?588ms/);
});
