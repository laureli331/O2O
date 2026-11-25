'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runOperatorFlow } = require('./operator-flow.cjs');

test('operator flow never reaches any injected client without explicit external dispatch enablement', async () => {
  let calls = 0;
  await assert.rejects(runOperatorFlow({ clients: { tat: { InvokeCommand: async () => { calls += 1; } } },
    verifiedMaterials: {}, enableExternalDispatch: false }), /explicit-enable/);
  assert.equal(calls, 0);
});
