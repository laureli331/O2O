'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
test('shared experiment lock keeps both consumers on the approved exact version policy', () => {
  const policy = read('docs/frontend-version-policy-20261030.json');
  const lock = read('tools/sp01-shared-core-probe/workspace.package-lock.json');
  for (const name of ['apps/web', 'apps/miniapp']) {
    const entry = lock.packages[name];
    for (const dependency of ['react', 'react-dom', '@types/react', '@types/react-dom', 'typescript']) {
      assert.equal(entry.dependencies?.[dependency] || entry.devDependencies?.[dependency], policy.required[dependency]);
    }
    assert.equal(entry.dependencies['@o2o/sp01-shared'], '0.0.0');
  }
  assert.equal(lock.packages['packages/shared'].peerDependencies.react, '18.3.1');
});
test('shared compatibility evidence preserves failures and cannot authorize product release', () => {
  const evidence = read('docs/sp01-shared-core-evidence-20261030.json');
  for (const flag of ['cloudChanged', 'formalProjectCreated', 'productAcceptancePassed', 'sp01Passed', 'sp07Started']) {
    assert.equal(evidence[flag], false, flag);
  }
  assert.equal(evidence.simulator.phoneTest, false);
  assert.equal(evidence.reactDoctor.countsAsCodeScanEvidence, false);
  assert.equal(evidence.retainedFailures.length, 3);
  assert.ok(evidence.limits.includes('vendor-declarations-and-security-still-unresolved'));
});
test('current toolchain review keeps ordinary build evidence separate from unresolved audit findings', () => {
  const evidence = read('docs/sp01-current-toolchain-review-20261030.json');
  assert.equal(evidence.audit.total, evidence.audit.moderate + evidence.audit.high + evidence.audit.critical);
  assert.equal(evidence.audit.exitCode, 1);
  assert.equal(evidence.findingsClosed, 0);
  for (const key of ['historicalSameCountImpliesSameFindings', 'missingBundleModuleProvesSafety',
    'vulnerabilityReproductionExecuted', 'remoteTemplateDownloaded', 'dependencyVersionsChanged', 'sp01Passed', 'productAcceptancePassed']) {
    assert.equal(evidence[key], false, key);
  }
});
