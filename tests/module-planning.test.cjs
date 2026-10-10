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
