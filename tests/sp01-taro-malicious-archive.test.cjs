'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const evidencePath = path.join(root, 'docs/sp01-taro-malicious-archive-20261105.json');

test('R01 records reproduced Windows path traversal without granting security clearance', () => {
  assert.ok(fs.existsSync(evidencePath), 'record the isolated probe result before marking this test complete');
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));

  assert.equal(evidence.task, 'SP01');
  assert.equal(evidence.item, 'R01');
  assert.equal(evidence.reuseInvestigation.dependencyPath, 'tools/sp01-taro-432-audit/node_modules/decompress');
  assert.equal(evidence.reuseInvestigation.dependencyVersion, '4.2.1');
  assert.equal(evidence.advisory.id, 'GHSA-hrh2-vp3x-79xf');
  assert.equal(evidence.probe.platform, 'win32');
  assert.equal(evidence.probe.externalNetworkRequests, 0);
  assert.equal(evidence.probe.cloudCalls, 0);
  assert.equal(evidence.probe.externalPathResolutionAttempted, true);
  assert.equal(evidence.probe.outsideSandboxDataReadWriteConfirmed, false);
  assert.equal(evidence.probe.tempSandboxRemoved, true);
  assert.equal(evidence.results.directTraversal.writeOutsideExtractionRootObserved, true);
  assert.equal(evidence.results.directTraversal.writeStayedInsideIsolatedSandbox, true);
  assert.equal(evidence.results.symlinkChain.writeOutsideSandboxObserved, false);
  assert.equal(evidence.results.symlinkChain.sentinelUnchanged, true);
  assert.equal(evidence.results.symlinkChain.reproductionStatus, 'not-reproduced-by-this-fixture');
  assert.equal(evidence.decision.r01SecurityResult, 'direct-path-traversal-reproduced; advisory-symlink-chain-not-reproduced');
  assert.equal(evidence.decision.securityClearance, 'not-established-platform-limited');
  assert.equal(evidence.decision.r01Status, 'pending');
  assert.equal(evidence.decision.sp01Passed, false);
  assert.equal(evidence.decision.sp07Started, true);
  assert.equal(evidence.decision.remoteArchiveExecutionEnabled, false);
});
