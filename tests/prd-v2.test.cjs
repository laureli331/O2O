'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = p => new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(path.join(root, p)));
const records = JSON.parse(read('docs/module-specs/decisions.json'));
const prd = read('docs/prd.md');
const monetization = JSON.parse(read('docs/monetization-decisions-20261015.json'));
const archived = read(records.prdConsolidation.archive);
const normalize = s => s.replaceAll('二手', '闲置').replaceAll('承接者', '接单员').replaceAll('期望完成时间', '服务到期时间').replaceAll('第15.2节', '第12.2节');
const family = (text, prefix) => {
  const result = new Map();
  for (const m of text.matchAll(new RegExp('^\\| (' + prefix + '\\d{2}) \\|[^\\r\\n]+', 'gm'))) {
    assert(!result.has(m[1]), 'Duplicate identifier ' + m[1]); result.set(m[1], m[0]);
  }
  return result;
};
const section = (text, from, to) => {
  const start = text.indexOf(from), end = text.indexOf(to, start);
  assert(start >= 0 && end > start, 'Missing policy section ' + from);
  return text.slice(start, end);
};
const terms = (text, expected, label) => { for (const term of expected) assert(text.includes(term), label + ': ' + term); };

function validateCurrent(text) {
  assert(text.startsWith('# 湘邻湘友微信小程序 PRD'));
  terms(text, ['版本：2.1', '2026-10-16', '没有产品实现', '正式收费标准、额度与交付细则仍待确认'], 'Current baseline');
  for (const [prefix, count] of [['M', 14], ['R', 8], ['F', 21], ['V', 22], ['T', 18], ['RT', 16], ['AT', 12], ['DT', 10], ['BX', 18], ['AI', 16], ['AM', 8], ['VP', 7]]) {
    const rows = family(text, prefix);
    assert.equal(rows.size, count, prefix + ' current coverage');
    for (let i = 1; i <= count; i++) assert(rows.has(prefix + String(i).padStart(2, '0')));
  }
  const modules = family(text, 'M'), fields = family(text, 'F');
  terms(modules.get('M02'), ['申请', '选1位', '分阶段', '到期'], 'Repair workflow');
  terms(modules.get('M13'), ['其它', '不强制细分类', '不接许可服务'], 'Other business');
  terms(modules.get('M14'), ['佣金', '月账单', '主动缴佣'], 'Commission scope');
  terms(fields.get('F08'), ['未定', '用户明确延后', '不得用旧'], 'Deferred Banner');
  assert(!text.includes('不停广告计时') && !text.includes('停止推广计时'), 'Old advertising clock is not an approved Banner policy');
  terms(fields.get('F06'), ['无完成上报/收到确认字段'], 'No completion buttons');
  terms(fields.get('F20'), ['可同名', '当前有效阶段版本', '1待确认费用方案'], 'Staged fees');
  terms(family(text, 'V').get('V22'), ['佣金账单', '异议', '注销'], 'Billing page group');

  const time = section(text, '## 6.', '## 7.');
  terms(time, ['最多720小时', '最多延168小时', '严格晚于截止', '截止时刻服务端有效收到交付异议仍及时', '已过到期按条件结束，不再额外等72小时', '不再有接单员“提交完成/已办完”或客户“确认完成/收到”'], 'Expiry contract');
  const fees = section(text, '## 7.', '## 8.');
  terms(fees, ['服务费与材料/配件/商品等实际支出分开', '允许同名', '旧版本和待确认不重复加', '99,999.99元', '首份正式费用生效后留72小时', '窗口内改价不重置原截止', '不重开交易、不重锁费率/封顶、不二次封顶'], 'Fee contract');
  const commission = section(text, '## 8.', '## 9.');
  for (const [business, config] of Object.entries(monetization.commission.currentConfiguration)) {
    const row = commission.split('\n').find(l => l.startsWith('| ' + business + ' |'));
    assert(row, business + ' fee row'); assert(row.includes((config.rateBasisPoints / 100) + '%'), 'Rate ' + business);
    assert(row.includes(config.cap.kind === 'none' ? '不封顶' : (config.cap.amountCents / 100) + '元'), 'Cap ' + business);
  }
  terms(commission, ['不每阶段收费封顶', '减少计佣基数另需运营核验批准', '实际出账成功起连续72小时', '争议应缴余额再给72小时', '无争议部分原期限不变', '不直接清零、不强制放弃', '不是只收费30天', '旧交易用锁定快照'], 'Commission contract');
  const personal = section(text, '### 9.1', '### 9.2');
  terms(personal, ['仅累计本人作为跑腿接单员', '无有效交付异议', '不先扣佣金', '非到账金额', '未知不填0'], 'Personal income');
  terms(family(text, 'N').get('N04'), ['跑腿只在自动结束后通知双方一次', '到期前24小时'], 'Notification exception');
  terms(text, ['共用本人的一个管理账号', '不声称区分实际自然人操作者', '首版不包含', '不建设独立申请返修/质保流程', '8组被评角色分别汇总', '维修免费目录直接联系且没有四类正式交易记录时'], 'Roles and retained scope');
  const gates = new Map([...family(text, 'E'), ...family(text, 'QG'), ...family(text, 'AG'), ...family(text, 'DG')]);
  assert.deepEqual([...gates.keys()].sort(), ['AG01', 'DG01', 'E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'QG01']);
  terms(gates.get('E04'), ['佣金', 'Banner'], 'Actual payment gate');
  terms(text, ['所有九项条件仍未验证通过', '旧开发计划48任务', '已完成当前M01—M14、F01—F21、V01—V22及74项验收的文档重映射'], 'Implementation boundary');
  for (const forbidden of ['平台不代收、不代结算、不抽跑腿佣金', '完成申请满24小时且无确认/异议才自动完成', '接单员提交完成，发布者确认后完成']) assert(!text.includes(forbidden), 'Obsolete operative rule: ' + forbidden);

  const expected = new Map(records.businessCloseoutQuestionInventory.questions.map(q => [q.id, q.recordedAnswer]));
  for (const q of records.exceptionFinanceDecisionBatches[0].questions) expected.set(q.id, q.selected);
  for (const q of records.sharedUnderstandingAudit.questions) expected.set(q.id, q.selected);
  const decisions = [...text.matchAll(/^\| DEC-((?:CQ|NE|UA|EA)\d{2}) \| ([A-Z]+) \|/gm)];
  assert.equal(decisions.length, 53, 'Decision trace count');
  assert.equal(new Set(decisions.map(m => m[1])).size, 53);
  for (const m of decisions) assert.equal(m[2], expected.get(m[1]), 'Actual choice ' + m[1]);
  return true;
}

test('current PRD formally consolidates approved rules with complete current coverage and actual decision provenance', () => assert.equal(validateCurrent(prd), true));

test('previous PRD remains byte-identical and preserves old decisions only as an explicit archive', () => {
  const meta = records.prdConsolidation;
  const hash = crypto.createHash('sha256').update(read(meta.archive).replace(/\r\n/g, '\n')).digest('hex').toUpperCase();
  assert.equal(hash, meta.archiveSha256LfNormalized);
  assert.match(meta.archiveSourceCommit, /^[0-9a-f]{40}$/);
  assert(archived.includes('版本：1.5'));
  assert(archived.includes('平台不代收、不代结算、不抽跑腿佣金'));
  assert(!prd.includes('平台不代收、不代结算、不抽跑腿佣金'));
  assert.equal(meta.sharedBusinessUnderstanding, true); assert.equal(meta.pendingIdentifiedBusinessChoices, 0);
  assert.equal(meta.productImplemented, false); assert.equal(meta.realServicesEnabled, false);
  assert.deepEqual(JSON.parse(read('assets/ui/development-handoff-20261009/decisions.json')).prdConsolidation, meta);
});

test('AI safeguards and metric definitions survive consolidation with the approved four-business scope', () => {
  for (const prefix of ['AI', 'AM']) {
    const prior = family(archived, prefix), current = family(prd, prefix);
    assert.deepEqual([...current.keys()], [...prior.keys()]);
    for (const [id, row] of prior) {
      if(id==='AI10'){terms(current.get(id), ['每自然月免费3次','20次／1.90元','180天','手动发布始终免费','真实支付未验证不售卖'], 'Approved resident AI commercial model');continue;}
      if(id==='AI01'){terms(current.get(id), ['四类发布表单均提供','未登录','受限账号'], 'Updated AI scope');continue;}
      if(id==='AI07'||id==='AI08'){assert.equal(current.get(id), normalize(row).replace('F03/F04','F02/F03/F04'), id+' four-business field mapping');continue;}
      assert.equal(current.get(id), normalize(row), id);
    }
  }
  terms(prd, ['明确的跑腿服务开始/到期时间', '原文不明确就留空', '维修/其它本轮开放标题、说明整理，时间仍由用户填写'], 'New accepted time extraction');
});

const mutations = [
  ['restoring manual completion', '无完成上报/收到确认字段', '必须确认完成/收到', /No completion buttons/],
  ['extending the initial horizon', '最多720小时', '最多1440小时', /Expiry contract/],
  ['extending each extension', '最多延168小时', '最多延336小时', /Expiry contract/],
  ['reintroducing a completion grace', '已过到期按条件结束，不再额外等72小时', '已过到期还要额外等72小时', /Expiry contract/],
  ['changing the runner rate', '| 跑腿 | 15% | 不封顶 |', '| 跑腿 | 5% | 不封顶 |', /Rate 跑腿/],
  ['changing the repair cap', '| 维修 | 15% | 同次服务30元 |', '| 维修 | 15% | 同次服务50元 |', /Cap 维修/],
  ['merging duplicate stage names', '允许同名', '同名合并', /Fee contract/],
  ['using the schedule as payment start', '实际出账成功起连续72小时', '计划出账时间起连续72小时', /Commission contract/],
  ['automatically reducing commission', '减少计佣基数另需运营核验批准', '双方改价就自动减少计佣基数', /Commission contract/],
  ['turning review into fee expiry', '不是只收费30天', '只收费30天', /Commission contract/],
  ['netting commissions from income', '不先扣佣金', '先扣佣金', /Personal income/],
  ['adding an errand pre-expiry notice', '跑腿只在自动结束后通知双方一次', '跑腿到期前后都通知双方', /Notification exception/],
  ['dropping the other module', /^\| M13 \|[^\r\n]+\r?\n/m, '', /M current coverage/],
  ['dropping commission page coverage', /^\| V22 \|[^\r\n]+\r?\n/m, '', /V current coverage/],
];
for (const [name, from, to, error] of mutations) test(name + ' is rejected by current PRD validation', () => {
  const changed = prd.replace(from, to); assert.notEqual(changed, prd, 'Mutation changed the fixture');
  assert.throws(() => validateCurrent(changed), error);
});

test('current and archived documents retain valid links, UTF-8, table widths and paired fences', () => {
  for (const f of ['docs/prd.md', records.prdConsolidation.archive]) {
    const text = read(f); assert.equal((text.match(/^```/gm) || []).length % 2, 0);
    for (const m of text.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^(https?:\/\/|#)/.test(m[1])) continue;
      assert(fs.existsSync(path.resolve(root, path.dirname(f), m[1].split('#')[0])), f + ': ' + m[1]);
    }
    let width = 0;
    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith('|')) { width = 0; continue; }
      const count = (line.match(/\|/g) || []).length;
      if (width) assert.equal(count, width, f + ' table: ' + line);
      width = count;
    }
  }
});
