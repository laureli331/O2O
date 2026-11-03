'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const baselineDir = path.join(root, 'tools/sp01-taro-431-baseline-audit');
const candidateDir = path.join(root, 'tools/sp01-taro-432-audit');
const evidencePath = path.join(root, 'docs/sp01-taro-432-compatibility-20261103.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function severityCounts(report) {
  return report.metadata.vulnerabilities;
}

test('Taro 4.3.2 isolated candidate preserves the agreed version and peer constraints', () => {
  const manifest = readJson(path.join(candidateDir, 'package.json'));
  const lock = readJson(path.join(candidateDir, 'package-lock.json'));

  assert.equal(manifest.dependencies.react, '18.3.1');
  assert.equal(manifest.dependencies['react-dom'], '18.3.1');
  assert.equal(manifest.devDependencies['@types/react'], '18.3.1');
  assert.equal(manifest.devDependencies['@types/react-dom'], '18.3.1');
  assert.equal(manifest.devDependencies.typescript, '5.9.3');
  assert.equal(manifest.devDependencies.webpack, '5.91.0');

  for (const section of ['dependencies', 'devDependencies']) {
    for (const [name, version] of Object.entries(manifest[section])) {
      if (name.startsWith('@tarojs/')) assert.equal(version, '4.3.2', `${section}.${name}`);
    }
  }
  for (const [name, pkg] of Object.entries(lock.packages)) {
    if (name.includes('/node_modules/@tarojs/') && pkg.version) {
      assert.equal(pkg.version, '4.3.2', name);
    }
  }
  assert.equal(lock.packages['node_modules/@tarojs/webpack5-runner'].peerDependencies.webpack, '5.91.0');
});

test('public registry audit comparison records package-entry delta without claiming risk remediation', () => {
  const baseline = readJson(path.join(baselineDir, 'npm-audit-public-report-20261103.json'));
  const candidate = readJson(path.join(candidateDir, 'npm-audit-public-report-20261103.json'));

  assert.deepEqual(severityCounts(baseline), { info: 0, low: 1, moderate: 32, high: 18, critical: 4, total: 55 });
  assert.deepEqual(severityCounts(candidate), { info: 0, low: 1, moderate: 31, high: 18, critical: 4, total: 54 });
  const baselineNames = new Set(Object.keys(baseline.vulnerabilities));
  const candidateNames = new Set(Object.keys(candidate.vulnerabilities));
  assert.deepEqual([...baselineNames].filter((name) => !candidateNames.has(name)), ['stylus']);
  assert.deepEqual([...candidateNames].filter((name) => !baselineNames.has(name)), []);

  for (const name of ['@tarojs/cli', '@tarojs/components', '@tarojs/webpack5-runner', 'adm-zip', 'decompress', 'download-git-repo', 'git-clone', 'swiper']) {
    assert.equal(candidate.vulnerabilities[name].severity, baseline.vulnerabilities[name].severity, name);
  }
});

test('production-only audits preserve exact counts and do not claim product exploitability', () => {
  const baseline = readJson(path.join(baselineDir, 'npm-audit-production-report-20261103.json'));
  const candidate = readJson(path.join(candidateDir, 'npm-audit-production-report-20261103.json'));
  const evidence = readJson(evidencePath);
  const production = evidence.productionDependencyAudit;

  assert.deepEqual(severityCounts(baseline), { info: 0, low: 1, moderate: 15, high: 2, critical: 3, total: 21 });
  assert.deepEqual(severityCounts(candidate), { info: 0, low: 1, moderate: 15, high: 2, critical: 3, total: 21 });
  assert.equal(baseline.metadata.dependencies.prod, 479);
  assert.equal(candidate.metadata.dependencies.prod, 479);
  assert.deepEqual(production.criticalAffectedPackageEntries, ['@tarojs/components', '@tarojs/taro', 'swiper']);
  assert.equal(production.commandExitCode, 1);
  assert.equal(production.riskRemediationClaimed, false);
  assert.match(production.scopeLimit, /does not establish shipped mini-program bundle reachability/);
  assert.equal(production.directCriticalAdvisoriesObserved[0].url, 'https://github.com/advisories/GHSA-hmx5-qpq5-p643');
});

test('Taro 4.3.2 evidence links actual checks and keeps R01/SP01 pending', () => {
  const evidence = readJson(evidencePath);
  const review = readJson(path.join(root, 'docs/sp01-readiness-review-20261030.json'));
  const plan = readJson(path.join(root, 'docs/v1-executable-development-plan-20261027.json'));
  const sp01 = plan.tasks.find((task) => task.id === 'SP01');
  const r01 = review.openItems.find((item) => item.id === 'R01');

  assert.equal(evidence.date, '2026-11-03');
  assert.equal(evidence.checks.appStrictTypecheck.exitCode, 0);
  assert.equal(evidence.checks.ownDeclarationInventory.declarationCount, 0);
  assert.equal(evidence.checks.ownDeclarationInventory.compilerExecuted, false);
  assert.equal(evidence.checks.vendorDeclarationFullTree.npmScriptExitCode, 2);
  assert.equal(evidence.checks.vendorDeclarationFullTree.typescriptExitCode, 2);
  assert.equal(evidence.checks.vendorDeclarationFullTree.diagnosticCount, 1056);
  assert.equal(evidence.checks.vendorDeclarationFullTree.declarationFileCount, 108);
  assert.equal(evidence.checks.weappBuild.exitCode, 0);
  assert.equal(evidence.checks.dependencyTree.exitCode, 0);
  assert.equal(evidence.checks.artifacts.productAcceptancePassed, false);
  assert.equal(evidence.decision.candidateAdopted, false);
  assert.equal(evidence.decision.r01Status, 'pending');
  assert.equal(evidence.decision.sp01Passed, false);
  assert.equal(evidence.productionDependencyAudit.candidate.affectedPackageEntries, 21);
  assert.equal(evidence.productionDependencyAudit.candidate.severity.critical, 3);
  assert.equal(evidence.productionDependencyAudit.riskRemediationClaimed, false);
  assert.equal(r01.state, 'pending');
  assert.equal(r01.latestTaro432CompatibilityEvidence, 'docs/sp01-taro-432-compatibility-20261103.json');
  assert.equal(r01.latestTaro432ProductionAuditEvidence, 'docs/sp01-taro-432-compatibility-20261103.json');
  assert.ok(review.sources.includes('docs/sp01-taro-432-compatibility-20261103.json'));
  assert.ok(review.sources.includes('docs/sp01-taro-432-compatibility-20261103.md'));
  assert.ok(review.sources.includes('tools/sp01-taro-431-baseline-audit/npm-audit-production-report-20261103.json'));
  assert.ok(review.sources.includes('tools/sp01-taro-432-audit/npm-audit-production-report-20261103.json'));
  assert.equal(sp01.executionProgress.latestTaro432CompatibilityEvidence, 'docs/sp01-taro-432-compatibility-20261103.json');
  assert.equal(sp01.executionProgress.latestTaro432ProductionAuditEvidence, 'docs/sp01-taro-432-compatibility-20261103.json');

  const markdown = fs.readFileSync(path.join(root, 'docs/sp01-taro-432-compatibility-20261103.md'), 'utf8');
  assert.match(markdown, /v4\.3\.2/);
  assert.match(markdown, /React 18\.3\.1/);
  assert.match(markdown, /\| 4 \/ 18 \/ 32 \/ 1 \|/);
  assert.match(markdown, /--omit=dev/);
  assert.match(markdown, /R01.*pending/);
});
