'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const evidence = require('../docs/sp01-huawei-gfxinfo-swipe-20261102.json');
const review = require('../docs/sp01-readiness-review-20261030.json');
const plan = require('../docs/v1-executable-development-plan-20261027.json');

test('Huawei gfxinfo swipe evidence stays limited to host-sampler feasibility', () => {
  assert.equal(evidence.device.model, 'HUAWEI SEA-AL10');
  assert.equal(evidence.foreground.activity, 'com.tencent.mm/.plugin.appbrand.ui.AppBrandUI00');
  assert.equal(evidence.foreground.process, 'com.tencent.mm:appbrand0');
  assert.equal(evidence.before.statsSinceMonotonicNs, evidence.after.statsSinceMonotonicNs);
  assert.equal(evidence.derived.renderedFrameCounterDelta, evidence.after.totalFramesRendered - evidence.before.totalFramesRendered);
  assert.equal(evidence.derived.jankyFrameCounterDelta, evidence.after.jankyFrames - evidence.before.jankyFrames);
  assert.equal(evidence.derived.renderedFrameCounterDelta, 77);
  assert.equal(evidence.derived.jankyFrameCounterDelta, 0);
  assert.equal(evidence.method.statsWereReset, false);
  assert.equal(evidence.method.networkOrCloudUsed, false);
  assert.equal(evidence.derived.hostWindowRateIsAcceptedFps, false);
  assert.equal(evidence.acceptanceEvidence, false);
  assert.equal(evidence.sp01Passed, false);
  assert.ok(evidence.limitations.some((item) => item.includes('does not isolate WebView')));
  assert.match(evidence.officialSource.url, /^https:\/\/developer\.android\.com\//);

  const followUp = evidence.automatedSelfScrollFollowUp;
  assert.equal(followUp.device.model, 'HUAWEI SEA-AL10');
  assert.equal(followUp.device.androidVersion, '10');
  assert.equal(followUp.foreground.activityBeforeAndAfter, 'com.tencent.mm/.plugin.appbrand.ui.AppBrandUI00');
  assert.equal(followUp.foreground.sampledProcess, 'com.tencent.mm:appbrand0');
  assert.equal(followUp.method.syntheticSwipeDurationArgumentMs, 5000);
  assert.equal(followUp.method.hostMeasuredCommandElapsedMs, 5431);
  assert.equal(followUp.method.statsWereReset, false);
  assert.equal(followUp.method.networkOrCloudUsed, false);
  assert.equal(followUp.before.totalFramesRendered, 2833);
  assert.equal(followUp.after.totalFramesRendered, 3027);
  assert.equal(followUp.before.jankyFrames, 3);
  assert.equal(followUp.after.jankyFrames, 3);
  assert.equal(followUp.derived.renderedFrameCounterDelta, 194);
  assert.equal(followUp.derived.jankyFrameCounterDelta, 0);
  assert.equal(followUp.derived.hostWindowRateIsAcceptedFps, false);
  assert.equal(followUp.acceptanceEvidence, false);
  assert.equal(followUp.sp01Passed, false);

  const latestFollowUp = evidence.latestAgentTriggeredSwipeFollowUp;
  assert.equal(latestFollowUp.device.model, 'HUAWEI SEA-AL10');
  assert.equal(latestFollowUp.foreground.sampledProcess, 'com.tencent.mm:appbrand0');
  assert.equal(latestFollowUp.method.syntheticSwipeDurationArgumentMs, 5000);
  assert.equal(latestFollowUp.method.hostMeasuredCommandElapsedMs, 5472);
  assert.equal(latestFollowUp.method.statsWereReset, false);
  assert.equal(latestFollowUp.method.networkOrCloudUsed, false);
  assert.equal(latestFollowUp.method.counterDeltaWindowIncludesBeforeAndAfterQueries, true);
  assert.equal(latestFollowUp.before.totalFramesRendered, 3272);
  assert.equal(latestFollowUp.after.totalFramesRendered, 3453);
  assert.equal(latestFollowUp.before.jankyFrames, 5);
  assert.equal(latestFollowUp.after.jankyFrames, 5);
  assert.equal(latestFollowUp.derived.renderedFrameCounterDelta, 181);
  assert.equal(latestFollowUp.derived.jankyFrameCounterDelta, 0);
  assert.equal(latestFollowUp.derived.hostWindowRateIsAcceptedFps, false);
  assert.equal(latestFollowUp.acceptanceEvidence, false);
  assert.equal(latestFollowUp.sp01Passed, false);
  assert.ok(latestFollowUp.limitations.some((item) => item.includes('No input-event timestamps')));

  const r03 = review.openItems.find((item) => item.id === 'R03');
  assert.ok(r03.additionalEvidence.includes('docs/sp01-huawei-gfxinfo-swipe-20261102.json'));
  assert.deepEqual(r03.latestLocalSyntheticSwipeEvidence, {
    evidence: 'docs/sp01-huawei-gfxinfo-swipe-20261102.json#latestAgentTriggeredSwipeFollowUp',
    device: 'HUAWEI SEA-AL10 / Android 10',
    process: 'com.tencent.mm:appbrand0',
    controlledSwipeDurationArgumentMs: 5000,
    hostMeasuredCommandElapsedMs: 5472,
    renderedFrameCounterDelta: 181,
    jankyFrameCounterDelta: 0,
    statsReset: false,
    networkOrCloudUsed: false,
    scope: 'host-sampler-feasibility-only; delta window also includes counter queries; not WebView FPS or product QP05',
    acceptanceEvidence: false,
  });
  assert.equal(r03.state, 'pending');
  assert.equal(review.sp01Passed, false);
  assert.equal(review.sp07Started, false);

  const sp01 = plan.tasks.find((task) => task.id === 'SP01');
  assert.equal(sp01.status, 'in-progress');
  assert.deepEqual(sp01.executionProgress.latestLocalGfxinfoSwipeProbe, {
    date: '2026-11-02',
    evidence: 'docs/sp01-huawei-gfxinfo-swipe-20261102.json#latestAgentTriggeredSwipeFollowUp',
    device: 'HUAWEI SEA-AL10 / Android 10',
    foreground: 'WeChat AppBrandUI00 / com.tencent.mm:appbrand0 ViewRoot',
    controlledSwipeDurationArgumentMs: 5000,
    hostMeasuredCommandElapsedMs: 5472,
    renderedFrameCounterDelta: 181,
    jankyFrameCounterDelta: 0,
    statsReset: false,
    networkOrCloudUsed: false,
    scope: 'host-sampler-feasibility-only; delta window also includes counter queries; not WebView FPS or product QP05',
    acceptanceEvidence: false,
  });
  const planMarkdown = fs.readFileSync(path.join(__dirname, '../docs/v1-executable-development-plan-20261027.md'), 'utf8');
  assert.match(planMarkdown, /2026-11-02 SP01 本地设备帧采样可行性/);
  assert.match(planMarkdown, /累计帧数从2833增至3027/);
  assert.match(planMarkdown, /夹住手势的累计帧计数从3272增至3453/);
});

test('Huawei SurfaceFlinger alternating swipe is recorded as host-only sampler feasibility', () => {
  const sample = evidence.surfaceFlingerAlternatingSwipeProbe;
  assert.equal(sample.device.model, 'HUAWEI SEA-AL10');
  assert.equal(sample.method.tool, 'SurfaceFlinger TimeStats');
  assert.equal(sample.method.gesturePattern, 'four alternating up/down cycles');
  assert.equal(sample.method.gestureCount, 8);
  assert.equal(sample.method.durationArgumentMsPerGesture, 600);
  assert.equal(sample.method.hostMeasuredCommandElapsedMs, 7340);
  assert.equal(sample.method.statsWereClearedBeforeCapture, true);
  assert.equal(sample.method.timeStatsDisabledAfterCapture, true);
  assert.equal(sample.method.networkOrCloudUsed, false);
  assert.equal(sample.display.userConfirmedSelectedRefreshRateHz, 60);
  assert.equal(sample.display.surfaceFlingerReportedRefreshRateHz, 60.000002);
  assert.equal(sample.layer.name, 'com.tencent.mm/com.tencent.mm.plugin.appbrand.ui.AppBrandUI00#0');
  assert.equal(sample.layer.totalFrames, 363);
  assert.equal(sample.layer.droppedFrames, 0);
  assert.equal(sample.layer.averageFps, 61.787);
  assert.deepEqual(sample.layer.presentToPresentHistogramMs, { '16': 361, '33': 1, '66': 1 });
  assert.equal(sample.derived.maximumAdjacentIntervalMs, 66);
  assert.equal(sample.derived.webViewFramesIsolated, false);
  assert.equal(sample.derived.scrollDisplacementIndependentlyVerified, false);
  assert.equal(sample.acceptanceEvidence, false);
  assert.equal(sample.sp01Passed, false);

  const r03 = review.openItems.find((item) => item.id === 'R03');
  assert.ok(r03.additionalEvidence.includes('docs/sp01-huawei-gfxinfo-swipe-20261102.json'));
  assert.equal(r03.latestSurfaceFlingerSwipeEvidence.evidence, 'docs/sp01-huawei-gfxinfo-swipe-20261102.json#surfaceFlingerAlternatingSwipeProbe');
  assert.equal(r03.latestSurfaceFlingerSwipeEvidence.averageFps, 61.787);
  assert.equal(r03.latestSurfaceFlingerSwipeEvidence.acceptanceEvidence, false);
  assert.equal(r03.state, 'pending');
  assert.equal(review.sp01Passed, false);
  assert.equal(review.sp07Started, false);

  const sp01 = plan.tasks.find((task) => task.id === 'SP01');
  assert.equal(sp01.status, 'in-progress');
  assert.equal(sp01.executionProgress.latestSurfaceFlingerSwipeProbe.evidence, 'docs/sp01-huawei-gfxinfo-swipe-20261102.json#surfaceFlingerAlternatingSwipeProbe');
  assert.equal(sp01.executionProgress.latestSurfaceFlingerSwipeProbe.acceptanceEvidence, false);
  const reviewMarkdown = fs.readFileSync(path.join(__dirname, '../docs/sp01-readiness-review-20261030.md'), 'utf8');
  const planMarkdown = fs.readFileSync(path.join(__dirname, '../docs/v1-executable-development-plan-20261027.md'), 'utf8');
  assert.match(reviewMarkdown, /复用 Android 内置 SurfaceFlinger TimeStats/);
  assert.match(reviewMarkdown, /363帧/);
  assert.match(planMarkdown, /Android 内置 SurfaceFlinger TimeStats/);
});
