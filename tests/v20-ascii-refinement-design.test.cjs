'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const relative = 'docs/superpowers/specs/2026-10-24-v20-review-workbench-ascii-design.md';
const document = fs.readFileSync(path.join(root, relative), 'utf8');

test('V20 refinement design records the approved hybrid carrier and three non-duplicate page contracts', () => {
  for (const phrase of [
    '网页主后台＋小程序轻量值班入口',
    'V20-A 统一处理队列',
    'V20-B 内容与回应审核工作台',
    'V20-C 资格核查与评价申诉工作台',
    '图文/回应进入 V20-B',
    '目录经历资格核查/评价申诉进入 V20-C',
  ]) assert.ok(document.includes(phrase), phrase);
});

test('V20 refinement design preserves rating, evidence, timing and version boundaries', () => {
  for (const phrase of [
    '24小时首次回应不等于24小时结案',
    '旧版本迟到结果不能覆盖当前候选版本',
    '合法数值不因图文拒绝失效',
    '结果未知时只允许查询本次请求',
    '相同IP/住址',
    '不能单独证明评价虚假',
    '不恢复联系方式',
    '不造交易、计佣、付款',
  ]) assert.ok(document.includes(phrase), phrase);
});

test('V20 refinement design contains explicit deduplication and validation plans', () => {
  assert.ok((document.match(/不生成的重复页面/g) || []).length >= 3);
  for (const phrase of [
    '页面去重',
    '业务闭环',
    '边界与权限',
    'ASCII 每个方框等宽闭合',
    'node --test tests/ascii-design.test.cjs',
    '项目全量 `node --test`',
  ]) assert.ok(document.includes(phrase), phrase);
});

test('V20 refinement design cites public first-party references and has valid Markdown structure', () => {
  for (const host of [
    'atlassian.design',
    'www.carbondesignsystem.com',
    'docs.stripe.com',
    'support.google.com',
  ]) assert.ok(document.includes(`https://${host}/`), host);

  assert.equal((document.match(/```/g) || []).length % 2, 0, 'balanced fences');
  assert.doesNotMatch(document, /\b(?:TODO|TBD|FIXME)\b|链接待定/i);
});
