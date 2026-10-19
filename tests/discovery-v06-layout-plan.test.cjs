'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const planPath = path.join(root, 'docs/superpowers/plans/2026-10-19-discovery-v06-layout-implementation.md');

test('V06 refinement plan is test-first and names every implementation surface', () => {
  assert.ok(fs.existsSync(planPath), 'implementation plan must exist');
  const plan = fs.readFileSync(planPath, 'utf8');
  for (const phrase of [
    '先写失败测试',
    'previews/v06.html',
    'tests/v06-preview.test.cjs',
    'scripts/verify-v06-preview.cjs',
    'docs/v06-html-preview.md',
    '最新 / 优惠 / 上新 / 活动',
    '商家公开资料页',
    'A 版顶部商家栏',
    '线条式 SVG `<`',
    '固定“收藏 / 分享”操作区',
    '发布时间与服务区域拆成两行',
    '间距固定为 4 像素',
    '删除空状态内部说明、详情隐私说明卡和收藏失败测试控件',
    '320、375、414',
  ]) assert.ok(plan.includes(phrase), phrase);
});

test('V06 refinement plan preserves confirmed scope and rollback boundaries', () => {
  const plan = fs.readFileSync(planPath, 'utf8');
  for (const phrase of [
    '不修改 V01—V05',
    '不修改小程序源码',
    '不暂存或提交 `redbook`',
    '不新增评论、点赞、关注、粉丝数、获赞数或推荐算法',
    '每个逻辑阶段独立提交',
    'git diff --check',
  ]) assert.ok(plan.includes(phrase), phrase);
  assert.doesNotMatch(plan, /\b(?:TBD|TODO|FIXME)\b/i);
});
