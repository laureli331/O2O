'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const decode = new TextDecoder('utf-8', { fatal: true });
const read = file => decode.decode(fs.readFileSync(path.join(root, file)));
const plan = read('docs/development-plan.md');
const record = JSON.parse(read('docs/development-decisions.json'));
function expand(expression, prefix) {
  const result=[];
  const pattern=new RegExp(`(?<![A-Z])${prefix}(\\d{2})(?:—${prefix}(\\d{2}))?`, 'g');
  for (const m of expression.matchAll(pattern)) {
    const end=Number(m[2] ?? m[1]);
    for(let n=Number(m[1]);n<=end;n++) result.push(prefix+String(n).padStart(2,'0'));
  }
  return result;
}
function validate(text) {
  assert(text.startsWith('# 新账号注册后的技术开发执行文档'), 'Document title missing');
  assert(text.indexOf('## 1. 验证与完成标准') < text.indexOf('## 5. 按原计划开发'), 'Validation must precede execution');
  const rows=[...text.matchAll(/^\| ([A-G]) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)];
  assert.equal(rows.length,7,'All seven phases are required');
  const tasks=[];
  for(const [,phase,range,,checks] of rows) {
    const actual=expand(range,'DP');tasks.push(...actual);
    const expected=[...plan.matchAll(new RegExp(`^\\| (DP\\d{2}) \\| ${phase} \\|`, 'gm'))].map(m=>m[1]);
    assert.deepEqual(actual,expected,`Phase ${phase} must retain original tasks`);
    if(phase!=='A') assert.match(checks, /(?:T\d{2}|检查：)/,'Phase acceptance is required');
  }
  assert.equal(new Set(tasks).size,48,'Forty-eight unique tasks required');
  const finalChecks=rows.find(r=>r[1]==='G')[4];
  assert.deepEqual(expand(finalChecks,'T'), Array.from({length:18},(_,i)=>'T'+String(i+1).padStart(2,'0')),'All T cases required');
  assert.deepEqual(expand(finalChecks,'RT'), Array.from({length:16},(_,i)=>'RT'+String(i+1).padStart(2,'0')),'All RT cases required');
  for(const [prefix,count] of [['AT',12],['DT',10]]) assert.deepEqual(expand(finalChecks,prefix), Array.from({length:count},(_,i)=>prefix+String(i+1).padStart(2,'0')), 'All '+prefix+' cases required');
  assert(text.includes(record.resources.appIdValue),'Old AppID must match record');
  assert(text.includes(record.accountRouteDecision.oldEnvironmentId),'Old environment must match record');
  for(const line of [
    '新 AppID、环境ID：待取得并核验',
    '新账号注册成功不等于 DP01—DP06 完成',
    'DP07 的原始前置为 DP01、DP03、DP04',
    '未完成依赖不得进入对应任务',
    '新账号验收不得指向旧 cloud1',
    '未知环境拒绝构建和部署',
    '旧账号数据和权限不自动继承',
    '禁止把旧账号标识直接当作新账号用户',
    '生产配置禁止使用受控替身',
    '旧账号测试不能代替新账号真实接入验收',
    'E01—E06、QG01 全部待核实',
    '不删除测试、不跳过测试、不降低验收标准',
    '没有产品代码，本轮没有部署或发布',
    '需要用户最终明确批准后才提交审核和发布',
  ]) assert(text.includes(line),`Safety or evidence boundary missing: ${line}`);
  for(const link of text.matchAll(/\]\(([^)]+)\)/g)) {
    if(/^(https?:\/\/|#)/.test(link[1]))continue;
    const target=path.resolve(root,'docs',link[1].split('#')[0]);
    assert(fs.existsSync(target),`Broken local reference: ${link[1]}`);
  }
  assert.equal((text.match(/^```/gm)||[]).length%2,0,'Code fences must be paired');
  return true;
}
const document=()=>read('docs/post-registration-development.md');
test('execution document matches the existing plan, account record and acceptance boundaries',()=>assert.equal(validate(document()),true));
test('a missing business phase is rejected',()=>assert.throws(()=>validate(document().replace(/^\| D \|[^\r\n]+\r?\n/m,'')),/All seven phases/));
test('moving a task to another phase is rejected',()=>assert.throws(()=>validate(document().replace('DP20—DP24','DP20—DP23')),/Phase D/));
test('omitting final acceptance cases is rejected',()=>assert.throws(()=>validate(document().replace('T01—T18、RT01—RT16','T01—T17、RT01—RT16')),/All T cases/));
test('using the old environment for new-account acceptance is rejected',()=>assert.throws(()=>validate(document().replace('新账号验收不得指向旧 cloud1','新账号验收使用旧 cloud1')),/boundary missing/));
test('silently inheriting old users is rejected',()=>assert.throws(()=>validate(document().replace('旧账号数据和权限不自动继承','旧账号数据和权限自动继承')),/boundary missing/));
test('account registration cannot substitute for prerequisites',()=>assert.throws(()=>validate(document().replace('新账号注册成功不等于 DP01—DP06 完成','新账号注册成功等于 DP01—DP06 完成')),/boundary missing/));
test('claiming verified external gates is rejected',()=>assert.throws(()=>validate(document().replace('E01—E06、QG01 全部待核实','E01—E06、QG01 全部已通过')),/boundary missing/));
test('missing linked contracts are rejected',()=>assert.throws(()=>validate(document().replace('(prd.md)','(nonexistent-prd.md)')),/Broken local reference/));

test('T and RT identifiers are parsed independently without double counting',()=>{
  assert.deepEqual(expand('T01—T03、RT01—RT02','T'),['T01','T02','T03']);
  assert.deepEqual(expand('T01—T03、RT01—RT02','RT'),['RT01','RT02']);
});
test('omitting rating acceptance cases is rejected',()=>assert.throws(()=>validate(document().replace('T01—T18、RT01—RT16','T01—T18、RT01—RT15')),/All RT cases/));

test('existing technical and development entries link to the new execution document',()=>{
  assert(read('docs/technical-decision.md').includes('(post-registration-development.md)'));
  assert(plan.includes('(post-registration-development.md)'));
});

test('omitting added AI acceptance from final checks is rejected',()=>assert.throws(()=>validate(document().replace('T01—T18、RT01—RT16、AT01—AT12、DT01—DT10','T01—T18、RT01—RT16、AT01—AT11、DT01—DT10')),/All AT cases/));
test('omitting added dashboard acceptance from final checks is rejected',()=>assert.throws(()=>validate(document().replace('T01—T18、RT01—RT16、AT01—AT12、DT01—DT10','T01—T18、RT01—RT16、AT01—AT12、DT01—DT09')),/All DT cases/));
