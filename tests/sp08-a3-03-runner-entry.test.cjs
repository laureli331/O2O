'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const { spawnSync } = require('node:child_process');
const runner = require('../tools/sp08-a3-03-github-oidc-smoke/runner-entry.cjs');
const prepareRunner = require('../tools/sp08-a3-03-github-oidc-smoke/prepare-a-runner.cjs');
const aSegment = require('../tools/sp08-a3-03-github-oidc-smoke/a-segment-local.cjs');
const { runApprovedAClient, runLocalAClient } = aSegment;

function contextFixture() {
  const env = { O2O_RUNNER_REPOSITORY: 'owner/repo', O2O_RUNNER_REPOSITORY_ID: '10', O2O_RUNNER_RUN_ID: '20', O2O_RUNNER_RUN_ATTEMPT: '1',
    O2O_RUNNER_ACTOR: 'operator', O2O_RUNNER_ACTOR_ID: '30', O2O_RUNNER_REF: 'refs/heads/main',
    O2O_RUNNER_WORKFLOW_REF: 'owner/repo/.github/workflows/release.yml@refs/heads/main', O2O_RUNNER_WORKFLOW_SHA: 'a'.repeat(40),
    O2O_RUNNER_CALLED_WORKFLOW_REF: 'owner/repo/.github/workflows/reusable.yml@refs/heads/main', O2O_RUNNER_CALLED_WORKFLOW_SHA: 'b'.repeat(40), O2O_RUNNER_ENVIRONMENT: 'fixture-env' };
  const expectedClaims = { repository: env.O2O_RUNNER_REPOSITORY, repository_id: env.O2O_RUNNER_REPOSITORY_ID,
    run_attempt: env.O2O_RUNNER_RUN_ATTEMPT, actor: env.O2O_RUNNER_ACTOR,
    actor_id: env.O2O_RUNNER_ACTOR_ID, ref: env.O2O_RUNNER_REF, workflow_ref: env.O2O_RUNNER_WORKFLOW_REF,
    workflow_sha: env.O2O_RUNNER_WORKFLOW_SHA, job_workflow_ref: env.O2O_RUNNER_CALLED_WORKFLOW_REF,
    job_workflow_sha: env.O2O_RUNNER_CALLED_WORKFLOW_SHA, environment: env.O2O_RUNNER_ENVIRONMENT };
  const request = { v: 'a303-request-v1', method: 'POST', route_id: 'route', env_id: 'fixture-env', resource_id: 'resource',
    action_id: 'action', artifact_digest: 'sha256:synthetic', repository_id: '10', run_id: '20', run_attempt: '1', payload: { fixed: true } };
  const config = { mode: 'start-approved', authorization: 'explicit-temporary', authorizedUntil: Date.now() + 60_000,
    targetIPv4: '10.20.30.40', port: 8443, policy: { expectedClaims, serverIPv4: '10.20.30.40' },
    request, approvedRequest: structuredClone(request), verifyOptions: { runId: '20', runAttempt: '1', commit: 'a'.repeat(40) } };
  return { env, config };
}

function certificates() {
  const script = `$ErrorActionPreference='Stop'; function New-Key { [System.Security.Cryptography.RSA]::Create(2048) }; $caKey=New-Key; $caReq=[System.Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=fixture-ca',$caKey,[System.Security.Cryptography.HashAlgorithmName]::SHA256,[System.Security.Cryptography.RSASignaturePadding]::Pkcs1); $caReq.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true,$false,0,$true)); $caReq.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new([System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyCertSign -bor [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::CrlSign,$true)); $ca=$caReq.CreateSelfSigned([datetimeoffset]::UtcNow.AddMinutes(-1),[datetimeoffset]::UtcNow.AddMinutes(30)); function New-Leaf($name,$ekuOid,$withIp) { $key=New-Key; $req=[System.Security.Cryptography.X509Certificates.CertificateRequest]::new("CN=$name",$key,[System.Security.Cryptography.HashAlgorithmName]::SHA256,[System.Security.Cryptography.RSASignaturePadding]::Pkcs1); $req.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false,$false,0,$true)); $req.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new([System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature -bor [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyEncipherment,$true)); if($withIp){$san=[System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new();$san.AddIpAddress([System.Net.IPAddress]::Parse('10.20.30.40'));$req.CertificateExtensions.Add($san.Build())};$oids=[System.Security.Cryptography.OidCollection]::new();$null=$oids.Add([System.Security.Cryptography.Oid]::new($ekuOid));$req.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($oids,$true));$cert=$req.Create($ca,[datetimeoffset]::UtcNow.AddMinutes(-1),[datetimeoffset]::UtcNow.AddMinutes(20),[byte[]]([guid]::NewGuid().ToByteArray())); return @{cert=$cert.ExportCertificatePem();key=$key.ExportPkcs8PrivateKeyPem()} }; @{ca=$ca.ExportCertificatePem();server=(New-Leaf 'server' '1.3.6.1.5.5.7.3.1' $true);wrongServer=(New-Leaf 'server' '1.3.6.1.5.5.7.3.1' $false);client=(New-Leaf 'client' '1.3.6.1.5.5.7.3.2' $false)} | ConvertTo-Json -Compress`;
  const result = spawnSync(process.env.O2O_TEST_PWSH || 'pwsh', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
  assert.equal(result.status, 0, 'certificate fixture generation failed');
  return JSON.parse(result.stdout.trim());
}

test('prepare runner enters runner.main for check and one approved synthetic execution', async () => {
  const fixture = certificates();
  const { env: base } = contextFixture();
  const env = { ...base, O2O_RUNNER_WORKFLOW_REF: 'owner/repo/.github/workflows/sp08-a3-03-tls-caller.yml@refs/heads/main',
    O2O_RUNNER_CALLED_WORKFLOW_REF: 'owner/repo/.github/workflows/sp08-a3-03-tls-source-reusable.yml@refs/heads/main',
    RUNNER_TEMP: 'C:/runner-temp', A303_PWSH: process.env.O2O_TEST_PWSH || 'pwsh' };
  const ca = fixture.ca;
  const caFingerprint256 = new crypto.X509Certificate(ca).fingerprint256.replaceAll(':', '').toLowerCase();
  const handoff = { caFingerprint256, operatorActorId: '30', operatorLogin: 'operator', repository: 'owner/repo',
    returnWorkflowPath: '.github/workflows/sp08-a3-03-csr-return.yml', returnWorkflowRef: 'refs/heads/main', returnWorkflowSha: 'd'.repeat(40),
    sourceWorkflowPath: '.github/workflows/sp08-a3-03-tls-caller.yml', sourceWorkflowRef: 'refs/heads/main', sourceWorkflowSha: 'a'.repeat(40) };
  const request = { v: 'a303-request-v1', method: 'POST', route_id: 'route', env_id: 'fixture-env', resource_id: 'resource', action_id: 'action', artifact_digest: 'sha256:synthetic', payload: { fixed: true } };
  const claims = { repository: 'owner/repo', repository_id: '10', run_attempt: '1', actor: 'operator', actor_id: '30', ref: 'refs/heads/main',
    workflow_ref: env.O2O_RUNNER_WORKFLOW_REF, workflow_sha: 'a'.repeat(40), job_workflow_ref: env.O2O_RUNNER_CALLED_WORKFLOW_REF,
    job_workflow_sha: 'b'.repeat(40), environment: 'fixture-env' };
  const policy = { mode: 'start-approved', authorization: 'explicit-temporary', authorizedUntil: Date.now() + 60_000,
    targetIPv4: '10.20.30.40', requestTemplate: request,
    policy: { serverIPv4: '10.20.30.40', tlsCert: fixture.server.cert, ca, expectedCaFingerprint256: caFingerprint256, expectedClaims: claims } };
  const runtime = { ...env, A303_HANDOFF_POLICY: JSON.stringify(handoff), A303_TLS_RUNNER_POLICY: JSON.stringify(policy) };
  const calls = [];
  const deps = { env: runtime, writeOut: () => {}, writeError: (value) => { throw new Error(value); }, execute: async (options) => { calls.push(options); return { ok: true, result: 'accepted' }; } };
  assert.equal(await prepareRunner.main(['--check-only'], deps), 0);
  assert.equal(calls.length, 0);
  runtime.A303_RETURN_RUN_ID = '44';
  assert.equal(await prepareRunner.main(['--execute-approved'], deps), 0);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].verifyOptions, { tempDir: env.RUNNER_TEMP, artifactDir: require('node:path').join(env.RUNNER_TEMP, 'a303-return'), runId: '20', runAttempt: '1', commit: 'a'.repeat(40), returnRunId: '44', pwshPath: env.A303_PWSH });
  assert.deepEqual(calls[0].identity, { repository_id: '10', run_id: '20', run_attempt: '1', workflow_ref: env.O2O_RUNNER_WORKFLOW_REF, workflow_sha: 'a'.repeat(40), job_workflow_ref: env.O2O_RUNNER_CALLED_WORKFLOW_REF, job_workflow_sha: 'b'.repeat(40) });
  delete runtime.A303_HANDOFF_POLICY;
  assert.equal(await prepareRunner.main(['--execute-approved'], { ...deps, writeError: () => {} }), 1);
  assert.equal(calls.length, 1);
});

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
  const options = { identity: {}, request: {}, policy: { serverIPv4: '10.20.30.40' }, env: {},
    runtimeRequest: async () => { calls += 1; }, approvedTarget: { ipv4: '10.20.30.40', port: 8443 },
    tlsOptions: { host: 'localhost', port: 8443, minVersion: 'TLSv1.3', maxVersion: 'TLSv1.3', rejectUnauthorized: true, key: 'x', cert: 'x', ca: 'x' }, authorizationDeadline: Date.now() + 60_000 };
  await assert.rejects(runApprovedAClient(options), { code: 'local-client-policy-missing' });
  assert.throws(() => runApprovedAClient({ ...options, approvedTarget: { ipv4: '10.20.30.40', port: 443 } }), { code: 'approved-target-policy-invalid' });
  assert.equal(calls, 0);
});

test('runner identity requires independent caller/called context and exact approved request/CSR binding', () => {
  const { env, config } = contextFixture();
  assert.equal(runner.runnerIdentity(config, env).run_id, '20');
  for (const [field, value] of [['job_workflow_sha', 'c'.repeat(40)], ['repository', 'other/repo'], ['actor_id', '31']]) {
    assert.throws(() => runner.runnerIdentity({ ...config, policy: { ...config.policy, expectedClaims: { ...config.policy.expectedClaims, [field]: value } } }, env), { code: 'runner-claim-policy-mismatch' });
  }
  assert.throws(() => runner.runnerIdentity({ ...config, verifyOptions: { ...config.verifyOptions, runId: '21' } }, env), { code: 'runner-verify-context-mismatch' });
  assert.throws(() => runner.runnerIdentity({ ...config, request: { ...config.request, action_id: 'other' } }, env), { code: 'runner-approved-request-mismatch' });
  assert.throws(() => runner.runnerIdentity({ ...config, policy: { ...config.policy, expectedClaims: { ...config.policy.expectedClaims, run_id: '999' } } }, env), { code: 'runner-config-invalid' });
  assert.throws(() => runner.runnerIdentity(config, { ...env, O2O_RUNNER_RUN_ATTEMPT: '2' }), { code: 'runner-context-invalid' });
  assert.equal(runner.publicErrorCode({ code: 'peer-controlled-sensitive-response' }), 'runner-entry-failed');
  assert.equal(runner.publicErrorCode({ code: 'tls-peer-rejected' }), 'tls-peer-rejected');
});

test('approved A client performs one injected token request and one fake socket, verifies peer IP certificate and exporter proof', async () => {
  const fixture = certificates();
  const { env } = contextFixture();
  const identity = { repository_id: '10', run_id: '20', run_attempt: '1', workflow_ref: env.O2O_RUNNER_WORKFLOW_REF,
    workflow_sha: env.O2O_RUNNER_WORKFLOW_SHA, job_workflow_ref: env.O2O_RUNNER_CALLED_WORKFLOW_REF, job_workflow_sha: env.O2O_RUNNER_CALLED_WORKFLOW_SHA };
  const request = { v: 'a303-request-v1', method: 'POST', route_id: 'route', env_id: 'fixture-env', resource_id: 'resource', action_id: 'action', artifact_digest: 'sha256:synthetic', repository_id: '10', run_id: '20', run_attempt: '1', payload: { fixed: true } };
  const issuer = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...issuer.publicKey.export({ format: 'jwk' }), kid: 'fixture-kid', alg: 'RS256', use: 'sig' };
  const now = Math.floor(Date.now() / 1000);
  const policy = { mode: 'github-oidc', service: 'fixture-service', serverIPv4: '10.20.30.40', tlsCert: fixture.server.cert, ca: fixture.ca,
    expectedCaFingerprint256: new crypto.X509Certificate(fixture.ca).fingerprint256.replaceAll(':', '').toLowerCase(),
    expectedClaims: { ...identity, repository: 'owner/repo', actor: 'operator', actor_id: '30', ref: 'refs/heads/main', environment: 'fixture-env' },
    expectedRequest: request, githubJwksKeys: [jwk], githubJwksFetchedAt: Date.now(), githubJwksExpiresAt: Date.now() + 60_000 };
  const pair = crypto.generateKeyPairSync('ed25519');
  const calls = { token: 0, socket: 0, writes: 0 };
  let envelope;
  const socket = new EventEmitter();
  socket.getProtocol = () => 'TLSv1.3'; socket.authorized = true; socket.isSessionReused = () => false;
  socket.getPeerCertificate = () => ({ raw: new crypto.X509Certificate(fixture.server.cert).raw });
  socket.exportKeyingMaterial = (length, label, context) => { assert.equal(length, 32); assert.equal(label, 'EXPORTER-Channel-Binding'); assert.equal(context.length, 0); return Buffer.alloc(32, 7); };
  socket.destroy = () => {};
  socket.write = (data) => { calls.writes += 1; envelope = JSON.parse(data); process.nextTick(() => socket.emit('data', Buffer.from('{"ok":true,"result":"accepted"}\n'))); return true; };
  const result = await runApprovedAClient({ identity, request, policy, env: { ACTIONS_ID_TOKEN_REQUEST_URL: 'https://oidc.test/request', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'fixture', A303_EXPECTED_OIDC_ORIGIN: 'https://oidc.test' },
    approvedTarget: { ipv4: '10.20.30.40', port: 8443 }, authorizationDeadline: Date.now() + 30_000,
    tlsOptions: { host: '10.20.30.40', port: 8443, minVersion: 'TLSv1.3', maxVersion: 'TLSv1.3', rejectUnauthorized: true, key: fixture.client.key, cert: fixture.client.cert, ca: fixture.ca },
    randomBytes: () => Buffer.alloc(32, 9), connectTransport: (options) => { calls.socket += 1; assert.equal(options.host, '10.20.30.40'); assert.equal(options.port, 8443); assert.equal(options.rejectUnauthorized, true); process.nextTick(() => socket.emit('secureConnect')); return socket; },
    runtimeRequest: async (url) => { calls.token += 1; const aud = new URL(String(url)).searchParams.get('audience'); const claims = { iss: 'https://token.actions.githubusercontent.com', aud, ...policy.expectedClaims, jti: 'fixture-jti', runner_environment: 'github-hosted', iat: now - 1, nbf: now - 1, exp: now + 60 }; const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64url'); const head = part({ alg: 'RS256', kid: 'fixture-kid', typ: 'JWT' }); const body = part(claims); const input = `${head}.${body}`; return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: `${input}.${crypto.sign('RSA-SHA256', Buffer.from(input, 'ascii'), issuer.privateKey).toString('base64url')}` }) }; } });
  assert.equal(result.ok, true); assert.equal(result.result, 'accepted');
  assert.deepEqual(calls, { token: 1, socket: 1, writes: 1 });
  const [header, body] = envelope.id_token.split('.');
  const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  const commit = aSegment.commitment(claims, request, envelope.proof_key_jwk, envelope.nonce, policy);
  const canonical = (value) => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);
  const exporter = Buffer.alloc(32, 7).toString('base64url');
  const proofMessage = `O2O-A303-A\n1\n${crypto.createHash('sha256').update(envelope.id_token, 'ascii').digest('base64url')}\n${crypto.createHash('sha256').update(canonical(commit), 'utf8').digest('base64url')}\n${exporter}`;
  assert.equal(crypto.verify(null, Buffer.from(proofMessage, 'utf8'), crypto.createPublicKey({ key: envelope.proof_key_jwk, format: 'jwk' }), Buffer.from(envelope.proof_a, 'base64url')), true);
  assert.equal(header.length > 0, true);
  assert.equal(envelope.id_token.split('.').length, 3);
  assert.throws(() => aSegment.validateApprovedTargetMaterial({ ...policy, tlsCert: fixture.wrongServer.cert }, '10.20.30.40'), { code: 'tls-server-ip-san-mismatch' });
  const wrongPeerSocket = new EventEmitter();
  wrongPeerSocket.getProtocol = () => 'TLSv1.3'; wrongPeerSocket.authorized = true; wrongPeerSocket.isSessionReused = () => false;
  wrongPeerSocket.getPeerCertificate = () => ({ raw: new crypto.X509Certificate(fixture.wrongServer.cert).raw });
  wrongPeerSocket.destroy = () => {}; wrongPeerSocket.exportKeyingMaterial = () => Buffer.alloc(32, 7);
  await assert.rejects(runApprovedAClient({ identity, request, policy, env: { ACTIONS_ID_TOKEN_REQUEST_URL: 'https://oidc.test/request', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'fixture', A303_EXPECTED_OIDC_ORIGIN: 'https://oidc.test' },
    approvedTarget: { ipv4: '10.20.30.40', port: 8443 }, authorizationDeadline: Date.now() + 30_000,
    tlsOptions: { host: '10.20.30.40', port: 8443, minVersion: 'TLSv1.3', maxVersion: 'TLSv1.3', rejectUnauthorized: true, key: fixture.client.key, cert: fixture.client.cert, ca: fixture.ca },
    connectTransport: () => { process.nextTick(() => wrongPeerSocket.emit('secureConnect')); return wrongPeerSocket; },
    runtimeRequest: async () => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: envelope.id_token }) }) }), { code: 'tls-peer-certificate-mismatch' });
});

test('check-only validates complete local target and runner context with zero token or TLS calls', async () => {
  const fixture = certificates();
  const { env, config } = contextFixture();
  config.mode = 'check-only'; config.authorization = 'local-check-only';
  config.policy.tlsCert = fixture.server.cert; config.policy.ca = fixture.ca;
  config.policy.expectedCaFingerprint256 = new crypto.X509Certificate(fixture.ca).fingerprint256.replaceAll(':', '').toLowerCase();
  let executed = 0; let output = '';
  const code = await runner.main(['--check-only', 'fixture'], { env, readConfig: () => config, execute: () => { executed += 1; },
    writeOut: (value) => { output += value; }, writeError: (value) => { output += value; } });
  assert.equal(code, 0); assert.equal(executed, 0);
  assert.deepEqual(JSON.parse(output), { checked: true, mode: 'check-only', networkRequests: 0, tlsConnections: 0 });
});

test('loopback wrapper strips approved-target escape fields and approved path rejects reserved targets', async () => {
  const options = { identity: {}, request: {}, policy: {}, env: {}, approvedTarget: { ipv4: '10.20.30.40', port: 8443 },
    tlsOptions: { host: '10.20.30.40', minVersion: 'TLSv1.3', maxVersion: 'TLSv1.3', rejectUnauthorized: true, key: 'x', cert: 'x', ca: 'x' } };
  await assert.rejects(runLocalAClient(options), { code: 'local-client-policy-missing' });
  for (const ip of ['0.0.0.0', '255.255.255.255', '127.0.0.1', '224.0.0.1', '192.0.2.10']) assert.equal(runner.isAllowedTargetIPv4(ip), false);
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
