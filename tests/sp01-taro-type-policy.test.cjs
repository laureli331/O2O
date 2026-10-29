'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluate } = require('../tools/sp01-taro-probe/check-type-policy.cjs');
test('type policy comparison requires real negative diagnostics and unchanged baseline config', () => {
  const good = { fullDeclarationExitCode: 2, sourceOnlyExitCode: 0, originalConfigUnchanged: true,
    negativeCases: [{ exitCode: 2, expectedDiagnosticObserved: true }, { exitCode: 2, expectedDiagnosticObserved: true }] };
  assert.equal(evaluate(good), true);
  for (const patch of [{ fullDeclarationExitCode: null }, { sourceOnlyExitCode: 2 }, { originalConfigUnchanged: false },
    { negativeCases: [{ exitCode: 0, expectedDiagnosticObserved: false }, good.negativeCases[1]] },
    { negativeCases: [{ exitCode: null, expectedDiagnosticObserved: false }, good.negativeCases[1]] }]) {
    assert.equal(evaluate({ ...good, ...patch }), false);
  }
});
