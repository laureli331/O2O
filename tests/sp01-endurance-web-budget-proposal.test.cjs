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
