'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { spawnSync } = require('node:child_process');
const { createEgressManifest, isUsablePublicIpv4, requestPublicIpv4, verifyEgressManifest, verifyManifestFile } = require('./egress-ip.cjs');

const context = { runId: '45173961060', runAttempt: '1', workflowSha: 'a'.repeat(40), csrSha256: 'b'.repeat(64) };
const instant = new Date('2026-11-23T12:00:00.000Z');

function fakeRequest({ statusCode = 200, body = '8.8.8.8', location, error, slow = false, refs = {} } = {}) {
  return (url, options, callback) => {
    assert.equal(url, 'https://api.ipify.org/');
    assert.equal(options.timeout, 5000);
    const req = new EventEmitter();
    req.destroy = () => { refs.requestDestroyed = true; };
    queueMicrotask(() => {
      if (error) { req.emit('error', error); return; }
      const res = new EventEmitter();
      res.statusCode = statusCode;
      res.headers = location ? { location } : {};
      res.resume = () => {};
      res.destroy = () => { refs.responseDestroyed = true; };
      callback(res);
      if (slow) {
        const bytes = Buffer.from(body);
        let index = 0;
        const emitByte = () => {
          if (index < bytes.length) { res.emit('data', bytes.subarray(index, ++index)); setTimeout(emitByte, 10); }
          else res.emit('end');
        };
        emitByte();
      } else {
        if (body) res.emit('data', Buffer.from(body));
        res.emit('end');
      }
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
  const cliManifestFile = path.join(dir, 'egress-cli.json');
  const expectedFile = path.join(dir, 'expected-context.json');
  try {
    const manifest = await createEgressManifest({ context, outputFile: file, now: () => instant, request: fakeRequest({ body: '8.8.8.8\n' }) });
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), manifest);
    assert.equal(verifyEgressManifest(manifest, context, instant), '8.8.8.8/32');
    assert.throws(() => verifyEgressManifest(manifest, { ...context, runId: '45173961061' }, instant), /egress-binding-mismatch/);
    assert.throws(() => verifyEgressManifest({ ...manifest, unexpected: true }, context, instant), /egress-manifest-schema-invalid/);
    assert.throws(() => verifyEgressManifest(manifest, context, new Date(instant.getTime() + 5 * 60 * 1000)), /egress-manifest-time-invalid/);
    assert.throws(() => verifyEgressManifest(manifest, context, new Date(instant.getTime() - 1)), /egress-manifest-time-invalid/);
    assert.throws(() => verifyEgressManifest(manifest, context, new Date(Number.NaN)), /egress-now-invalid/);
    assert.throws(() => verifyManifestFile(file, file, instant), /egress-expected-context-invalid/);
    fs.writeFileSync(expectedFile, JSON.stringify(context), { flag: 'wx' });
    await createEgressManifest({ context, outputFile: cliManifestFile, request: fakeRequest() });
    const cli = spawnSync(process.execPath, [path.join(__dirname, 'egress-ip.cjs'), 'verify', cliManifestFile, expectedFile], { encoding: 'utf8', timeout: 5000 });
    assert.equal(cli.status, 0, cli.stderr);
    assert.equal(cli.stdout.trim(), '8.8.8.8/32');
  } finally {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    if (fs.existsSync(cliManifestFile)) fs.unlinkSync(cliManifestFile);
    if (fs.existsSync(expectedFile)) fs.unlinkSync(expectedFile);
    fs.rmdirSync(dir);
  }
});

test('fails closed on redirects, non-200 responses, invalid IP and oversized bodies', async () => {
  for (const options of [
    { statusCode: 302, location: 'https://elsewhere.invalid/' },
    { statusCode: 503, body: '8.8.8.8' },
    { body: '192.168.0.2' },
    { body: '8'.repeat(65) },
    { body: Buffer.from([0x38, 0xb8, 0x2e, 0x38, 0x2e, 0x38, 0x2e, 0x38]) }
  ]) await assert.rejects(requestPublicIpv4(fakeRequest(options)));
});

test('applies a total deadline to slow-drip responses and destroys both streams', async () => {
  const refs = {};
  await assert.rejects(requestPublicIpv4(fakeRequest({ body: '8.8.8.8', slow: true, refs }), 25), /egress-total-timeout/);
  assert.equal(refs.requestDestroyed, true);
  assert.equal(refs.responseDestroyed, true);
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
