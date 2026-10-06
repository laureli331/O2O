'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateDevelopmentRecord } = require('./helpers/development-record-validator.cjs');

const repo = path.resolve(__dirname, '..');
const decoder = new TextDecoder('utf-8', { fatal: true });
const read = relative => decoder.decode(fs.readFileSync(path.join(repo, relative)));
const plan = read('docs/development-plan.md');
const record = JSON.parse(read('docs/development-decisions.json'));
const technical = read('docs/technical-decision.md');
const evidence = read('docs/external-evidence.md');
const copy = () => structuredClone(record);

test('actual adoption and task progress obey the original dependency plan', () => {
  assert.equal(validateDevelopmentRecord(record, plan), true);
  assert(technical.includes('用户实际回复：**“采用”**'));
  assert(plan.includes('后续用户回复“采用”'));
  assert(plan.includes('技术执行记录'));
});

test('confirmed resource facts preserve personal subject and unopened environment', () => {
  assert.equal(record.resources.appIdExists, true);
  assert.equal(record.resources.appIdValue, null);
  assert.equal(record.resources.currentSubject, 'personal');
  assert.equal(record.resources.individualBusinessRegistration, 'willing-if-needed-not-registered');
  assert.equal(record.resources.developerToolsInstalled, false);
  assert.equal(record.resources.cloudEnvironmentOpened, false);
  assert.equal(record.resources.cloudRuntimeVersion, null);
  assert.equal(record.resources.databaseMode, null);
  assert.equal(record.resources.productionBudget, null);
  assert(technical.includes('两项都没有'));
  assert(technical.includes('暂时是个人主体, 若有需要, 可注册个体工商户'));
});

test('missing user confirmation and silently substituted architecture are rejected', () => {
  const missingApproval = copy();
  missingApproval.approval.reply = '';
  assert.throws(() => validateDevelopmentRecord(missingApproval, plan), /Actual user adoption/);
  const changed = copy();
  changed.approval.database = 'postgresql';
  assert.throws(() => validateDevelopmentRecord(changed, plan), /Approved choice changed: database/);
});

test('starting product engineering before prerequisites finish is rejected', () => {
  const changed = copy();
  changed.tasks.DP07 = '执行中';
  assert.throws(() => validateDevelopmentRecord(changed, plan), /Incomplete dependency: DP07 requires DP01/);
});

test('task labels cannot substitute for unconfirmed data and business decisions', () => {
  const changed = copy();
  for (let index = 1; index <= 7; index++) changed.tasks[`DP${String(index).padStart(2, '0')}`] = '已完成';
  assert.throws(() => validateDevelopmentRecord(changed, plan), /Data handling decision is not confirmed/);
  changed.prerequisites.dataHandlingConfirmed = true;
  assert.throws(() => validateDevelopmentRecord(changed, plan), /Business configuration is not confirmed/);
});

test('missing or duplicate external conditions are rejected', () => {
  const missing = copy();
  missing.externalGates.pop();
  assert.throws(() => validateDevelopmentRecord(missing, plan), /All seven external conditions/);
  const duplicate = copy();
  duplicate.externalGates.push(duplicate.externalGates[0]);
  assert.throws(() => validateDevelopmentRecord(duplicate, plan), /All seven external conditions/);
});

test('no evidence and general documentation cannot be called project verification', () => {
  const changed = copy();
  changed.externalGates[0].status = '已完成';
  assert.throws(() => validateDevelopmentRecord(changed, plan), /Completed condition lacks project evidence: E01/);
  changed.externalGates[0].evidence = [{ kind: 'general-documentation' }];
  assert.throws(() => validateDevelopmentRecord(changed, plan), /General documentation is not project evidence: E01/);
  changed.externalGates[0].evidence = [{ kind: 'project-verification', source: 'synthetic-test-fixture' }];
  assert.throws(() => validateDevelopmentRecord(changed, plan), /Missing evidence field date: E01/);
});

test('unverified conditions cannot enable production', () => {
  const changed = copy();
  changed.productionEnabled = true;
  assert.throws(() => validateDevelopmentRecord(changed, plan), /Unverified conditions cannot enable production/);
});

test('documents link existing local sources and preserve paired fences and tables', () => {
  for (const [relative, text] of [['docs/technical-decision.md', technical], ['docs/external-evidence.md', evidence]]) {
    for (const link of text.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^(https?:\/\/|#)/.test(link[1])) continue;
      assert(fs.existsSync(path.resolve(path.dirname(path.join(repo, relative)), link[1].split('#')[0])), `Broken link: ${relative} -> ${link[1]}`);
    }
    assert.equal([...text.matchAll(/^```/gm)].length % 2, 0, `Unpaired fences: ${relative}`);
    let previous = 0;
    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith('|')) { previous = 0; continue; }
      const count = [...line.matchAll(/\|/g)].length;
      if (previous) assert.equal(count, previous, `Broken table: ${relative}`);
      previous = count;
    }
  }
});

test('external ledger covers every condition and labels draft consultations unsent', () => {
  const ids = [...evidence.matchAll(/^\| (E0[1-6]|QG01) \|/gm)].map(match => match[1]);
  assert.deepEqual(ids, ['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'QG01']);
  assert(evidence.includes('微信平台咨询草稿（未发送）'));
  assert(evidence.includes('核验供应商咨询草稿（未发送）'));
  assert(evidence.includes('未处理真实证件或支付'));
  assert.equal(record.productionEnabled, false);
  assert(record.externalGates.every(gate => gate.status !== '已完成' && gate.evidence.length === 0));
});

test('prepared official installer is recorded without claiming an installation', () => {
  const prepared = record.preparedDeveloperTools;
  assert.equal(prepared.channel, 'stable');
  assert.equal(prepared.architecture, 'Windows-x64');
  assert.equal(new URL(prepared.source).hostname, 'devtools.wxqcloud.qq.com.cn');
  assert.equal(prepared.version, prepared.fileVersion);
  assert.equal(prepared.signatureStatus, 'Valid');
  assert.equal(prepared.signer, 'Tencent Technology (Shenzhen) Company Limited');
  assert.equal(prepared.bytes, 190935184);
  assert.match(prepared.sha256, /^[a-f0-9]{64}$/);
  assert.equal(prepared.installationExecuted, false);
  assert(technical.includes(prepared.sha256));
  const ignoredFolders = read('.gitignore').split(/\r?\n/);
  assert(ignoredFolders.includes('.local/'), 'Local installers must not enter Git');
  assert(prepared.localPath.startsWith('.local/downloads/'));
});
