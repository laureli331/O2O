const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { inspectRuntimeOidcOrigin } = require('../tools/sp08-a3-03-github-oidc-smoke/oidc-origin-preflight.cjs');

const source = fs.readFileSync(
  path.join(__dirname, '../tools/sp08-a3-03-github-oidc-smoke/oidc-origin-preflight.cjs'),
  'utf8',
);

test('preflight reports a timestamped origin-only result and never reads credentials or makes requests', () => {
  const rawUrl = 'https://runner-oidc.actions.githubusercontent.com/job/request?grant=secret';
  const result = inspectRuntimeOidcOrigin({
    ACTIONS_ID_TOKEN_REQUEST_URL: rawUrl,
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'bearer-secret-must-not-be-read-or-printed',
  });
  const output = JSON.stringify(result);

  assert.equal(result.ok, true);
  assert.equal(Date.parse(result.observedAt) > 0, true);
  assert.equal(result.origin, 'https://runner-oidc.actions.githubusercontent.com');
  assert.equal(result.hostname, 'runner-oidc.actions.githubusercontent.com');
  assert.equal(result.port, 443);
  assert.equal(result.originCheck, 'bound-to-runner-injected-url');
  assert.equal(result.networkRequestPerformed, false);
  assert.equal(result.tokenRequestPerformed, false);
  assert.equal(output.includes(rawUrl), false);
  assert.equal(output.includes('grant=secret'), false);
  assert.equal(output.includes('bearer-secret-must-not-be-read-or-printed'), false);
  assert.equal(source.includes('ACTIONS_ID_TOKEN_REQUEST_TOKEN'), false);
  assert.equal(source.includes("require('node:https')"), false);
  assert.equal(source.includes('node:dns'), false);
});

test('CLI emits a redacted result and writes only the validated origin to GitHub step output', (t) => {
  const runtimeUrl = 'https://runner-oidc.actions.githubusercontent.com/job/request?opaque=do-not-print';
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'o2o-a303-preflight-'));
  const outputFile = path.join(tempDir, 'github-output.txt');
  t.after(() => {
    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
    fs.rmdirSync(tempDir);
  });
  const run = spawnSync(process.execPath, [path.join(__dirname, '../tools/sp08-a3-03-github-oidc-smoke/oidc-origin-preflight.cjs')], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ACTIONS_ID_TOKEN_REQUEST_URL: runtimeUrl,
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'secret-token-value',
      GITHUB_OUTPUT: outputFile,
    },
  });
  const output = JSON.parse(run.stdout.trim());

  assert.equal(run.status, 0);
  assert.equal(output.origin, 'https://runner-oidc.actions.githubusercontent.com');
  assert.equal(output.networkRequestPerformed, false);
  assert.equal(output.tokenRequestPerformed, false);
  assert.equal(fs.readFileSync(outputFile, 'utf8'), 'origin=https://runner-oidc.actions.githubusercontent.com\n');
  assert.equal(run.stdout.includes(runtimeUrl), false);
  assert.equal(run.stdout.includes('opaque=do-not-print'), false);
  assert.equal(run.stdout.includes('secret-token-value'), false);
  assert.equal(run.stderr, '');
});

test('preflight rejects non-HTTPS, userinfo, explicit nondefault ports, fragments and audience conflicts', () => {
  const urls = [
    'http://runner-oidc.actions.githubusercontent.com/request?grant=x',
    'https://user:pass@runner-oidc.actions.githubusercontent.com/request?grant=x',
    'https://runner-oidc.actions.githubusercontent.com:8443/request?grant=x',
    'https://runner-oidc.actions.githubusercontent.com/request?grant=x#fragment',
    'https://runner-oidc.actions.githubusercontent.com/request?audience=already-set',
  ];

  for (const url of urls) {
    const result = inspectRuntimeOidcOrigin({ ACTIONS_ID_TOKEN_REQUEST_URL: url });
    assert.equal(result.ok, false);
    assert.equal(result.networkRequestPerformed, false);
    assert.equal(result.tokenRequestPerformed, false);
    assert.equal(JSON.stringify(result).includes(url), false);
  }
});

test('preflight rejects IP literals, local-only hostnames, malformed DNS names and oversized URLs', () => {
  const urls = [
    'https://127.0.0.1/request?grant=x',
    'https://[::1]/request?grant=x',
    'https://localhost/request?grant=x',
    'https://oidc.internal/request?grant=x',
    'https://bad..host/request?grant=x',
    `https://runner-oidc.actions.githubusercontent.com/${'x'.repeat(8192)}?grant=x`,
  ];

  for (const url of urls) {
    const result = inspectRuntimeOidcOrigin({ ACTIONS_ID_TOKEN_REQUEST_URL: url });
    assert.equal(result.ok, false);
    assert.equal(result.networkRequestPerformed, false);
    assert.equal(result.tokenRequestPerformed, false);
    assert.equal(JSON.stringify(result).includes(url), false);
  }
});

test('preflight missing-variable and parse failures return sanitized codes', () => {
  assert.deepEqual(inspectRuntimeOidcOrigin({}), {
    ok: false,
    code: 'missing-runtime-url',
    networkRequestPerformed: false,
    tokenRequestPerformed: false,
  });
  const malformed = inspectRuntimeOidcOrigin({ ACTIONS_ID_TOKEN_REQUEST_URL: 'not a URL with bearer=secret' });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.networkRequestPerformed, false);
  assert.equal(malformed.tokenRequestPerformed, false);
  assert.equal(JSON.stringify(malformed).includes('bearer=secret'), false);
});
