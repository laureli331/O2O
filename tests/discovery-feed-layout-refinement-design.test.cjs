'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const specPath = path.join(root, 'docs/superpowers/specs/2026-10-19-discovery-feed-layout-refinement-design.md');

test('discovery feed refinement design records the approved content-first layout', () => {
  assert.ok(fs.existsSync(specPath), 'refinement design spec must exist');
  const spec = fs.readFileSync(specPath, 'utf8');
  for (const phrase of [
    '最新 / 优惠 / 上新 / 活动',
    '删除顶部引导卡',
    '删除“最新发布 / 演示加载失败”行',
    '最多选择一个主题，也可以不选',
    '公开卡片、公开详情和商家公开资料页不显示“已审核”或“资料已审核”',
    '只修改 V06 离线预览、设计记录和验证',
  ]) assert.ok(spec.includes(phrase), phrase);
});

test('discovery topic behavior is deterministic and does not invent recommendation semantics', () => {
  const spec = fs.readFileSync(specPath, 'utf8');
  for (const phrase of [
    '“最新”包含全部审核通过且当前可展示的商家主帖',
    '同时进入“最新”和“优惠”',
    '同时进入“最新”和“上新”',
    '同时进入“最新”和“活动”',
    '普通内容不选主题时，只进入“最新”',
    '不使用“推荐”',
    '不使用“附近”',
    '不得由系统根据正文自动猜测主题',
    '第一版不新增推荐算法',
  ]) assert.ok(spec.includes(phrase), phrase);
});

test('refinement design has no unresolved placeholders', () => {
  const spec = fs.readFileSync(specPath, 'utf8');
  assert.doesNotMatch(spec, /\b(?:TBD|TODO|FIXME)\b/i);
  assert.doesNotMatch(spec, /待确认|另行确认|以后再说/);
});

test('all approved V06 public and publishing surfaces use the same content-first structure', () => {
  const spec = fs.readFileSync(specPath, 'utf8');
  for (const phrase of [
    '图片选择与排序置顶',
    '底部固定“保存草稿 / 预览”操作区',
    '顶部商家栏',
    '线条式 SVG `<`',
    '底部固定“收藏 / 分享”操作区',
    '删除“不会用假帖子填充空状态。”',
    '删除详情页隐私说明卡',
    '不在用户页面展示收藏失败测试控件',
    '资料头部下方展示该商家自己的公开主帖双列列表',
    '只包含审核通过且当前可展示的帖子',
    '不显示粉丝数、获赞数、关注按钮',
    '不修改 V01—V05',
  ]) assert.ok(spec.includes(phrase), phrase);
});
