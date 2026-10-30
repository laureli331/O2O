'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require(path.resolve(__dirname, '../../.local/sp01-shared-react18-probe/node_modules/typescript'));
function load(file) {
  const result = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, 'shared', file), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(output, { exports: result.exports, RangeError, TypeError, Number,
    require: () => { throw Error('UNEXPECTED_RUNTIME_DEPENDENCY'); } });
  return result.exports;
}
test('pure synthetic reducer preserves input and handles normal, reset and integer boundaries', () => {
  const { reduceCounter } = load('model.ts');
  const start = { count: 0 };
  const next = reduceCounter(start, { type: 'increment' });
  assert.equal(start.count, 0);
  assert.equal(next.count, 1);
  assert.equal(reduceCounter(next, { type: 'reset' }).count, 0);
  assert.throws(() => reduceCounter({ count: -1 }, { type: 'increment' }), /INVALID_COUNT/);
  assert.throws(() => reduceCounter({ count: Number.MAX_SAFE_INTEGER }, { type: 'increment' }), /COUNT_OVERFLOW/);
});
test('one request wrapper accepts injected transport and validates inputs/results without platform APIs', async () => {
  const { readSynthetic } = load('api.ts');
  for (const label of ['web-contract', 'weapp-contract']) {
    let calls = 0;
    const transport = { send: async value => { calls++; return { count: value }; } };
    assert.equal((await readSynthetic(transport, 2)).count, 2, label);
    await assert.rejects(readSynthetic(transport, -1), /INVALID_INPUT/);
    assert.equal(calls, 1);
  }
  await assert.rejects(readSynthetic({ send: async () => ({ count: 'wrong' }) }, 0), /INVALID_RESPONSE/);
  await assert.rejects(readSynthetic({ send: async () => { throw Error('OFFLINE'); } }, 0), /OFFLINE/);
});
