const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const ledger = readFileSync(join(__dirname, '..', 'docs', 'external-evidence.md'), 'utf8');
const evidence = ledger.split('\n').find(line => line.includes('2026-11-24 后续截图证据'));

test('records screenshot scope without overstating independent verification', () => {
  assert.ok(evidence, 'the ledger records the user-provided screenshots');
  for (const value of [
    '用户提供，非本工具自动化独立读取',
    'ins-knnuwne7',
    'lb-qkr1sj7r',
    '所属项目为“所有项目”',
    '共0条',
    '不能证明系统盘',
    '最终账单/结算状态',
    '仍 **HOLD**',
  ]) {
    assert.ok(evidence.includes(value), `evidence note includes ${value}`);
  }
});
