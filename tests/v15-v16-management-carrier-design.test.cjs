'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const nodePath = require('node:path');

const path = 'docs/superpowers/specs/2026-10-23-v15-v16-web-admin-carrier-design.md';
const doc = fs.readFileSync(path, 'utf8');

test('approved carrier records confirmation without claiming implemented pages', () => {
  for (const text of [
    '状态：D1—D5 已获用户确认（2026-10-23）',
    '覆盖旧“小程序内完整承载”决策',
    '真实登录、权限、托管和后端接入仍未实施',
    '本文不授权部署、购买套餐、创建真实账号或执行任何真实处置'
  ]) {
    assert.match(doc, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('proposal distinguishes official foundations from custom V15 and V16 workflows', () => {
  for (const text of [
    '微信小程序数据分析',
    '微信内容安全接口',
    '微信客服消息',
    'CloudBase 云开发平台',
    '腾讯云微搭基础概念',
    '没有直接提供能够替代 V15/V16 的成品业务后台'
  ]) {
    assert.match(doc, new RegExp(text));
  }
});

test('proposal compares three carriers and recommends a shared-backend hybrid', () => {
  for (const text of [
    'A：全部继续放在小程序',
    'B：V15/V16 全部改为网页端',
    'C：网页主后台＋小程序轻量入口',
    '共用同一套 CloudBase 数据、云函数、权限校验、事务状态和应用级操作日志'
  ]) {
    assert.match(doc, new RegExp(text));
  }
});

test('high-risk operations and V16 configuration stay in the web workbench', () => {
  for (const text of [
    '账号能力限制、封禁和解除',
    '实收重新分配、多收退款发起和费用更正',
    '故障恢复验收和保护截止变更',
    '地区、分类、服务、佣金、公示及生效时间配置',
    'V16 只在网页主后台提供完整编辑能力'
  ]) {
    assert.match(doc, new RegExp(text));
  }
});

test('proposal preserves state safety, audit caveats, migration and rollback', () => {
  for (const text of [
    '内容安全结果只作为风险线索',
    '渠道退款或支付结果只作为渠道事实',
    '旧版本冲突',
    '不能识别具体自然人操作者',
    '可回退的渐进迁移',
    '回退承载入口不回滚已经成功的业务事实'
  ]) {
    assert.match(doc, new RegExp(text));
  }
});

test('proposal keeps five explicit user decision gates and a complete validation plan', () => {
  for (let i = 1; i <= 5; i += 1) {
    assert.match(doc, new RegExp('D' + i));
  }
  for (const text of ['本建议稿验证', '后续实施验收建议', '高风险操作', '无障碍与交互', '回归']) {
    assert.match(doc, new RegExp(text));
  }
  assert.doesNotMatch(doc, /\b(?:TBD|TODO|FIXME)\b/);
});

test('proposal markdown has balanced fences, valid local links and consistent tables', () => {
  const fences = doc.match(/^```/gm) || [];
  assert.equal(fences.length % 2, 0);

  for (const match of doc.matchAll(/\]\((?!https?:\/\/|#)([^)]+)\)/g)) {
    const target = nodePath.resolve(nodePath.dirname(path), match[1]);
    assert.equal(fs.existsSync(target), true, 'missing local link: ' + match[1]);
  }

  const prose = doc.replace(/```[\s\S]*?```/g, '');
  const tableGroups = prose.split(/\r?\n\s*\r?\n/).filter(block => /^\|/m.test(block));
  for (const group of tableGroups) {
    const rows = group.split(/\r?\n/).filter(line => line.startsWith('|'));
    const widths = rows.map(line => (line.match(/\|/g) || []).length);
    assert.equal(new Set(widths).size, 1, 'inconsistent table width');
  }
});


test('confirmed carrier propagates to authoritative plans and page definitions', () => {
  for (const path of ['docs/development-plan.md','docs/structured-design.md','docs/prd.md','docs/ascii-design-prd-2.1.md','CONTEXT.md']) {
    const text = fs.readFileSync(path,'utf8');
    assert.ok(text.includes('管理端承载确认（2026-10-23）'),path);
    assert.ok(text.includes('用户确认 D1—D5'),path);
    assert.ok(text.includes('网页主后台＋小程序轻量入口'),path);
    assert.ok(text.includes('HTML 本地迁移已完成，真实后端未接入'),path);
    assert.ok(text.includes('首次回应/请求补充材料须真实能力验证后再开放'),path);
  }
  const plan = fs.readFileSync('docs/development-plan.md','utf8');
  const dp04 = plan.split(/\r?\n/).find(line => line.startsWith('| DP04 |'));
  const dp12 = plan.split(/\r?\n/).find(line => line.startsWith('| DP12 |'));
  assert.ok(dp04.includes('网页主后台＋小程序轻量入口'));
  assert.ok(!dp04.includes('落实已采用小程序内承载形式'));
  assert.ok(dp12.includes('两端共用后端'));
  const ascii = fs.readFileSync('docs/ascii-design-prd-2.1.md','utf8');
  assert.ok(ascii.includes('管理账号专属运营入口的目标为小程序轻量值班'));
  assert.ok(ascii.includes('不再定义小程序完整操作范围'));
  assert.ok(ascii.includes('不代表小程序开放配置编辑'));
});
