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
  assert.equal(other.confirmed.publicPublishing, true);
  assert.equal(other.confirmed.applicationsAllowed, true);
  assert.equal(other.followUp[1].userReply, 'A');
  assert.equal(other.followUp[1].selectedOption, '公开发布并允许申请接单：用户可以实际找到人处理需求，同时积累分类数据');
  assert(!other.pending.includes('公开接单或仅收集需求'));
  assert.equal(other.confirmed.matchingMode, 'apply-then-publisher-selects');
  assert.equal(other.followUp[2].userReply, 'A');
  assert.equal(other.followUp[2].selectedOption, '先申请，发布者再选人：发布者比较申请者后决定，与维修的选人方向一致；报价规则另议');
  assert(!other.pending.includes('申请后的选人模式'));
  assert(other.pending.includes('申请人数/内容、选定生效/竞争申请及改选规则'));
  assert.equal(Object.hasOwn(other.confirmed, 'quoteRequiredAtApplication'), false);
  assert.equal(other.confirmed.selectedWorkerCount, 1);
  assert.equal(repair.userReply, 'A');
  assert.equal(repair.confirmed.matchingMode, 'apply-then-publisher-selects');
  assert.equal(repair.confirmed.quoteRequiredAtApplication, false);
  for (const item of value.items) {
    assert.equal(item.confirmed.selectedWorkerCount, 1);
    assert.equal(Object.hasOwn(item.confirmed, 'applicantLimit'), false);
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
  assert.equal(handoff.items.find(item => item.id === 'HD04').status, 'public-business-approved-rules-pending');
  for (const mutation of [
    data => { data.items[0].confirmed.businessModule = false; },
    data => { data.items[0].confirmed.excludeCategories = ['维修']; },
    data => { data.items[0].confirmed.purpose = '所有需求均可直接抢单'; },
    data => { data.items[0].confirmed.publicPublishing = false; },
    data => { data.items[0].confirmed.applicationsAllowed = false; },
    data => { data.items[0].followUp[1].selectedOption = '仅收集需求'; },
    data => { data.items[0].confirmed.matchingMode = 'first-come-first-served'; },
    data => { data.items[0].confirmed.quoteRequiredAtApplication = false; },
    data => { data.items[0].confirmed.selectedWorkerCount = 2; },
    data => { data.items[1].confirmed.selectedWorkerCount = 2; },
    data => { data.items[0].confirmed.applicantLimit = 1; },
    data => { data.items[1].confirmed.applicantLimit = null; },
    data => { data.items[0].pending = data.items[0].pending.filter(item => item !== '申请人数/内容、选定生效/竞争申请及改选规则'); },
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

test('other publisher selection mode is synchronized while quote and applicant-limit rules remain unresolved', () => {
  const other = handoff.items.find(item => item.id === 'HD04');
  assert.equal(other.followUp[0].userReply, records.items[0].followUp[0].userReply);
  assert(other.confirmed.includes('为后续更新迭代提供依据'));
  assert.deepEqual(other.followUp[1], records.items[0].followUp[1]);
  assert(other.confirmed.includes('允许公开发布并申请接单'));
  assert.deepEqual(other.followUp[2], records.items[0].followUp[2]);
  assert(other.confirmed.includes('先申请再由发布者选人'));
  assert(other.pending.includes('申请人数/内容、选定生效/竞争申请及改选规则'));
  assert(read('CONTEXT.md').includes('先申请再由发布者选1位接单员'));
  assert(read('docs/module-specs/README.md').includes('归类原则和整理数据目的已确认'));
  assert(read('docs/ui-development-handoff/business-addendum.md').includes('没有自动批准新增采集方案'));
});

test('single selected worker approval is dated and synchronized for both businesses without imposing an applicant cap', () => {
  const [other, repair] = records.items;
  assert.equal(records.updatedAt, '2026-10-11');
  assert.equal(handoff.updatedAt, records.updatedAt);
  const answer = other.followUp[3];
  assert.equal(answer.date, '2026-10-11');
  assert.equal(answer.userReply, 'A');
  assert(answer.selectedOption.includes('申请人数另行讨论'));
  assert.deepEqual(repair.followUp[0], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD01').followUp[1], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD04').followUp[3], answer);
  for (const item of records.items) assert(item.pending.some(text => text.includes('申请人数')));
  assert(read('docs/module-specs/README.md').includes('每条需求最终选1位'));
  assert(read('docs/ui-development-handoff/business-addendum.md').includes('该决定不确认申请人数限制'));
});
