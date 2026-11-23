'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { spawnSync } = require('node:child_process');
const { createEgressManifest, isUsablePublicIpv4, requestPublicIpv4, verifyEgressManifest } = require('./egress-ip.cjs');

const context = { runId: '45173961060', runAttempt: '1', workflowSha: 'a'.repeat(40), csrSha256: 'b'.repeat(64) };
const instant = new Date('2026-11-23T12:00:00.000Z');

function fakeRequest({ statusCode = 200, body = '203.0.113.22', location, error } = {}) {
  return (url, options, callback) => {
    assert.equal(url, 'https://api.ipify.org/');
    assert.equal(options.timeout, 5000);
    const req = new EventEmitter();
    req.destroy = () => {};
    queueMicrotask(() => {
      if (error) { req.emit('error', error); return; }
      const res = new EventEmitter();
      res.statusCode = statusCode;
      res.headers = location ? { location } : {};
      res.setEncoding = () => {};
      res.resume = () => {};
      res.destroy = () => {};
      callback(res);
      if (body) res.emit('data', body);
      res.emit('end');
    });
    return req;
  };
}

test('accepts public IPv4 and rejects private, loopback, link-local, documentation and reserved ranges', () => {
  assert.equal(isUsablePublicIpv4('8.8.8.8'), true);
  for (const ip of ['10.1.2.3', '127.0.0.1', '169.254.1.2', '172.16.1.1', '192.168.1.1', '100.64.0.1', '198.51.100.4', '203.0.113.9', '224.0.0.1', '::1', '999.1.1.1']) {
    assert.equal(isUsablePublicIpv4(ip), false, ip);
  }
});

test('creates a separate tightly bound manifest and verifies only its matching /32 suggestion', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a303-egress-'));
  const file = path.join(dir, 'egress.json');
  try {
    const manifest = await createEgressManifest({ context, outputFile: file, now: () => instant, request: fakeRequest({ body: '8.8.8.8\n' }) });
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), manifest);
    assert.equal(verifyEgressManifest(manifest, context, instant), '8.8.8.8/32');
    assert.throws(() => verifyEgressManifest(manifest, { ...context, runId: '45173961061' }, instant), /egress-binding-mismatch/);
    assert.throws(() => verifyEgressManifest({ ...manifest, unexpected: true }, context, instant), /egress-manifest-schema-invalid/);
    assert.throws(() => verifyEgressManifest(manifest, context, new Date(instant.getTime() + 5 * 60 * 1000)), /egress-manifest-time-invalid/);
    assert.throws(() => verifyEgressManifest(manifest, context, new Date(instant.getTime() - 1)), /egress-manifest-time-invalid/);
  } finally {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(dir);
  }
});

test('fails closed on redirects, non-200 responses, invalid IP and oversized bodies', async () => {
  for (const options of [
    { statusCode: 302, location: 'https://elsewhere.invalid/' },
    { statusCode: 503, body: '8.8.8.8' },
    { body: '192.168.0.2' },
    { body: '8'.repeat(65) }
  ]) await assert.rejects(requestPublicIpv4(fakeRequest(options)));
});

test('rejects malformed context before invoking the injected request', async () => {
  let called = false;
  await assert.rejects(createEgressManifest({ context: { ...context, runAttempt: '2' }, outputFile: 'not-written', request: () => { called = true; } }), /egress-context-invalid/);
  assert.equal(called, false);
});

test('existing source cleanup removes the new manifest by its exact filename', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a303-egress-clean-'));
  const file = path.join(dir, 'egress-ip-manifest.json');
  try {
    fs.writeFileSync(file, '{}', { flag: 'wx' });
    const result = spawnSync(process.execPath, [path.join(__dirname, 'clean-source.cjs')], { env: { ...process.env, RUNNER_TEMP: dir }, timeout: 5000 });
    assert.equal(result.status, 0);
    assert.equal(fs.existsSync(file), false);
  } finally { fs.rmdirSync(dir); }
});
