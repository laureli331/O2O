'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const report = JSON.parse(read('docs/sp01-taro-reuse-review-20261029.json'));

test('Taro reuse record retains sources, license, ordered alternatives and actual build scope', () => {
  assert.deepEqual(report.investigation.map((item) => item.priority), [1, 2, 3, 4]);
  assert.ok(report.sources.some((source) => source.includes('templates/default/config/index.js')));
  assert.equal(report.licenses.templateLicenseRetained, true);
  assert.ok(report.comparison.directTemplate && report.comparison.localAdaptation && report.comparison.ownRenderer);
  assert.equal(report.validation.weappBuildExitCode, 0);
  assert.equal(report.validation.artifactChecksPassed, true);
  assert.equal(report.validation.devtoolsCompilationVerified, false);
  assert.equal(report.validation.realDeviceVerified, false);
  assert.match(read('tools/sp01-taro-probe/THIRD-PARTY-NOTICES.md'), /Copyright \(c\) 2018 O2Team/);
});

test('known candidate failures cannot become compatibility acceptance or weaken type checking', () => {
  assert.notEqual(report.validation.typecheckExitCode, 0);
  assert.notEqual(report.validation.dependencyTreeExitCode, 0);
  assert.equal(report.validation.audit.counts.total, 42);
  assert.equal(report.candidateCompatibilityAccepted, false);
  assert.equal(report.versionsFrozen, false);
  assert.equal(report.sp01Passed, false);
  assert.equal(report.productAcceptancePassed, false);
  const config = JSON.parse(read('tools/sp01-taro-probe/tsconfig.json'));
  assert.equal(config.compilerOptions.strict, true);
  assert.equal(config.compilerOptions.skipLibCheck, false);
  const project = JSON.parse(read('tools/sp01-taro-probe/project.config.json'));
  assert.equal(project.appid, 'touristappid');
  assert.equal(report.cloudResourcesChanged, false);
});
