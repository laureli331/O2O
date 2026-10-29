'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createChunkExperiment } = require('../tools/sp01-storage-probe/chunk-read-experiment.cjs');
const input = { objectId: 'synthetic-object', version: 'v1', index: 0 };
const grant = { allowed: true, fileKey: 'synthetic-file', version: 'v1', authorizationVersion: 'a1' };
function fixture(options = {}) {
  let reads = 0, checks = 0;
  const read = createChunkExperiment({
    chunkBytes: 256 * 1024, responseLimitBytes: 6 * 1024 * 1024,
    resolveGrant: async (actor, objectId) => {
      checks++;
      assert.equal(objectId, input.objectId);
      if (options.grants) return options.grants(checks);
      return actor.id === 'A' ? { ...grant } : null;
    },
    readVersion: async (key, version) => {
      reads++;
      assert.equal(key, grant.fileKey); assert.equal(version, 'v1');
      return Buffer.alloc(5 * 1024 * 1024, 31);
    }, ...options,
  });
  return { read, reads: () => reads, checks: () => checks };
}
test('5MiB synthetic content reconstructs exactly from bounded responses', async () => {
  const f = fixture(), parts = [];
  for (let index = 0; index < 20; index++) {
    const response = await f.read({ id: 'A' }, { ...input, index });
    assert.equal(response.success, true);
    assert.ok(Buffer.byteLength(JSON.stringify(response)) < 6 * 1024 * 1024);
    parts.push(Buffer.from(response.data, 'base64'));
  }
  assert.deepEqual(Buffer.concat(parts), Buffer.alloc(5 * 1024 * 1024, 31));
  assert.equal(f.checks(), 40);
});
test('forged client actor, role and file binding cannot grant B access', async () => {
  const f = fixture();
  const result = await f.read({ id: 'B' }, { ...input, actor: 'A', role: 'admin', fileKey: 'other' });
  assert.deepEqual(result, { success: false, code: 'FORBIDDEN' });
  assert.equal(f.reads(), 0);
});
test('revocation or object changes during read release no content', async () => {
  for (const replacement of [null, { ...grant, version: 'v2' }, { ...grant, fileKey: 'different' }, { ...grant, authorizationVersion: 'a2' }]) {
    const f = fixture({ grants: (count) => count === 1 ? grant : replacement });
    const result = await f.read({ id: 'A' }, input);
    assert.equal(result.success, false);
    assert.equal(result.data, undefined);
  }
});
test('access revoked between chunks blocks all following chunks', async () => {
  const f = fixture({ grants: (count) => count <= 2 ? grant : null });
  assert.equal((await f.read({ id: 'A' }, input)).success, true);
  assert.deepEqual(await f.read({ id: 'A' }, { ...input, index: 1 }), { success: false, code: 'FORBIDDEN' });
  assert.equal(f.reads(), 1);
});
test('in-place grant mutation during asynchronous I/O cannot rewrite the authorization snapshot', async () => {
  const mutable = { ...grant };
  const f = fixture({ grants: () => mutable, readVersion: async () => {
    mutable.authorizationVersion = 'changed';
    return Buffer.from('synthetic');
  } });
  assert.deepEqual(await f.read({ id: 'A' }, input), { success: false, code: 'VERSION_CONFLICT' });
});
test('simultaneous requests do not share the current actor or leak content to B', async () => {
  const f = fixture();
  const [a, b] = await Promise.all([f.read({ id: 'A' }, input), f.read({ id: 'B' }, input)]);
  assert.equal(a.success, true);
  assert.deepEqual(b, { success: false, code: 'FORBIDDEN' });
  assert.equal(f.reads(), 1);
});
test('invalid range, stale version, missing identity and failed I/O do not report success', async () => {
  const f = fixture();
  assert.equal((await f.read(null, input)).code, 'UNAUTHENTICATED');
  for (const index of [-1, 1.5, Infinity]) assert.equal((await f.read({ id: 'A' }, { ...input, index })).code, 'INVALID_INPUT');
  assert.equal((await f.read({ id: 'A' }, { ...input, version: 'old' })).code, 'VERSION_CONFLICT');
  assert.equal((await f.read({ id: 'A' }, { ...input, index: 20 })).code, 'INVALID_RANGE');
  const failed = fixture({ readVersion: async () => { throw Error('private-secret'); } });
  assert.deepEqual(await failed.read({ id: 'A' }, input), { success: false, code: 'UNCONFIRMED' });
});
