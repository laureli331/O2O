'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('SP01 endurance proposal does not present unmeasured budgets as approved', () => {
  const text = fs.readFileSync(path.join(__dirname, '../docs/sp01-endurance-web-budget-proposal-20261031.md'), 'utf8');
  assert.match(text, /已确认准备工作量/);
  assert.match(text, /混合循环.*提议，未确认/s);
  assert.match(text, /小程序内存.*数值预算留空/);
  assert.match(text, /Web 核心任务.*P95 预算须由正式页面试测及用户确认/s);
  assert.match(text, /R05 与 SP01 均为未通过/);
  assert.match(text, /3 轮×30 次/);
  assert.match(text, /developer\.chrome\.com\/docs\/devtools\/performance-monitor/);
});

test('SP01 Android memory evidence is renderer-process scoped and keeps page budget pending', () => {
  const root = path.join(__dirname, '..');
  const evidence = JSON.parse(fs.readFileSync(path.join(root, 'docs/sp01-huawei-webview-memory-probe-20261102.json'), 'utf8'));
  const proposal = fs.readFileSync(path.join(root, 'docs/sp01-endurance-web-budget-proposal-20261031.md'), 'utf8');
  const review = JSON.parse(fs.readFileSync(path.join(root, 'docs/sp01-readiness-review-20261030.json'), 'utf8'));
  assert.deepEqual(evidence.samples.map(sample => sample.totalPssKb), [14371, 16471, 16470]);
  assert.equal(evidence.discovery.wechatRenderer.activityManagerPackageList[0], 'com.tencent.mm');
  assert.equal(evidence.interpretation.singleMiniProgramPageAttributionProven, false);
  assert.equal(evidence.interpretation.growthBudgetApproved, false);
  assert.equal(evidence.interpretation.r05State, 'pending');
  assert.match(proposal, /渲染进程级方法可行性/);
  assert.match(proposal, /同一应用的多个 WebView 可能共享渲染进程/);
  assert.equal(review.openItems.find(item => item.id === 'R05').state, 'pending');
  assert.equal(review.openItems.find(item => item.id === 'R05').latestEvidence, 'docs/sp01-huawei-webview-memory-probe-20261102.json');
});
