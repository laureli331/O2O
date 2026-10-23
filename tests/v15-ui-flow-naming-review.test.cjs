'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const nodePath = require('node:path');

const path = 'docs/v15-ui-flow-naming-review-20261023.md';
const doc = fs.readFileSync(path, 'utf8');

test('review is explicitly writing-only and does not claim production capabilities', () => {
  assert.match(doc, /只提供可审阅的修改建议/);
  assert.match(doc, /不修改 V15 HTML、CSS、JavaScript/);
  assert.match(doc, /不授权启用真实账号处置、退款、通知或故障验收/);
});

test('review separates V14 alignment, partial alignment and non-applicable items', () => {
  for (const text of ['已对齐', '部分对齐', '不适用', '无法证明端到端']) {
    assert.match(doc, new RegExp(text));
  }
  assert.match(doc, /V14 是用户侧/);
  assert.match(doc, /V15 是运营侧/);
});

test('review records the observed high-risk V15 findings', () => {
  for (const text of [
    '限制账号',
    '封禁账号',
    '确认记录',
    '已出结论卡片仍位于“待你处理”下',
    '重新开启处理',
    '永久整改',
    '共用管理账号无法识别实际操作者'
  ]) {
    assert.match(doc, new RegExp(text));
  }
});

test('recommendations include exact review context and queue separation', () => {
  for (const text of [
    '执行前 → 执行后',
    '待你处理、等待对方、最近完成',
    'PAY-A → BILL-A',
    '目标账号',
    '动作不同，字段名称也不同',
    '最终按钮'
  ]) {
    assert.match(doc, new RegExp(text));
  }
});

test('review cites primary design references and explains adaptation boundaries', () => {
  for (const url of [
    'support.atlassian.com/jira-service-management-cloud/docs/check-out-your-queues/',
    'support.zendesk.com/hc/en-us/articles/5604663490458-Using-SLA-policies',
    'design-system.service.gov.uk/patterns/check-answers/',
    'design-system.service.gov.uk/components/button/',
    'developer.apple.com/design/human-interface-guidelines/buttons',
    'www.w3.org/TR/WCAG22/'
  ]) {
    assert.match(doc, new RegExp(url.replace(/[.*+?^$()|[\]\\]/g, '\\$&')));
  }
  assert.match(doc, /不照搬/);
});

test('review keeps decision gates and a complete future verification plan', () => {
  for (let i = 1; i <= 8; i += 1) {
    assert.match(doc, new RegExp('D' + i));
  }
  for (const text of ['队列和状态', '高风险操作', '布局、交互和无障碍', '端到端联调']) {
    assert.match(doc, new RegExp(text));
  }
  assert.doesNotMatch(doc, /\b(?:TBD|TODO|FIXME)\b/);
});

test('review markdown has balanced fences, valid local links and consistent tables', () => {
  const fences = doc.match(/^~~~/gm) || [];
  assert.equal(fences.length % 2, 0);

  for (const match of doc.matchAll(/\]\((?!https?:\/\/|#)([^)]+)\)/g)) {
    const target = nodePath.resolve(nodePath.dirname(path), match[1]);
    assert.equal(fs.existsSync(target), true, 'missing local link: ' + match[1]);
  }

  const tableGroups = doc.split(/\r?\n\s*\r?\n/).filter(block => /^\|/m.test(block));
  for (const group of tableGroups) {
    const rows = group.split(/\r?\n/).filter(line => line.startsWith('|'));
    const widths = rows.map(line => (line.match(/\|/g) || []).length);
    assert.equal(new Set(widths).size, 1, 'inconsistent table width');
  }
});
