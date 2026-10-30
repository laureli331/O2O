'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createMaintenanceManifest, createMaintenanceWebManifest, maintenanceCandidateStatus } = require('../tools/sp01-shared-core-probe/maintenance-manifest.cjs');

test('maintenance comparison changes only the two scoped transitive overrides and preserves its input', () => {
  const baseline = { name: 'synthetic', dependencies: { react: '18.3.1' },
    overrides: { typescript: '5.9.3', 'schema-utils@^4.0.0': '4.3.3' } };
  const before = structuredClone(baseline);
  const candidate = createMaintenanceManifest(baseline);
  assert.deepEqual(baseline, before);
  assert.deepEqual(candidate, { ...before, overrides: { ...before.overrides,
    'adm-zip@^0.5.12': '0.6.1', 'serialize-javascript@^6.0.2': '7.1.4' } });
  candidate.dependencies.react = 'synthetic-mutated';
  assert.equal(baseline.dependencies.react, '18.3.1');
});
test('Web comparison pins the supported Vite build peer without changing React or TypeScript', () => {
  const baseline = { dependencies: { react: '18.3.1', 'react-dom': '18.3.1' },
    devDependencies: { typescript: '5.9.3', vite: '8.3.5' } };
  const before = structuredClone(baseline);
  assert.deepEqual(createMaintenanceWebManifest(baseline), { ...before,
    devDependencies: { ...before.devDependencies, esbuild: '0.28.2' } });
  assert.deepEqual(baseline, before);
});
test('candidate lock preserves approved core versions and makes the Web build peer reproducible', () => {
  const root = path.resolve(__dirname, '..');
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'tools/sp01-shared-core-probe/maintenance.workspace.package-lock.json')));
  const policy = require('../docs/frontend-version-policy-20261030.json');
  for (const app of ['apps/web', 'apps/miniapp']) {
    const entry = lock.packages[app];
    for (const name of ['react', 'react-dom', '@types/react', '@types/react-dom', 'typescript']) {
      assert.equal(entry.dependencies?.[name] || entry.devDependencies?.[name], policy.required[name]);
    }
  }
  assert.equal(lock.packages['node_modules/adm-zip'].version, '0.6.1');
  assert.equal(lock.packages['node_modules/serialize-javascript'].version, '7.1.4');
  assert.equal(lock.packages['apps/web'].devDependencies.esbuild, '0.28.2');
  assert.equal(lock.packages['apps/web/node_modules/esbuild'].version, '0.28.2');
  assert.notEqual(lock.packages['apps/web/node_modules/esbuild'].extraneous, true);
  assert.equal(lock.packages['node_modules/esbuild'].version, '0.21.5');
});
test('maintenance evidence records user adoption while retaining failed attempts and unresolved audit', () => {
  const root = path.resolve(__dirname, '..');
  const evidence = require('../docs/sp01-maintenance-candidate-20261030.json');
  const digest = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, evidence.lock))).digest('hex');
  assert.equal(evidence.lockSha256, digest);
  assert.equal(evidence.checks.finalFullDependencyTreeExitCode, 0);
  assert.equal(evidence.retainedFailures[0].dependencyTreeExitCode, 1);
  assert.equal(evidence.retainedFailures[1].fullDependencyTreeExitCode, 1);
  assert.equal(evidence.audit.exitCode, 1);
  assert.equal(evidence.audit.after.total, evidence.audit.after.moderate + evidence.audit.after.high + evidence.audit.after.critical);
  assert.deepEqual(evidence.audit.addedEntries, []);
  assert.equal(evidence.adopted, true);
  const policy = require('../docs/frontend-version-policy-20261030.json');
  assert.equal(evidence.userAdoption.reply, policy.approvedMaintenanceCandidate.userReply);
  assert.equal(evidence.lock, policy.approvedMaintenanceCandidate.lock);
  for (const key of ['versionsFrozen', 'vulnerabilityReproductionPerformed', 'cloudChanged', 'sp01Passed', 'sp07Started', 'productAcceptancePassed']) {
    assert.equal(evidence[key], false, key);
  }
});
test('candidate generator status reflects the approved SP01 candidate without implying product freeze', () => {
  assert.deepEqual(maintenanceCandidateStatus(), {
    candidateStatus: 'user-adopted-current-SP01-candidate',
    candidateScope: 'current-SP01-candidate-not-final-product-freeze',
    productVersionFrozen: false,
  });
});

test('remaining Taro dev-server risk records measured branch isolation without closing the audit', () => {
  const evidence = require('../docs/sp01-maintenance-candidate-20261030.json');
  const check = evidence.remainingRiskPathCheck;
  assert.equal(check.package, 'webpack-dev-server@4.15.2');
  assert.deepEqual(check.weapp, { miniEntryLoaded: true, h5EntryLoaded: false, devServerModuleLoaded: false });
  assert.deepEqual(check.h5, { miniEntryLoaded: false, h5EntryLoaded: true, devServerModuleLoaded: true });
  assert.equal(check.serverStarted, false);
  assert.equal(check.advisoryResolved, false);
  assert.equal(evidence.audit.allFindingsResolved, false);
});
