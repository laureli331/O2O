'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('R01 risk review retains audit failures and distinguishes source paths from fixes', () => {
  const note = fs.readFileSync(path.join(__dirname, '../docs/sp01-r01-residual-risk-20261031.md'), 'utf8');
  const audit = require('../docs/sp01-maintenance-candidate-20261030.json');
  assert.equal(audit.audit.after.total, 32);
  assert.equal(audit.audit.allFindingsResolved, false);
  assert.match(note, /32 个受影响包条目/);
  assert.match(note, /R01 与 SP01 仍未通过/);
  assert.match(note, /不能一概标“不适用”/);
  assert.match(note, /未运行漏洞利用或远程模板下载/);
  assert.match(note, /swiper@11\.1\.15/);
  assert.match(note, /dist\/hydrate\/index\.js/);
  assert.match(note, /12\.1\.2/);
  assert.match(note, /尚未在正式产品构建包验证/);
  assert.match(note, /未做适配测试或依赖变更/);
});
