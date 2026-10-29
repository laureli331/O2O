'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGuardedReader, createHandler } = require('../tools/sp01-range-probe/function/handler');
const grant = { allowed: true, fileKey: 'owned', version: 'v1', authorizationVersion: 'a1',
  url: 'https://synthetic.invalid/f', expectedHost: 'synthetic.invalid', totalBytes: 7, etag: '"a"' };
function fixture({ resolve, read } = {}) {
  const calls = [];
  const reader = createGuardedReader({ chunkBytes: 3, responseLimitBytes: 1024,
    resolveGrant: resolve || (async (actor) => actor.id === 'A' ? grant : null),
    readRange: async (options) => { calls.push(options); return read ? read(options) : Buffer.from('abcdefg').subarray(options.start, options.end + 1); },
  });
  return { reader, calls };
}
const input = { objectId: 'object', version: 'v1', index: 0 };

test('guarded range reader reconstructs exact content with bounded reads and repeatable requests', async () => {
  const f = fixture();
  const results = [];
  for (let index = 0; index < 3; index++) results.push(await f.reader({ id: 'A' }, { ...input, index }));
  assert.equal(Buffer.concat(results.map((r) => Buffer.from(r.data, 'base64'))).toString(), 'abcdefg');
  assert.deepEqual(f.calls.map((o) => [o.start, o.end]), [[0, 2], [3, 5], [6, 6]]);
  assert.deepEqual(await f.reader({ id: 'A' }, input), results[0]);
});

test('unauthenticated, spoofed B, invalid bounds and old version do not read storage', async () => {
  const f = fixture();
  for (const [actor, request, code] of [
    [null, input, 'UNAUTHENTICATED'],
    [{ id: 'B' }, { ...input, actor: 'A', fileKey: 'owned', role: 'admin' }, 'FORBIDDEN'],
    [{ id: 'A' }, { ...input, index: -1 }, 'INVALID_INPUT'],
    [{ id: 'A' }, { ...input, index: 9 }, 'INVALID_RANGE'],
    [{ id: 'A' }, { ...input, version: 'old' }, 'VERSION_CONFLICT'],
  ]) assert.equal((await f.reader(actor, request)).code, code);
  assert.equal(f.calls.length, 0);
});

test('revocation or mutable metadata changes during I/O never release bytes', async () => {
  for (const change of ['revoke', 'version', 'authorizationVersion', 'etag', 'totalBytes', 'fileKey', 'url']) {
    const mutable = { ...grant };
    const f = fixture({ resolve: async () => mutable, read: async () => {
      if (change === 'revoke') mutable.allowed = false;
      else mutable[change] = change === 'totalBytes' ? 8 : 'changed';
      return Buffer.from('abc');
    } });
    const result = await f.reader({ id: 'A' }, input);
    assert.equal(result.success, false);
    assert.equal(Object.hasOwn(result, 'data'), false);
  }
});

test('short reads, exceptions and oversized responses remain unconfirmed without content', async () => {
  for (const read of [async () => Buffer.from('a'), async () => { throw Error('private'); }]) {
    const f = fixture({ read });
    const result = await f.reader({ id: 'A' }, input);
    assert.equal(result.success, false);
    assert.equal(Object.hasOwn(result, 'data'), false);
    assert.doesNotMatch(JSON.stringify(result), /private/);
  }
  const reader = createGuardedReader({ chunkBytes: 3, responseLimitBytes: 1, resolveGrant: async () => grant, readRange: async () => Buffer.from('abc') });
  assert.equal((await reader({ id: 'A' }, input)).code, 'RESPONSE_TOO_LARGE');
});

test('simultaneous A and B calls do not share trusted actors', async () => {
  const f = fixture();
  const [a, b] = await Promise.all([f.reader({ id: 'A' }, input), f.reader({ id: 'B' }, input)]);
  assert.equal(a.success, true);
  assert.equal(b.code, 'FORBIDDEN');
  assert.equal(f.calls.length, 1);
});

test('guarded cloud experiment checks full content and negative cases and deletes only its object', async () => {
  let content;
  let fileID;
  let deleted = false;
  const handler = createHandler({ randomId: () => 'a'.repeat(32), app: {
    uploadFile: async (request) => { content = request.fileContent; fileID = `cloud://cloud1-d2gjahlq39bf141c7.636c-cloud1-d2gjahlq39bf141c7-1518394589/${request.cloudPath}`; return { fileID }; },
    getTempFileURL: async () => ({ fileList: [{ fileID, code: 'SUCCESS', tempFileURL: 'https://636c-cloud1-d2gjahlq39bf141c7-1518394589.tcb.qcloud.la/file' }] }),
    deleteFile: async (request) => { assert.deepEqual(request.fileList, [fileID]); deleted = true; return { fileList: [{ fileID, code: 'SUCCESS' }] }; },
  }, readRange: async (request) => {
    if (request.etag === '"synthetic-wrong-version"') throw Object.assign(Error('rejected'), { statusCode: 206, reason: 'ETAG_MISMATCH' });
    return content.subarray(request.start, request.end + 1);
  } });
  const result = await handler({ action: 'run', mode: 'guarded', role: 'admin' });
  assert.equal(result.success, true);
  assert.equal(result.evidenceScope, 'real-storage/synthetic-grants');
  assert.equal(result.guarded.fullContentMatch, true);
  assert.equal(result.guarded.chunkCount, 20);
  assert.equal(result.guarded.normalSourceBytes, 5 * 1024 * 1024);
  assert.ok(result.guarded.cases.every((c) => c.passed));
  assert.equal(deleted, true);
  assert.equal(result.cleanupConfirmed, true);
  assert.doesNotMatch(JSON.stringify(result), /tempFileURL|cloud:\/\/|base64/);
});

test('guarded experiment cannot pass on partial reads or unconfirmed cleanup', async () => {
  for (const mode of ['read-failure', 'cleanup-failure']) {
    let fileID;
    let content;
    let cleanupAttempted = false;
    const handler = createHandler({ randomId: () => 'b'.repeat(32), app: {
      uploadFile: async (request) => {
        content = request.fileContent;
        fileID = `cloud://cloud1-d2gjahlq39bf141c7.636c-cloud1-d2gjahlq39bf141c7-1518394589/${request.cloudPath}`;
        return { fileID };
      },
      getTempFileURL: async () => ({ fileList: [{ fileID, code: 'SUCCESS', tempFileURL: 'https://636c-cloud1-d2gjahlq39bf141c7-1518394589.tcb.qcloud.la/file' }] }),
      deleteFile: async () => {
        cleanupAttempted = true;
        if (mode === 'cleanup-failure') throw Error('private credentials');
        return { fileList: [{ fileID, code: 'SUCCESS' }] };
      },
    }, readRange: async (request) => {
      if (mode === 'read-failure') throw Error('private credentials');
      if (request.etag === '"synthetic-wrong-version"') throw Object.assign(Error('private credentials'), { statusCode: 206, reason: 'ETAG_MISMATCH' });
      return content.subarray(request.start, request.end + 1);
    } });
    const result = await handler({ action: 'run', mode: 'guarded' });
    assert.equal(result.success, false);
    assert.equal(cleanupAttempted, true);
    assert.equal(result.cleanupConfirmed, mode !== 'cleanup-failure');
    assert.doesNotMatch(JSON.stringify(result), /private credentials/);
  }
});

test('generic 206 and transport failures are not counted as confirmed version rejection', async () => {
  for (const error of [Object.assign(Error('unknown'), { statusCode: 206 }), Error('network')]) {
    const f = fixture({ read: async () => { throw error; } });
    assert.equal((await f.reader({ id: 'A' }, input)).code, 'UNCONFIRMED');
  }
  const f = fixture({ read: async () => { throw Object.assign(Error('mismatch'), { statusCode: 206, reason: 'ETAG_MISMATCH' }); } });
  assert.equal((await f.reader({ id: 'A' }, input)).code, 'VERSION_CONFLICT');
});
