'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const reviewPath = path.join(root, 'docs/v11-ui-flow-naming-review-20261022.md');
const read = () => fs.readFileSync(reviewPath, 'utf8');

test('V11 review exists and separates observed problems from unconfirmed decisions', () => {
  assert.ok(fs.existsSync(reviewPath), 'V11 review markdown must exist');
  const review = read();
  for (const phrase of [
    '已实际检查',
    '本次没有假定',
    '不代表正式命名、素材规格、字段来源或审核节点已经确认',
    '实施前需要用户确认的关键决策',
    '当前记录不足以安全选择',
  ]) assert.ok(review.includes(phrase), phrase);
});

test('V11 review records the verified flow and feedback defects', () => {
  const review = read();
  for (const phrase of [
    '草稿已保存',
    '尚未保存的修改将丢失',
    '提示条覆盖弹层正文',
    '当前投放从界面消失',
    '查看原因并修改',
    '绿色对勾图标',
    '待开始状态不把用户送进无数据空页作为主要路径',
  ]) assert.ok(review.includes(phrase), phrase);
});

test('V11 review provides exact naming, layout, state, and validation guidance', () => {
  const review = read();
  for (const phrase of [
    '状态驱动的广告管理首页',
    '广告管理 / 订单与退款 / 投放数据',
    '准备下期广告',
    '付款结果核实中',
    '当前生效版本',
    '320、375、414px',
    'aria-invalid',
    'D1',
    'D6',
  ]) assert.ok(review.includes(phrase), phrase);
});

test('V11 review cites public sources and avoids unresolved writing placeholders', () => {
  const review = read();
  for (const url of [
    'https://e.oppo.com/marketing/doc/operation-feeds.html',
    'https://support.google.com/google-ads/answer/1722120?hl=en-en',
    'https://ads.tiktok.com/resources/help/article/ad-review-faq?lang=en&redirected=1',
    'https://design-system.service.gov.uk/components/error-summary/',
    'https://www.w3.org/WAI/WCAG22/Understanding/error-identification',
    'https://m3.material.io/components/snackbar/overview',
  ]) assert.ok(review.includes(url), url);
  assert.doesNotMatch(review, /\b(?:TBD|TODO|FIXME)\b/i);
});
