'use strict';

// Design-contract checks only. No post, review, notification or payment operation is executed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const specPath = path.join(root, 'docs/superpowers/specs/2026-10-18-discover-navigation-design.md');
const spec = fs.readFileSync(specPath, 'utf8');
const context = fs.readFileSync(path.join(root, 'CONTEXT.md'), 'utf8');
const basis = fs.readFileSync(path.join(root, 'docs/module-specs/current-development-basis-20261015.md'), 'utf8');

test('approved first-release navigation and notification placement are explicit', () => {
  for (const phrase of [
    '首页 / 发现 / 发布 / 服务 / 我的',
    '“服务”页右上角提供通知入口',
    '删除底栏“消息”入口',
    '通知中心是“服务”的二级页面',
    '线性指南针图标',
    '不复用搜索放大镜',
    '通知入口复用现有消息气泡图标并叠加未读角标',
  ]) assert.ok(spec.includes(phrase), phrase);
});

test('discovery remains a reviewed merchant-only first-release feed', () => {
  for (const phrase of [
    '第一版发现页只展示审核通过且当前允许展示的商家主帖',
    '居民发布的维修、跑腿、闲置和其它需求继续由首页承载',
    '第一版允许审核通过的商家自行提交主帖',
    '第一版基础发帖不绑定工具会员、内容加热或付费资格',
    '第一版不提供评论、点赞、关注、热榜、付费加热或个性化推荐',
  ]) assert.ok(spec.includes(phrase), phrase);
});

test('visual direction and post limits match the approved design', () => {
  for (const phrase of [
    '双列瀑布流',
    '不复制小红书的品牌色、品牌图标、素材或专属文案',
    '至少 1 张、最多 9 张',
    '第一版只支持图文，不支持视频',
    '标题必填，最多 20 个可见字符',
    '正文必填，最多 1,000 个可见字符',
  ]) assert.ok(spec.includes(phrase), phrase);
});

test('review replacement and privacy boundaries cannot be mistaken for live implementation', () => {
  for (const phrase of [
    '线上旧版继续展示，新版本单独进入审核',
    '新版本审核通过后原子替换旧版',
    '帖子表单不单独填写手机号、微信号或详细地址',
    '本次不创建或修改小程序源码',
    '也不启用真实发布、审核、通知、支付或商业化',
    '不得改动当前工作区中与本设计无关的 `redbook` 删除记录',
  ]) assert.ok(spec.includes(phrase), phrase);
});

test('written specification has no unresolved placeholders', () => {
  assert.doesNotMatch(spec, /\b(?:TBD|TODO|FIXME)\b/i);
  assert.doesNotMatch(spec, /待确认|另行确认|以后再说/);
});

test('current context and development basis point back to the approved design and current override', () => {
  for (const text of [context, basis]) {
    assert.ok(text.includes('第一版发现与导航确认（2026-10-18）'));
    assert.ok(text.includes('discoveryFirstReleaseDecision'));
    assert.ok(text.includes('旧 `featurePlanning.merchantSquareRelease = v2` 保留为2026-10-15历史记录'));
  }
});
