'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const report = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../docs/sp01-taro-compatibility-20261029.json'), 'utf8'));
test('peer repair evidence is separate from original failures and preserves supported Webpack and Taro', () => {
  assert.equal(report.baselineEvidence, 'docs/sp01-taro-reuse-review-20261029.json');
  assert.equal(report.validation.dependencyTreeExitCode, 0);
  assert.equal(report.validation.weappBuildExitCode, 0);
  assert.equal(report.changes.webpack, '5.91.0');
  assert.equal(report.changes.taro, '4.3.1');
  assert.equal(report.reuseChecks.forceOrLegacyPeerDepsUsed, false);
  assert.equal(report.reuseChecks.thirdPartySourceModified, false);
  assert.equal(report.validation.audit.counts.total, Object.entries(report.validation.audit.counts).filter(([key]) => key !== 'total').reduce((sum, [, value]) => sum + value, 0));
  assert.equal(report.validation.audit.allFindingsResolved, false);
});
test('policy comparison does not adopt a scope change or convert declaration failures to product acceptance', () => {
  const p = report.validation.typePolicyComparison;
  assert.equal(p.fullDeclarationExitCode, 2);
  assert.equal(p.sourceOnlyExitCode, 0);
  assert.ok(p.negativeCases.every((entry) => entry.exitCode === 2 && entry.expectedDiagnosticObserved));
  assert.equal(p.originalConfigUnchanged, true);
  assert.equal(p.policyAdopted, false);
  assert.equal(p.fullDeclarationCheckPassed, false);
  assert.equal(report.typeCheckPolicyDecision, 'awaiting-user-confirmation');
  assert.equal(report.candidateCompatibilityAccepted, false);
  assert.equal(report.productAcceptancePassed, false);
});
