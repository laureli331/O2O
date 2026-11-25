'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bindVerifiedSourceInput, runServerLifecycle, validateLifecycleTargets, validateServerInput } = require('./server-lifecycle.cjs');
const { buildClients } = require('./tencentcloud-a303-api.cjs');

const targets = { region: 'ap-guangzhou', instanceId: 'ins-fixture01', securityGroupId: 'sg-fixture01', startCommandId: 'cmd-fixture01', stopCommandId: 'cmd-fixture02' };
const fakeSource = { sourceRunId: '123', attempt: '1', workflowSha: 'a'.repeat(40), csrSha256: 'b'.repeat(64) };
const input = JSON.stringify({ mode: 'start-approved', authorization: 'explicit-temporary', authorizedUntil: 600000, interfaceName: 'eth0', bindIPv4: '10.0.0.2', port: 8443,
  policy: { mode: 'github-oidc', serverIPv4: '198.51.100.8', issuer: 'https://token.actions.githubusercontent.com', githubJwksKeys: [{ kid: 'fixture' }],
    githubJwksFetchedAt: 1, githubJwksExpiresAt: 500000,
    expectedClaims: { run_id: '123', run_attempt: '1', workflow_sha: fakeSource.workflowSha, repository_id: '456' },
    expectedRequest: { run_id: '123', run_attempt: '1', repository_id: '456', payload: { database_access: false } } } });

test('validates fixed commands and binds the legacy public input to source, target, JWKS and CLB IPv4', () => {
  assert.throws(() => validateLifecycleTargets({ ...targets, stopCommandId: 'DRAFT' }), /lifecycle-stopCommandId-invalid/);
  assert.throws(() => validateLifecycleTargets({ ...targets, stopCommandId: targets.startCommandId }), /lifecycle-command-ids-must-differ/);
  const bound = bindVerifiedSourceInput(input, fakeSource);
  const b64 = validateServerInput(bound, { now: 1, instanceId: targets.instanceId, sourceRunId: '123', attempt: '1',
    workflowSha: fakeSource.workflowSha, csrSha256: fakeSource.csrSha256, clbIPv4: '198.51.100.8' });
  const parsed = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  assert.equal(parsed.sourceBinding.csr_sha256, fakeSource.csrSha256);
  assert.equal(parsed.policy.githubJwksExpiresAt, 500000);
  assert.throws(() => validateServerInput(bound, { now: 1, instanceId: targets.instanceId, sourceRunId: '123', attempt: '1',
    workflowSha: fakeSource.workflowSha, csrSha256: fakeSource.csrSha256, clbIPv4: '198.51.100.9' }), /server-input-binding-invalid/);
});

test('rejects caller-constructed source materials before any lifecycle Invoke', async () => {
  let calls = 0;
  const clients = buildClients({ region: targets.region, transport: async () => { calls += 1; return {}; } });
  await assert.rejects(runServerLifecycle({ clients, targets, verifiedMaterials: fakeSource, serverInput: input,
    expectedInput: { clbIPv4: '198.51.100.8' }, buildReturn: async () => ({}), awaitCallerTlsCompletion: async () => ({}) }), /verified-source-materials-required/);
  assert.equal(calls, 0);
});

test('review templates compose existing JWKS/server-entry inputs and expose only fixed lifecycle evidence', () => {
  const start = fs.readFileSync(path.join(__dirname, 'tat-server-start.template.sh'), 'utf8');
  const stop = fs.readFileSync(path.join(__dirname, 'tat-server-stop.template.sh'), 'utf8');
  assert.match(start, /assemble-local/);
  assert.match(start, /server-entry\.cjs" --check-only/);
  assert.match(start, /server-entry\.cjs" --start-approved/);
  assert.match(start, /listener_ready=private_ipv4:8443/);
  assert.match(start, /\$PRIVATE_IPV4:8443/);
  assert.match(stop, /ps -p "\$PID"/);
  assert.match(stop, /server_stopped_and_keys_removed=true/);
  assert.match(stop, /test ! -e "\$ROOT\/pki\/server\.key\.pem"/);
});
