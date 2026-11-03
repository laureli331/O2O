'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const json = (relativePath) => JSON.parse(read(relativePath));
const evidence = json('docs/sp01-taro-432-maintenance-followup-20261103.json');
const artifactDir = 'tools/sp01-taro-432-audit/maintenance-followup-20261103';

test('R01 maintenance follow-up preserves the confirmed single-version toolchain and stays isolated', () => {
  assert.equal(evidence.scope, 'isolated-candidate-compatibility-only');
  assert.equal(evidence.candidate.adoptionStatus, 'not-adopted');
  assert.equal(evidence.versionConstraints.react, '18.3.1');
  assert.equal(evidence.versionConstraints.reactDom, '18.3.1');
  assert.equal(evidence.versionConstraints.reactTypes, '18.3.1');
  assert.equal(evidence.versionConstraints.reactDomTypes, '18.3.1');
  assert.equal(evidence.versionConstraints.typescript, '5.9.3');
  assert.equal(evidence.versionConstraints.webpack, '5.91.0');
  assert.equal(evidence.versionConstraints.strictPeerDependencies, true);
  assert.equal(evidence.checks.weappBuild.syntheticSampleOnly, true);
  assert.equal(evidence.checks.weappBuild.exitCode, 0);
  assert.equal(evidence.checks.cleanInstall.exitCode, 0);
  assert.equal(evidence.checks.dependencyTree.exitCode, 0);
  assert.deepEqual(evidence.checks.dependencyTree.problems, []);
  assert.equal(evidence.checks.applicationTypecheck.exitCode, 0);
  assert.equal(evidence.checks.thirdPartyDeclarationTypecheck.exitCode, 2);
  assert.equal(evidence.checks.thirdPartyDeclarationTypecheck.diagnostics, 1056);
  assert.equal(evidence.checks.thirdPartyDeclarationTypecheck.declarationFiles, 108);
  assert.equal(evidence.readinessDecision.r01State, 'pending');
  assert.equal(evidence.readinessDecision.sp01Passed, false);
  assert.equal(evidence.readinessDecision.sp07Started, false);
});

test('audit figures are calculated from preserved raw reports and keep 432 maintenance baseline distinct', () => {
  const reportPairs = [
    ['fullAuditBaseline', 'isolated432Baseline', 'npm-audit-baseline-full.json'],
    ['fullAuditCandidate', 'isolated432Candidate', 'npm-audit-candidate-full.json']
  ];
  for (const [artifactKey, recordKey, fileName] of reportPairs) {
    const report = json(path.posix.join(artifactDir, fileName));
    const recorded = evidence.auditComparison[recordKey];
    assert.equal(report.metadata.vulnerabilities.total, recorded.affectedPackageEntries);
    for (const severity of ['low', 'moderate', 'high', 'critical']) {
      assert.equal(report.metadata.vulnerabilities[severity], recorded.severity[severity]);
    }
    assert.equal(report.metadata.dependencies.total, recorded.dependencyEntries);
    assert.ok(evidence.evidenceArtifacts[artifactKey]);
  }

  const productionBaseline = json(path.posix.join(artifactDir, 'npm-audit-baseline-production.json'));
  const productionCandidate = json(path.posix.join(artifactDir, 'npm-audit-candidate-production.json'));
  assert.equal(productionBaseline.metadata.vulnerabilities.total, 21);
  assert.equal(productionCandidate.metadata.vulnerabilities.total, 21);
  assert.deepEqual(
    productionBaseline.metadata.vulnerabilities,
    productionCandidate.metadata.vulnerabilities
  );
  assert.equal(evidence.auditComparison.productionDependencyComparison.riskRemediationClaimed, false);
  assert.match(evidence.auditComparison.comparisonBoundary, /Taro 4\.3\.1-to-4\.3\.2/);
});

test('maintenance candidate package pins and independent validation artifacts match the structured record', () => {
  const manifest = json(path.posix.join(artifactDir, 'candidate.package.json'));
  const lock = json(path.posix.join(artifactDir, 'candidate.package-lock.json'));
  assert.equal(manifest.dependencies.react, '18.3.1');
  assert.equal(manifest.dependencies['react-dom'], '18.3.1');
  assert.equal(manifest.devDependencies['@types/react'], '18.3.1');
  assert.equal(manifest.devDependencies['@types/react-dom'], '18.3.1');
  assert.equal(manifest.devDependencies.typescript, '5.9.3');
  assert.equal(manifest.devDependencies.webpack, '5.91.0');
  assert.deepEqual(manifest.overrides, evidence.candidate.experimentOverrides);
  assert.equal(lock.packages['node_modules/adm-zip'].version, '0.6.1');
  assert.equal(lock.packages['node_modules/serialize-javascript'].version, '7.1.4');
  const schemaUtilsFour = Object.entries(lock.packages)
    .filter(([packagePath]) => /(?:^|\/)node_modules\/schema-utils$/.test(packagePath))
    .map(([, entry]) => entry.version)
    .filter((version) => version.startsWith('4.'));
  assert.ok(schemaUtilsFour.length > 0);
  assert.ok(schemaUtilsFour.every((version) => version === '4.3.3'));
  assert.equal(lock.packages['node_modules/schema-utils'].version, '2.7.1');
  assert.equal(lock.packages['node_modules/glob'].version, '10.5.0');

  assert.equal(evidence.checks.archiveCompatibility.passed, true);
  assert.equal(evidence.checks.archiveCompatibility.vulnerabilityReproductionPerformed, false);
  for (const relativePath of Object.values(evidence.evidenceArtifacts)) {
    assert.ok(fs.existsSync(path.join(root, relativePath)), `missing evidence artifact: ${relativePath}`);
  }
});

test('readiness index keeps R01 pending and does not start SP07', () => {
  const readiness = json('docs/sp01-readiness-review-20261030.json');
  const r01 = readiness.openItems.find((item) => item.id === 'R01');
  const plan = json('docs/v1-executable-development-plan-20261027.json');
  const sp07 = plan.tasks.find((task) => task.id === 'SP07');
  assert.equal(readiness.sp01Passed, false);
  assert.equal(readiness.sp07Started, false);
  assert.equal(r01.state, 'pending');
  assert.equal(r01.latestMaintenanceFollowupEvidence, 'docs/sp01-taro-432-maintenance-followup-20261103.json');
  assert.equal(sp07.status, 'planned');
  assert.equal(sp07.productAcceptancePassed, false);
});
