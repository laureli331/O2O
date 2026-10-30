'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeSamples } = require('../tools/sp01-network-probe/summarize.cjs');

test('network sample summary retains failures and computes nearest-rank p95', () => {
  const result = summarizeSamples([
    { elapsedMs: 100, ok: true }, { elapsedMs: 200, ok: true },
    { elapsedMs: 300, ok: true }, { elapsedMs: 400, ok: false },
  ]);
  assert.deepEqual(result, { attempts: 4, succeeded: 3, failed: 1,
    failureRate: 0.25, medianMs: 200, p95Ms: 300, maxMs: 300,
    meanConsecutiveDifferenceMs: 100 });
});

test('network sample summary does not invent latency when all attempts fail', () => {
  assert.deepEqual(summarizeSamples([{ ok: false, elapsedMs: 500 }]), {
    attempts: 1, succeeded: 0, failed: 1, failureRate: 1,
    medianMs: null, p95Ms: null, maxMs: null,
    meanConsecutiveDifferenceMs: null,
  });
});

test('empty and malformed sample sets cannot be reported as successful measurements', () => {
  assert.equal(summarizeSamples([]).failureRate, null);
  assert.equal(summarizeSamples([]).p95Ms, null);
  assert.throws(() => summarizeSamples([{ ok: true, elapsedMs: -1 }]), TypeError);
  assert.throws(() => summarizeSamples([{ ok: true, elapsedMs: Number.NaN }]), TypeError);
});
