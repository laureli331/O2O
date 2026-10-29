'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { EventEmitter } = require('node:events');
const { readRange } = require('../tools/sp01-storage-probe/range-reader.cjs');
const options = { url: 'https://synthetic.example/file?signature=private', expectedHost: 'synthetic.example',
  start: 0, end: 2, totalBytes: 10, etag: '"abc123"', timeoutMs: 1000 };
function transport(overrides = {}, chunks = [Buffer.from('abc')]) {
  let count = 0;
  return { count: () => count, get(url, config, callback) {
    count++;
    assert.equal(config.headers.Range, 'bytes=0-2');
    assert.equal(config.headers['If-Match'], options.etag);
    const req = new EventEmitter();
    req.setTimeout = () => req;
    req.destroy = () => {};
    process.nextTick(() => {
      const response = Readable.from(chunks);
      response.statusCode = overrides.statusCode ?? 206;
      response.headers = overrides.headers ?? { 'content-range': 'bytes 0-2/10', etag: options.etag };
      callback(response);
    });
    return req;
  } };
}
test('range reader sends a conditional byte request and returns only its exact bytes', async () => {
  const api = transport();
  assert.deepEqual(await readRange(options, api), Buffer.from('abc'));
  assert.equal(api.count(), 1);
});
test('range reader rejects whole file fallback, redirects and changed object preconditions', async () => {
  for (const statusCode of [200, 301, 302, 403, 412, 416]) {
    await assert.rejects(readRange(options, transport({ statusCode })), { message: 'RANGE_RESPONSE_REJECTED' });
  }
});
test('range reader rejects wrong bounds, total, ETag, encoding, oversized or truncated bodies', async () => {
  for (const headers of [
    { 'content-range': 'bytes 1-3/10', etag: options.etag },
    { 'content-range': 'bytes 0-2/11', etag: options.etag },
    { 'content-range': 'bytes 0-2/10', etag: '"changed"' },
    { 'content-range': 'bytes 0-2/10', etag: options.etag, 'content-encoding': 'gzip' },
  ]) await assert.rejects(readRange(options, transport({ headers })));
  await assert.rejects(readRange(options, transport({}, [Buffer.from('abcd')])));
  await assert.rejects(readRange(options, transport({}, [Buffer.from('ab')])));
});
test('untrusted URLs and invalid ranges fail before any request', async () => {
  const api = transport();
  for (const patch of [
    { url: 'http://synthetic.example/file' }, { url: 'https://other.example/file' },
    { url: 'https://user:password@synthetic.example/file' }, { url: 'https://synthetic.example:444/file' },
    { start: -1 }, { end: 10 }, { end: 1.5 }, { timeoutMs: 0 }, { etag: 'W/"weak"' },
  ]) await assert.rejects(readRange({ ...options, ...patch }, api));
  assert.equal(api.count(), 0);
});
test('network and timeout errors are bounded and do not expose signed URLs', async () => {
  for (const timeout of [false, true]) {
    const api = { get() {
      const req = new EventEmitter();
      req.destroy = () => {};
      req.setTimeout = (_ms, handler) => {
        process.nextTick(() => timeout ? handler() : req.emit('error', Error(options.url)));
        return req;
      };
      return req;
    } };
    await assert.rejects(readRange(options, api), (error) => {
      assert.equal(error.message, 'RANGE_RESPONSE_REJECTED');
      assert.doesNotMatch(error.stack, /signature=private/);
      return true;
    });
  }
});
