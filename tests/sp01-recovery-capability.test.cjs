'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

test('SP01 recovery capability separates public documentation from target entitlement', () => {
  const evidence = require('../docs/sp01-recovery-capability-20261031.json');
  assert.equal(evidence.targetEnvironmentId, 'cloud1-d2gjahlq39bf141c7');
  assert.equal(evidence.databaseFamily, 'document');
  assert.equal(evidence.targetRollbackEntitlementVerified, false);
  assert.equal(evidence.targetConsoleObservation.backupOrRollbackEntryVisible, true);
  assert.equal(evidence.targetConsoleObservation.entryIdentityIndividuallyVerified, false);
  assert.equal(evidence.targetConsoleObservation.availableBackupAreaText, '暂无数据');
  assert.equal(evidence.targetConsoleObservation.retentionShown, false);
  assert.equal(evidence.targetBackupRetentionDays, null);
  assert.equal(evidence.restoreExecuted, false);
  assert.equal(evidence.sp01Passed, false);
  assert.ok(evidence.sources.every(source => source.url.startsWith('https://')));
});
