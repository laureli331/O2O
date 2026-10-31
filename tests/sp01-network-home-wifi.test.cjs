'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeSamples } = require('../tools/sp01-network-probe/summarize.cjs');
const evidence = require('../docs/sp01-network-home-wifi-20261031.json');

test('OPPO home Wi-Fi result recomputes exactly and cannot be called link RTT or packet loss', () => {
  assert.equal(evidence.samples.length, 30);
  assert.deepEqual(summarizeSamples(evidence.samples), evidence.userReportedSummary);
  assert.equal(evidence.probeCommit, '837b286');
  assert.equal(evidence.scope, 'application-roundtrip-not-link-rtt-or-packet-loss');
  assert.ok(evidence.notMeasured.includes('link RTT'));
  assert.ok(evidence.notMeasured.includes('packet loss'));
  assert.equal(evidence.r04Passed, false);
  assert.equal(evidence.sp01Passed, false);
});
