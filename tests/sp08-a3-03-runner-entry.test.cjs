'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const runner = require('../tools/sp08-a3-03-github-oidc-smoke/runner-entry.cjs');
const { runApprovedAClient } = require('../tools/sp08-a3-03-github-oidc-smoke/a-segment-local.cjs');

test('runner entry refuses absent config, implicit modes, and nonapproved target before execution', async () => {
  const env = { GITHUB_REPOSITORY: 'o/r', GITHUB_REPOSITORY_ID: '1', GITHUB_RUN_ID: '2', GITHUB_RUN_ATTEMPT: '1', GITHUB_WORKFLOW_REF: 'o/r/.github/workflows/a.yml@refs/heads/main', GITHUB_WORKFLOW_SHA: 'a'.repeat(40) };
  let executions = 0;
  for (const config of [null, {}, { mode: 'start-approved', authorization: 'explicit-temporary', authorizedUntil: Date.now() + 60_000, targetIPv4: '0.0.0.0', port: 8443 }]) {
    let errors = '';
    const code = await runner.main(['--execute-approved', 'fixture'], { env, readConfig: () => config,
      execute: () => { executions += 1; }, writeOut: () => {}, writeError: (value) => { errors += value; } });
    assert.equal(code, 1);
    assert.notEqual(errors, '');
  }
  assert.equal(executions, 0);
});

test('approved A client rejects host aliases, non-8443 ports, and mismatched policy before token transport', async () => {
  let calls = 0;
  const options = { identity: {}, request: {}, policy: { serverIPv4: '192.0.2.10' }, env: {},
    runtimeRequest: async () => { calls += 1; }, approvedTarget: { ipv4: '192.0.2.10', port: 8443 },
    tlsOptions: { host: 'localhost', port: 8443, minVersion: 'TLSv1.3', maxVersion: 'TLSv1.3', rejectUnauthorized: true, key: 'x', cert: 'x', ca: 'x' }, authorizationDeadline: Date.now() + 60_000 };
  await assert.rejects(runApprovedAClient(options), { code: 'local-client-policy-missing' });
  assert.throws(() => runApprovedAClient({ ...options, approvedTarget: { ipv4: '192.0.2.10', port: 443 } }), { code: 'approved-target-policy-invalid' });
  assert.equal(calls, 0);
});

test('runner CLI check-only reports fixed zero-network status and never invokes execute', async () => {
  let output = '';
  let executions = 0;
  const code = await runner.main(['--check-only', 'fixture'], {
    env: {}, readConfig: () => ({}), execute: () => { executions += 1; },
    writeOut: (value) => { output += value; }, writeError: () => {},
  });
  assert.equal(code, 1);
  assert.equal(output, '');
  assert.equal(executions, 0);
});
