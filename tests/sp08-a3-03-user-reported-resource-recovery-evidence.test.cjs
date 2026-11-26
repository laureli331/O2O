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

test('November 25 closure keeps preparation, screenshot recovery and unverified runtime results distinct', () => {
  const section = ledger.split('## SP08/A3-03 11月25日晚间准备与回收（2026-11-26补录）')[1]
    ?.split('\n## ')[0];
  assert.ok(section, 'records the last attempt independently of November 24');
  for (const value of [
    '非本工具自动化独立读取', 'ins-jzia3btz', 'disk-e7de2hev', 'lb-mh8sn34x',
    '实际释放时刻及最终账单/结算状态未知', '后端绑定最终保存状态未核实',
    '不记为已安装', '未派发本轮 caller/CSR-return', '未设置本轮短时 GitHub 变量',
    '未取得 CSR', '仍 **HOLD**', 'FR00 未放行', '解除策略成功', '撤销会话成功',
    '不把此前无权限空态表述为撤销后的策略清单', '未核实云端旧会话 API 拒绝结果',
    '不作为重新购买或重新授权的批准',
  ]) assert.ok(section.includes(value), `closure preserves ${value}`);
});
