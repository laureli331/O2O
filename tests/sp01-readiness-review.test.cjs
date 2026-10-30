'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const review = require('../docs/sp01-readiness-review-20261030.json');
const quality = require('../docs/v1-quality-acceptance-20261027.json');
const plan = require('../docs/v1-executable-development-plan-20261027.json');

test('SP01 current review covers the exact contract criteria without silently removing pending preparation', () => {
  const contract = quality.taskContracts.find(x => x.task === 'SP01');
  const criteria = review.qualityReview.flatMap(row => row.criteria);
  assert.deepEqual([...criteria].sort(), [...contract.qualityCriteria].sort());
  assert.equal(new Set(criteria).size, criteria.length);
  assert.deepEqual(review.datasetShapesInherited, quality.measurement.datasetShapes);
  const items = new Set(review.openItems.map(x => x.id));
  assert.equal(items.size, 6);
  for (const row of review.qualityReview) {
    assert.equal(row.productResult, 'not-executed');
    for (const id of row.openItems) assert.ok(items.has(id));
    for (const id of row.laterEvidenceTasks || []) assert.ok(plan.tasks.some(task => task.id === id));
  }
  for (const item of review.openItems) {
    if (item.id === 'R02') {
      assert.equal(item.state, 'verified-for-SP01');
      assert.equal(item.verificationScope, 'SP01-isolated-compatibility-only');
      const evidence = require('../' + item.evidence);
      assert.equal(evidence.checks.sharedFullStrictExitCode, 0);
      assert.equal(evidence.simulator.resetCount0Observed, true);
      assert.equal(evidence.productAcceptancePassed, false);
    } else assert.ok(['pending', 'awaiting-user'].includes(item.state));
    assert.ok(item.nextAction.length > 20);
  }
});

test('SP01 review preserves gates, source files and historical evidence boundaries', () => {
  for (const file of review.sources) assert.ok(fs.existsSync(path.resolve(__dirname, '..', file)), file);
  assert.equal(review.e06GatePassed, false);
  assert.equal(review.sp01Passed, false);
  assert.equal(review.sp07Started, false);
  assert.equal(review.productAcceptancePassed, false);
  assert.equal(review.existingPlanAndQualityThresholdsChanged, false);
  assert.equal(review.knownFacts.currentCloudStateRequeried, false);
  assert.equal(review.knownFacts.historicalDirectDownloadCodeAttributed, false);
  assert.equal(review.openItems.find(x => x.id === 'R01').vulnerabilityReproductionAuthorizedByThisReview, false);
  assert.equal(review.openItems.find(x => x.id === 'R06').newCloudActionAuthorizedByThisReview, false);
  const platform = require('../docs/sp02-platform-evidence-20261027.json');
  const findGate = value => {
    if (!value || typeof value !== 'object') return undefined;
    if (value.id === 'E06') return value;
    for (const child of Object.values(value)) {
      const found = findGate(child);
      if (found) return found;
    }
  };
  const gate = findGate(platform);
  assert.equal(gate.gatePassed, false);
  assert.equal(gate.currentReview.historicalFieldsRetainedBelow, true);
  assert.equal(gate.currentReview.data, 'docs/sp01-readiness-review-20261030.json');
});
