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

  const r03 = review.openItems.find((item) => item.id === 'R03');
  assert.ok(r03.additionalEvidence.includes('docs/sp01-huawei-gfxinfo-swipe-20261102.json'));
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
    hostMeasuredCommandElapsedMs: 5723,
    renderedFrameCounterDelta: 77,
    jankyFrameCounterDelta: 0,
    statsReset: false,
    networkOrCloudUsed: false,
    scope: 'host-sampler-feasibility-only; not WebView FPS or product QP05',
    acceptanceEvidence: false,
  });
  const planMarkdown = fs.readFileSync(path.join(__dirname, '../docs/v1-executable-development-plan-20261027.md'), 'utf8');
  assert.match(planMarkdown, /2026-11-02 SP01 本地设备帧采样可行性/);
});
