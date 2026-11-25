'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { bindVerifiedSourceInput, runServerLifecycle, validateLifecycleTargets, validateServerInput } = require('./server-lifecycle.cjs');
const { buildClients, requestWithinDeadline, requireVerifiedCallerCompletion } = require('./tencentcloud-a303-api.cjs');

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

test('caps real SDK HTTP timeout to remaining deadline and returns unknown without hanging', async () => {
  const client = { profile: { httpProfile: { reqTimeout: 30 } }, request: async () => new Promise(() => {}) };
  await assert.rejects(requestWithinDeadline({ client, method: 'request', args: [], deadline: Date.now() + 25 }), /deadline-request-outcome-unknown/);
  assert.equal(client.profile.httpProfile.reqTimeout, 30);
});

test('rejects caller-supplied success-shaped runner evidence', () => {
  assert.throws(() => requireVerifiedCallerCompletion({ runId: '123', runAttempt: '1', workflowSha: 'a'.repeat(40), workflowPath: '.github/workflows/x.yml', conclusion: 'success' }), /caller-run-evidence-unverified/);
});

test('review templates compose existing JWKS/server-entry inputs and expose only fixed lifecycle evidence', () => {
  const start = fs.readFileSync(path.join(__dirname, 'tat-server-start.template.sh'), 'utf8');
  const stop = fs.readFileSync(path.join(__dirname, 'tat-server-stop.template.sh'), 'utf8');
  assert.match(start, /assemble-local/);
  assert.match(start, /server-entry\.cjs" --check-only/);
  assert.match(start, /server-entry\.cjs" --start-approved/);
  assert.match(start, /listener_ready=private_ipv4:8443/);
  assert.match(start, /\$PRIVATE_IPV4:8443/);
  assert.match(start, /kill -0 "\$SERVER_PID"/);
  assert.match(start, /ss -lntpH/);
  assert.match(start, /pid=\$SERVER_PID,/);
  assert.match(stop, /ps -p "\$PID"/);
  assert.match(stop, /server_stopped_and_keys_removed=true/);
  assert.match(stop, /"\$ROOT\/pki\/server\.key\.pem"/);
  const deletes = stop.split('\n').filter((line) => line.startsWith('rm -f '));
  assert.ok(deletes.length >= 9);
  assert.ok(deletes.every((line) => line.match(/"\$ROOT\//g)?.length === 1), 'each rm removes one explicit path');
});

test('stop template removes config/key copies after partial startup and reports unknown when PID is absent', (t) => {
  const gitPath = process.env.GIT_EXE || 'D:/Git_exe';
  const candidates = [path.join(gitPath, 'usr', 'bin', 'bash.exe'), path.join(gitPath, 'bin', 'bash.exe')];
  const bash = candidates.find((candidate) => fs.existsSync(candidate));
  if (!bash) { t.skip('Git for Windows Bash unavailable; bash -n is verified separately'); return; }
  const stop = fs.readFileSync(path.join(__dirname, 'tat-server-stop.template.sh'), 'utf8');
  const filePaths = ['pki/ca.key.pem', 'pki/server.key.pem', 'pki/server.csr.pem', 'pki/ca.srl', 'pki/client.pem', 'tmp/client.csr.pem',
    'tmp/client.ext', 'tmp/client.pem', 'tmp/server-template.json', 'server-config.json', 'server.pid', 'server-public-input.json', 'tmp/server-lifecycle-owner.json'];
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'a303-stop-offline-'));
  const cleanup = () => {
    for (const relative of filePaths) { const filename = path.join(root, relative); if (fs.existsSync(filename)) fs.unlinkSync(filename); }
    for (const directory of ['pki', 'tmp']) { const full = path.join(root, directory); if (fs.existsSync(full)) fs.rmdirSync(full); }
    const scriptPath = path.join(root, 'stop.sh'); if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
    fs.rmdirSync(root);
  };
  t.after(cleanup);
  fs.mkdirSync(path.join(root, 'pki')); fs.mkdirSync(path.join(root, 'tmp'));
  const recreateFiles = (withBadPid) => {
    fs.mkdirSync(path.join(root, 'pki'), { recursive: true }); fs.mkdirSync(path.join(root, 'tmp'), { recursive: true });
    for (const relative of filePaths.filter((name) => name !== 'server.pid')) {
      fs.writeFileSync(path.join(root, relative), relative.endsWith('server-lifecycle-owner.json') ? '{"run_id":"123"}' : 'offline-secret-fixture');
    }
    if (withBadPid) fs.writeFileSync(path.join(root, 'server.pid'), 'not-a-pid');
  };
  const scriptPath = path.join(root, 'stop.sh');
  fs.writeFileSync(scriptPath, stop.replace('ROOT=/opt/o2o-sp08-a303', `ROOT='${root.replaceAll('\\', '/')}'`).replace("SOURCE_RUN_ID='{{source_run_id}}'", "SOURCE_RUN_ID='123'"));
  const env = { ...process.env, PATH: `${path.join(gitPath, 'usr', 'bin')};${path.join(gitPath, 'mingw64', 'bin')};${process.env.PATH}` };
  for (const withBadPid of [false, true]) {
    recreateFiles(withBadPid);
    const result = spawnSync(bash, [scriptPath], { encoding: 'utf8', timeout: 10000, windowsHide: true, shell: false, env });
    assert.equal(result.status, 32, result.stderr);
    assert.match(result.stdout, /server_stop_state=unknown_pid_but_secrets_removed/);
    assert.ok(filePaths.every((relative) => !fs.existsSync(path.join(root, relative))));
  }
});
