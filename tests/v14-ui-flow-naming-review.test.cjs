'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const reviewPath = path.join(root, 'docs/v14-ui-flow-naming-review-20261022.md');
const read = () => fs.readFileSync(reviewPath, 'utf8');

test('V14 review exists and keeps the writing-only boundary explicit', () => {
  assert.ok(fs.existsSync(reviewPath), 'V14 review markdown must exist');
  const review = read();
  for (const phrase of [
    '新一版独立评审',
    '不修改现有 HTML、CSS、JavaScript',
    '不启用真实举报、申诉、图片上传、微信通知或个人信息处理能力',
    '本次不假定',
    '本文给出推荐方案和待确认项，不授权实施',
  ]) assert.ok(review.includes(phrase), phrase);
});

test('V14 review records browser-observed flow and naming problems', () => {
  const review = read();
  for (const phrase of [
    '原处理对象、理由、时间',
    '待确认提交',
    '在线申请暂未开放',
    '我的处理记录与帮助',
    '最近保存的文字草稿会保留',
    '放弃修改',
    '3.64:1',
    '320px',
  ]) assert.ok(review.includes(phrase), phrase);
});

test('V14 review provides concrete layouts, naming, priorities, and decision gates', () => {
  const review = read();
  for (const phrase of [
    '任务型双中心',
    '通知负责告知，处理记录负责跟进',
    '举报已提交 / 申诉已提交 / 补充材料已提交',
    'P0：流程正确性和事实完整性',
    '状态与主操作矩阵',
    '实施前需要确认的关键决策',
    'D1',
    'D6',
    '仅供后续执行者',
  ]) assert.ok(review.includes(phrase), phrase);
});

test('V14 review preserves confirmed PRD boundaries and avoids invented capabilities', () => {
  const review = read();
  for (const phrase of [
    '服务/费用争议',
    '不自动暂停交易、改价、退款或认定对方违规',
    '24 小时首次回应',
    '不表示原结论撤销或权限恢复',
    'E03',
    '必须查明真实服务端幂等、查询和持久化能力',
  ]) assert.ok(review.includes(phrase), phrase);
});

test('V14 review cites public primary guidance and has no unresolved drafting placeholders', () => {
  const review = read();
  for (const url of [
    'https://developer.apple.com/design/human-interface-guidelines/notifications/',
    'https://developer.apple.com/design/human-interface-guidelines/managing-notifications',
    'https://support.google.com/websearch/answer/15101968?hl=en',
    'https://design-system.service.gov.uk/patterns/confirmation-pages/',
    'https://design-system.service.gov.uk/components/error-summary/',
    'https://developer.apple.com/design/human-interface-guidelines/alerts',
    'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html',
  ]) assert.ok(review.includes(url), url);
  assert.doesNotMatch(review, /\b(?:TBD|TODO|FIXME)\b/i);
});

test('V14 review contains proportional verification coverage', () => {
  const review = read();
  for (const phrase of [
    '320、375、414px',
    '30 条通知',
    '1000 字说明',
    '9 张图片',
    'Toast',
    'aria-invalid',
    '4.5:1',
    '减少动态效果',
  ]) assert.ok(review.includes(phrase), phrase);
});
