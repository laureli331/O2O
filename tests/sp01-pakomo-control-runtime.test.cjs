'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('../docs/sp01-pakomo-control-runtime-check-20261102.json');
const readiness = require('../docs/sp01-readiness-review-20261030.json');
const abortedAttempt = require('../docs/sp01-pakomo-attempt-20261102.json');

test('Pakomo runtime evidence records confirmed start, recovery, and the bounded-run overage without claiming a sample', () => {
  assert.equal(runtime.scope, 'local-device-control-only-no-cloud-sample');
  assert.equal(runtime.device.model, 'HUAWEI SEA-AL10');
  assert.equal(runtime.start.response.ok, true);
  assert.equal(runtime.start.response.confirmed, true);
  assert.equal(runtime.start.response.stage, 'forwarding');
  assert.equal(runtime.start.response.appliedRule, 'light');
  assert.equal(runtime.start.response.scope, 'applications');
  assert.equal(runtime.stop.response.ok, true);
  assert.equal(runtime.stop.response.active, false);
  assert.equal(runtime.postStopStatus.response.stage, 'stopped');
  assert.equal(runtime.postStopStatus.response.active, false);
  assert.equal(runtime.recovery.wifiValidated, true);
  assert.equal(runtime.recovery.vpnTransportPresent, false);
  assert.equal(runtime.authorization.authorizedMaximumVpnDurationMs, 60000);
  assert.equal(runtime.authorization.measuredStartToStopMs, 138824);
  assert.equal(runtime.authorization.durationLimitExceeded, true);
  assert.equal(runtime.networkSample.performed, false);
  assert.equal(runtime.networkSample.cloudBaseCalls, 0);
  assert.equal(runtime.networkSample.cloudDatabaseOrStorageWrites, false);
  assert.equal(runtime.acceptanceEvidence, false);

  const r04 = readiness.openItems.find(item => item.id === 'R04');
  assert.equal(r04.state, 'pending');
  assert.equal(r04.pakomoRuntimeControlEvidence, 'docs/sp01-pakomo-control-runtime-check-20261102.json');
  assert.match(r04.nextAction, /within that run's 60-second authorization/);
  assert.match(r04.nextAction, /Do not repeat under that consumed authorization/);
  assert.equal(readiness.sp01Passed, false);
});

test('later Pakomo authorization is recorded as consumed without a CloudBase sample', () => {
  assert.equal(abortedAttempt.scope, 'authorized-local-pakomo-start-stop-no-cloud-sample');
  assert.equal(abortedAttempt.authorization.authorizedMaximumVpnDurationMs, 60000);
  assert.equal(abortedAttempt.authorization.measuredStartToStopMs, 77092);
  assert.equal(abortedAttempt.authorization.durationLimitExceededByMs, 17092);
  assert.equal(abortedAttempt.pakomo.start.confirmed, true);
  assert.equal(abortedAttempt.pakomo.start.appliedRule, 'light');
  assert.equal(abortedAttempt.pakomo.stop.confirmedInactive, true);
  assert.equal(abortedAttempt.pakomo.postStopStatus.active, false);
  assert.equal(abortedAttempt.sample.performed, false);
  assert.equal(abortedAttempt.sample.cloudBaseCalls, 0);
  assert.equal(abortedAttempt.sample.databaseOrStorageWrites, false);
  assert.equal(abortedAttempt.recovery.wifiNetworkAgentConnected, true);
  assert.equal(abortedAttempt.recovery.vpnNetworkAgentFound, false);
  assert.equal(abortedAttempt.acceptanceEvidence, false);
});
