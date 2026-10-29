'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const evidence = require('../docs/sp01-guarded-range-evidence-20261029.json');

test('guarded cloud evidence preserves transport arithmetic and independent exact-scope cleanup', () => {
  const result = evidence.result;
  const g = result.guarded;
  assert.equal(g.chunkCount * 256 * 1024, result.binaryBytes);
  assert.equal(g.normalSourceRequests, g.chunkCount);
  assert.equal(g.normalSourceBytes, result.binaryBytes);
  assert.ok(g.maxResponseBytes < g.responseLimitBytes);
  assert.ok(g.cases.every((entry) => entry.passed === true));
  const earlyRejections = g.cases.filter((entry) => ['unauthorized-B', 'stale-request-version'].includes(entry.name));
  assert.equal(earlyRejections.length, 2);
  assert.ok(earlyRejections.every((entry) => entry.sourceRequests === 0 && entry.noContent));
  assert.ok(result.cloudPath.startsWith(evidence.independentCleanupRead.cloudPath));
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(evidence.independentCleanupRead.files.length, evidence.independentCleanupRead.totalCount);
  assert.equal(evidence.independentCleanupRead.totalCount, 0);
  assert.equal(evidence.temporaryFunctionDeleted, true);
  assert.equal(evidence.functionDeletionEvidence.deletedFunctionAbsent, true);
  assert.equal(evidence.functionDeletionEvidence.remainingFunctions.includes(evidence.functionName), false);
  assert.ok(evidence.functionDeletionEvidence.remainingFunctions.includes('sp01IdentityProbe'));
});

test('synthetic grant evidence cannot silently become real user or product acceptance', () => {
  assert.equal(evidence.source, 'user-returned-cloud-console-json');
  assert.equal(evidence.result.evidenceScope, 'real-storage/synthetic-grants');
  assert.equal(evidence.realUserAuthorizationVerified, false);
  assert.equal(evidence.sp01Passed, false);
  assert.equal(evidence.productAcceptancePassed, false);
  assert.equal(evidence.requestId, null);
  assert.ok(evidence.limitations.length > 0);
});
