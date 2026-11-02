'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('R04 network profile method keeps Cloudflare link results separate from CloudBase round trips', () => {
  const source = fs.readFileSync(path.join(__dirname, '../docs/sp01-network-profile-method-20261031.md'), 'utf8');
  assert.match(source, /speed\.cloudflare\.com/);
  assert.match(source, /手机到 Cloudflare/);
  assert.match(source, /不能换算成链路 RTT、上下行、抖动或丢包/);
  assert.match(source, /公共 Wi-Fi 单列/);
  assert.match(source, /sp01-network-huawei-pakomo-light-20261102\.json/);
  assert.match(source, /sp01-network-huawei-normal-20261102\.json/);
  assert.match(source, /正常档的 P95 和最大值反而更高/);
  assert.match(source, /重复配对正常\/轻度弱网轮次/);
  assert.match(source, /R04 与 SP01 继续保持待完成/);
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
  assert.match(r04.nextAction, /same-device Huawei SEA-AL10 normal-profile baseline is now recorded/i);
  assert.match(r04.nextAction, /Repeat paired normal\/light-profile rounds on the same Huawei and Wi-Fi/i);
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
  assert.equal(r04.deviceWeakNetworkEvidence.normalProfileBaseline.maxMs, 1552);
  assert.equal(r04.deviceWeakNetworkEvidence.vpnStoppedAfterRun, 'user-confirmed');
  assert.equal(r04.deviceWeakNetworkEvidence.measuredWeakNetworkEffect, false);
  assert.ok(r04.unknown.some(item => item.includes('repeat paired normal/weak-profile runs on Huawei SEA-AL10')));
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
