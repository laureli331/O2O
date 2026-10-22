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
    '不是页面实施授权',
    '本轮确认结果与剩余前置条件',
    '本次补充确认 C',
  ]) assert.ok(review.includes(phrase), phrase);
});

test('V11 review preserves original writing scope and records later implementation authorization and D4 choice', () => {
  const review = read();
  for (const phrase of [
    '已确认文稿',
    '本轮只更新文稿，不修改页面',
    '已确认 A',
    '已确认事实约束',
    '本次新增指令授权实施',
    '本次补充确认 C',
    '本次广告区域可修改并重新审核，不修改商家档案',
    '未决，禁止接真实能力',
    '仅供其他执行者',
    '不修改现有 HTML、CSS 或 JavaScript',
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
