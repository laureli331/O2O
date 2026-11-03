'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { summarizeSamples } = require('../tools/sp01-network-probe/summarize.cjs');

test('R04 network profile method keeps Cloudflare link results separate from CloudBase round trips', () => {
  const source = fs.readFileSync(path.join(__dirname, '../docs/sp01-network-profile-method-20261031.md'), 'utf8');
  assert.match(source, /speed\.cloudflare\.com/);
  assert.match(source, /手机到 Cloudflare/);
  assert.match(source, /不能换算成链路 RTT、上下行、抖动或丢包/);
  assert.match(source, /公共 Wi-Fi 单列/);
  assert.match(source, /sp01-network-huawei-pakomo-light-20261102\.json/);
  assert.match(source, /sp01-network-huawei-normal-20261102\.json/);
  assert.match(source, /sp01-network-huawei-paired-reruns-20261102\.json/);
  assert.match(source, /轻度弱网381\.83ms/);
  assert.match(source, /不能确认具体参数已生效/);
  assert.match(source, /sp01-pakomo-current-device-snapshot-20261102\.json/);
  assert.match(source, /不能回溯证明六轮采样时 VPN/);
  assert.match(source, /sp01-network-huawei-cloudflare-4g-20261103\.json/);
  assert.match(source, /sp01-network-huawei-cloudflare-4g-round2-20261103\.json/);
  assert.match(source, /sp01-network-huawei-cloudflare-4g-round3-20261103\.json/);
  assert.match(source, /下载12\.7Mbps、上传15\.8Mbps/);
  assert.match(source, /第二轮下载3\.57Mbps、上传14\.3Mbps/);
  assert.match(source, /R04 与 SP01 仍待完成/);
});

test('Huawei reported-4g evidence retains raw samples and independently matches the supplied summary', () => {
  const evidencePath = 'docs/sp01-network-huawei-cellular-4g-20261103.json';
  const evidence = require(`../${evidencePath}`);
  const values = [1747, 644, 330, 329, 379, 317, 319, 283, 949, 308, 377, 326, 576, 409, 318, 377, 314, 330, 313, 391, 333, 322, 314, 327, 395, 310, 301, 342, 321, 317];
  const recomputed = summarizeSamples(evidence.samples);

  assert.deepEqual(evidence.samples.map(sample => sample.elapsedMs), values);
  assert.ok(evidence.samples.every(sample => sample.ok));
  assert.equal(evidence.networkCondition.networkTypeReportedByProbe, '4g');
  assert.equal(evidence.networkCondition.independentlyVerified, false);
  assert.equal(evidence.networkCondition.pakomoOrVpnState, 'unknown');
  assert.equal(evidence.scope, 'application-roundtrip-not-link-rtt-or-packet-loss');
  assert.deepEqual(recomputed, evidence.userReportedSummary);
  assert.deepEqual(recomputed, evidence.independentlyRecomputed);
  assert.equal(evidence.runDurationRecorded, false);
  assert.equal(evidence.r04Passed, false);
  assert.equal(evidence.sp01Passed, false);

  const readiness = require('../docs/sp01-readiness-review-20261030.json');
  const r04 = readiness.openItems.find(item => item.id === 'R04');
  assert.equal(r04.latestCellularNetworkSampleEvidence, evidencePath);
  assert.ok(r04.evidence.split('; ').includes(evidencePath));
  assert.ok(readiness.sources.includes(evidencePath));
  assert.equal(r04.state, 'pending');
  assert.equal(readiness.sp01Passed, false);

  const review = fs.readFileSync(path.join(__dirname, '../docs/sp01-readiness-review-20261030.md'), 'utf8');
  assert.match(review, /华为探针报告4G.*30\/30.*P50 327ms.*P95 949ms.*最大1747ms/);
  assert.match(review, /VPN\/Pakomo状态和精确时长未记录/);
});

test('R04 records user-reported app-scope isolation without claiming measured weak-network effect', () => {
  const source = fs.readFileSync(path.join(__dirname, '../docs/sp01-weak-network-tool-review-20261031.md'), 'utf8');
  assert.match(source, /Pakomo v0\.3\.0/);
  assert.match(source, /6798549060990f9bdcb7a9feedbe16259ee95d9d/);
  assert.match(source, /GPL-3\.0/);
  assert.match(source, /Android 10/);
  assert.match(source, /仅微信/);
  assert.match(source, /官方发布 APK/);
  assert.match(source, /尚未在华为备用机实测/);
  assert.match(source, /安装如获另行确认/);
  assert.match(source, /没有运行官方发布 APK、没有生成 APK、没有安装/);
  assert.match(source, /固定提交的构建入口审查/);
  assert.match(source, /未配置 `distributionSha256Sum`/);
  assert.match(source, /用户于 2026-11-01 授权在隔离目录准备官方工具并尝试本地调试构建/);
  assert.match(source, /`build-tools;35\.0\.0`/);
  assert.match(source, /`platforms;android-36`/);
  assert.match(source, /dry-run 未执行 Android 编译\/打包任务/);
  assert.match(source, /20f1b1176237254a6fc204d8434196fa11a4cfb387567519c61556e8710aed78/);
  assert.match(source, /90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a/);
  assert.match(source, /Android SDK 许可仍由用户自行审阅和接受/);
  assert.match(source, /不授权悬浮窗/);

  const readiness = require('../docs/sp01-readiness-review-20261030.json');
  const r04 = readiness.openItems.find(item => item.id === 'R04');
  assert.equal(r04.state, 'pending');
  assert.equal(readiness.sp01Passed, false);
  assert.equal(r04.latestBoundedPakomoSampleEvidence, 'docs/sp01-network-huawei-pakomo-bounded-20261102.json');
  assert.match(r04.nextAction, /A bounded 30-call application-roundtrip run was recorded at 26,000ms/i);
  assert.equal(r04.latestBuildEvidence.versionName, '0.1.0-kernel');
  assert.equal(r04.latestBuildEvidence.apkSha256, 'F026D48E9D6F298A1419EA69332A7C28F8D50D7BF115D978DDB1FB0DC6BCBD34');
  assert.equal(r04.latestBuildEvidence.installed, true);
  assert.equal(r04.deviceInstallEvidence.deviceModel, 'SEA-AL10');
  assert.equal(r04.deviceInstallEvidence.adbInstallResult, 'Success');
  assert.equal(r04.deviceInstallEvidence.appProcessRunningAfterInstall, false);
  assert.equal(r04.deviceInstallEvidence.vpnActiveAfterInstall, false);
  assert.equal(r04.deviceInstallEvidence.overlayAppOp, 'ignore');
  assert.equal(r04.latestBuildEvidence.weakNetworkInjectionVerified, false);
  assert.equal(r04.deviceWeakNetworkEvidence.source, 'user-reported; not directly observed by the agent');
  assert.equal(r04.deviceWeakNetworkEvidence.applicationScope, '指定应用');
  assert.equal(r04.deviceWeakNetworkEvidence.selectedApplication, 'WeChat (user-confirmed)');
  assert.equal(r04.deviceWeakNetworkEvidence.profile.packetLossPercent, 1);
  assert.equal(r04.deviceWeakNetworkEvidence.profile.downlinkKbps, 2048);
  assert.equal(r04.deviceWeakNetworkEvidence.profile.uplinkKbps, 1024);
  assert.equal(r04.deviceWeakNetworkEvidence.reportedResults.unselectedBrowserConnectivity, 'normal');
  assert.equal(r04.deviceWeakNetworkEvidence.reportedResults.networkRecoveredAfterVpnStopped, 'normal');
  assert.equal(r04.deviceWeakNetworkEvidence.cloudBaseCallsMade, true);
  assert.equal(r04.deviceWeakNetworkEvidence.cloudBaseSample.succeeded, 30);
  assert.equal(r04.deviceWeakNetworkEvidence.normalProfileBaseline.succeeded, 30);
  assert.equal(r04.deviceWeakNetworkEvidence.normalProfileBaseline.medianMs, 293);
  assert.equal(r04.deviceWeakNetworkEvidence.normalProfileBaseline.p95Ms, 848);
  assert.equal(r04.deviceWeakNetworkEvidence.pairedReruns.normalRuns, 2);
  assert.equal(r04.deviceWeakNetworkEvidence.pairedReruns.lightRuns, 2);
  assert.deepEqual(r04.deviceWeakNetworkEvidence.pairedReruns.rerunPairsAveragedP50DifferencesMs, [82, 108.5]);
  assert.equal(r04.deviceWeakNetworkEvidence.normalProfileBaseline.maxMs, 1552);
  assert.equal(r04.deviceWeakNetworkEvidence.vpnStoppedAfterRun, 'user-confirmed');
  assert.equal(r04.deviceWeakNetworkEvidence.measuredWeakNetworkEffect, false);
  assert.ok(r04.unknown.some(item => item.includes('direct Pakomo/VPN state and diagnostic counters')));
  assert.match(r04.evidence, /sp01-weak-network-tool-review-20261031\.md/);
});

test('Huawei Pakomo sample retains raw observations and records its measurement limits', () => {
  const sample = require('../docs/sp01-network-huawei-pakomo-light-20261102.json');
  assert.equal(sample.networkTypeReportedByProbe, 'wifi');
  assert.equal(sample.pakomoTestCondition.applicationScope, '指定应用');
  assert.equal(sample.pakomoTestCondition.selectedApplication, 'WeChat');
  assert.equal(sample.pakomoTestCondition.profile, '轻度弱网');
  assert.equal(sample.samples.length, 30);
  assert.equal(sample.samples.filter(item => item.ok).length, 30);
  assert.equal(sample.userReportedSummary.medianMs, 379);
  assert.equal(sample.independentlyRecomputed.averagedMiddleP50Ms, 382.5);
  assert.equal(sample.independentlyRecomputed.nearestRankP95Ms, 566);
  assert.equal(sample.afterRun.vpnStopped, 'user-confirmed');
  assert.equal(sample.r04Passed, false);
  assert.equal(sample.sp01Passed, false);
});

test('Huawei normal-profile baseline preserves raw observations and avoids causal claims', () => {
  const sample = require('../docs/sp01-network-huawei-normal-20261102.json');
  assert.equal(sample.networkCondition.pakomoState, 'stopped-user-confirmed');
  assert.equal(sample.networkCondition.networkTypeReportedByProbe, 'wifi');
  assert.deepEqual(sample.samples.map(item => item.elapsedMs), [1552, 292, 300, 293, 326, 848, 403, 274, 293, 296, 301, 277, 292, 265, 273, 297, 301, 409, 272, 293, 292, 300, 292, 266, 310, 271, 299, 285, 278, 265]);
  assert.equal(sample.samples.filter(item => item.ok).length, 30);
  assert.equal(sample.userReportedSummary.medianMs, 293);
  assert.equal(sample.userReportedSummary.p95Ms, 848);
  assert.equal(sample.userReportedSummary.maxMs, 1552);
  assert.equal(sample.userReportedSummary.meanConsecutiveDifferenceMs, 103);
  assert.equal(sample.independentlyRecomputed.averagedMiddleP50Ms, 293);
  assert.equal(sample.comparisonToLightProfile.p95DifferenceMs, 282);
  assert.equal(sample.comparisonToLightProfile.effectConfirmed, false);
  assert.equal(sample.r04Passed, false);
  assert.equal(sample.sp01Passed, false);
});

test('Huawei paired rerun evidence records the consistent P50 direction and unresolved conditions', () => {
  const sample = require('../docs/sp01-network-huawei-paired-reruns-20261102.json');
  assert.equal(sample.runs.length, 4);
  assert.ok(sample.runs.every(run => run.recomputed.succeeded === 30 && run.recomputed.failed === 0));
  assert.deepEqual(sample.comparison.rerunPairs.map(pair => pair.averagedMedianDifferenceMs), [82, 108.5]);
  assert.deepEqual(sample.comparison.rerunPairs.map(pair => pair.p95DifferenceMs), [8, 165]);
  assert.equal(sample.comparison.threeRunMeanOfPerRunAveragedP50Ms.lightMinusNormal, 93.33333333333333);
  assert.equal(sample.comparison.effectConfirmed, false);
  assert.deepEqual(sample.notMeasured.includes('directly observed VPN active/inactive state during each run'), true);
  assert.equal(sample.r04Passed, false);
  assert.equal(sample.sp01Passed, false);
});

test('Huawei paired reruns retain user-pasted values and verify run-level summaries', () => {
  const evidence = require('../docs/sp01-network-huawei-paired-reruns-20261102.json');
  const expected = {
    normalRerun2: [1712, 293, 320, 287, 440, 317, 361, 300, 275, 341, 287, 301, 322, 286, 313, 297, 302, 265, 285, 333, 292, 271, 292, 301, 276, 272, 295, 308, 275, 294],
    lightRerun2: [433, 372, 413, 479, 399, 375, 358, 418, 438, 377, 379, 376, 402, 351, 448, 395, 366, 360, 379, 396, 365, 380, 357, 386, 363, 372, 374, 411, 377, 367],
    normalRerun3: [517, 277, 300, 457, 266, 290, 297, 284, 288, 291, 275, 290, 310, 276, 285, 280, 263, 292, 250, 312, 267, 276, 264, 269, 263, 264, 265, 239, 257, 250],
    lightRerun3: [367, 342, 391, 402, 350, 384, 392, 387, 622, 414, 395, 366, 364, 400, 400, 372, 351, 397, 375, 596, 350, 378, 408, 386, 337, 399, 341, 769, 375, 358]
  };

  assert.equal(evidence.runs.length, 4);
  for (const run of evidence.runs) {
    const values = expected[run.id];
    assert.ok(values, `unexpected run id ${run.id}`);
    assert.deepEqual(run.samples.map(sample => sample.elapsedMs), values);
    assert.ok(run.samples.every(sample => sample.ok));
    const sorted = [...values].sort((a, b) => a - b);
    const differences = values.slice(1).map((value, index) => Math.abs(value - values[index]));
    assert.deepEqual(run.recomputed, {
      attempts: values.length,
      succeeded: values.length,
      failed: 0,
      lowerMiddleP50Ms: sorted[14],
      averagedMiddleP50Ms: (sorted[14] + sorted[15]) / 2,
      nearestRankP95Ms: sorted[Math.ceil(values.length * 0.95) - 1],
      maxMs: Math.max(...values),
      meanConsecutiveDifferenceMs: differences.reduce((sum, value) => sum + value, 0) / differences.length
    });
  }
  assert.deepEqual(evidence.comparison.rerunPairs.map(pair => pair.averagedMedianDifferenceMs), [82, 108.5]);
  assert.deepEqual(evidence.comparison.rerunPairs.map(pair => pair.p95DifferenceMs), [8, 165]);
  assert.equal(evidence.conditionDirectlyObserved, false);
  assert.ok(evidence.runs.every(run => run.pakomoStateDirectlyObserved === false));
  assert.equal(evidence.r04Passed, false);
  assert.equal(evidence.sp01Passed, false);
});

test('first Cloudflare screenshot is a single round with high loss and no false CloudBase claim', () => {
  const evidence = require('../docs/sp01-network-cloudflare-home-wifi-20261031.json');
  assert.equal(evidence.scope, 'phone-to-Cloudflare, not phone-to-CloudBase');
  assert.equal(evidence.downloadMbps, 25.5);
  assert.equal(evidence.uploadMbps, 33.5);
  assert.equal(evidence.latencyMs, 200);
  assert.equal(evidence.jitterMs, 40);
  assert.equal(evidence.packetLossPercent, 14.3);
  assert.equal(evidence.deviceAndAccessConfirmedByUser, true);
  assert.equal(evidence.deviceAndAccessIndependentlyVerifiedByScreenshot, false);
  assert.equal(evidence.independentRounds, 1);
  assert.equal(evidence.normalNetworkStableRangeFrozen, false);
  assert.equal(evidence.r04Passed, false);
});

test('second Cloudflare round retains variable loss rather than replacing the first', () => {
  const first = require('../docs/sp01-network-cloudflare-home-wifi-20261031.json');
  const second = require('../docs/sp01-network-cloudflare-home-wifi-round2-20261031.json');
  assert.equal(second.round, 2);
  assert.equal(second.downloadMbps, 27.1);
  assert.equal(second.uploadMbps, 25.1);
  assert.equal(second.latencyMs, 191);
  assert.equal(second.jitterMs, 74.3);
  assert.equal(second.packetLossPercent, 1.8);
  assert.equal(first.packetLossPercent - second.packetLossPercent, 12.5);
  assert.equal(second.normalNetworkStableRangeFrozen, false);
  assert.equal(second.scope, first.scope);
});

test('Huawei cellular Cloudflare evidence is retained separately from the CloudBase 4G sample', () => {
  const evidencePath = 'docs/sp01-network-huawei-cloudflare-4g-20261103.json';
  const evidence = require(`../${evidencePath}`);
  const appRoundtrip = require('../docs/sp01-network-huawei-cellular-4g-20261103.json');
  const screenshotPath = path.join(__dirname, '..', evidence.sourceImage);
  const screenshot = fs.readFileSync(screenshotPath);

  assert.equal(evidence.target, 'speed.cloudflare.com');
  assert.equal(evidence.scope, 'phone-to-Cloudflare, not phone-to-CloudBase');
  assert.deepEqual({
    downloadMbps: evidence.downloadMbps,
    uploadMbps: evidence.uploadMbps,
    latencyMs: evidence.latencyMs,
    downloadLatencyMs: evidence.downloadLatencyMs,
    uploadLatencyMs: evidence.uploadLatencyMs,
    jitterMs: evidence.jitterMs,
    downloadJitterMs: evidence.downloadJitterMs,
    uploadJitterMs: evidence.uploadJitterMs,
    packetLossPercent: evidence.packetLossPercent
  }, {
    downloadMbps: 12.7,
    uploadMbps: 15.8,
    latencyMs: 218,
    downloadLatencyMs: 220,
    uploadLatencyMs: 224,
    jitterMs: 105,
    downloadJitterMs: 269,
    uploadJitterMs: 178,
    packetLossPercent: 17.1
  });
  assert.equal(evidence.networkCondition.cellularIndicatorVisibleInScreenshot, true);
  assert.equal(evidence.networkCondition.pakomoOrVpnState, 'unknown');
  assert.equal(evidence.independentRoundsForThisDeviceAndAccess, 1);
  assert.equal(evidence.stableCellularRangeFrozen, false);
  assert.equal(evidence.r04Passed, false);
  assert.equal(evidence.sp01Passed, false);
  assert.deepEqual([...screenshot.subarray(0, 2)], [0xff, 0xd8]);
  assert.notEqual(evidence.scope, appRoundtrip.scope);

  const readiness = require('../docs/sp01-readiness-review-20261030.json');
  const r04 = readiness.openItems.find(item => item.id === 'R04');
  assert.equal(r04.firstCellularCloudflareEvidence, evidencePath);
  assert.ok(r04.cellularCloudflareEvidence.includes(evidencePath));
  assert.ok(r04.evidence.split('; ').includes(evidencePath));
  assert.ok(readiness.sources.includes(evidencePath));
  assert.ok(r04.evidence.includes('sp01-network-huawei-cellular-4g-20261103.json'));
  assert.equal(r04.state, 'pending');
  assert.equal(readiness.sp01Passed, false);
});

test('second Huawei 4G Cloudflare round preserves its screenshot and does not freeze a stable range', () => {
  const evidencePath = 'docs/sp01-network-huawei-cloudflare-4g-round2-20261103.json';
  const evidence = require(`../${evidencePath}`);
  const first = require('../docs/sp01-network-huawei-cloudflare-4g-20261103.json');
  const screenshotPath = path.join(__dirname, '..', evidence.sourceImage);
  const screenshot = fs.readFileSync(screenshotPath);

  assert.equal(evidence.round, 2);
  assert.equal(evidence.reportedLocalTime, '14:17:00');
  assert.equal(evidence.sourceImageSha256, 'FFF31148A12E1F483175104A2B001148F913DDCF37BA275821F234831EF04D07');
  assert.equal(evidence.target, 'speed.cloudflare.com');
  assert.equal(evidence.scope, 'phone-to-Cloudflare, not phone-to-CloudBase');
  assert.equal(evidence.networkCondition.accessReportedByScreenshot, '4g');
  assert.equal(evidence.networkCondition.pakomoOrVpnState, 'unknown');
  assert.equal(evidence.downloadMbps, 3.57);
  assert.equal(evidence.uploadMbps, 14.3);
  assert.equal(evidence.latencyMs, 212);
  assert.equal(evidence.downloadLatencyMs, 229);
  assert.equal(evidence.uploadLatencyMs, 362);
  assert.equal(evidence.jitterMs, 145);
  assert.equal(evidence.downloadJitterMs, 172);
  assert.equal(evidence.uploadJitterMs, 215);
  assert.equal(evidence.packetLossPercent, 9.3);
  assert.equal(evidence.independentRoundsForThisDeviceAndAccess, 2);
  assert.equal(evidence.stableCellularRangeFrozen, false);
  assert.equal(evidence.r04Passed, false);
  assert.equal(evidence.sp01Passed, false);
  assert.notEqual(evidence.packetLossPercent, first.packetLossPercent);
  assert.deepEqual([...screenshot.subarray(0, 2)], [0xff, 0xd8]);
  assert.equal(crypto.createHash('sha256').update(screenshot).digest('hex').toUpperCase(), evidence.sourceImageSha256);

  const readiness = require('../docs/sp01-readiness-review-20261030.json');
  const r04 = readiness.openItems.find(item => item.id === 'R04');
  assert.equal(r04.latestCellularCloudflareEvidence, 'docs/sp01-network-huawei-cloudflare-4g-round3-20261103.json');
  assert.equal(r04.firstCellularCloudflareEvidence, 'docs/sp01-network-huawei-cloudflare-4g-20261103.json');
  assert.deepEqual(r04.cellularCloudflareEvidence, [
    'docs/sp01-network-huawei-cloudflare-4g-20261103.json',
    evidencePath,
    'docs/sp01-network-huawei-cloudflare-4g-round3-20261103.json'
  ]);
  assert.ok(r04.evidence.split('; ').includes(evidencePath));
  assert.ok(readiness.sources.includes(evidencePath));
  assert.ok(readiness.sources.includes(evidence.sourceImage));
  assert.equal(r04.state, 'pending');
  assert.equal(readiness.sp01Passed, false);
});

test('third Huawei 4G Cloudflare round preserves the 50.7 percent loss observation without freezing a stable range', () => {
  const evidencePath = 'docs/sp01-network-huawei-cloudflare-4g-round3-20261103.json';
  const evidence = require(`../${evidencePath}`);
  const second = require('../docs/sp01-network-huawei-cloudflare-4g-round2-20261103.json');
  const screenshotPath = path.join(__dirname, '..', evidence.sourceImage);
  const screenshot = fs.readFileSync(screenshotPath);

  assert.equal(evidence.round, 3);
  assert.equal(evidence.reportedLocalTime, '14:43:14');
  assert.equal(evidence.target, 'speed.cloudflare.com');
  assert.equal(evidence.scope, 'phone-to-Cloudflare, not phone-to-CloudBase');
  assert.equal(evidence.networkCondition.accessReportedByScreenshot, '4g');
  assert.equal(evidence.networkCondition.pakomoOrVpnState, 'unknown');
  assert.equal(evidence.deviceContext.modelIndependentlyVerifiedByScreenshot, false);
  assert.deepEqual({
    downloadMbps: evidence.downloadMbps,
    uploadMbps: evidence.uploadMbps,
    latencyMs: evidence.latencyMs,
    downloadLatencyMs: evidence.downloadLatencyMs,
    uploadLatencyMs: evidence.uploadLatencyMs,
    jitterMs: evidence.jitterMs,
    downloadJitterMs: evidence.downloadJitterMs,
    uploadJitterMs: evidence.uploadJitterMs,
    packetLossPercent: evidence.packetLossPercent
  }, {
    downloadMbps: 2.88,
    uploadMbps: 14.9,
    latencyMs: 209,
    downloadLatencyMs: 217,
    uploadLatencyMs: 268,
    jitterMs: 92,
    downloadJitterMs: 116,
    uploadJitterMs: 150,
    packetLossPercent: 50.7
  });
  assert.deepEqual(evidence.networkQualityStars, {
    streaming: '1/5',
    gaming: '1/5',
    videoCalls: '1/5'
  });
  assert.equal(evidence.independentRoundsForThisDeviceAndAccess, 3);
  assert.equal(evidence.previousRoundEvidence, 'docs/sp01-network-huawei-cloudflare-4g-round2-20261103.json');
  assert.equal(evidence.comparisonToPreviousRound.previousRoundPacketLossPercent, second.packetLossPercent);
  assert.equal(evidence.stableCellularRangeFrozen, false);
  assert.equal(evidence.weakNetworkInjectionVerified, false);
  assert.equal(evidence.r04Passed, false);
  assert.equal(evidence.sp01Passed, false);
  assert.deepEqual([...screenshot.subarray(0, 2)], [0xff, 0xd8]);
  assert.equal(crypto.createHash('sha256').update(screenshot).digest('hex').toUpperCase(), evidence.sourceImageSha256);

  const readiness = require('../docs/sp01-readiness-review-20261030.json');
  const r04 = readiness.openItems.find(item => item.id === 'R04');
  assert.equal(r04.latestCellularCloudflareEvidence, evidencePath);
  assert.deepEqual(r04.cellularCloudflareEvidence, [
    'docs/sp01-network-huawei-cloudflare-4g-20261103.json',
    'docs/sp01-network-huawei-cloudflare-4g-round2-20261103.json',
    evidencePath
  ]);
  assert.ok(r04.evidence.split('; ').includes(evidencePath));
  assert.ok(r04.known.includes('third Cloudflare round'));
  assert.ok(r04.known.includes('50.7%'));
  assert.ok(readiness.sources.includes(evidencePath));
  assert.ok(readiness.sources.includes(evidence.sourceImage));
  assert.equal(r04.state, 'pending');
  assert.equal(readiness.sp01Passed, false);
});

test('public Wi-Fi evidence keeps CloudBase round trips separate from Cloudflare link metrics and leaves R04 pending', () => {
  const appPath = 'docs/sp01-network-public-wifi-app-round1-20261103.json';
  const cloudflarePath = 'docs/sp01-network-cloudflare-public-wifi-20261103.json';
  const app = require(`../${appPath}`);
  const cloudflare = require(`../${cloudflarePath}`);
  const appRecomputed = summarizeSamples(app.samples);
  const screenshotPath = path.join(__dirname, '..', cloudflare.sourceImage);
  const screenshot = fs.readFileSync(screenshotPath);
  const readiness = require('../docs/sp01-readiness-review-20261030.json');
  const r04 = readiness.openItems.find(item => item.id === 'R04');
  const method = fs.readFileSync(path.join(__dirname, '../docs/sp01-network-profile-method-20261031.md'), 'utf8');

  assert.equal(app.samples.length, 30);
  assert.ok(app.samples.every(sample => sample.ok));
  assert.deepEqual(appRecomputed, app.userReportedSummary);
  assert.deepEqual(appRecomputed, app.independentlyRecomputed);
  assert.equal(app.networkCondition.networkTypeReportedByProbe, 'wifi');
  assert.equal(app.networkCondition.publicAccessIndependentlyVerified, false);
  assert.equal(app.networkCondition.scenarioAccessTypeUserReported, 'public/free Wi-Fi');
  assert.equal(app.networkCondition.pakomoOrVpnStateUserReported, 'off');
  assert.equal(app.networkCondition.pakomoOrVpnStateIndependentlyVerified, false);
  assert.equal(app.deviceContext.deviceUserReported, 'Huawei backup device');
  assert.equal(app.deviceContext.model, 'SEA-AL10');
  assert.match(app.deviceContext.modelSource, /Existing device profile/);
  assert.equal(app.deviceContext.modelIndependentlyVerified, false);
  assert.equal(app.scope, 'application-roundtrip-not-link-rtt-or-packet-loss');
  assert.equal(app.r04Passed, false);
  assert.equal(app.sp01Passed, false);

  assert.equal(cloudflare.target, 'speed.cloudflare.com');
  assert.equal(cloudflare.scope, 'phone-to-Cloudflare, not phone-to-CloudBase');
  assert.deepEqual({
    downloadMbps: cloudflare.downloadMbps,
    uploadMbps: cloudflare.uploadMbps,
    latencyMs: cloudflare.latencyMs,
    jitterMs: cloudflare.jitterMs,
    packetLossPercent: cloudflare.packetLossPercent
  }, { downloadMbps: 87.2, uploadMbps: 56.7, latencyMs: 111, jitterMs: 39.3, packetLossPercent: 0 });
  assert.equal(cloudflare.networkCondition.wifiIndicatorVisibleInScreenshot, true);
  assert.equal(cloudflare.networkCondition.cellularIndicatorVisibleInScreenshot, true);
  assert.equal(cloudflare.networkCondition.publicAccessIndependentlyVerified, false);
  assert.equal(cloudflare.networkCondition.scenarioAccessTypeUserReported, 'public/free Wi-Fi');
  assert.equal(cloudflare.networkCondition.pakomoOrVpnStateUserReported, 'off');
  assert.equal(cloudflare.networkCondition.pakomoOrVpnStateIndependentlyVerified, false);
  assert.equal(cloudflare.deviceContext.deviceUserReported, 'Huawei backup device');
  assert.equal(cloudflare.deviceContext.model, 'SEA-AL10');
  assert.match(cloudflare.deviceContext.modelSource, /Existing device profile/);
  assert.equal(cloudflare.deviceContext.modelIndependentlyVerifiedByScreenshot, false);
  assert.equal(cloudflare.publicWifiStableRangeFrozen, false);
  assert.equal(cloudflare.r04Passed, false);
  assert.equal(cloudflare.sp01Passed, false);
  assert.deepEqual([...screenshot.subarray(0, 2)], [0xff, 0xd8]);
  assert.equal(crypto.createHash('sha256').update(screenshot).digest('hex').toUpperCase(), cloudflare.sourceImageSha256);
  assert.notEqual(cloudflare.scope, app.scope);

  assert.equal(r04.latestPublicWifiAppSampleEvidence, appPath);
  assert.equal(r04.latestPublicWifiCloudflareEvidence, cloudflarePath);
  assert.equal(r04.publicWifiEvidence.scenarioAccessTypeUserReported, 'public/free Wi-Fi');
  assert.equal(r04.publicWifiEvidence.deviceUserReported, 'Huawei backup device');
  assert.equal(r04.publicWifiEvidence.pakomoOrVpnStateUserReported, 'off');
  assert.equal(r04.publicWifiEvidence.publicAccessIndependentlyVerified, false);
  assert.equal(r04.publicWifiEvidence.stableRangeFrozen, false);
  assert.ok(r04.evidence.split('; ').includes(appPath));
  assert.ok(r04.evidence.split('; ').includes(cloudflarePath));
  assert.ok(r04.evidence.split('; ').includes(cloudflare.sourceImage));
  assert.ok(readiness.sources.includes(appPath));
  assert.ok(readiness.sources.includes(cloudflarePath));
  assert.ok(readiness.sources.includes(cloudflare.sourceImage));
  assert.equal(r04.state, 'pending');
  assert.equal(readiness.sp01Passed, false);
  assert.match(method, /公共\/免费 Wi-Fi 请求场景/);
  assert.match(method, /Cloudflare链路指标与CloudBase应用往返分开/);
  assert.match(method, /用户已确认本轮使用公共\/免费 Wi-Fi、华为备用机/);
  assert.match(method, /不冻结公共 Wi-Fi 稳定范围/);
  assert.match(method, /R04 与 SP01 仍待完成/);
});
