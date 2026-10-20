const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const specPath = path.join(
  __dirname,
  '..',
  'docs',
  'superpowers',
  'specs',
  '2026-10-20-merchant-profile-subscription-design.md',
);

test('merchant profile subscription design records the approved navigation and subscription behavior', () => {
  const spec = fs.readFileSync(specPath, 'utf8');

  for (const phrase of [
    '覆盖 2026-10-19',
    '订阅 / 发现',
    '每次点击底部“发现”',
    '默认进入“发现”',
    '登录后查看订阅内容',
    '不发送站内通知或微信提醒',
    '不再继续订阅？',
    '继续订阅',
    '取消订阅',
  ]) assert.ok(spec.includes(phrase), phrase);
});

test('merchant profile design records the approved content, metrics and filtering contract', () => {
  const spec = fs.readFileSync(specPath, 'utf8');

  for (const phrase of [
    '帖子 / 订阅 / 收藏',
    '当前审核通过且可公开展示',
    '一句话简介',
    '不重复展示长篇商家介绍',
    '服务方式',
    '上门 / 到店 / 远程 / 配送',
    '联系方式',
    '未登录用户也直接看到完整电话和微信',
    '明确授权公开',
    '最新 / 优惠 / 上新 / 活动',
    '单选',
  ]) assert.ok(spec.includes(phrase), phrase);
});

test('merchant profile design stays within the approved prototype boundary', () => {
  const spec = fs.readFileSync(specPath, 'utf8');

  for (const phrase of [
    '只修改 V06 离线预览、设计记录和验证',
    '不修改小程序源码',
    '不创建生产接口或数据库字段',
  ]) assert.ok(spec.includes(phrase), phrase);

  assert.doesNotMatch(spec, /\b(?:TODO|TBD)\b/);
});
