'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
test('project instructions retain ordered SP reuse investigation and evidence requirements', () => {
  const text = fs.readFileSync(path.resolve(__dirname, '../AGENTS.md'), 'utf8');
  const section = text.slice(text.indexOf('## SP任务实施前的复用调查'));
  assert.match(section, /每张SP任务卡/);
  const order = ['项目内', '官方能力', '第三方库', '自行实现'].map((word) => section.indexOf(word));
  assert.ok(order.every((value, index) => value >= 0 && (index === 0 || value > order[index - 1])));
  for (const word of ['源码', '许可', '维护', '依赖兼容', '最小验证', '总成本', '回退', '来源链接', '验收门槛']) assert.ok(section.includes(word), word);
  assert.match(section, /关键依赖.*确认/);
  assert.match(section, /普通.*自行推进/);
});
