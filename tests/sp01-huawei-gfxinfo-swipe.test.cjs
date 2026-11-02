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

  const r03 = review.openItems.find((item) => item.id === 'R03');
  assert.ok(r03.additionalEvidence.includes('docs/sp01-huawei-gfxinfo-swipe-20261102.json'));
  assert.deepEqual(r03.latestLocalSyntheticSwipeEvidence, {
    evidence: 'docs/sp01-huawei-gfxinfo-swipe-20261102.json#automatedSelfScrollFollowUp',
    device: 'HUAWEI SEA-AL10 / Android 10',
    process: 'com.tencent.mm:appbrand0',
    controlledSwipeDurationArgumentMs: 5000,
    hostMeasuredCommandElapsedMs: 5431,
    renderedFrameCounterDelta: 194,
    jankyFrameCounterDelta: 0,
    statsReset: false,
    networkOrCloudUsed: false,
    scope: 'host-sampler-feasibility-only; not WebView FPS or product QP05',
    acceptanceEvidence: false,
  });
  assert.equal(r03.state, 'pending');
  assert.equal(review.sp01Passed, false);
  assert.equal(review.sp07Started, false);

  const sp01 = plan.tasks.find((task) => task.id === 'SP01');
  assert.equal(sp01.status, 'in-progress');
  assert.deepEqual(sp01.executionProgress.latestLocalGfxinfoSwipeProbe, {
    date: '2026-11-02',
    evidence: 'docs/sp01-huawei-gfxinfo-swipe-20261102.json',
    device: 'HUAWEI SEA-AL10 / Android 10',
    foreground: 'WeChat AppBrandUI00 / com.tencent.mm:appbrand0 ViewRoot',
    controlledSwipeDurationArgumentMs: 5000,
    hostMeasuredCommandElapsedMs: 5431,
    renderedFrameCounterDelta: 194,
    jankyFrameCounterDelta: 0,
    statsReset: false,
    networkOrCloudUsed: false,
    scope: 'host-sampler-feasibility-only; not WebView FPS or product QP05',
    acceptanceEvidence: false,
  });
  const planMarkdown = fs.readFileSync(path.join(__dirname, '../docs/v1-executable-development-plan-20261027.md'), 'utf8');
  assert.match(planMarkdown, /2026-11-02 SP01 本地设备帧采样可行性/);
  assert.match(planMarkdown, /累计帧数从2833增至3027/);
});
