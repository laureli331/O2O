'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluate } = require('../tools/sp01-toolchain-probe/check.cjs');
const good = { validStatus: 0, invalidStatus: 1, invalidOutput: 'invalid.ts(1,14): error TS2322: incorrect type',
  validEmitted: true, invalidEmitted: false, runtimeMatched: true };

test('compiler candidate requires successful valid fixture, exact negative diagnostic and emitted runtime behavior', () => {
  assert.equal(evaluate(good), true);
  for (const patch of [
    { validStatus: 1 }, { invalidStatus: 0 }, { invalidStatus: null },
    { invalidOutput: 'compiler crashed' }, { validEmitted: false },
    { invalidEmitted: true }, { runtimeMatched: false },
  ]) assert.equal(evaluate({ ...good, ...patch }), false);
});
