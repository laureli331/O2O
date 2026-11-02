'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const evidence = require('../docs/sp01-taro-vite-runner-comparison-20261102.json');
const readiness = require('../docs/sp01-readiness-review-20261030.json');

test('Taro Vite comparison preserves React alignment and does not claim to resolve R01', () => {
  assert.equal(evidence.scope, 'isolated-compatibility-comparison-only');
  assert.equal(evidence.candidate.taro, '4.3.1');
  assert.equal(evidence.candidate.taroViteRunner, '4.3.1');
  assert.equal(evidence.candidate.react, '18.3.1');
  assert.equal(evidence.candidate.reactDom, '18.3.1');
  assert.equal(evidence.candidate.typesReact, '18.3.1');
  assert.equal(evidence.candidate.typesReactDom, '18.3.1');
  assert.equal(evidence.candidate.typescript, '5.9.3');
  assert.equal(evidence.dependencyGraph.webpackPresent, false);
  assert.equal(evidence.dependencyGraph.taroWebpack5RunnerPresent, false);
  assert.equal(evidence.dependencyGraph.taroLoaderPresent, false);
  assert.equal(evidence.dependencyGraph.cliTemplateFetcherPresent, true);
  assert.equal(evidence.verification.typecheck.exitCode, 0);
  assert.equal(evidence.verification.weappBuild.exitCode, 0);
  assert.equal(evidence.verification.weappBuild.modulesTransformed, 144);
  assert.deepEqual(evidence.verification.audit.severityEntries, {
    critical: 4,
    high: 16,
    moderate: 23,
    low: 2,
    info: 0,
  });
  assert.equal(evidence.decision.adopted, false);
  assert.equal(evidence.decision.r01Status, 'pending');
  assert.equal(evidence.decision.sp01Passed, false);
  assert.equal(evidence.decision.sp07Started, false);
  assert.equal(evidence.decision.productAcceptancePassed, false);

  const r01 = readiness.openItems.find((item) => item.id === 'R01');
  assert.equal(r01.state, 'pending');
  assert.equal(r01.viteRunnerComparisonEvidence, 'docs/sp01-taro-vite-runner-comparison-20261102.json');
  assert.equal(readiness.sp01Passed, false);
  assert.equal(readiness.sp07Started, false);
  assert.equal(readiness.productAcceptancePassed, false);

  const markdown = fs.readFileSync(path.join(__dirname, '../docs/sp01-taro-vite-runner-comparison-20261102.md'), 'utf8');
  assert.match(markdown, /Do not adopt this candidate/);
  assert.match(markdown, /R01 stays pending/);
  assert.match(markdown, /Taro compiler configuration/);
});
