'use strict';

// Implementation-plan contract only. It does not execute product or external operations.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const planPath = path.join(root, 'docs/superpowers/plans/2026-10-18-discover-navigation-implementation.md');
const plan = fs.readFileSync(planPath, 'utf8');

test('plan is test-first, commit-scoped and preserves unrelated working changes', () => {
  for (const phrase of [
    '先修改或新增合同测试',
    '不提交已知失败状态',
    '每个逻辑阶段单独创建 Git commit',
    '不暂存、不删除、不恢复当前工作区已有的 `redbook` 删除记录',
    '不使用 `git reset --hard`',
  ]) assert.ok(plan.includes(phrase), phrase);
});

test('plan maps the approved first-release scope without pulling commercialization forward', () => {
  for (const phrase of [
    '首页 / 发现 / 发布 / 服务 / 我的',
    '发现页只展示审核通过且当前可展示的商家图文主帖',
    '原底栏消息入口取消',
    '已选 A 版线性指南针图标',
    '内容加热仍为“观察真实发帖数据后，第二版酌情评估”',
    '真实销售、支付、推广、审核和通知执行均保持关闭',
  ]) assert.ok(plan.includes(phrase), phrase);
});

test('plan has exact product-contract growth and verification commands', () => {
  for (const phrase of [
    '模块：14 → 15',
    '字段组：21 → 22',
    '页面组：22 → 23',
    '通知：9 → 10',
    '验收：74 → 82',
    '开发任务：57 → 60',
    'node --test tests/*.test.cjs',
    'tests/validate-development-plan.ps1',
    'tests/validate-structured-design.ps1',
    'tests/validate-selected-ui-20261009.ps1',
  ]) assert.ok(plan.includes(phrase), phrase);
});

test('plan covers deterministic assets, existing previews and the new discovery preview', () => {
  for (const phrase of [
    'scripts/prepare-ui-development-handoff.cjs',
    'icon-discover.svg',
    'previews/v01-v02.html',
    'previews/v04.html',
    'previews/v05.html',
    'previews/v06.html',
    'tests/v06-preview.test.cjs',
    'scripts/verify-v06-preview.cjs',
    '320、375、414 像素',
    'prefers-reduced-motion',
  ]) assert.ok(plan.includes(phrase), phrase);
});

test('plan has no unresolved placeholders or unsafe destructive command', () => {
  assert.doesNotMatch(plan, /\b(?:TBD|TODO|FIXME)\b/i);
  assert.doesNotMatch(plan, /待确认|另行确认|以后再说/);
  assert.ok(plan.includes('不使用 `git reset --hard`'));
});
