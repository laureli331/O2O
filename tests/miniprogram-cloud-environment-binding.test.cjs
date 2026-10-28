'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('target QuickStart binding is backed by screenshot and read-only environment-list evidence without claiming runtime verification', () => {
  const plan = JSON.parse(read('docs/v1-executable-development-plan-20261027.json'));
  const project = JSON.parse(read('miniprogram/project.config.json'));
  const app = read('miniprogram/miniprogram/app.js');
  const observation = plan.accountEvidence.latestUserCreatedProjectAndCloudConsoleObservation;
  const screenshot = observation.latestEnvironmentDetailsScreenshot;
  const env = app.match(/^\s*env:\s*(['"])(.*?)\1\s*,?$/m);

  assert.equal(project.appid, plan.accountEvidence.formalNewAppId);
  assert.equal(plan.accountEvidence.formalNewEnvironmentStatus, 'screenshot-and-cli-cloud-env-list-confirmed-associated-runtime-not-verified');
  assert.equal(screenshot.visibleAppId, project.appid);
  assert.equal(screenshot.visibleEnvironmentId, plan.accountEvidence.formalNewEnvironmentId);
  assert.equal(screenshot.provesTargetAppEnvironmentAssociation, true);
  assert.equal(observation.cloudEnvironmentBindingApiVerified, true);
  assert.equal(observation.cloudEnvironmentBindingApiEvidenceDate, '2026-10-28');
  assert.equal(observation.cloudEnvironmentBindingApiEvidenceMethod, 'target-appid-scoped-cloud-env-list');
  assert.ok(env, 'QuickStart must configure an explicit CloudBase environment ID');
  assert.equal(env[2], plan.accountEvidence.formalNewEnvironmentId);
  assert.match(app, /wx\.cloud\.init\(\{\s*env:\s*this\.globalData\.env/);
  assert.equal(plan.accountEvidence.liveCloudRevalidatedThisDelivery, true);
  assert.equal(plan.accountEvidence.latestBridgeRecheck.environmentApiVerified, true);
  assert.equal(plan.accountEvidence.latestBridgeRecheck.runtimeVerified, false);
});
