'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('target QuickStart binds only the user-confirmed CloudBase environment without claiming live verification', () => {
  const plan = JSON.parse(read('docs/v1-executable-development-plan-20261027.json'));
  const project = JSON.parse(read('miniprogram/project.config.json'));
  const app = read('miniprogram/miniprogram/app.js');
  const observation = plan.accountEvidence.latestUserCreatedProjectAndCloudConsoleObservation;
  const screenshot = observation.latestEnvironmentDetailsScreenshot;
  const env = app.match(/^\s*env:\s*(['"])(.*?)\1\s*,?$/m);

  assert.equal(project.appid, plan.accountEvidence.formalNewAppId);
  assert.equal(plan.accountEvidence.formalNewEnvironmentStatus, 'screenshot-confirmed-created-associated-not-api-verified');
  assert.equal(screenshot.visibleAppId, project.appid);
  assert.equal(screenshot.visibleEnvironmentId, plan.accountEvidence.formalNewEnvironmentId);
  assert.equal(screenshot.provesTargetAppEnvironmentAssociation, true);
  assert.equal(observation.cloudEnvironmentBindingApiVerified, false);
  assert.ok(env, 'QuickStart must configure an explicit CloudBase environment ID');
  assert.equal(env[2], plan.accountEvidence.formalNewEnvironmentId);
  assert.match(app, /wx\.cloud\.init\(\{\s*env:\s*this\.globalData\.env/);
  assert.equal(plan.accountEvidence.liveCloudRevalidatedThisDelivery, false);
});
