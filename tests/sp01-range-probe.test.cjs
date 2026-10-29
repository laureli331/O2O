'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler, ENV, BUCKET, SIZE } = require('../tools/sp01-range-probe/function/handler');
const id = 'a'.repeat(32);
const path = `sp01_range_probe/range-${id}.bin`;
const fileID = `cloud://${ENV}.${BUCKET}/${path}`;
function fixture(overrides = {}) {
  const calls = [];
  let source;
  const handler = createHandler({
    randomId: () => id,
    app: {
      uploadFile: async (input) => { calls.push('upload'); source = input.fileContent; return { fileID }; },
      getTempFileURL: async () => { calls.push('url'); return { fileList: [{ fileID, code: 'SUCCESS', tempFileURL: `https://${BUCKET}.tcb.qcloud.la/${path}?sign=private` }] }; },
      deleteFile: async (input) => { calls.push('delete'); assert.deepEqual(input.fileList, [fileID]); return { fileList: [{ fileID, code: 'SUCCESS' }] }; },
      ...overrides.app,
    },
    readRange: async (request) => {
      if (overrides.readRange) return overrides.readRange(request, source);
      calls.push('range');
      if (request.etag === '"sp01-invalid-etag"') throw Object.assign(Error('synthetic'), { statusCode: 412 });
      assert.equal(request.totalBytes, SIZE);
      return source.subarray(request.start, request.end + 1);
    },
  });
  return { handler, calls };
}
test('inspect and invalid actions never create data', async () => {
  const f = fixture();
  assert.equal((await f.handler({ action: 'inspect' })).writes, false);
  assert.equal((await f.handler({ action: 'other' })).success, false);
  assert.deepEqual(f.calls, []);
});
test('cloud probe checks three exact segments and wrong ETag, then cleans only its object', async () => {
  const f = fixture();
  const result = await f.handler({ action: 'run', url: 'https://attacker.invalid' });
  assert.equal(result.success, true);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.ranges.reduce((sum, range) => sum + range.bytes, 0), 3 * 256 * 1024);
  assert.ok(result.ranges.every((range) => range.matches));
  assert.equal(result.wrongEtagRejected, true);
  assert.equal(result.wrongEtagHttpStatus, 412);
  assert.equal(f.calls.at(-1), 'delete');
  assert.doesNotMatch(JSON.stringify(result), /sign=|tempFileURL|cloud:\/\//);
});
test('range failures stay failed and clean the exact synthetic object without leaking errors', async () => {
  const f = fixture({ readRange: async () => { throw Error('private-signed-url'); } });
  const result = await f.handler({ action: 'run' });
  assert.equal(result.success, false);
  assert.equal(result.failurePhase, 'ranges');
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(f.calls.at(-1), 'delete');
  assert.doesNotMatch(JSON.stringify(result), /private-signed-url/);
});
test('cleanup errors and non-412 failures cannot be counted as a passing probe', async () => {
  const cleanup = fixture({ app: { deleteFile: async () => { throw Error('secret'); } } });
  assert.equal((await cleanup.handler({ action: 'run' })).success, false);
  const missing = fixture({ readRange: async (request, source) => {
    if (request.etag === '"sp01-invalid-etag"') throw Object.assign(Error('missing'), { statusCode: 403 });
    return source.subarray(request.start, request.end + 1);
  } });
  const result = await missing.handler({ action: 'run' });
  assert.equal(result.ranges.length, 3);
  assert.equal(result.wrongEtagRejected, false);
  assert.equal(result.wrongEtagHttpStatus, 403);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.success, false);
});

test('wrong ETag diagnostics distinguish rejected 206, unknown errors and unexpected success', async () => {
  for (const status of [206, null, 'success']) {
    const f = fixture({ readRange: async (request, source) => {
      if (request.etag !== '"sp01-invalid-etag"') return source.subarray(request.start, request.end + 1);
      if (status === 'success') return Buffer.alloc(1);
      throw Object.assign(Error('private signed url'), { statusCode: status });
    } });
    const result = await f.handler({ action: 'run' });
    assert.equal(result.success, false);
    assert.equal(result.wrongEtagRejected, false);
    assert.equal(result.wrongEtagHttpStatus, typeof status === 'number' ? status : null);
    assert.equal(result.wrongEtagOutcome, status === 'success' ? 'unexpected-success' : status === null ? 'unknown-error' : 'http-error');
    assert.equal(result.cleanupConfirmed, true);
    assert.doesNotMatch(JSON.stringify(result), /private signed url/);
  }
});
