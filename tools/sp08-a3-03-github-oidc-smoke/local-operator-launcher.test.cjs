'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { executeOnce, main, readEnvelope, validateSecretEnvelope } = require('./local-operator-launcher.cjs');
const { spawnSync } = require('node:child_process');

const envelope = () => ({ credential: { secretId: 'sentinel-id', secretKey: 'sentinel-key', token: 'sentinel-sts-token' }, token: 'sentinel-github-token', expiration: '2027-01-01T00:00:00Z' });
const config = { public: true };

test('bounded stdin accepts one JSON envelope and rejects oversized input', async () => {
  assert.equal((await readEnvelope(Readable.from([JSON.stringify(envelope())]))).token, 'sentinel-github-token');
  await assert.rejects(readEnvelope(Readable.from(['12345']), 4), /too-large/);
  await assert.rejects(readEnvelope(new Readable({ read() {} }), 100, 10), /timeout/);
  const failedInput = new Readable({ read() { this.destroy(new Error('sentinel-stream-error')); } });
  await assert.rejects(readEnvelope(failedInput), /input-invalid/);
});

test('temporary credentials require exact fields, token, and future expiration', () => {
  assert.equal(validateSecretEnvelope(envelope(), Date.parse('2026-01-01T00:00:00Z')).credential.token, 'sentinel-sts-token');
  for (const bad of [ { ...envelope(), expiration: 'bad' }, { ...envelope(), expiration: '2020-01-01T00:00:00Z' }, { ...envelope(), token: '' }, { ...envelope(), extra: 'x' }, { ...envelope(), token: 'x'.repeat(8193) } ]) {
    assert.throws(() => validateSecretEnvelope(bad, Date.parse('2026-01-01T00:00:00Z')));
  }
  const missingStsToken = envelope(); delete missingStsToken.credential.token;
  assert.throws(() => validateSecretEnvelope(missingStsToken, Date.parse('2026-01-01T00:00:00Z')), /fields-invalid/);
});

test('one explicit local call passes validated stdin secrets once and does not retry', async () => {
  let calls = 0;
  const result = await executeOnce({ config, envelope: envelope(), check: () => ({}), now: () => Date.parse('2026-01-01T00:00:00Z'),
    run: async (_config, secrets, options) => { calls += 1; assert.equal(secrets.token, 'sentinel-github-token'); assert.equal(secrets.credential.token, 'sentinel-sts-token'); assert.equal(options.enableExternalDispatch, true); return { state: 'test-only' }; } });
  assert.equal(result.state, 'test-only'); assert.equal(calls, 1);
  await assert.rejects(executeOnce({ config, envelope: envelope(), check: () => ({}), now: () => Date.parse('2028-01-01T00:00:00Z'), run: async () => { calls += 1; } }));
  assert.equal(calls, 1);
});

test('runner exception and secret sentinels are suppressed at the CLI boundary', async () => {
  const file = path.join(os.tmpdir(), `a303-public-${process.pid}.json`); fs.writeFileSync(file, '{}');
  let out = ''; let err = '';
  try {
    const code = await main(['--run-once', file], Readable.from([JSON.stringify(envelope())]), { write: (s) => { out += s; } }, { write: (s) => { err += s; } }, {
      check: () => ({}), run: async () => { throw new Error('sentinel-key sentinel-token'); },
    });
    assert.equal(code, 1); assert.equal(out.includes('sentinel'), false); assert.equal(err.includes('sentinel'), false);
  } finally { fs.unlinkSync(file); }
});

test('PowerShell bounded drain kills a real local fake child writing oversized no-newline output', { skip: process.platform !== 'win32' }, () => {
  const pwsh = 'C:\\Users\\Administrator\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\native\\powershell\\pwsh.exe';
  const result = spawnSync(pwsh, ['-NoProfile', '-File', path.join(__dirname, 'bounded-process-output.test.ps1')], { encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /bounded stdout and stderr children stopped/);
  assert.equal(`${result.stdout}${result.stderr}`.includes('SENTINEL-'), false);
});

test('await-source CLI checks without reading stdin and uses a fixed readiness marker without leaking failure details', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a303-await-cli-'));
  const file = path.join(dir, 'plan.json'); fs.writeFileSync(file, '{}');
  let out = ''; let err = ''; let calls = 0;
  try {
    assert.equal(await main(['--check-await-source', file], { [Symbol.asyncIterator]() { assert.fail('must-not-read-input'); } },
      { write: s => { out += s; } }, { write: s => { err += s; } }, {
        checkAwait: () => ({ state: 'check-only', readyToDispatch: false }),
      }), 0);
    assert.match(out, /check-only/); assert.equal(err, ''); out = '';
    const input = envelope();
    assert.equal(await main(['--await-source', file], Readable.from([JSON.stringify(input)]),
      { write: s => { out += s; } }, { write: s => { err += s; } }, {
        awaitRun: async options => { calls += 1; assert.equal(options.enableExternalDispatch, true);
          assert.equal(options.envelope.token, 'sentinel-github-token'); options.onReady(); throw new Error('sentinel-key'); },
      }), 1);
    assert.equal(calls, 1); assert.equal(out, 'A303_AWAIT_SOURCE_READY\n');
    assert.equal(`${out}${err}`.includes('sentinel'), false);
  } finally { fs.unlinkSync(file); fs.rmdirSync(dir); }
});
