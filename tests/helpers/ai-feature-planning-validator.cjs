'use strict';
const assert = require('node:assert/strict');

function rows(text, prefix) {
  const found = new Map();
  for (const match of text.matchAll(new RegExp('^\\| (' + prefix + '\\d{2}) \\|[^\\r\\n]+', 'gm'))) {
    assert(!found.has(match[1]), 'Duplicate contract: ' + match[1]);
    found.set(match[1], match[0].trim());
  }
  return found;
}
function family(text, prefix, count, label) {
  const found = rows(text, prefix);
  assert.equal(found.size, count, label + ' count');
  for (let i = 1; i <= count; i++) assert(found.has(prefix + String(i).padStart(2, '0')), label + ' missing ID');
  return found;
}
function requireTerms(text, terms, label) {
  for (const term of terms) assert(text?.includes(term), label + ': ' + term);
}

// Checks the approved document contract; does not certify product behavior.
function validateAiFeaturePlanning(bundle) {
  const { prd, design, plan, execution, decisions, evidence, record } = bundle;
  const ai = family(prd, 'AI', 16, 'AI rules');
  const bs = family(prd, 'BS', 12, 'Business statistics');
  const am = family(prd, 'AM', 8, 'AI metrics');
  family(decisions, 'FC', 18, 'Confirmed decisions');
  for (const [prefix, count] of [['M',12], ['R',8], ['F',18], ['V',21], ['T',18], ['RT',16], ['AT',12], ['DT',10]]) {
    family(prd, prefix, count, 'PRD ' + prefix);
  }
  for (const prefix of ['F','V','AT','DT']) {
    const source = rows(prd, prefix), target = rows(design, prefix);
    assert.deepEqual([...target.keys()].sort(), [...source.keys()].sort(), 'Design mapping: ' + prefix);
    if (prefix === 'F') for (const [id,row] of source) assert.equal(target.get(id), row, 'Field contract mismatch: ' + id);
  }
  for (const prefix of ['M','R','AT','DT','T','RT']) {
    assert.deepEqual([...rows(plan,prefix).keys()].sort(), [...rows(prd,prefix).keys()].sort(), 'Plan mapping: ' + prefix);
  }
  requireTerms(ai.get('AI01'), ['只在跑腿/二手','维修不显示','未登录','受限账号'], 'AI scope');
  requireTerms(ai.get('AI02'), ['1—1000字符','不调用模型'], 'Input bound');
  requireTerms(ai.get('AI03'), ['需选择需求','不算可用草稿','新请求','分别计请求与费用','不自动调用'], 'Multi-intent accounting');
  requireTerms(ai.get('AI04'), ['不读取历史发布、地址簿、旧草稿','第一版图片不进入模型'], 'No historical or image reference');
  requireTerms(decisions, ['不参考了, 感觉在现阶段弊大于利','最新选择取代AB'], 'Latest cancellation overrides history');
  requireTerms(ai.get('AI05'), ['不作为模型输入','阻止请求','不能把原文交给模型脱敏','不承诺识别全部隐私'], 'Private input boundary');
  requireTerms(ai.get('AI06'), ['不补造金额','无价格不自动设面议','服务费与商品费用必须分开'], 'Facts and fees');
  requireTerms(ai.get('AI07'), ['保留原值','未选择不得替换','一次列出'], 'Manual conflict boundary');
  requireTerms(ai.get('AI08'), ['明确采用','正式发布必须另行确认','选填0—9张图片'], 'Separate adoption and publication');
  requireTerms(ai.get('AI09'), ['保留本页','不自动重试','用户点击保存','不承诺未保存页面退出'], 'Failure recovery boundary');
  requireTerms(ai.get('AI11'), ['不默认进入运行日志','禁止响应体被网关/SDK调试日志复制','不自动转训练/评测资料'], 'Raw AI logging boundary');
  requireTerms(ai.get('AI12'), ['不能再次调用','不为恢复而暗中重调模型'], 'Idempotency boundary');
  requireTerms(ai.get('AI14'), ['旧结果不得覆盖新表单','所属用户、业务、请求状态和版本'], 'Ownership and stale result boundary');
  requireTerms(ai.get('AI15'), ['最后一次明确采用','同一发布最多1次','不继承旧AI关联'], 'Last-adopted attribution');
  requireTerms(bs.get('BS01'), ['仅两位独立同权运营者','不增加村社区/细分分类筛选'], 'Dashboard access');
  requireTerms(bs.get('BS02'), ['Asia/Shanghai','前一自然日','同一截止/汇总版本','不把失败清零'], 'Daily cutoff');
  requireTerms(bs.get('BS05'), ['首次成功发布时间','获申请率A/P、承接率H/P、已承接完成比例C/H','不是不同日期事件数相除'], 'Cohort denominator');
  requireTerms(bs.get('BS07'), ['不重复加C','不证明居民货款或服务费结清'], 'Completion is not settlement');
  requireTerms(bs.get('BS11'), ['截止快照','不能以今天状态冒充过去状态'], 'Historical stock');
  requireTerms(bs.get('BS12'), ['推广临时标识原S04期限保持'], 'Existing retention');
  requireTerms(am.get('AM02'), ['校验','不计S'], 'Usable draft denominator');
  requireTerms(am.get('AM04'), ['修改率E/B','图片/私密字段','不据修改推定AI错误'], 'Adopted field comparison');
  requireTerms(am.get('AM05'), ['一发布最多关联1请求','请求批次'], 'AI request cohort');
  requireTerms(am.get('AM06'), ['最近秩ceil(p×n)','n=0'], 'Latency definition');
  requireTerms(am.get('AM07'), ['未知','实际0与未知分开','无单价/用量不能填0元'], 'Unknown usage');
  const gates = rows(evidence,'(?:AG|DG)');
  assert.deepEqual([...gates.keys()].sort(), ['AG01','DG01'], 'External AI and analytics gates');
  requireTerms(gates.get('AG01'), ['官方报价不是实际费用或开通证据'], 'Price is not project evidence');
  for (const gate of ['AG01','DG01']) {
    assert(prd.includes('| ' + gate + ' |') && plan.includes('| ' + gate + ' |') && execution.includes('| ' + gate + ' |'), 'Cross-document gate: ' + gate);
    const actual = record.externalGates.filter(g => g.id === gate);
    assert.equal(actual.length, 1, 'Recorded gate count: ' + gate);
    assert.notEqual(actual[0].status, '已完成', 'Unverified current gate: ' + gate);
    assert.deepEqual(actual[0].evidence, [], 'No real project verification yet: ' + gate);
  }
  requireTerms(prd, ['完整第一版不能因此被宣称已交付/已上线','具体期限未定不采集真实新增分析数据','普通发帖、评论'], 'Scope and incomplete release boundary');
  requireTerms(design, ['新增部分尚未完成视觉设计','本轮只核对合同'], 'Unrendered design');
  requireTerms(execution, ['原计划48项任务','AT01—AT12、DT01—DT10','新增DP41须在DP03之前完成'], 'Execution scope');
  requireTerms(decisions, ['不默认安排到第二版','不授权产品代码'], 'Deferred scope');
  assert.equal(record.featurePlanning.productCodeImplemented, false, 'Documents are not product code');
  return true;
}
module.exports = { validateAiFeaturePlanning };
