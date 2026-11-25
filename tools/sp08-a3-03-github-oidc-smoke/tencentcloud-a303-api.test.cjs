'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { addIngressRule, awaitVerifiedCallerRun, buildClients, buildSdkClients, invokeOnce, pollTask, pollUntilTerminal, removeIngressRule, validateCsr, validateTarget, verifySourceMaterials } = require('./tencentcloud-a303-api.cjs');
const { parseReturnBundle } = require('./return-bundle.cjs');
const { runServerLifecycle } = require('./server-lifecycle.cjs');

const target = { commandId: 'cmd-approved1', instanceId: 'ins-approved1', region: 'ap-guangzhou', securityGroupId: 'sg-approved1' };
const pem = '-----BEGIN CERTIFICATE REQUEST-----\nQUJD\n-----END CERTIFICATE REQUEST-----\n';
const digest = require('node:crypto').createHash('sha256').update(pem).digest('hex');
function fixtureMaterials() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a303-sdk-'));
  const nowMs = Date.parse('2026-11-24T12:00:00.000Z');
  const names = ['source.csr.pem', 'source-manifest.json', 'egress-ip-manifest.json'];
  const sourceManifestPath = path.join(tempDir, names[1]);
  const egressPath = path.join(tempDir, names[2]);
  const zipPath = path.join(tempDir, 'bundle.zip');
  const scriptPath = path.join(tempDir, 'make-zip.ps1');
  const sourceKeyPath = path.join(tempDir, 'source.key.pem');
  const certPath = path.join(tempDir, 'certs.json');
  const createScript = path.join(tempDir, 'make-fixture.ps1');
  fs.writeFileSync(createScript, `$ErrorActionPreference='Stop'
$rsa=[System.Security.Cryptography.RSA]::Create(2048)
$req=[System.Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=A303 Offline CSR',$rsa,[System.Security.Cryptography.HashAlgorithmName]::SHA256,[System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
$eku=[System.Security.Cryptography.OidCollection]::new();$null=$eku.Add([System.Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.2'))
$req.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($eku,$false))
$req.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new([System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature,$true))
[IO.File]::WriteAllText('${path.join(tempDir, names[0])}',$req.CreateSigningRequestPem())
[IO.File]::WriteAllText('${sourceKeyPath}',$rsa.ExportPkcs8PrivateKeyPem())
$caRsa=[System.Security.Cryptography.RSA]::Create(2048)
$caReq=[System.Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=A303 Offline CA',$caRsa,[System.Security.Cryptography.HashAlgorithmName]::SHA256,[System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
$caReq.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true,$false,0,$true))
$caReq.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new([System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyCertSign -bor [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::CrlSign,$true))
$now=[DateTimeOffset]::UtcNow;$ca=$caReq.CreateSelfSigned($now.AddHours(-1),$now.AddDays(1))
$leaf=$req.Create($ca,$now.AddHours(-1),$now.AddDays(1),[byte[]](1..16))
$finger=[Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData($ca.RawData)).ToLowerInvariant()
[IO.File]::WriteAllText('${certPath}',(@{leaf=$leaf.ExportCertificatePem();ca=$ca.ExportCertificatePem();fingerprint=$finger}|ConvertTo-Json -Compress))
$rsa.Dispose();$caRsa.Dispose();$ca.Dispose();$leaf.Dispose()`, { flag: 'wx' });
  const pwshPath = process.env.A303_TEST_PWSH || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe';
  const generated = spawnSync(pwshPath, ['-NoProfile', '-NonInteractive', '-File', createScript], { encoding: 'utf8', timeout: 10000, windowsHide: true, shell: false });
  assert.equal(generated.status, 0, generated.stderr);
  const csrPem = fs.readFileSync(path.join(tempDir, names[0]), 'utf8');
  const csrSha256 = require('node:crypto').createHash('sha256').update(csrPem).digest('hex');
  const certificates = JSON.parse(fs.readFileSync(certPath, 'utf8'));
  fs.writeFileSync(sourceManifestPath, JSON.stringify({ source_run_id: '123', source_job_id: 'source-csr', source_run_attempt: '1', source_commit: 'a'.repeat(40), source_started_at: '2026-11-24T11:55:00.000Z', csr_sha256: csrSha256 }), { flag: 'wx' });
  fs.writeFileSync(egressPath, JSON.stringify({ schema: 'sp08-a303-egress-ip-v1', source_run_id: '123', source_run_attempt: '1', workflow_sha: 'a'.repeat(40), csr_sha256: csrSha256, query_source: 'https://api.ipify.org/', queried_at: '2026-11-24T11:59:00.000Z', ipv4: '8.8.8.8', cidr_suggestion: '8.8.8.8/32', expires_at: '2026-11-24T12:04:00.000Z', identity_note: 'Public IP observation only; not an identity credential or authorization.' }), { flag: 'wx' });
  fs.writeFileSync(scriptPath, `Compress-Archive -LiteralPath @('${path.join(tempDir, names[0])}','${sourceManifestPath}','${egressPath}') -DestinationPath '${zipPath}' -Force`, { flag: 'wx' });
  const zipped = spawnSync(pwshPath, ['-NoProfile', '-NonInteractive', '-File', scriptPath], { encoding: 'utf8', timeout: 10000, windowsHide: true, shell: false });
  assert.equal(zipped.status, 0, zipped.stderr);
  const zipBytes = fs.readFileSync(zipPath);
  const artifactDigest = `sha256:${require('node:crypto').createHash('sha256').update(zipBytes).digest('hex')}`;
  const expected = { sourceRunId: '123', repositoryId: '456', trustedHeadSha: 'a'.repeat(40), actorId: '789', actorLogin: 'operator', workflowPath: '.github/workflows/sp08-a3-03-tls-caller.yml', notBeforeMs: nowMs - 10 * 60 * 1000, notAfterMs: nowMs, caFingerprint256: certificates.fingerprint };
  const run = { id: 123, event: 'workflow_dispatch', status: 'in_progress', conclusion: null, repository: { id: 456 }, path: expected.workflowPath, head_sha: expected.trustedHeadSha, run_attempt: 1, actor: { id: 789, login: 'operator' }, created_at: '2026-11-24T11:55:00Z' };
  const fetchImpl = async (url, options) => {
    assert.equal(options.redirect, url.endsWith('/artifacts/99/zip') ? 'manual' : 'error');
    if (url === 'https://api.github.com/repos/owner/repo/actions/runs/123') return { status: 200, url, json: async () => run };
    if (url === 'https://api.github.com/repos/owner/repo/actions/runs/123/artifacts?per_page=100') return { status: 200, url, json: async () => ({ total_count: 1, artifacts: [{ id: 99, name: 'sp08-a303-csr-123-1', expired: false, size_in_bytes: zipBytes.length, digest: artifactDigest, workflow_run: { id: 123, repository_id: 456, head_sha: 'a'.repeat(40) } }] }) };
    if (url === 'https://api.github.com/repos/owner/repo/actions/artifacts/99/zip') return { status: 302, headers: { get: (name) => name === 'location' ? 'https://artifact-download.invalid/signed' : null } };
    if (url === 'https://artifact-download.invalid/signed') {
      assert.equal(options.headers.authorization, undefined);
      let sent = false;
      return { status: 200, body: { getReader: () => ({ read: async () => { if (sent) return { done: true }; sent = true; return { done: false, value: zipBytes }; }, cancel: async () => {} }) } };
    }
    throw new Error('unexpected-offline-url');
  };
  const cleanup = () => { for (const name of [...names, 'source.key.pem', 'bundle.zip', 'make-zip.ps1', 'make-fixture.ps1', 'certs.json']) fs.unlinkSync(path.join(tempDir, name)); fs.rmdirSync(tempDir); };
  return { tempDir, sourceKeyPath, csrPem, csrSha256, certificates, expected, fetchImpl, now: () => nowMs, pwshPath, cleanup };
}

test('rejects draft targets and malformed or mismatched CSR before transport', async () => {
  assert.throws(() => validateTarget({ ...target, commandId: '<FIXED_COMMAND_ID>' }), /target-commandId-invalid/);
  assert.throws(() => validateCsr(pem, '0'.repeat(64)), /csr-digest-mismatch/);
  let calls = 0;
  const clients = buildClients({ region: target.region, transport: async () => { calls += 1; return { InvocationId: 'inv-123' }; } });
  await assert.rejects(invokeOnce({ clients, target: { ...target, commandId: 'DRAFT' } }), /target-commandId-invalid/);
  assert.equal(calls, 0);
});

test('SDK generated method reaches injectable transport with exact single-CVM request', async () => {
  const fixture = fixtureMaterials();
  const verifiedMaterials = await verifySourceMaterials({ expected: fixture.expected, token: 'offline-test-token', repository: 'owner/repo', fetchImpl: fixture.fetchImpl, now: fixture.now, pwshPath: fixture.pwshPath });
  const requests = [];
  const scriptOutput = `csr_sha256=${fixture.csrSha256}\nleaf_cert_b64=${Buffer.from(fixture.certificates.leaf).toString('base64')}\nca_cert_b64=${Buffer.from(fixture.certificates.ca).toString('base64')}\n`;
  const taskOutput = Buffer.from(scriptOutput).toString('base64');
  const clients = buildClients({ region: target.region, transport: async (service, action, request) => {
    requests.push({ service, action, request });
    if (action === 'InvokeCommand') return { InvocationId: 'inv-123' };
    if (action === 'DescribeInvocationTasks') return { TotalCount: 1, InvocationTaskSet: [{ InvocationId: 'inv-123', InstanceId: target.instanceId, CommandId: target.commandId, TaskStatus: 'SUCCESS', TaskResult: { ExitCode: 0, Dropped: 0, Output: taskOutput } }] };
    throw new Error('unexpected-action');
  } });
  const result = await invokeOnce({ clients, target, verifiedMaterials, now: () => 1000 });
  assert.equal(result.invocationId, 'inv-123');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].service, 'tat');
  assert.equal(requests[0].action, 'InvokeCommand');
  assert.deepEqual(requests[0].request.InstanceIds, [target.instanceId]);
  assert.deepEqual(JSON.parse(requests[0].request.Parameters), { csr_b64: Buffer.from(fixture.csrPem).toString('base64') });
  const signed = await pollTask({ clients, invocation: result });
  assert.equal(signed.state, 'success');
  assert.equal(signed.output.csr_sha256, fixture.csrSha256);
  const bundle = JSON.stringify({ source_run_id: '123', source_job_id: 'source-csr', source_run_attempt: '1', source_commit: 'a'.repeat(40), source_started_at: '2026-11-24T11:55:00.000Z', csr_sha256: signed.output.csr_sha256, leaf_certificate: signed.output.leaf_certificate, ca_certificate: signed.output.ca_certificate });
  const returnDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a303-return-'));
  assert.deepEqual(parseReturnBundle(bundle, returnDir), { artifactName: 'sp08-a303-return-123-1' });
  assert.equal(fs.readFileSync(path.join(returnDir, 'leaf.pem'), 'utf8'), `${fixture.certificates.leaf.replace(/\r\n/g, '\n').replace(/\n?$/, '\n')}`);
  for (const filename of ['leaf.pem', 'ca.pem', 'binding.json']) fs.unlinkSync(path.join(returnDir, filename));
  fs.rmdirSync(returnDir);
  const lifecycleTargets = { region: target.region, instanceId: target.instanceId, securityGroupId: target.securityGroupId, startCommandId: 'cmd-fake-start', stopCommandId: 'cmd-fake-stop' };
  const lifecycleInput = JSON.stringify({ mode: 'start-approved', authorization: 'explicit-temporary', authorizedUntil: Date.parse('2026-11-24T12:10:00.000Z'),
    interfaceName: 'eth0', bindIPv4: '10.0.0.2', port: 8443, policy: { mode: 'github-oidc', serverIPv4: '198.51.100.8',
      issuer: 'https://token.actions.githubusercontent.com', githubJwksKeys: [{ kid: 'fixture' }], githubJwksFetchedAt: Date.parse('2026-11-24T11:59:00.000Z'),
      githubJwksExpiresAt: Date.parse('2026-11-24T12:14:00.000Z'), expectedClaims: { run_id: '123', run_attempt: '1', workflow_sha: 'a'.repeat(40), repository_id: '456' },
      expectedRequest: { run_id: '123', run_attempt: '1', repository_id: '456', payload: { database_access: false } } } });
  const lifecycleEvents = [];
  let releaseCaller;
  let nextLifecycleInvocation = 0;
  const lifecycleClients = buildClients({ region: target.region, transport: async (_service, action, request) => {
    if (action === 'InvokeCommand') { lifecycleEvents.push(`invoke:${request.CommandId}`); return { InvocationId: `inv-life${++nextLifecycleInvocation}` }; }
    if (action === 'DescribeInvocationTasks') {
      const id = request.Filters[0].Values[0];
      const start = id === 'inv-life1';
      return { TotalCount: 1, InvocationTaskSet: [{ InvocationId: id, InstanceId: target.instanceId,
        CommandId: start ? lifecycleTargets.startCommandId : lifecycleTargets.stopCommandId, TaskStatus: 'SUCCESS',
        TaskResult: { ExitCode: 0, Dropped: 0, Output: Buffer.from(`${start ? 'listener_ready=private_ipv4:8443' : 'server_stopped_and_keys_removed=true'}\n`).toString('base64') } }] };
    }
    throw new Error(`unexpected-lifecycle-action:${action}`);
  } });
  const lifecyclePromise = runServerLifecycle({ clients: lifecycleClients, targets: lifecycleTargets, verifiedMaterials, serverInput: lifecycleInput,
    expectedInput: { clbIPv4: '198.51.100.8' }, now: () => Date.parse('2026-11-24T11:59:30.000Z'), buildReturn: async () => {
      lifecycleEvents.push('return-submitted'); return { artifactName: 'sp08-a303-return-123-1' };
    }, awaitCallerTlsCompletion: async () => {
      lifecycleEvents.push('runner-wait');
      let callerPoll = 0;
      return awaitVerifiedCallerRun({ expected: { verifiedMaterials, sourceRunId: '123', sourceRunAttempt: '1', runId: '124', runAttempt: '1', event: 'workflow_dispatch', workflowSha: 'a'.repeat(40),
        repositoryId: '456', workflowPath: '.github/workflows/caller.yml', workflowRef: 'owner/repo/.github/workflows/caller.yml@refs/heads/codex/sp08-a3-03-tls-prep' },
      token: 'offline-test-token', repository: 'owner/repo', deadline: Date.parse('2026-11-24T12:05:00.000Z'),
      now: () => Date.parse('2026-11-24T11:59:30.000Z'), sleep: async () => { lifecycleEvents.push('caller-still-running'); if (callerPoll === 5) await new Promise((resolve) => { releaseCaller = resolve; }); },
      fetchImpl: async (url, options) => { callerPoll += 1; assert.equal(url, 'https://api.github.com/repos/owner/repo/actions/runs/124'); assert.equal(options.redirect, 'error');
        const completed = callerPoll === 6;
        return { status: 200, url, json: async () => ({ id: 124, repository: { id: 456 }, run_attempt: 1, path: '.github/workflows/caller.yml', head_sha: 'a'.repeat(40), event: 'workflow_dispatch',
          status: completed ? 'completed' : 'in_progress', conclusion: completed ? 'success' : null }) }; } });
    } });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(lifecycleEvents, ['invoke:cmd-fake-start', 'return-submitted', 'runner-wait', 'caller-still-running', 'caller-still-running', 'caller-still-running', 'caller-still-running', 'caller-still-running']);
  releaseCaller();
  assert.deepEqual(await lifecyclePromise, { artifactName: 'sp08-a303-return-123-1' });
  assert.deepEqual(lifecycleEvents, ['invoke:cmd-fake-start', 'return-submitted', 'runner-wait', 'caller-still-running', 'caller-still-running', 'caller-still-running', 'caller-still-running', 'caller-still-running', 'invoke:cmd-fake-stop']);
  const callerExpected = { verifiedMaterials, sourceRunId: '123', sourceRunAttempt: '1', runId: '124', runAttempt: '1', event: 'workflow_dispatch', workflowSha: 'a'.repeat(40), repositoryId: '456',
    workflowPath: '.github/workflows/caller.yml', workflowRef: 'owner/repo/.github/workflows/caller.yml@refs/heads/codex/sp08-a3-03-tls-prep' };
  const callerDeadline = Date.parse('2026-11-24T12:05:00.000Z');
  let clockNow = callerDeadline - 5000;
  await assert.rejects(awaitVerifiedCallerRun({ expected: callerExpected, token: 'offline-test-token', repository: 'owner/repo', deadline: callerDeadline,
    now: () => clockNow, sleep: async (ms) => { clockNow += ms; }, fetchImpl: async () => ({ status: 200,
      json: async () => ({ id: 124, repository: { id: 456 }, run_attempt: 1, path: callerExpected.workflowPath, head_sha: 'a'.repeat(40), event: 'workflow_dispatch', status: 'in_progress' }) }) }), /caller-run-check-deadline-unknown/);
  clockNow = callerDeadline - 1000;
  await assert.rejects(awaitVerifiedCallerRun({ expected: callerExpected, token: 'offline-test-token', repository: 'owner/repo', deadline: callerDeadline,
    now: () => clockNow, fetchImpl: async () => { clockNow = callerDeadline; return { status: 200,
      json: async () => ({ id: 124, repository: { id: 456 }, run_attempt: 1, path: callerExpected.workflowPath, head_sha: 'a'.repeat(40), event: 'workflow_dispatch', status: 'completed', conclusion: 'success' }) }; } }), /caller-run-check-deadline-unknown/);
  await assert.rejects(invokeOnce({ clients, target, verifiedMaterials, now: () => 1000 }), /invoke-already-attempted-manual-recovery/);
  fixture.cleanup();
});

test('official service clients load with explicit credentials without reading ambient credential files', () => {
  const clients = buildSdkClients({ region: target.region, credential: { secretId: 'fixture-id', secretKey: 'fixture-secret' } });
  assert.equal(typeof clients.tat.InvokeCommand, 'function');
  assert.equal(typeof clients.tat.DescribeInvocationTasks, 'function');
  assert.equal(typeof clients.vpc.DescribeSecurityGroupPolicies, 'function');
  assert.equal(typeof clients.vpc.CreateSecurityGroupPolicies, 'function');
  assert.equal(typeof clients.vpc.DeleteSecurityGroupPolicies, 'function');
});

test('SDK common uses patched uuid v4 in its real trace-id path without network IO', async () => {
  const base = path.join(__dirname, 'node_modules');
  assert.equal(require(path.join(base, 'tencentcloud-sdk-nodejs-tat/package.json')).version, '4.1.241');
  assert.equal(require(path.join(base, 'tencentcloud-sdk-nodejs-vpc/package.json')).version, '4.1.351');
  assert.equal(require(path.join(base, 'tencentcloud-sdk-nodejs-common/package.json')).version, '4.1.220');
  assert.equal(require(path.join(base, 'uuid/package.json')).version, '11.1.1');
  const { HttpConnection } = require(path.join(base, 'tencentcloud-sdk-nodejs-common/tencentcloud/common/http/http_connection.js'));
  const original = HttpConnection.doRequestWithSign3;
  let captured;
  HttpConnection.doRequestWithSign3 = async (options) => { captured = options; throw new Error('offline transport fixture'); };
  try {
    const clients = buildSdkClients({ region: target.region, credential: { secretId: 'fixture-id', secretKey: 'fixture-secret' } });
    await assert.rejects(clients.tat.DescribeInvocationTasks({ Filters: [], Limit: 1 }), /offline transport fixture/);
  } finally { HttpConnection.doRequestWithSign3 = original; }
  assert.match(captured.headers['X-TC-TraceId'], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('unknown Invoke result is not retried and requires manual reconciliation', async () => {
  const fixture = fixtureMaterials();
  const verifiedMaterials = await verifySourceMaterials({ expected: fixture.expected, token: 'offline-test-token', repository: 'owner/repo', fetchImpl: fixture.fetchImpl, now: fixture.now, pwshPath: fixture.pwshPath });
  let calls = 0;
  const clients = buildClients({ region: target.region, transport: async () => { calls += 1; return {}; } });
  await assert.rejects(invokeOnce({ clients, target, verifiedMaterials, now: () => Date.parse('2026-11-24T11:59:59.999Z') }), /invocation-result-unknown-manual-recovery/);
  assert.equal(calls, 1);
  fixture.cleanup();
});

test('does not accept caller-constructed source evidence', async () => {
  let calls = 0;
  const clients = buildClients({ region: target.region, transport: async () => { calls += 1; return { InvocationId: 'inv-123' }; } });
  await assert.rejects(invokeOnce({ clients, target, verifiedMaterials: { sourceRunId: '123', csrSha256: digest, csrPem: pem, cidr: '8.8.8.8/32' } }), /verified-source-materials-required/);
  assert.equal(calls, 0);
});

test('rejects source artifact whose uploaded digest does not match the archive bytes', async () => {
  const fixture = fixtureMaterials();
  const clients = buildClients({ region: target.region, transport: async () => { throw new Error('cloud transport must not be reached'); } });
  const tamperedFetch = async (url, options) => {
    const response = await fixture.fetchImpl(url, options);
    if (url.endsWith('/artifacts?per_page=100')) {
      const list = await response.json();
      list.artifacts[0].digest = `sha256:${'0'.repeat(64)}`;
      return { ...response, json: async () => list };
    }
    return response;
  };
  await assert.rejects(verifySourceMaterials({ expected: fixture.expected, token: 'offline-test-token', repository: 'owner/repo', fetchImpl: tamperedFetch, now: fixture.now, pwshPath: fixture.pwshPath }), /source-artifact-digest-mismatch/);
  await assert.rejects(invokeOnce({ clients, target, verifiedMaterials: { sourceRunId: '123', cidr: '8.8.8.8/32', csrSha256: digest, csrPem: pem } }), /verified-source-materials-required/);
  fixture.cleanup();
});

test('rejects completed, failed or cancelled source runs instead of waiting on a deadlock path', async () => {
  const fixture = fixtureMaterials();
  const invalidRunFetch = async (url, options) => {
    const response = await fixture.fetchImpl(url, options);
    if (url.endsWith('/actions/runs/123')) return { ...response, json: async () => ({ id: 123, event: 'workflow_dispatch', status: 'completed', conclusion: 'success', repository: { id: 456 }, path: fixture.expected.workflowPath, head_sha: fixture.expected.trustedHeadSha, run_attempt: 1, actor: { id: 789, login: 'operator' }, created_at: '2026-11-24T11:55:00Z' }) };
    return response;
  };
  await assert.rejects(verifySourceMaterials({ expected: fixture.expected, token: 'offline-test-token', repository: 'owner/repo', fetchImpl: invalidRunFetch, now: fixture.now, pwshPath: fixture.pwshPath }), /source-run-not-active-or-untrusted/);
  fixture.cleanup();
});

test('expired source material is rejected before invoking Tencent SDK', async () => {
  const fixture = fixtureMaterials();
  const verifiedMaterials = await verifySourceMaterials({ expected: fixture.expected, token: 'offline-test-token', repository: 'owner/repo', fetchImpl: fixture.fetchImpl, now: fixture.now, pwshPath: fixture.pwshPath });
  let calls = 0;
  const clients = buildClients({ region: target.region, transport: async () => { calls += 1; return { InvocationId: 'inv-123' }; } });
  await assert.rejects(invokeOnce({ clients, target, verifiedMaterials, now: () => Date.parse('2026-11-24T12:01:00.000Z') }), /source-or-egress-deadline-expired/);
  assert.equal(calls, 0);
  fixture.cleanup();
});

test('task lookup binds invocation, instance, command and rejects truncated or missing output', async () => {
  const request = { invocationId: 'inv-123', instanceId: target.instanceId, commandId: target.commandId };
  let query;
  const clients = { tat: { DescribeInvocationTasks: async (args) => { query = args; return { TotalCount: 1, InvocationTaskSet: [{ InvocationId: request.invocationId, InstanceId: request.instanceId, CommandId: request.commandId, TaskStatus: 'RUNNING' }] }; } } };
  assert.deepEqual(await pollTask({ clients, invocation: request }), { state: 'running' });
  assert.equal(query.Filters[0].Values[0], request.invocationId);
  clients.tat.DescribeInvocationTasks = async () => ({ TotalCount: 0, InvocationTaskSet: [] });
  await assert.rejects(pollTask({ clients, invocation: request }), /task-missing-or-ambiguous-manual-recovery/);
});

test('polling obeys a hard injectable deadline and fixed request budget', async () => {
  let time = 1000;
  let calls = 0;
  const clients = { tat: { DescribeInvocationTasks: async () => { calls += 1; return { TotalCount: 1, InvocationTaskSet: [{ InvocationId: 'inv-1', InstanceId: target.instanceId, CommandId: target.commandId, TaskStatus: 'RUNNING' }] }; } } };
  await assert.rejects(pollUntilTerminal({ clients, invocation: { invocationId: 'inv-1', instanceId: target.instanceId, commandId: target.commandId, startedAt: 1000 }, deadlineMs: 3000, maxPolls: 3, now: () => time, sleep: async (ms) => { time += ms; }, pollDelayMs: 1000 }), /task-deadline-expired-manual-recovery|task-still-running-manual-recovery/);
  assert.ok(calls <= 3);
  await assert.rejects(pollUntilTerminal({ clients, invocation: { invocationId: 'inv-1', instanceId: target.instanceId, commandId: target.commandId, startedAt: 0 }, deadlineMs: 300001, now: () => 1 }), /poll-budget-invalid/);
});

test('security rule recovery deletes only its marked rule and preserves prior rules', async () => {
  const fixture = fixtureMaterials();
  const verifiedMaterials = await verifySourceMaterials({ expected: fixture.expected, token: 'offline-test-token', repository: 'owner/repo', fetchImpl: fixture.fetchImpl, now: fixture.now, pwshPath: fixture.pwshPath });
  let version = '1';
  let ingress = [{ PolicyIndex: 0, Protocol: 'TCP', Port: '443', CidrBlock: '198.51.100.1/32', Action: 'ACCEPT', PolicyDescription: 'legacy' }];
  const transport = async (_service, action, request) => {
    if (action === 'DescribeSecurityGroupPolicies') return { SecurityGroupPolicySet: { Version: version, Ingress: structuredClone(ingress) } };
    if (action === 'CreateSecurityGroupPolicies') { assert.equal(request.SecurityGroupPolicySet.Ingress[0].CidrBlock, '8.8.8.8/32'); ingress.push({ ...request.SecurityGroupPolicySet.Ingress[0], PolicyIndex: 1 }); version = '2'; return { RequestId: 'create' }; }
    if (action === 'DeleteSecurityGroupPolicies') { assert.equal(request.SecurityGroupPolicySet.Version, version); ingress = ingress.filter((rule) => rule.PolicyIndex !== request.SecurityGroupPolicySet.Ingress[0].PolicyIndex); version = '3'; return { RequestId: 'delete' }; }
    throw new Error('unexpected-action');
  };
  const clients = buildClients({ region: target.region, transport });
  const lease = await addIngressRule({ clients, target, verifiedMaterials, now: () => 2000 });
  ingress[1].PolicyIndex = 7;
  const result = await removeIngressRule({ clients, lease });
  assert.deepEqual(result, { removed: true, deleteOutcome: 'confirmed' });
  assert.deepEqual(ingress.map((rule) => rule.PolicyDescription), ['legacy']);
  fixture.cleanup();
});

test('cleanup refuses to delete a same-index replacement without this run marker', async () => {
  const lease = { securityGroupId: target.securityGroupId, version: '2', policyIndex: 1, rule: { Protocol: 'TCP', Port: '8443', CidrBlock: '8.8.8.8/32', Action: 'ACCEPT', PolicyDescription: 'A303-0123456789abcdef01234567' } };
  let deletes = 0;
  const clients = { vpc: { DescribeSecurityGroupPolicies: async () => ({ SecurityGroupPolicySet: { Version: '3', Ingress: [{ PolicyIndex: 1, Protocol: 'TCP', Port: '8443', CidrBlock: '8.8.8.8/32', Action: 'ACCEPT', PolicyDescription: 'user-rule' }] } }), DeleteSecurityGroupPolicies: async () => { deletes += 1; return { RequestId: 'delete' }; } } };
  await assert.rejects(removeIngressRule({ clients, lease }), /security-group-rule-changed-manual-recovery/);
  assert.equal(deletes, 0);
});

test('unknown security-group create and delete outcomes reconcile by this rule marker', async () => {
  const fixture = fixtureMaterials();
  const verifiedMaterials = await verifySourceMaterials({ expected: fixture.expected, token: 'offline-test-token', repository: 'owner/repo', fetchImpl: fixture.fetchImpl, now: fixture.now, pwshPath: fixture.pwshPath });
  let ingress = [];
  let version = '1';
  const clients = buildClients({ region: target.region, transport: async (_service, action, request) => {
    if (action === 'DescribeSecurityGroupPolicies') return { SecurityGroupPolicySet: { Version: version, Ingress: structuredClone(ingress) } };
    if (action === 'CreateSecurityGroupPolicies') { ingress.push({ ...request.SecurityGroupPolicySet.Ingress[0], PolicyIndex: 4 }); version = '2'; throw new Error('simulated-unknown-create-result'); }
    if (action === 'DeleteSecurityGroupPolicies') { ingress = []; version = '3'; throw new Error('simulated-unknown-delete-result'); }
    throw new Error('unexpected-action');
  } });
  const lease = await addIngressRule({ clients, target, verifiedMaterials, now: () => 2000 });
  assert.equal(lease.createOutcome, 'recovered-by-marker');
  const removal = await removeIngressRule({ clients, lease });
  assert.deepEqual(removal, { removed: true, deleteOutcome: 'recovered-by-readback' });
  fixture.cleanup();
});
