'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'docs', 'sp03-data-privacy-deletion-20261104.json');
const markdownPath = path.join(root, 'docs', 'sp03-data-privacy-deletion-20261104.md');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const load = () => JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

test('SP03 inventory is explicitly a draft and preserves the no-real-data boundary', () => {
  const inventory = load();
  assert.equal(inventory.task, 'SP03');
  assert.equal(inventory.status, 'draft-not-accepted');
  assert.equal(inventory.productAcceptancePassed, false);
  assert.equal(inventory.realPersonalDataProcessed, false);
  assert.equal(inventory.storageOrCloudChanged, false);
  assert.equal(inventory.retentionPeriodsInvented, false);
  assert.equal(inventory.sourceConflict.dependencyResolutionChanged, false);
});

test('SP03 inventory maps every PRD field group F01-F22 exactly once', () => {
  const ids = load().records.filter((record) => /^F\d{2}$/.test(record.id)).map((record) => record.id);
  assert.deepEqual(ids, Array.from({ length: 22 }, (_, index) => `F${String(index + 1).padStart(2, '0')}`));
});

test('every data class records purpose, visibility, lifecycle, deletion, necessary retention and open term', () => {
  for (const record of load().records) {
    for (const key of ['source', 'dataClasses', 'purpose', 'visibility', 'lifecycle', 'deletion', 'necessaryRetention', 'retention']) {
      assert.ok(record[key], `${record.id} missing ${key}`);
    }
    assert.ok(record.purpose.confirmed || record.purpose.proposed, `${record.id} purpose has no evidence status`);
    assert.ok(record.visibility.confirmed || record.visibility.proposed, `${record.id} visibility has no evidence status`);
    assert.equal(record.retention.period, null, `${record.id} must not invent a retention period`);
    assert.equal(record.retention.status, 'pending-evidence-or-confirmation');
    assert.ok(record.retention.trigger, `${record.id} missing retention trigger`);
    assert.ok(record.deletion.userAction || record.deletion.systemAction, `${record.id} missing deletion path`);
    assert.ok(record.necessaryRetention.rule, `${record.id} missing necessary-retention boundary`);
  }
});

test('sensitive identity, private data, AI payloads, logs and suppliers retain frozen safeguards and evidence gates', () => {
  const inventory = load();
  const records = new Map(inventory.records.map((record) => [record.id, record]));
  assert.match(records.get('F01').safeguards.join(' '), /不保存.*完整.*身份|完整姓名.*身份证/);
  assert.match(records.get('F02').safeguards.join(' '), /详细地址.*私密|私密.*详细地址/);
  assert.match(records.get('F09').safeguards.join(' '), /快照|编辑.*删除.*不.*篡改/);
  assert.match(records.get('F17').safeguards.join(' '), /图片|历史|私密/);
  assert.match(records.get('TECH-LOGS').safeguards.join(' '), /姓名|身份证/);
  assert.match(records.get('TECH-LOGS').safeguards.join(' '), /AI原文/);
  assert.ok(inventory.supplierProcessing.some((entry) => entry.gate === 'AG01'));
  assert.ok(inventory.analyticsAndAds.some((entry) => entry.gate === 'DG01'));
  assert.ok(inventory.confirmations.some((entry) => entry.gate === 'E03'));
});

test('inventory cites repository sources, official privacy baseline and downstream acceptance ownership', () => {
  const inventory = load();
  for (const source of inventory.sources) {
    assert.ok(fs.existsSync(path.join(root, source.path)), `missing source ${source.path}`);
  }
  assert.ok(inventory.legalBaseline.sources.some((source) => source.url === 'https://www.cac.gov.cn/2021-08/20/c_1631050028355286.htm'));
  assert.ok(inventory.downstreamRequirements.some((item) => item.criterion === 'QS09' && item.owner.includes('SP35')));
  assert.ok(inventory.downstreamRequirements.some((item) => item.criterion === 'QR08' && item.owner.includes('SP28')));
  assert.ok(inventory.downstreamRequirements.some((item) => item.criterion === 'QS10' && item.owner.includes('SP31')));
  assert.ok(inventory.confirmations.length > 0);
});

test('Markdown and JSON expose the same draft, source conflict, unresolved terms and scope boundaries', () => {
  const inventory = load();
  const markdown = fs.readFileSync(markdownPath, 'utf8');
  assert.match(markdown, /SP03.*草案|草案.*SP03/);
  assert.match(markdown, /E03/);
  assert.match(markdown, /AG01/);
  assert.match(markdown, /DG01/);
  assert.match(markdown, /DP41/);
  assert.match(markdown, /未确认|待确认/);
  assert.match(markdown, /不等于.*通过|未.*通过/);
  for (const record of inventory.records) assert.ok(markdown.includes(record.id), `Markdown missing ${record.id}`);
  for (const source of inventory.sources) assert.ok(markdown.includes(source.path), `Markdown missing ${source.path}`);
});
