'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('R01 risk review retains audit failures and distinguishes source paths from fixes', () => {
  const note = fs.readFileSync(path.join(__dirname, '../docs/sp01-r01-residual-risk-20261031.md'), 'utf8');
  const audit = require('../docs/sp01-maintenance-candidate-20261030.json');
  const inventory = require('../docs/sp01-r01-advisory-inventory-20261030.json');
  assert.equal(audit.audit.after.total, 32);
  assert.equal(audit.audit.allFindingsResolved, false);
  assert.match(note, /32 个受影响包条目/);
  assert.match(note, /23 个不同公告 URL/);
  assert.match(note, /不是重新查询注册表/);
  assert.equal(inventory.affectedPackageEntries.total, audit.audit.after.total);
  assert.deepEqual(inventory.affectedPackageEntries, {
    total: 32,
    critical: 4,
    high: 13,
    moderate: 15,
    low: 0,
    info: 0,
  });
  assert.deepEqual(inventory.distinctAdvisoryUrls, {
    total: 23,
    critical: 5,
    high: 13,
    moderate: 5,
    low: 0,
    info: 0,
  });
  assert.equal(new Set(inventory.advisories.map(({ url }) => url)).size, 23);
  assert.ok(inventory.advisories.every(({ url, affectedPackages, affectedRanges }) =>
    url.startsWith('https://github.com/advisories/GHSA-')
    && affectedPackages.length > 0
    && affectedRanges.length > 0));
  assert.match(note, /R01 与 SP01 仍未通过/);
  assert.match(note, /不能一概标“不适用”/);
  assert.match(note, /未运行漏洞利用或远程模板下载/);
  assert.match(note, /swiper@11\.1\.15/);
  assert.match(note, /dist\/hydrate\/index\.js/);
  assert.match(note, /12\.1\.2/);
  assert.match(note, /隔离 weapp 样例运行/);
  assert.match(note, /模块清单含139个模块、0 个名称匹配 Swiper 的模块/);
  assert.match(note, /不能外推正式产品/);
  assert.match(note, /正式页面建立后需对真实产品包重复模块清单检查/);
  assert.match(note, /尚未做升级适配测试或依赖变更/);
});
