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
    } else if (item.id === 'R01') {
      const candidate = require('../docs/sp01-maintenance-candidate-20261030.json');
      assert.equal(candidate.adopted, true);
      assert.equal(candidate.audit.after.total, 32);
      assert.match(item.known, /已采用.*32条/);
    } else if (item.id === 'R03') {
      const capability = require('../docs/sp01-device-capability-20261030.json');
      assert.equal(item.state, 'pending');
      assert.equal(item.evidence, 'docs/sp01-device-capability-20261030.json');
      assert.equal(capability.documentedRuntimeCapabilities.apiCanProveLiveFps, false);
      assert.equal(capability.realDeviceRuns.length, 4);
      assert.ok(capability.realDeviceRuns.every((run) => run.renderer === 'webview'));
      assert.ok(capability.realDeviceRuns.every((run) => run.performanceApiAvailable && run.observerRegistered));
      assert.ok(capability.realDeviceRuns.every((run) => run.supportedEntryTypes.join(',') === 'interaction,loadPackage,navigation,render,resource,script'));
      assert.ok(capability.realDeviceRuns.every((run) => run.currentEntries === 'not-provided'));
      const retest = capability.revisedProbeRetests.find((run) => run.deviceId === 'DEVICE01');
      assert.ok(retest, 'the revised probe has a fresh OPPO report');
      assert.equal(retest.probeCommit, 'aa61c9a');
      assert.equal(retest.currentEntryCount, 20);
      assert.deepEqual(retest.entryTypeCounts, { script: 1, navigation: 1, render: 11, interaction: 7, loadPackage: 0, resource: 0 });
      assert.equal(retest.recognizedEntryCount, 4);
      assert.deepEqual(retest.unrecognizedEntryCountsByType, { render: 9, interaction: 7 });
      assert.equal(retest.entriesWithoutDurationCount, 20);
      assert.equal(retest.fpsOrFrameMetricReported, false);
      assert.equal(retest.cloudOrNetworkUsed, false);
      assert.equal(capability.fpsToolMenu.userReportedPresent, false);
      assert.equal(capability.runtimeVersionDiscrepancies[0].status, 'unresolved');
      assert.equal(capability.localTests.realPhoneRuns, '4 unique devices; 5 user-provided capability reports including one revised OPPO retest');
      assert.equal(capability.localTests.freshEntriesAfterRevisedProbe, 'completed on OPPO: 20 entries, no durations or FPS/frame metric');
      assert.equal(capability.freshEntryFollowUp.oneDeviceRetest, 'completed on OPPO PLJ110 using the revised probe');
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
