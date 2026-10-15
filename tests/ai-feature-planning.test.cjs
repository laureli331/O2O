'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateAiFeaturePlanning } = require('./helpers/ai-feature-planning-validator.cjs');
const { validateDevelopmentRecord } = require('./helpers/development-record-validator.cjs');
const root = path.resolve(__dirname,'..');
const read = p => new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(path.join(root,p)));
// This suite preserves the originally approved v1.5 contract and its regression mutations.
// Current v2.0 coverage and unchanged AI safeguards are validated in prd-v2.test.cjs.
const paths = {prd:'docs/prd-v1.5-archive-20261015.md', design:'docs/structured-design.md', plan:'docs/development-plan.md', execution:'docs/post-registration-development.md', decisions:'docs/ai-feature-decisions.md', evidence:'docs/external-evidence.md'};
function bundle() {
  return {...Object.fromEntries(Object.entries(paths).map(([key,p]) => [key,read(p)])), record:JSON.parse(read('docs/development-decisions.json'))};
}
test('archived v1.5 scope, fields, pages, gates and acceptance remain consistent with its original design and plan', () => {
  const b = bundle();
  assert.equal(validateAiFeaturePlanning(b),true);
  assert.equal(validateDevelopmentRecord(b.record,b.plan),true);
});
const mutations = [
  ['granting public dashboard access', 'prd', 'V21仅获授权的本人管理账号可读汇总', 'V21所有普通用户可读汇总', /Dashboard access/],
  ['restoring history', 'prd', '不读取历史发布、地址簿、旧草稿', '读取历史发布、地址簿、旧草稿', /No historical/],
  ['sending images in v1', 'prd', '第一版图片不进入模型', '第一版图片进入模型', /image reference/],
  ['changing the input bound', 'prd', '本次输入去首尾空白后1—1000字符', '本次输入去首尾空白后1—2000字符', /Input bound/],
  ['sending private values to the model', 'prd', '不作为模型输入', '作为模型输入', /Private input/],
  ['silently replacing manual fields', 'prd', '未选择不得替换', '未选择也可替换', /Manual conflict/],
  ['publishing on adoption', 'prd', '正式发布必须另行确认', '采用即可正式发布', /Separate adoption/],
  ['automatically retrying failures', 'prd', '不自动重试，允许明确手动重试', '自动重试，允许明确手动重试', /Failure recovery/],
  ['raw SDK debug logging', 'prd', '禁止响应体被网关/SDK调试日志复制', '允许响应体被网关/SDK调试日志复制', /Raw AI logging/],
  ['hiding the first multi-intent call cost', 'prd', '分别计请求与费用', '仅计最后一次请求与费用', /Multi-intent/],
  ['mixing daily events into a cohort rate', 'prd', '不是不同日期事件数相除', '使用不同日期事件数相除', /Cohort denominator/],
  ['using current status for past stock', 'prd', '不能以今天状态冒充过去状态', '以今天状态作为过去状态', /Historical stock/],
  ['inheriting old AI attribution', 'prd', '不继承旧AI关联', '继承旧AI关联', /Last-adopted/],
  ['changing unknown costs to zero', 'prd', '无单价/用量不能填0元', '无单价/用量填写0元', /Unknown usage/],
  ['removing new field constraints', 'design', /^\| F17 \|[^\r\n]+\r?\n/m, '', /Design mapping/],
  ['omitting a dashboard case from the plan', 'plan', /^\| DT10 \|[^\r\n]+\r?\n/m, '', /Plan mapping/],
  ['claiming a public quote is project verification', 'evidence', '官方报价不是实际费用或开通证据', '官方报价证明项目已开通', /Price is not project/],
];
for (const [name,key,from,to,error] of mutations) test(name + ' is rejected', () => {
  const b = bundle();
  const changed = b[key].replace(from,to);
  assert.notEqual(changed,b[key],'Mutation must change the fixture');
  b[key] = changed;
  assert.throws(() => validateAiFeaturePlanning(b),error);
});
test('new task dependencies and cycles are enforced before progress', () => {
  const b = bundle();
  for (const [id,dependency] of [['DP03','DP41'],['DP36','DP48']]) {
    const row = b.plan.match(new RegExp('^\\| '+id+' \\|[^\\r\\n]+','m'))[0];
    const changed = row.replace('、'+dependency,'');
    assert.notEqual(changed,row);
    assert.throws(() => validateDevelopmentRecord(b.record,b.plan.replace(row,changed)),/Required new prerequisite/);
  }
  const row=b.plan.match(/^\| DP41 \|[^\r\n]+/m)[0];
  const cyclic=row.replace('DP01、DP02','DP01、DP02、DP03');
  assert.notEqual(cyclic,row);
  assert.throws(() => validateDevelopmentRecord(b.record,b.plan.replace(row,cyclic)),/Dependency cycle/);
});
test('unknown costs, quotas and retention cannot enable real services', () => {
  const b = bundle(), feature = b.record.featurePlanning;
  for(const key of ['provider','model','channel','dailyQuota','dailyBudget','monthlyBudget','concurrencyLimit','timeoutMs','outputTokenLimit','newAnalyticsRetention']) assert.equal(feature[key],null,key);
  feature.realAiEnabled=true;
  assert.throws(() => validateDevelopmentRecord(b.record,b.plan),/Unknown AI configuration/);
  feature.realAiEnabled=false; feature.newProductionAnalyticsEnabled=true;
  assert.throws(() => validateDevelopmentRecord(b.record,b.plan),/Unknown retention/);
});
test('AI and analytics gates cannot be silently removed or called complete', () => {
  for (const id of ['AG01','DG01']) {
    const b=bundle();
    b.record.externalGates=b.record.externalGates.filter(g => g.id!==id);
    assert.throws(() => validateDevelopmentRecord(b.record,b.plan),/All nine/);
    const c=bundle(); c.record.externalGates.find(g=>g.id===id).status='已完成';
    assert.throws(() => validateDevelopmentRecord(c.record,c.plan),/lacks project evidence/);
  }
});
test('updated documents have valid links, paired fences and consistent tables', () => {
  const files=[...Object.values(paths),'docs/technical-decision.md','docs/miniapp-planning.md','docs/planning-validation.md'];
  for (const p of files) {
    const text=read(p);
    assert.equal((text.match(/^```/gm)||[]).length%2,0,p+' fences');
    let width=0;
    for (const line of text.split(/\r?\n/)) {
      if(!line.startsWith('|')) {width=0;continue;}
      const next=(line.match(/\|/g)||[]).length;
      if(width) assert.equal(next,width,p+' table: '+line);
      width=next;
    }
    for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
      if(/^(https?:\/\/|#)/.test(match[1])) continue;
      assert(fs.existsSync(path.resolve(path.dirname(path.join(root,p)),match[1].split('#')[0])),p+' link: '+match[1]);
    }
  }
});
