'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));

test('latest explicit user choice overrides native frontend for both clients without approving an adapter', () => {
  const d = json('docs/react-frontend-decision-20261029.json');
  const plan = json('docs/v1-executable-development-plan-20261027.json');
  const tech = json('docs/development-decisions.json');
  assert.equal(d.confirmed.miniappFramework, 'react');
  assert.equal(d.confirmed.adminFramework, 'react');
  assert.equal(d.confirmed.language, 'typescript');
  assert.equal(d.userEvidence.selection, '2');
  assert.equal(d.adapter.status, 'awaiting-user-confirmation');
  assert.equal(d.adapter.selected, null);
  assert.equal(d.adapter.recommended, 'taro');
  assert.equal(tech.approval.frontend, 'native-wechat-typescript');
  assert.equal(tech.currentFrontendApproval.frontend, 'react-typescript-miniapp-adapter-pending');
  assert.equal(plan.architecture.frontend, tech.currentFrontendApproval.frontend);
  assert.equal(plan.architecture.adminFramework, 'react');
  assert.equal(plan.architecture.miniappAdapter, null);
  assert.equal(plan.architecture.backend, 'node-cloud-functions');
  assert.equal(plan.firstProductTask, 'SP07');
  assert.equal(d.formalProjectCreated, false);
  assert.equal(d.productAcceptancePassed, false);
  assert.ok(plan.sources.includes('docs/react-frontend-decision-20261029.json'));
  assert.match(read('docs/v1-executable-development-plan-20261027.md'), /react-frontend-decision-20261029/);
});

test('Taro React candidate records actual peer constraint rather than assuming latest React support', () => {
  const d = json('docs/react-frontend-decision-20261029.json');
  assert.equal(d.candidates.taro.version, '4.3.1');
  assert.equal(d.candidates.taro.reactPeer, '^18');
  assert.equal(d.candidates.reactVersion, '18.3.1');
  assert.equal(d.candidates.versionsFrozen, false);
  assert.equal(d.candidates.buildVerified, false);
  assert.equal(d.candidates.twoPlatformUiReuseGuaranteed, false);
});
