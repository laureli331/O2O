'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = {
  v17: 'docs/v17-ui-flow-naming-review-20261023.md',
  v18: 'docs/v18-ui-flow-naming-review-20261023.md',
  v19: 'docs/v19-ui-flow-naming-review-20261023.md',
};

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('three review drafts stay advisory and preserve the confirmed product boundaries', () => {
  for (const relative of Object.values(files)) {
    const text = read(relative);
    assert.match(text, /仅供评审/);
    assert.match(text, /本轮不修改/);
    assert.match(text, /待确认的关键决策/);
    assert.match(text, /未确认前/);
    assert.match(text, /实施后的验收清单/);
  }

  assert.match(read(files.v17), /不提供新建、重新确认、撤回、重提/);
  assert.match(read(files.v18), /三项 1—5 星均必选且无默认值/);
  assert.match(read(files.v19), /不修改.*统计口径/);
});

test('each draft records the observed issue and an exact naming recommendation', () => {
  const v17 = read(files.v17);
  assert.match(v17, /处理状态 \+ 评价资格/);
  assert.match(v17, /查看我的评价/);

  const v18 = read(files.v18);
  for (const phrase of ['这次经历已经评价', '可评价', '暂不可评', '我的评价']) {
    assert.ok(v18.includes(phrase), `V18 draft should include ${phrase}`);
  }

  const v19 = read(files.v19);
  for (const phrase of ['综合评分', '3.5 / 5', '按首次提交时间从新到旧', '态度评分分布']) {
    assert.ok(v19.includes(phrase), `V19 draft should include ${phrase}`);
  }
});

test('public references use first-party design or product documentation', () => {
  const all = Object.values(files).map(read).join('\n');
  for (const host of [
    'atlassian.design',
    'design-system.service.gov.uk',
    'www.w3.org',
    'support.google.com',
    'www.airbnb.com',
  ]) {
    assert.ok(all.includes(`https://${host}/`), `missing first-party reference: ${host}`);
  }
  assert.match(all, /不代表已实际体验|不是对这些平台最新版客户端的实机体验/);
});

test('markdown fences are balanced and drafts contain no unresolved placeholders', () => {
  for (const relative of Object.values(files)) {
    const text = read(relative);
    assert.equal((text.match(/```/g) || []).length % 2, 0, `${relative} has unbalanced fences`);
    assert.doesNotMatch(text, /\b(?:TODO|TBD|FIXME)\b|待补充|链接待定/i);
  }
});
