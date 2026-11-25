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
const { dispatchReturnOnce } = require('./return-dispatch-once.cjs');
const { assertOperatorReturnRunBinding, runOperatorFlow } = require('./operator-flow.cjs');
const { waitForReturnRun } = require('./csr-handoff.cjs');
const { runOperatorEntry } = require('./operator-entry.cjs');

const target = { commandId: 'cmd-approved1', instanceId: 'ins-approved1', region: 'ap-guangzhou', securityGroupId: 'sg-approved1' };
const pem = '-----BEGIN CERTIFICATE REQUEST-----\nQUJD\n-----END CERTIFICATE REQUEST-----\n';
const digest = require('node:crypto').createHash('sha256').update(pem).digest('hex');
function fixtureMaterials(nowMs = Date.parse('2026-11-24T12:00:00.000Z')) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a303-sdk-'));
  const sourceStartedAt = new Date(nowMs - 5 * 60 * 1000).toISOString();
  const egressQueriedAt = new Date(nowMs - 60 * 1000).toISOString();
  const egressExpiresAt = new Date(nowMs + 4 * 60 * 1000).toISOString();
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
  fs.writeFileSync(sourceManifestPath, JSON.stringify({ source_run_id: '123', source_job_id: 'source-csr', source_run_attempt: '1', source_commit: 'a'.repeat(40), source_started_at: sourceStartedAt, csr_sha256: csrSha256 }), { flag: 'wx' });
  fs.writeFileSync(egressPath, JSON.stringify({ schema: 'sp08-a303-egress-ip-v1', source_run_id: '123', source_run_attempt: '1', workflow_sha: 'a'.repeat(40), csr_sha256: csrSha256, query_source: 'https://api.ipify.org/', queried_at: egressQueriedAt, ipv4: '8.8.8.8', cidr_suggestion: '8.8.8.8/32', expires_at: egressExpiresAt, identity_note: 'Public IP observation only; not an identity credential or authorization.' }), { flag: 'wx' });
  fs.writeFileSync(scriptPath, `Compress-Archive -LiteralPath @('${path.join(tempDir, names[0])}','${sourceManifestPath}','${egressPath}') -DestinationPath '${zipPath}' -Force`, { flag: 'wx' });
  const zipped = spawnSync(pwshPath, ['-NoProfile', '-NonInteractive', '-File', scriptPath], { encoding: 'utf8', timeout: 10000, windowsHide: true, shell: false });
  assert.equal(zipped.status, 0, zipped.stderr);
  const zipBytes = fs.readFileSync(zipPath);
  const artifactDigest = `sha256:${require('node:crypto').createHash('sha256').update(zipBytes).digest('hex')}`;
  const expected = { sourceRunId: '123', repositoryId: '456', trustedHeadSha: 'a'.repeat(40), actorId: '789', actorLogin: 'operator', workflowPath: '.github/workflows/sp08-a3-03-tls-caller.yml', workflowRef: 'owner/repo/.github/workflows/sp08-a3-03-tls-caller.yml@refs/heads/codex/sp08-a3-03-tls-prep', notBeforeMs: nowMs - 10 * 60 * 1000, notAfterMs: nowMs, caFingerprint256: certificates.fingerprint };
  const run = { id: 123, event: 'workflow_dispatch', status: 'in_progress', conclusion: null, repository: { id: 456 }, path: expected.workflowPath, head_sha: expected.trustedHeadSha, head_branch: 'codex/sp08-a3-03-tls-prep', run_attempt: 1, actor: { id: 789, login: 'operator' }, created_at: sourceStartedAt };
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
  const testNow = Date.parse('2026-11-24T11:59:50.000Z');
  const verifiedMaterials = await verifySourceMaterials({ expected: fixture.expected, token: 'offline-test-token', repository: 'owner/repo', fetchImpl: fixture.fetchImpl, now: () => testNow, pwshPath: fixture.pwshPath });
  const sourceCompletion = { id: 123, repository: { id: 456 }, run_attempt: 1, path: fixture.expected.workflowPath, head_sha: 'a'.repeat(40),
    head_branch: 'codex/sp08-a3-03-tls-prep', event: 'workflow_dispatch', actor: { id: 789, login: 'operator' }, status: 'completed', conclusion: 'success' };
  const completionArgs = { verifiedMaterials, token: 'offline-test-token', deadline: Date.parse('2026-11-24T12:05:00.000Z'), now: () => testNow };
  await assert.rejects(awaitVerifiedCallerRun({ ...completionArgs, fetchImpl: async () => ({ status: 200, json: async () => ({ ...sourceCompletion, id: 124 }) }) }), /caller-run-binding-mismatch/);
  await assert.rejects(awaitVerifiedCallerRun({ ...completionArgs, fetchImpl: async () => ({ status: 200, json: async () => ({ ...sourceCompletion, head_branch: 'main' }) }) }), /caller-run-binding-mismatch/);
  const requests = [];
  const scriptOutput = `csr_sha256=${fixture.csrSha256}\nleaf_cert_b64=${Buffer.from(fixture.certificates.leaf).toString('base64')}\nca_cert_b64=${Buffer.from(fixture.certificates.ca).toString('base64')}\n`;
  const taskOutput = Buffer.from(scriptOutput).toString('base64');
  const clients = buildClients({ region: target.region, transport: async (service, action, request) => {
    requests.push({ service, action, request });
    if (action === 'InvokeCommand') return { InvocationId: 'inv-123' };
    if (action === 'DescribeInvocationTasks') return { TotalCount: 1, InvocationTaskSet: [{ InvocationId: 'inv-123', InstanceId: target.instanceId, CommandId: target.commandId, TaskStatus: 'SUCCESS', TaskResult: { ExitCode: 0, Dropped: 0, Output: taskOutput } }] };
    throw new Error('unexpected-action');
  } });
  const result = await invokeOnce({ clients, target, verifiedMaterials, now: () => testNow });
  assert.equal(result.invocationId, 'inv-123');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].service, 'tat');
  assert.equal(requests[0].action, 'InvokeCommand');
  assert.deepEqual(requests[0].request.InstanceIds, [target.instanceId]);
  assert.deepEqual(JSON.parse(requests[0].request.Parameters), { csr_b64: Buffer.from(fixture.csrPem).toString('base64'), source_run_id: verifiedMaterials.sourceRunId });
  const signed = await pollTask({ clients, invocation: result, now: () => testNow, certificateNow: Date.now });
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
      return awaitVerifiedCallerRun({ verifiedMaterials, token: 'offline-test-token', deadline: Date.parse('2026-11-24T12:05:00.000Z'),
      now: () => Date.parse('2026-11-24T11:59:30.000Z'), sleep: async () => { lifecycleEvents.push('caller-still-running'); if (callerPoll === 5) await new Promise((resolve) => { releaseCaller = resolve; }); },
      fetchImpl: async (url, options) => { callerPoll += 1; assert.equal(url, 'https://api.github.com/repos/owner/repo/actions/runs/123'); assert.equal(options.redirect, 'error');
        const completed = callerPoll === 6;
        return { status: 200, url, json: async () => ({ id: 123, repository: { id: 456 }, run_attempt: 1, path: '.github/workflows/sp08-a3-03-tls-caller.yml', head_sha: 'a'.repeat(40), head_branch: 'codex/sp08-a3-03-tls-prep', event: 'workflow_dispatch', actor: { id: 789, login: 'operator' },
          status: completed ? 'completed' : 'in_progress', conclusion: completed ? 'success' : null }) }; } });
    } });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(lifecycleEvents, ['invoke:cmd-fake-start', 'return-submitted', 'runner-wait', 'caller-still-running', 'caller-still-running', 'caller-still-running', 'caller-still-running', 'caller-still-running']);
  releaseCaller();
  assert.deepEqual(await lifecyclePromise, { artifactName: 'sp08-a303-return-123-1' });
  assert.deepEqual(lifecycleEvents, ['invoke:cmd-fake-start', 'return-submitted', 'runner-wait', 'caller-still-running', 'caller-still-running', 'caller-still-running', 'caller-still-running', 'caller-still-running', 'invoke:cmd-fake-stop']);
  const callerDeadline = Date.parse('2026-11-24T12:05:00.000Z');
  let clockNow = callerDeadline - 5000;
  await assert.rejects(awaitVerifiedCallerRun({ verifiedMaterials, token: 'offline-test-token', deadline: callerDeadline,
    now: () => clockNow, sleep: async (ms) => { clockNow += ms; }, fetchImpl: async () => ({ status: 200,
      json: async () => ({ id: 123, repository: { id: 456 }, run_attempt: 1, path: '.github/workflows/sp08-a3-03-tls-caller.yml', head_sha: 'a'.repeat(40), head_branch: 'codex/sp08-a3-03-tls-prep', event: 'workflow_dispatch', actor: { id: 789, login: 'operator' }, status: 'in_progress' }) }) }), /caller-run-check-deadline-unknown/);
  clockNow = callerDeadline - 1000;
  await assert.rejects(awaitVerifiedCallerRun({ verifiedMaterials, token: 'offline-test-token', deadline: callerDeadline,
    now: () => clockNow, fetchImpl: async () => { clockNow = callerDeadline; return { status: 200,
      json: async () => ({ id: 123, repository: { id: 456 }, run_attempt: 1, path: '.github/workflows/sp08-a3-03-tls-caller.yml', head_sha: 'a'.repeat(40), head_branch: 'codex/sp08-a3-03-tls-prep', event: 'workflow_dispatch', actor: { id: 789, login: 'operator' }, status: 'completed', conclusion: 'success' }) }; } }), /caller-run-check-deadline-unknown/);
  await assert.rejects(invokeOnce({ clients, target, verifiedMaterials, now: () => 1000 }), /invoke-already-attempted-manual-recovery/);
  fixture.cleanup();
});

test('official service clients load with explicit credentials without reading ambient credential files', () => {
  const clients = buildSdkClients({ region: target.region, credential: { secretId: 'fixture-id', secretKey: 'fixture-secret', token: 'fixture-token' } });
  assert.equal(typeof clients.tat.InvokeCommand, 'function');
  assert.equal(typeof clients.tat.DescribeInvocationTasks, 'function');
  assert.equal(typeof clients.vpc.DescribeSecurityGroupPolicies, 'function');
  assert.equal(typeof clients.vpc.CreateSecurityGroupPolicies, 'function');
  assert.equal(typeof clients.vpc.DeleteSecurityGroupPolicies, 'function');
  assert.equal(clients.tat.profile.httpProfile.reqTimeout, 10, '10000ms adapter timeout becomes 10 SDK seconds');
  assert.equal(clients.tat.credential.token, 'fixture-token');
  assert.equal(clients.vpc.credential.token, 'fixture-token');
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

test('return dispatch binds minted source, durably reserves once and never retries an unknown POST', async () => {
  const fixture = fixtureMaterials();
  const nowMs = Date.parse('2026-11-24T11:59:50.000Z');
  const verifiedMaterials = await verifySourceMaterials({ expected: fixture.expected, token: 'offline-test-token', repository: 'owner/repo', fetchImpl: fixture.fetchImpl, now: () => nowMs, pwshPath: fixture.pwshPath });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'a303-return-journal-'));
  const journalPath = path.join(directory, 'dispatch.json');
  const bindingBranch = 'codex/sp08-a3-03-tls-prep';
  const sourceRun = { id: 123, repository: { id: 456 }, path: fixture.expected.workflowPath, head_sha: fixture.expected.trustedHeadSha,
    run_attempt: 1, status: 'in_progress', conclusion: null, event: 'workflow_dispatch', actor: { id: 789 }, head_branch: bindingBranch };
  let posts = 0;
  let unknown = true;
  const fetchImpl = async (url, options) => {
    assert.equal(options.signal instanceof AbortSignal, true);
    if (options.method === 'GET' && url.endsWith('/actions/runs/123')) return { status: 200, json: async () => sourceRun };
    if (options.method === 'GET' && url.includes('/actions/workflows/sp08-a3-03-csr-return.yml/runs?')) return { status: 200, json: async () => ({ workflow_runs: [] }) };
    if (options.method === 'POST') { posts += 1; const body = JSON.parse(options.body); assert.equal(body.ref, bindingBranch); assert.equal(body.inputs.bundle.length < 60000, true); if (unknown) throw new Error('connection-lost-after-send'); return { status: 204 }; }
    throw new Error('unexpected-request');
  };
  const bundle = JSON.stringify({ source_run_id: '123', source_job_id: 'source-csr', source_run_attempt: '1', source_commit: fixture.expected.trustedHeadSha,
    source_started_at: '2026-11-24T11:55:00.000Z', csr_sha256: fixture.csrSha256, leaf_certificate: fixture.certificates.leaf, ca_certificate: fixture.certificates.ca });
  try {
    await assert.rejects(dispatchReturnOnce({ verifiedMaterials, journalPath, bundle, token: 'offline-token', fetchImpl, deadline: verifiedMaterials.sourceDeadline, now: () => nowMs }), /outcome-unknown/);
    assert.deepEqual(JSON.parse(fs.readFileSync(journalPath, 'utf8')).state, 'intent');
    unknown = false;
    await assert.rejects(dispatchReturnOnce({ verifiedMaterials, journalPath, bundle, token: 'offline-token', fetchImpl, deadline: verifiedMaterials.sourceDeadline, now: () => nowMs }), /journal-already-exists/);
    assert.equal(posts, 1);
  } finally { fs.unlinkSync(journalPath); fs.rmdirSync(directory); fixture.cleanup(); }
});

test('return dispatch deadline aborts a response body that stalls after headers', async () => {
  const fixture = fixtureMaterials();
  const nowMs = Date.parse('2026-11-24T11:59:50.000Z');
  const verifiedMaterials = await verifySourceMaterials({ expected: fixture.expected, token: 'offline-test-token', repository: 'owner/repo', fetchImpl: fixture.fetchImpl, now: () => nowMs, pwshPath: fixture.pwshPath });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'a303-return-timeout-'));
  const journalPath = path.join(directory, 'dispatch.json');
  const hangingFetch = async () => ({ status: 200, json: async () => new Promise(() => {}) });
  const bundle = JSON.stringify({ source_run_id: '123', source_run_attempt: '1', source_commit: fixture.expected.trustedHeadSha, csr_sha256: fixture.csrSha256, source_job_id: 'source-csr' });
  try {
    await assert.rejects(dispatchReturnOnce({ verifiedMaterials, journalPath, bundle, token: 'offline-token', fetchImpl: hangingFetch, deadline: nowMs + 20, now: () => nowMs }), /outcome-unknown/);
    assert.equal(fs.existsSync(journalPath), false);
  } finally { fs.rmdirSync(directory); fixture.cleanup(); }
});

test('operator flow completes fixture CSR, cert validation, leased ingress, return dispatch, same-run TLS, stop and lease removal', async () => {
  const nowMs = Date.now();
  const fixture = fixtureMaterials(nowMs + 60 * 1000);
  const verifiedMaterials = await verifySourceMaterials({ expected: fixture.expected, token: 'offline-test-token', repository: 'owner/repo',
    fetchImpl: fixture.fetchImpl, now: () => nowMs, pwshPath: fixture.pwshPath });
  const journalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a303-flow-journal-'));
  const journalPath = path.join(journalDir, 'return-dispatch.json');
  const operationTarget = { commandId: 'cmd-sign01', instanceId: 'ins-flow01', region: 'ap-guangzhou', securityGroupId: 'sg-flow01' };
  const lifecycleTargets = { region: operationTarget.region, instanceId: operationTarget.instanceId, securityGroupId: operationTarget.securityGroupId,
    startCommandId: 'cmd-start01', stopCommandId: 'cmd-stop01' };
  const securityTarget = { ...operationTarget, commandId: 'cmd-sign01' };
  const tlsSource = { id: 123, repository: { id: 456 }, run_attempt: 1, path: fixture.expected.workflowPath, head_sha: fixture.expected.trustedHeadSha,
    head_branch: 'codex/sp08-a3-03-tls-prep', event: 'workflow_dispatch', actor: { id: 789, login: 'operator' }, status: 'completed', conclusion: 'success' };
  const returnWorkflowPath = '.github/workflows/sp08-a3-03-csr-return.yml';
  const returnWorkflowSha = fixture.expected.trustedHeadSha;
  const trace = [];
  let dispatchStatus = 204;
  let ingress = [];
  let version = '1';
  const certOutput = `csr_sha256=${fixture.csrSha256}\nleaf_cert_b64=${Buffer.from(fixture.certificates.leaf).toString('base64')}\nca_cert_b64=${Buffer.from(fixture.certificates.ca).toString('base64')}\n`;
  const clients = buildClients({ region: operationTarget.region, transport: async (_service, action, request) => {
    trace.push(action === 'InvokeCommand' ? request.CommandId : action);
    if (action === 'InvokeCommand') {
      if (request.CommandId === operationTarget.commandId) return { InvocationId: 'inv-cert1' };
      if (request.CommandId === lifecycleTargets.startCommandId) return { InvocationId: 'inv-start1' };
      if (request.CommandId === lifecycleTargets.stopCommandId) return { InvocationId: 'inv-stop1' };
    }
    if (action === 'DescribeInvocationTasks') {
      const invocationId = request.Filters[0].Values[0];
      const output = invocationId === 'inv-cert1' ? Buffer.from(certOutput).toString('base64')
        : Buffer.from(`${invocationId === 'inv-start1' ? 'listener_ready=private_ipv4:8443' : 'server_stopped_and_keys_removed=true'}\n`).toString('base64');
      const id = invocationId === 'inv-cert1' ? operationTarget.commandId : invocationId === 'inv-start1' ? lifecycleTargets.startCommandId : lifecycleTargets.stopCommandId;
      return { TotalCount: 1, InvocationTaskSet: [{ InvocationId: invocationId, InstanceId: operationTarget.instanceId, CommandId: id,
        TaskStatus: 'SUCCESS', TaskResult: { ExitCode: 0, Dropped: 0, Output: output } }] };
    }
    if (action === 'DescribeSecurityGroupPolicies') return { SecurityGroupPolicySet: { Version: version, Ingress: structuredClone(ingress) } };
    if (action === 'CreateSecurityGroupPolicies') { ingress.push({ ...request.SecurityGroupPolicySet.Ingress[0], PolicyIndex: 4 }); version = '2'; return { RequestId: 'create' }; }
    if (action === 'DeleteSecurityGroupPolicies') { ingress = []; version = '3'; return { RequestId: 'delete' }; }
    throw new Error(`unexpected-${action}`);
  } });
  const expectedClaims = { run_id: '123', run_attempt: '1', workflow_sha: fixture.expected.trustedHeadSha, repository_id: '456' };
  const serverInput = JSON.stringify({ mode: 'start-approved', authorization: 'explicit-temporary', authorizedUntil: nowMs + 60000,
    interfaceName: 'eth0', bindIPv4: '10.0.0.2', port: 8443, policy: { mode: 'github-oidc', serverIPv4: '198.51.100.8',
      githubJwksFetchedAt: nowMs - 1000, githubJwksExpiresAt: nowMs + 60000, expectedClaims,
      expectedRequest: { run_id: '123', run_attempt: '1', repository_id: '456', payload: { database_access: false } } } });
  const expectedInput = { clbIPv4: '198.51.100.8' };
  const githubFetch = async (url, options) => {
    trace.push(options.method === 'POST' ? 'github-dispatch' : url.includes('/actions/runs/123') ? 'github-source-read' : 'github-return-poll');
    if (url.endsWith('/actions/runs/123')) return { status: 200, url, json: async () => options.method === 'GET' && trace.includes('github-dispatch') ? tlsSource : {
      ...tlsSource, status: 'in_progress', conclusion: null } };
    if (url.includes('/actions/workflows/sp08-a3-03-csr-return.yml/runs?') && options.method === 'GET'
      && url.includes('status=completed')) return { status: 200, headers: { get: () => null }, json: async () => ({ total_count: 1, workflow_runs: [{ id: 456,
        event: 'workflow_dispatch', status: 'completed', conclusion: 'success', repository: { full_name: 'owner/repo' }, path: returnWorkflowPath,
        head_sha: returnWorkflowSha, head_branch: 'codex/sp08-a3-03-tls-prep', run_attempt: 1, actor: { id: 789, login: 'operator' }, created_at: new Date(nowMs).toISOString() }] }) };
    if (url.includes('/actions/workflows/sp08-a3-03-csr-return.yml/runs?')) return { status: 200, json: async () => ({ workflow_runs: [] }) };
    if (url.endsWith('/actions/workflows/sp08-a3-03-csr-return.yml/dispatches')) {
      const parsed = JSON.parse(options.body);
      const bundle = JSON.parse(parsed.inputs.bundle);
      assert.equal(parsed.ref, 'codex/sp08-a3-03-tls-prep');
      assert.equal(bundle.csr_sha256, fixture.csrSha256);
      assert.equal(bundle.source_run_id, '123');
      trace.push('exact-return-body');
      return { status: dispatchStatus };
    }
    throw new Error(`unexpected-github-${url}`);
  };
  const callerFetch = async (url) => ({ status: 200, url, json: async () => tlsSource });
  const awaitCallerTlsCompletion = async ({ deadline }) => awaitVerifiedCallerRun({ verifiedMaterials, token: 'offline-token', fetchImpl: callerFetch,
    deadline, now: () => nowMs, sleep: async () => {} });
  const untrustedActorReturn = await waitForReturnRun({ token: 'offline-token', repository: 'owner/repo', workflowId: 'sp08-a3-03-csr-return.yml',
    expected: { workflowPath: returnWorkflowPath, trustedHeadSha: returnWorkflowSha, actorId: '999', actorLogin: 'other-operator',
      notBeforeMs: verifiedMaterials.sourceStartedAt, notAfterMs: verifiedMaterials.sourceStartedAt + 300000 },
    budget: { maxPolls: 1, maxPages: 1, maxCandidates: 2, maxArtifactBytes: 65536, maxWaitMs: 300000, requestTimeoutMs: 10000, pollDelaysMs: [0] },
    fetchImpl: async (url) => ({ status: 200, url, headers: { get: () => null }, json: async () => ({ total_count: 1, workflow_runs: [{ id: 457,
      event: 'workflow_dispatch', status: 'completed', conclusion: 'success', repository: { full_name: 'owner/repo' }, path: returnWorkflowPath,
      head_sha: returnWorkflowSha, head_branch: 'codex/sp08-a3-03-tls-prep', run_attempt: 1,
      actor: { id: 999, login: 'other-operator' }, created_at: new Date(nowMs).toISOString() }] }) }), sleep: async () => {} });
  assert.throws(() => assertOperatorReturnRunBinding(untrustedActorReturn, verifiedMaterials), /operator-return-run-binding-invalid/);
  const untrustedShaReturn = await waitForReturnRun({ token: 'offline-token', repository: 'owner/repo', workflowId: 'sp08-a3-03-csr-return.yml',
    expected: { workflowPath: returnWorkflowPath, trustedHeadSha: 'd'.repeat(40), actorId: '789', actorLogin: 'operator',
      notBeforeMs: verifiedMaterials.sourceStartedAt, notAfterMs: verifiedMaterials.sourceStartedAt + 300000 },
    budget: { maxPolls: 1, maxPages: 1, maxCandidates: 2, maxArtifactBytes: 65536, maxWaitMs: 300000, requestTimeoutMs: 10000, pollDelaysMs: [0] },
    fetchImpl: async (url) => ({ status: 200, url, headers: { get: () => null }, json: async () => ({ total_count: 1, workflow_runs: [{ id: 458,
      event: 'workflow_dispatch', status: 'completed', conclusion: 'success', repository: { full_name: 'owner/repo' }, path: returnWorkflowPath,
      head_sha: 'd'.repeat(40), head_branch: 'codex/sp08-a3-03-tls-prep', run_attempt: 1,
      actor: { id: 789, login: 'operator' }, created_at: new Date(nowMs).toISOString() }] }) }), sleep: async () => {} });
  assert.throws(() => assertOperatorReturnRunBinding(untrustedShaReturn, verifiedMaterials), /operator-return-run-binding-invalid/);
  try {
    const flowOptions = { enableExternalDispatch: true, clients, target: operationTarget, lifecycleTargets, securityTarget,
      verifiedMaterials, serverInput, expectedInput, journalPath, token: 'offline-token', fetchImpl: githubFetch, now: () => nowMs,
      sleep: async () => {}, awaitVerifiedReturnRun: async ({ deadline }) => waitForReturnRun({ token: 'offline-token', repository: 'owner/repo',
        workflowId: 'sp08-a3-03-csr-return.yml', expected: { workflowPath: returnWorkflowPath, trustedHeadSha: returnWorkflowSha,
          actorId: '789', actorLogin: 'operator', notBeforeMs: verifiedMaterials.sourceStartedAt, notAfterMs: verifiedMaterials.sourceStartedAt + 300000 },
        budget: { maxPolls: 1, maxPages: 1, maxCandidates: 10, maxArtifactBytes: 65536, maxWaitMs: 300000, requestTimeoutMs: 10000, pollDelaysMs: [0] },
        headBranch: 'codex/sp08-a3-03-tls-prep',
        fetchImpl: githubFetch, sleep: async () => {} }), awaitCallerTlsCompletion };
    await assert.rejects(runOperatorFlow({ ...flowOptions, securityTarget: { ...securityTarget, instanceId: 'ins-other01' } }), /operator-targets-disagree/);
    assert.equal(trace.length, 0);
    fs.writeFileSync(journalPath, '{}', { flag: 'wx' });
    await assert.rejects(runOperatorFlow(flowOptions), /dispatch-journal-already-exists/);
    assert.equal(trace.length, 0);
    fs.unlinkSync(journalPath);
    const entryConfig = { repository: 'owner/repo', repositoryId: '456', actorId: '789', actorLogin: 'operator',
      workflowPath: fixture.expected.workflowPath, workflowRef: fixture.expected.workflowRef, trustedHeadSha: fixture.expected.trustedHeadSha,
      sourceRunId: '123', notBeforeMs: fixture.expected.notBeforeMs, notAfterMs: fixture.expected.notAfterMs,
      caFingerprint256: fixture.expected.caFingerprint256, target: operationTarget, lifecycleTargets, securityTarget,
      serverInput, expectedInput, journalPath, pwshPath: fixture.pwshPath };
    const entryFetch = async (url, options) => url.includes('/actions/artifacts/') || url.includes('/actions/runs/123/artifacts') || url.startsWith('https://artifact-download.invalid/')
      ? fixture.fetchImpl(url, options) : url.endsWith('/actions/runs/123') && !trace.includes('github-dispatch')
        ? fixture.fetchImpl(url, options) : githubFetch(url, options);
    const result = await runOperatorEntry(entryConfig, { token: 'offline-token', credential: { secretId: 'offline', secretKey: 'offline' } },
      { enableExternalDispatch: true, fetchImpl: entryFetch, callerFetchImpl: async (url) => ({ status: 200, url, json: async () => tlsSource }),
        now: () => nowMs, sleep: async () => {}, buildClients: () => clients });
    assert.equal(result.state, 'tls-complete');
    assert.equal(result.returnRunId, '456');
    assert.deepEqual(ingress, []);
    assert.deepEqual(JSON.parse(fs.readFileSync(journalPath, 'utf8')).returnRunId, '456');
    await assert.rejects(dispatchReturnOnce({ verifiedMaterials, journalPath, bundle: '{}', token: 'offline-token', fetchImpl: githubFetch,
      deadline: verifiedMaterials.sourceDeadline, now: () => nowMs }), /dispatch-journal-already-exists/);
    assert.ok(trace.indexOf('github-dispatch') > trace.indexOf('cmd-start01'));
    assert.ok(trace.indexOf('cmd-stop01') > trace.indexOf('github-return-poll'));
    assert.ok(trace.includes('exact-return-body'));
    const unknownJournalPath = path.join(journalDir, 'unknown-dispatch.json');
    const retryMaterials = await verifySourceMaterials({ expected: fixture.expected, token: 'offline-test-token', repository: 'owner/repo',
      fetchImpl: fixture.fetchImpl, now: () => nowMs, pwshPath: fixture.pwshPath });
    trace.length = 0;
    ingress = [];
    version = '1';
    dispatchStatus = 500;
    await assert.rejects(runOperatorFlow({ ...flowOptions, verifiedMaterials: retryMaterials, journalPath: unknownJournalPath }), /return-dispatch-outcome-unknown/);
    assert.equal(JSON.parse(fs.readFileSync(unknownJournalPath, 'utf8')).state, 'intent');
    assert.ok(trace.includes('cmd-stop01'));
    assert.deepEqual(ingress, []);
    fs.unlinkSync(unknownJournalPath);
    const concurrentJournalPath = path.join(journalDir, 'concurrent-dispatch.json');
    dispatchStatus = 204;
    let postCount = 0;
    const concurrentFetch = async (url, options) => {
      if (options.method === 'POST') { postCount += 1; return { status: 204 }; }
      if (url.endsWith('/actions/runs/123')) return { status: 200, json: async () => ({ ...tlsSource, status: 'in_progress', conclusion: null }) };
      if (url.includes('/actions/workflows/sp08-a3-03-csr-return.yml/runs?')) return { status: 200, json: async () => ({ workflow_runs: [] }) };
      throw new Error('unexpected-concurrency-url');
    };
    const concurrencyBundle = JSON.stringify({ source_run_id: '123', source_job_id: 'source-csr', source_run_attempt: '1',
      source_commit: fixture.expected.trustedHeadSha, source_started_at: new Date(verifiedMaterials.sourceStartedAt).toISOString(),
      csr_sha256: fixture.csrSha256, leaf_certificate: fixture.certificates.leaf, ca_certificate: fixture.certificates.ca });
    const concurrent = await Promise.allSettled([1, 2].map(() => dispatchReturnOnce({ verifiedMaterials, journalPath: concurrentJournalPath,
      bundle: concurrencyBundle, token: 'offline-token', fetchImpl: concurrentFetch, deadline: verifiedMaterials.sourceDeadline, now: () => nowMs })));
    assert.equal(concurrent.filter((item) => item.status === 'fulfilled').length, 1);
    assert.equal(postCount, 1);
    assert.equal(JSON.parse(fs.readFileSync(concurrentJournalPath, 'utf8')).state, 'accepted');
    fs.unlinkSync(concurrentJournalPath);
    const sourceBase = { id: 123, repository: { id: 456 }, path: fixture.expected.workflowPath, head_sha: fixture.expected.trustedHeadSha,
      run_attempt: 1, status: 'in_progress', conclusion: null, event: 'workflow_dispatch', actor: { id: 789, login: 'operator' }, head_branch: 'codex/sp08-a3-03-tls-prep' };
    const badSourceRuns = [
      { ...sourceBase, id: 124 }, { ...sourceBase, repository: { id: 457 } }, { ...sourceBase, run_attempt: 2 },
      { ...sourceBase, head_sha: 'd'.repeat(40) }, { ...sourceBase, head_branch: 'refs/heads/other' },
    ];
    for (const [index, badRun] of badSourceRuns.entries()) {
      const badJournal = path.join(journalDir, `bad-binding-${index}.json`);
      await assert.rejects(dispatchReturnOnce({ verifiedMaterials, journalPath: badJournal, bundle: concurrencyBundle, token: 'offline-token',
        deadline: verifiedMaterials.sourceDeadline, now: () => nowMs, fetchImpl: async (url) => ({ status: 200,
          json: async () => { if (url.endsWith('/actions/runs/123')) return badRun; throw new Error('unexpected-request-after-bad-source'); } }) }), /return-source-binding-mismatch/);
      assert.equal(fs.existsSync(badJournal), false);
    }
  } finally { if (fs.existsSync(journalPath)) fs.unlinkSync(journalPath); fs.rmdirSync(journalDir); fixture.cleanup(); }
});
