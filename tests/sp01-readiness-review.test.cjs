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
      assert.equal(capability.revisedProbeRetests.length, 3);
      const firstRetest = capability.revisedProbeRetests.find((run) => run.id === 'DEVICE01-REVISED-1');
      assert.equal(firstRetest.probeCommit, 'aa61c9a');
      assert.equal(firstRetest.reportedEntryRowCount, 20);
      const retest = capability.revisedProbeRetests.find((run) => run.id === 'DEVICE01-DURATION-FIX-1');
      assert.ok(retest, 'the corrected formatter has a fresh OPPO report');
      assert.equal(retest.probeCommit, '6c4636a');
      assert.equal(retest.reportedEntryRowCount, 20);
      assert.deepEqual(retest.entryTypeCounts, { script: 1, navigation: 2, render: 10, interaction: 6, loadPackage: 1, resource: 0 });
      assert.equal(retest.recognizedEntryCount, 10);
      assert.deepEqual(retest.unrecognizedEntryCountsByType, { render: 4, interaction: 6 });
      assert.equal(retest.rowsWithDisplayedDurationCount, 14);
      assert.equal(retest.rowsWithoutDisplayedDurationCount, 6);
      assert.equal(retest.routeDurationMissing, true);
      assert.equal(retest.mergedSourcesMayDuplicateRows, true);
      assert.deepEqual(retest.unrecognizedDurationSamplesMsByType, { render: [569, 560, 569, 560], interaction: [4, 1, 1, 4, 1, 1] });
      assert.equal(retest.fpsOrFrameMetricReported, false);
      assert.equal(retest.cloudOrNetworkUsed, false);
      const snapshotRetest = capability.revisedProbeRetests.find((run) => run.id === 'DEVICE01-SNAPSHOT-FIX-1');
      assert.equal(snapshotRetest.probeCommitRequested, '7e9ba98');
      assert.equal(snapshotRetest.probeRevisionEmbeddedInReport, false);
      assert.equal(snapshotRetest.reportedEntryRowCount, 10);
      assert.deepEqual(snapshotRetest.entryTypeCounts, { script: 1, navigation: 2, render: 5, interaction: 2, loadPackage: 0, resource: 0 });
      assert.equal(snapshotRetest.recognizedEntryCount, 7);
      assert.deepEqual(snapshotRetest.unrecognizedEntryCountsByType, { render: 1, interaction: 2 });
      assert.deepEqual(snapshotRetest.unrecognizedDurationSamplesMsByType, { render: [591], interaction: [4, 1] });
      assert.equal(snapshotRetest.rowsWithDisplayedDurationCount, 6);
      assert.equal(snapshotRetest.rowsWithoutDisplayedDurationCount, 4);
      assert.equal(snapshotRetest.routeDurationMissing, true);
      assert.equal(snapshotRetest.visibleRepeatedTypeDurationPatterns, false);
      assert.equal(snapshotRetest.fpsOrFrameMetricReported, false);
      assert.equal(snapshotRetest.cloudOrNetworkUsed, false);
      assert.equal(capability.fpsMeasurementResearch.status, 'System Tracing is not exposed in the checked Huawei menu; official GPU Rendering fallback found but not validated against the mini-program or acceptance metrics');
      assert.equal(capability.fpsMeasurementResearch.androidCandidate.bestAvailableDevice, 'DEVICE04 HUAWEI SEA-AL10, Android 10, user-selected 60Hz');
      assert.match(capability.fpsMeasurementResearch.androidCandidate.deviceAvailability, /did not find System Tracing/);
      assert.equal(capability.fpsMeasurementResearch.androidCandidate.unverified.length, 2);
      assert.match(capability.fpsMeasurementResearch.gpuRenderingFallback.method, /Profile GPU Rendering/);
      assert.equal(capability.fpsMeasurementResearch.gpuRenderingFallback.unverified.length, 3);
      assert.match(capability.fpsMeasurementResearch.iosCandidate.limitation, /Windows 11 environment/);
      assert.equal(capability.sources.androidOnDeviceSystemTracing, 'https://developer.android.com/topic/performance/tracing/on-device');
      assert.equal(capability.sources.androidUiJankDetection, 'https://developer.android.com/studio/profile/jank-detection');
      assert.equal(capability.sources.androidGpuRendering, 'https://developer.android.com/topic/performance/rendering/inspect-gpu-rendering');
      assert.equal(capability.sources.perfettoLocalUi, 'https://perfetto.dev/docs/getting-started/system-tracing');
      assert.equal(capability.fpsToolMenu.userReportedPresent, false);
      assert.equal(capability.systemTracingMenu.userReportedPresent, false);
      assert.equal(capability.runtimeVersionDiscrepancies[0].status, 'unresolved');
      assert.equal(capability.localTests.realPhoneRuns, '4 unique devices; 7 user-provided capability reports including three revised OPPO retests');
      assert.equal(capability.localTests.freshEntriesAfterRevisedProbe, 'OPPO returned 10 rows after snapshot-source correction was requested; visible repeated type/duration patterns are absent; report does not embed source revision; route duration and FPS remain unresolved');
      assert.equal(capability.freshEntryFollowUp.oneDeviceRetest, 'OPPO snapshot-source retest supplied: 10 rows, visible repeats absent; route duration and FPS remain unresolved');
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
