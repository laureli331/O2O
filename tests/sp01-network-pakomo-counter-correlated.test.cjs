'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { summarizeSamples } = require('../tools/sp01-network-probe/summarize.cjs');

const evidencePath = 'docs/sp01-network-huawei-pakomo-counter-correlated-20261102.json';
const evidence = require(`../${evidencePath}`);
const review = require('../docs/sp01-readiness-review-20261030.json');
const r04 = review.openItems.find(item => item.id === 'R04');

test('R04 records the latest Huawei Pakomo sample with in-run status counters', () => {
  assert.ok(review.sources.includes(evidencePath));
  assert.ok(r04.evidence.split('; ').includes(evidencePath));
  assert.equal(r04.latestCounterCorrelatedSampleEvidence, evidencePath);
  assert.equal(evidence.authorization.maximumVpnDurationMs, 60_000);
  assert.equal(evidence.pakomo.startResponse.confirmed, true);
  assert.equal(evidence.pakomo.startResponse.stage, 'forwarding');
  assert.equal(evidence.pakomo.startResponse.active, true);
  assert.equal(evidence.pakomo.startResponse.appliedRule, 'light');
  assert.equal(evidence.pakomo.stopResponse.confirmedInactive, true);
  assert.equal(evidence.pakomo.stopResponse.active, false);
  assert.equal(evidence.pakomo.applicationScope, 'applications');
  assert.equal(evidence.pakomo.statusDuringSample.pollCount, 22);

  const statusSeriesPath = path.resolve(__dirname, '..', evidence.pakomo.statusDuringSample.sourceFile);
  assert.ok(fs.existsSync(statusSeriesPath));
  const statusSeriesBytes = fs.readFileSync(statusSeriesPath);
  assert.equal(
    crypto.createHash('sha256').update(statusSeriesBytes).digest('hex').toUpperCase(),
    evidence.evidence.statusSeriesSha256
  );
  const polls = JSON.parse(statusSeriesBytes.toString('utf8')).samples;
  assert.equal(polls.length, 22);
  assert.ok(polls.every(poll => poll.active === true && poll.stage === 'forwarding'));
  assert.ok(polls.every(poll => poll.activeFlows > 0));
  assert.ok(polls.every(poll => poll.dropped === 0));
  assert.equal(polls[0].delayed, 66);
  assert.equal(polls.at(-1).delayed, 126);
  assert.ok(polls.every((poll, index) => index === 0 || poll.delayed >= polls[index - 1].delayed));

  const sample = evidence.sample;
  assert.equal(sample.rawElapsedMs.length, 30);
  assert.ok(sample.rawElapsedMs.every(value => Number.isFinite(value) && value >= 0));
  const recomputed = summarizeSamples(sample.rawElapsedMs.map(elapsedMs => ({ ok: true, elapsedMs })));
  assert.deepEqual(recomputed, sample.summary);
  assert.equal(sample.summary.succeeded, 30);
  assert.equal(sample.summary.failed, 0);
  assert.equal(sample.summary.medianMs, 393);
  assert.equal(sample.summary.p95Ms, 1181);
  assert.equal(sample.summary.maxMs, 2048);

  assert.equal(evidence.after.validatedWifi, true);
  assert.equal(evidence.after.vpnNetworkAgentFound, false);
  assert.equal(sample.databaseOrStorageWrites, false);
  assert.equal(evidence.interpretation.statusCountersCorrelatedWithRun, true);
  assert.equal(evidence.interpretation.provesPerRequestShaping, false);
  assert.equal(evidence.interpretation.provesExactImpairmentParameters, false);
  assert.equal(evidence.r04Passed, false);
  assert.equal(evidence.sp01Passed, false);
  assert.equal(r04.state, 'pending');

  for (const screenshot of evidence.evidence.screenshots) {
    const screenshotPath = path.resolve(__dirname, '..', screenshot.path);
    assert.ok(fs.existsSync(screenshotPath));
    assert.equal(
      crypto.createHash('sha256').update(fs.readFileSync(screenshotPath)).digest('hex').toUpperCase(),
      screenshot.sha256
    );
  }
  const reviewMarkdown = fs.readFileSync(path.resolve(__dirname, '../docs/sp01-readiness-review-20261030.md'), 'utf8');
  assert.match(reviewMarkdown, /最新新增一轮22次状态轮询与30次只读采样重叠[\s\S]*?30\/30[\s\S]*?P50=393ms[\s\S]*?P95=1181ms/);
});
