'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const json = (relativePath) => JSON.parse(read(relativePath));

test('QD03 signs only the SP01-SP06 preparation gate and preserves product acceptance as open', () => {
  const plan = json('docs/v1-executable-development-plan-20261027.json');
  const signoff = json('docs/qd03-sp07-local-foundation-20261104.json');
  const quality = json('docs/v1-quality-acceptance-20261027.json');
  const qd03 = quality.criteria.find((criterion) => criterion.id === 'QD03');

  assert.ok(qd03, 'the original QD03 criterion remains in the quality contract');
  assert.equal(qd03.productResult, 'not-executed');
  assert.equal(signoff.criterionId, 'QD03');
  assert.equal(signoff.scope, 'SP01-SP06-preparation-to-SP07-foundation-entry');
  assert.deepEqual(signoff.prerequisiteTasks, ['SP01', 'SP02', 'SP03', 'SP04', 'SP05', 'SP06']);
  assert.deepEqual(signoff.prerequisiteStatuses, {
    SP01: 'complete',
    SP02: 'complete',
    SP03: 'complete',
    SP04: 'complete',
    SP05: 'complete',
    SP06: 'complete',
  });
  assert.equal(signoff.decision.status, 'signed-for-scoped-foundation');
  assert.equal(signoff.decision.productAcceptancePassed, false);
  assert.equal(signoff.decision.productResult, 'not-executed');
  assert.deepEqual(signoff.preservedLaterGates.map((gate) => gate.criterionId), [
    'QP05', 'QP06', 'QP07', 'QP08', 'QP09', 'QP10', 'QS02', 'QR06',
  ]);
  assert.equal(signoff.remoteArchiveExecution.enabled, false);
  assert.equal(signoff.remoteArchiveExecution.preservedTest, 'tests/sp01-taro-malicious-archive.test.cjs');
  assert.equal(signoff.remoteArchiveExecution.evidenceJsonPresent, false);
  assert.equal(fs.existsSync(path.join(root, signoff.remoteArchiveExecution.preservedTest)), true);

  const latestGate = plan.sp01StageBoundaryClarification.latestQD03Signoff;
  assert.equal(latestGate.document, 'docs/qd03-sp07-local-foundation-20261104.json');
  assert.equal(latestGate.signed, true);
  assert.equal(latestGate.productAcceptancePassed, false);
  assert.ok(plan.sources.includes('docs/qd03-sp07-local-foundation-20261104.md'));
  assert.ok(plan.sources.includes('docs/qd03-sp07-local-foundation-20261104.json'));
  assert.equal(plan.tasks.find((task) => task.id === 'SP07').status, 'in-progress');
  assert.deepEqual(plan.tasks.find((task) => task.id === 'SP07').dependsOn, signoff.prerequisiteTasks);
});

test('the new formal workspace pins the confirmed shared toolchain without adopting the QuickStart', () => {
  const rootManifest = json('package.json');
  const miniapp = json('apps/mini-program/package.json');
  const web = json('apps/admin-web/package.json');
  const shared = json('packages/shared/package.json');
  const sharedTs = json('packages/shared/tsconfig.json');
  const cloudFunctions = json('apps/cloud-functions/package.json');
  const lock = json('package-lock.json');

  assert.equal(rootManifest.packageManager, 'npm@10.8.2');
  assert.deepEqual(rootManifest.workspaces, ['apps/*', 'packages/*']);
  assert.equal(rootManifest.engines.node, '>=20.19.0 <21');
  assert.equal(rootManifest.devDependencies.typescript, '5.9.3');
  assert.equal(rootManifest.devDependencies['@types/react'], '18.3.1');
  assert.equal(rootManifest.devDependencies['@types/react-dom'], '18.3.1');
  assert.equal(rootManifest.overrides.react, '18.3.1');
  assert.equal(rootManifest.overrides['react-dom'], '18.3.1');
  assert.equal(rootManifest.overrides['@types/react'], '18.3.1');
  assert.equal(rootManifest.overrides['@types/react-dom'], '18.3.1');
  assert.equal(rootManifest.overrides.typescript, '5.9.3');
  assert.ok(rootManifest.scripts['check:shared']);
  assert.ok(rootManifest.scripts['build:weapp']);
  assert.ok(rootManifest.scripts['build:web']);
  assert.ok(!Object.keys(rootManifest.scripts).some((name) => /deploy|publish|template|download/i.test(name)));
  assert.ok(!rootManifest.workspaces.some((workspace) => workspace.includes('miniprogram')));

  for (const manifest of [miniapp, web]) {
    assert.equal(manifest.dependencies.react, '18.3.1');
    assert.equal(manifest.dependencies['react-dom'], '18.3.1');
    assert.equal(manifest.devDependencies['@types/react'], '18.3.1');
    assert.equal(manifest.devDependencies['@types/react-dom'], '18.3.1');
    assert.equal(manifest.devDependencies.typescript, '5.9.3');
  }
  assert.equal(miniapp.devDependencies['@tarojs/cli'], '4.3.2');
  assert.equal(miniapp.devDependencies['@tarojs/webpack5-runner'], '4.3.2');
  assert.equal(miniapp.devDependencies.webpack, '5.91.0');
  assert.equal(web.devDependencies.vite, '8.3.5');
  assert.equal(shared.peerDependencies.react, '18.3.1');
  assert.equal(sharedTs.compilerOptions.strict, true);
  assert.ok(!sharedTs.compilerOptions.lib.some((library) => /dom/i.test(library)));
  assert.deepEqual(lock.packages[''].workspaces, rootManifest.workspaces);
  assert.equal(lock.packages['apps/mini-program'].dependencies.react, '18.3.1');
  assert.equal(lock.packages['apps/admin-web'].dependencies.react, '18.3.1');
  assert.equal(cloudFunctions.scripts?.deploy, undefined);
  assert.ok(!JSON.stringify(cloudFunctions.dependencies ?? {}).includes('wx-server-sdk'));
});

test('authored starter TS has no any or platform globals and cloud workspace has no live integration', () => {
  const authoredSourceRoots = [
    'packages/shared/src',
    'apps/mini-program/src',
    'apps/admin-web/src',
  ].map((relativePath) => path.join(root, relativePath));
  const sourceFiles = [];
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) sourceFiles.push(entryPath);
    }
  };
  for (const sourceRoot of authoredSourceRoots) visit(sourceRoot);

  assert.ok(sourceFiles.length > 0, 'authored TypeScript workspaces must contain checked source');
  for (const file of sourceFiles) {
    const source = fs.readFileSync(file, 'utf8');
    if (file.includes(`${path.sep}packages${path.sep}shared${path.sep}`)) {
      assert.doesNotMatch(source, /\b(?:window|document|wx)\b/, path.relative(root, file));
    }
    assert.doesNotMatch(source, /\bany\b/, path.relative(root, file));
  }
  assert.equal(fs.existsSync(path.join(root, 'miniprogram/project.config.json')), true);
  assert.equal(fs.existsSync(path.join(root, 'apps/mini-program/config/index.ts')), true);
  assert.equal(fs.existsSync(path.join(root, 'apps/admin-web/vite.config.ts')), true);
  assert.equal(fs.existsSync(path.join(root, 'apps/cloud-functions/README.md')), true);
  assert.equal(fs.existsSync(path.join(root, 'tsconfig.json')), true);
  assert.equal(json('tsconfig.json').compilerOptions.strict, true);
});

test('SP07 records clean-room checks honestly and preserves the sole missing-evidence regression', () => {
  const signoff = json('docs/qd03-sp07-local-foundation-20261104.json');
  const validation = signoff.validation;
  const plan = json('docs/v1-executable-development-plan-20261027.json');
  const sp07 = plan.tasks.find((task) => task.id === 'SP07');

  assert.equal(validation.date, '2026-11-05');
  assert.equal(validation.runtime.node, '20.19.3');
  assert.equal(validation.runtime.npm, '10.8.2');
  assert.equal(validation.cleanRoom.evidenceDate, '2026-11-04');
  assert.equal(validation.cleanRoom.install.exitCode, 0);
  assert.equal(validation.cleanRoom.install.packagesAdded, 1163);
  assert.deepEqual(validation.cleanRoom.checks.map((check) => check.exitCode), [0, 0, 0]);
  assert.equal(validation.workingTree.sourceScan.credentialFileCount, 0);
  assert.equal(validation.workingTree.sourceScan.staticPatternMatches, 0);
  assert.match(validation.workingTree.sourceScan.limitations, /not a secret-scanner or security audit/i);

  const regression = validation.workingTree.fullRegression;
  assert.equal(regression.total, 1652);
  assert.equal(regression.passed, 1651);
  assert.equal(regression.failed, 1);
  assert.equal(regression.skipped, 0);
  assert.match(regression.failure, /sp01-taro-malicious-archive-20261103\.json/);
  assert.equal(validation.workingTree.workspaceBoundaryGate.result, 'passed');
  assert.match(validation.workingTree.workspaceBoundaryGate.limitations, /not a secret-scanner/i);
  assert.equal(sp07.executionProgress.date, '2026-11-05');
  assert.equal(sp07.status, 'in-progress');
  assert.equal(sp07.productAcceptancePassed, false);
  assert.ok(sp07.executionProgress.remainingAcceptance.some((item) => /full repository regression is not green/i.test(item)));
});
