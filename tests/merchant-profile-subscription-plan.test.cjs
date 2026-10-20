'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const planPath = path.join(
  __dirname,
  '..',
  'docs',
  'superpowers',
  'plans',
  '2026-10-20-merchant-profile-subscription-implementation.md',
);

test('merchant profile subscription plan is test-first and names every implementation surface', () => {
  assert.ok(fs.existsSync(planPath), 'implementation plan must exist');
  const plan = fs.readFileSync(planPath, 'utf8');

  for (const phrase of [
    '先写失败测试',
    'previews/v06.html',
    'tests/v06-preview.test.cjs',
    'scripts/verify-v06-preview.cjs',
    'docs/v06-html-preview.md',
    '订阅 / 发现',
    '登录后查看订阅内容',
    '帖子 / 订阅 / 收藏',
    '查看详细信息',
    '最新 / 优惠 / 上新 / 活动',
    '不再继续订阅？',
    '继续订阅',
    '取消订阅',
  ]) assert.ok(plan.includes(phrase), phrase);
});

test('merchant profile subscription plan preserves scope, privacy and rollback boundaries', () => {
  const plan = fs.readFileSync(planPath, 'utf8');

  for (const phrase of [
    '不修改 V01—V05',
    '不修改小程序源码',
    '不创建生产接口或数据库字段',
    '明确授权公开',
    '不暂存或提交 `redbook`',
    '每个逻辑阶段独立提交',
    '不使用 `git reset --hard`',
  ]) assert.ok(plan.includes(phrase), phrase);
  assert.doesNotMatch(plan, /\b(?:TBD|TODO|FIXME)\b/i);
});

test('merchant profile subscription plan includes model, browser and full regression checks', () => {
  const plan = fs.readFileSync(planPath, 'utf8');

  for (const phrase of [
    '订阅失败',
    '取消失败',
    '取消订阅不删除',
    '320、375、414',
    'prefers-reduced-motion',
    'node --test tests/*.test.cjs',
    'tests/validate-structured-design.ps1',
    'tests/validate-development-plan.ps1',
    'tests/validate-selected-ui-20261009.ps1',
    'scripts/prepare-ui-development-handoff.cjs --check',
    'git diff --check',
  ]) assert.ok(plan.includes(phrase), phrase);
});
