'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const records = JSON.parse(read('docs/module-specs/decisions.json'));
const handoff = JSON.parse(read('assets/ui/development-handoff-20261009/decisions.json'));

function verify(value) {
  assert.deepEqual(value.items.map(item => item.id), ['MP01', 'MP02']);
  const [other, repair] = value.items;
  assert.equal(other.userReply, '业务还包括"其它"');
  assert.equal(other.confirmed.businessModule, true);
  assert.equal(other.confirmed.name, '其它');
  assert.deepEqual(other.confirmed.excludeCategories, ['维修', '跑腿', '闲置']);
  assert.equal(other.confirmed.purpose, '整理其它需求数据，作为后续更新迭代依据');
  assert.equal(other.followUp[0].userReply, '除了"维修、跑腿、闲置", 方便为后续更新迭代整理数据');
  assert(other.pending.includes('公开接单或仅收集需求'));
  assert.equal(repair.userReply, 'A');
  assert.equal(repair.confirmed.matchingMode, 'apply-then-publisher-selects');
  assert.equal(repair.confirmed.quoteRequiredAtApplication, false);
  for (const item of value.items) {
    assert.equal(item.fullWorkflowReady, false);
    assert(item.pending.length >= 5);
    assert.equal(handoff.items.find(row => row.id === item.handoffDecision).productionAllowed, false);
  }
}

test('actual answers include other business and repair application mode without approving unfinished workflows', () => {
  verify(records);
  const repair = handoff.items.find(item => item.id === 'HD01');
  assert.equal(repair.followUp[0].userReply, 'A');
  assert(repair.confirmed.includes('申请时不强制报价'));
  assert.equal(handoff.items.find(item => item.id === 'HD04').userReply, records.items[0].userReply);
  assert.equal(handoff.items.find(item => item.id === 'HD04').status, 'business-scope-approved-rules-pending');
  for (const mutation of [
    data => { data.items[0].confirmed.businessModule = false; },
    data => { data.items[0].confirmed.excludeCategories = ['维修']; },
    data => { data.items[0].confirmed.purpose = '所有需求均可直接抢单'; },
    data => { data.items[0].pending = data.items[0].pending.filter(item => item !== '公开接单或仅收集需求'); },
    data => { data.items[1].confirmed.matchingMode = 'first-come-first-served'; },
    data => { data.items[1].confirmed.quoteRequiredAtApplication = true; },
    data => { data.items[0].fullWorkflowReady = true; }
  ]) {
    const changed = structuredClone(records);
    mutation(changed);
    assert.throws(() => verify(changed));
  }
});

test('planning references resolve and existing handoff points to the new confirmed decisions', () => {
  const entry = 'docs/module-specs/README.md';
  const document = read(entry);
  for (const match of document.matchAll(/\]\(([^)]+)\)/g)) {
    assert(fs.existsSync(path.resolve(root, path.dirname(entry), match[1])), match[1]);
  }
  assert(read('docs/prd.md').includes('module-specs/README.md'));
  assert(read('docs/ui-development-handoff/README.md').includes('../module-specs/README.md'));
  assert(read('docs/ui-development-handoff/business-addendum.md').includes('申请时不强制报价'));
  assert(read('docs/ui-development-handoff/page-spec.md').includes('其它属于业务模块'));
});

test('other classification purpose is synchronized without pre-approving a collection or order workflow', () => {
  const other = handoff.items.find(item => item.id === 'HD04');
  assert.equal(other.followUp[0].userReply, records.items[0].followUp[0].userReply);
  assert(other.confirmed.includes('为后续更新迭代提供依据'));
  assert(other.pending.includes('公开接单或仅收集需求'));
  assert(read('CONTEXT.md').includes('是否公开供人接单'));
  assert(read('docs/module-specs/README.md').includes('归类原则和整理数据目的已确认'));
  assert(read('docs/ui-development-handoff/business-addendum.md').includes('没有自动批准新增采集方案'));
});
