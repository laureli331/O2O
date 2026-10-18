'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const text = fs.readFileSync(path.join(__dirname, '../docs/miniapp-filing-progress-20261018.md'), 'utf8');
test('filing progress preserves evidence and does not imply filing completion', () => {
  for (const item of ['2026年10月18日','wx2414399d423dfb65','湘邻湘友','2026-10-16','用户报告','具体领取日期','未提供','待领取','尚无正式提交成功','不涉及文化前置审批的承诺书','60天内','以上都不涉及','不将完整证件','不能照搬','不抽佣','当前已确认PRD','E01—E06/QG01','其他改动']) assert(text.includes(item), item);
  assert(!/预计.{0,10}2026-10-\d{2}/.test(text));
  assert(!/(?<!\d)\d{17}[\dXx](?!\d)/.test(text));
});
