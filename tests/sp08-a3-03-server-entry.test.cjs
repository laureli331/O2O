'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const entry = require('../tools/sp08-a3-03-github-oidc-smoke/server-entry.cjs');

test('server preflight requires explicit check-only and a future authorization window capped at fifteen minutes', () => {
  const now = 1_000_000;
  for (const config of [
    {},
    { mode: 'start', authorizedUntil: now + 60_000, policy: {} },
    { mode: 'check-only', authorizedUntil: now, policy: {} },
    { mode: 'check-only', authorizedUntil: now + 900_001, policy: {} },
  ]) assert.throws(() => entry.validateCheckOnlyConfig(config, now), { code: 'server-entry-authorization-invalid' });
});

test('check-only entry fails closed on absent TLS material before any listener can be created', () => {
  assert.throws(() => entry.validateCheckOnlyConfig({
    mode: 'check-only', authorizedUntil: Date.now() + 60_000, policy: {},
  }), { code: 'local-server-policy-missing' });
});

test('CLI refuses implicit start mode and reports a fixed usage error', async () => {
  let stderr = '';
  const original = process.stderr.write;
  process.stderr.write = (value) => { stderr += value; return true; };
  try { assert.equal(await entry.main(['--start', 'config.json']), 2); }
  finally { process.stderr.write = original; }
  assert.match(stderr, /^usage: node server-entry\.cjs --check-only\|--start-approved/);
});

test('CLI waits for listener closure, emits only a fixed summary, and returns nonzero when not accepted', async () => {
  let output = '';
  const secretHandle = { key: 'fixture-private-key' };
  secretHandle.self = secretHandle;
  const code = await entry.main(['--start-approved', 'fixture.json'], {
    readConfig: () => ({ mode: 'start-approved', secret: 'fixture-token' }),
    startApproved: () => ({ server: secretHandle, closed: Promise.resolve(), accepted: false, close: async () => {} }),
    writeOut: (value) => { output += value; }, writeError: () => {},
  });
  assert.equal(code, 1);
  assert.deepEqual(JSON.parse(output), { mode: 'start-approved', ready: false, accepted: false, result: 'not-accepted', interrupted: false, listenerAttempts: 1, listenersActive: 0, networkRequests: 0 });
  assert.doesNotMatch(output, /fixture-private-key|fixture-token|server|secret/);
});

test('check-only CLI never calls listener startup and emits no config material', async () => {
  let output = '';
  let starts = 0;
  const code = await entry.main(['--check-only', 'fixture.json'], {
    readConfig: () => ({ mode: 'check-only', authorizedUntil: 0, token: 'should-not-print' }),
    startApproved: () => { starts += 1; throw new Error('unexpected-start'); },
    writeOut: (value) => { output += value; }, writeError: () => {},
  });
  assert.equal(code, 1);
  assert.equal(starts, 0);
  assert.equal(output, '');
});

test('approved start requires an exact non-internal private IPv4 on the named interface before binding', () => {
  const config = { mode: 'start-approved', authorization: 'explicit-temporary', authorizedUntil: Date.now() + 60_000,
    interfaceName: 'fixture0', bindIPv4: '10.20.30.40', port: 8443, policy: {} };
  let bindCalls = 0;
  const bind = () => { bindCalls += 1; };
  assert.throws(() => entry.startApproved(config, { interfaces: {}, bind }), { code: 'server-entry-interface-address-mismatch' });
  assert.throws(() => entry.startApproved({ ...config, bindIPv4: '0.0.0.0' }, { interfaces: {}, bind }), { code: 'server-entry-authorization-invalid' });
  assert.equal(bindCalls, 0);
});
