'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { encodedResponseBytes, compareTransport } = require('../tools/sp01-storage-probe/transport-sizing.cjs');

test('base64 capacity calculation agrees with actual serialized responses at padding boundaries', () => {
  for (const size of [0, 1, 2, 3, 4, 255, 256, 257, 5 * 1024 * 1024]) {
    const actual = Buffer.byteLength(JSON.stringify({ data: Buffer.alloc(size).toString('base64') }));
    assert.equal(encodedResponseBytes(size), actual);
  }
});
test('an allowed 5MiB image cannot fit a single minimal 6MiB base64 response', () => {
  const result = compareTransport(5 * 1024 * 1024, 6 * 1024 * 1024, 256 * 1024);
  assert.equal(result.wholeFitsMinimalEnvelope, false);
  assert.equal(result.chunkCount, 20);
  assert.equal(result.chunkFitsMinimalEnvelope, true);
});
test('experiment parameters cannot silently allow invalid sizes or oversized chunks', () => {
  for (const bad of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => encodedResponseBytes(bad));
  }
  assert.throws(() => compareTransport(1, 0, 1));
  assert.throws(() => compareTransport(1, 100, 0));
  assert.equal(compareTransport(100, 20, 100).chunkFitsMinimalEnvelope, false);
});
