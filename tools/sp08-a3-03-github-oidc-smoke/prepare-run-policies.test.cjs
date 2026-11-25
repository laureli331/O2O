'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { prepareRunPolicies } = require('./prepare-run-policies.cjs');
const { buildApprovedConfig } = require('./prepare-a-runner.cjs');
const { validateConfig } = require('./runner-entry.cjs');
const { prepareOperatorConfig } = require('./prepare-operator-config.cjs');
const { checkOnly, runOperatorEntry } = require('./operator-entry.cjs');

function certificates() {
  const pwsh = 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe';
  const code = `$ErrorActionPreference='Stop'
$caKey=[Security.Cryptography.RSA]::Create(2048)
$caReq=[Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=offline-ca',$caKey,[Security.Cryptography.HashAlgorithmName]::SHA256,[Security.Cryptography.RSASignaturePadding]::Pkcs1)
$caReq.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true,$false,0,$true))
$ca=$caReq.CreateSelfSigned([datetimeoffset]::UtcNow.AddMinutes(-1),[datetimeoffset]::UtcNow.AddHours(1))
$key=[Security.Cryptography.RSA]::Create(2048)
$req=[Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=offline-server',$key,[Security.Cryptography.HashAlgorithmName]::SHA256,[Security.Cryptography.RSASignaturePadding]::Pkcs1)
$san=[Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new();$san.AddIpAddress([Net.IPAddress]::Parse('8.8.8.8'));$req.CertificateExtensions.Add($san.Build())
$eku=[Security.Cryptography.OidCollection]::new();$null=$eku.Add([Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.1'));$req.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($eku,$true))
$cert=$req.Create($ca,[datetimeoffset]::UtcNow.AddMinutes(-1),[datetimeoffset]::UtcNow.AddMinutes(20),[guid]::NewGuid().ToByteArray())
@{caCertificate=$ca.ExportCertificatePem();serverCertificate=$cert.ExportCertificatePem()} | ConvertTo-Json -Compress`;
  const result = spawnSync(pwsh, ['-NoProfile', '-NonInteractive', '-Command', code], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('public policies bind one explicit SHA and pass existing runner context checks without dispatch', () => {
  const now = Date.now();
  const input = { ...certificates(), repository: 'owner/repo', repositoryId: '10', actorId: '30', actorLogin: 'operator',
    branch: 'codex/test', trustedHeadSha: 'a'.repeat(40), targetIPv4: '8.8.8.8', authorizedUntil: now + 60000 };
  const original = JSON.stringify(input);
  const built = prepareRunPolicies(input, now);
  assert.equal(JSON.stringify(input), original);
  assert.equal(built.readyToDispatch, false);
  const handoff = JSON.parse(built.variables.A303_HANDOFF_POLICY);
  const runner = JSON.parse(built.variables.A303_TLS_RUNNER_POLICY);
  assert.equal(handoff.sourceWorkflowSha, input.trustedHeadSha);
  assert.equal(handoff.returnWorkflowSha, input.trustedHeadSha);
  assert.equal(runner.policy.expectedClaims.job_workflow_sha, input.trustedHeadSha);
  assert.equal(Object.hasOwn(runner.policy.expectedClaims, 'run_id'), false);
  assert.equal(Object.hasOwn(runner.requestTemplate, 'run_id'), false);
  assert.equal(runner.requestTemplate.payload.database_access, false);
  assert.equal(runner.requestTemplate.artifact_digest, `sha256:${crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'a-segment-local.cjs'), 'utf8').replaceAll('\r\n', '\n')).digest('hex')}`);
  assert.doesNotMatch(JSON.stringify(built), /PRIVATE KEY|secretKey/);
  const env = { O2O_RUNNER_REPOSITORY: 'owner/repo', O2O_RUNNER_REPOSITORY_ID: '10', O2O_RUNNER_RUN_ID: '20',
    O2O_RUNNER_RUN_ATTEMPT: '1', O2O_RUNNER_ACTOR: 'operator', O2O_RUNNER_ACTOR_ID: '30', O2O_RUNNER_REF: 'refs/heads/codex/test',
    O2O_RUNNER_WORKFLOW_REF: runner.policy.expectedClaims.workflow_ref, O2O_RUNNER_WORKFLOW_SHA: input.trustedHeadSha,
    O2O_RUNNER_CALLED_WORKFLOW_REF: runner.policy.expectedClaims.job_workflow_ref, O2O_RUNNER_CALLED_WORKFLOW_SHA: input.trustedHeadSha,
    O2O_RUNNER_ENVIRONMENT: 'SP08-A3-03-OIDC-smoke', RUNNER_TEMP: os.tmpdir(), A303_PWSH: 'pwsh' };
  const checked = buildApprovedConfig({ serialized: built.variables.A303_TLS_RUNNER_POLICY, handoffSerialized: built.variables.A303_HANDOFF_POLICY, env, checkOnly: true });
  assert.equal(checked.request.run_id, '20');
  assert.equal(validateConfig(checked, env, now).checked, true);
  for (const patch of [{ trustedHeadSha: undefined }, { trustedHeadSha: 'OLD' }, { authorizedUntil: now },
    { authorizedUntil: now + 900001 }, { targetIPv4: '10.0.0.1' }, { targetIPv4: '8.8.4.4' },
    { caCertificate: 'PRIVATE KEY' }, { extra: true }]) assert.throws(() => prepareRunPolicies({ ...input, ...patch }, now));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a303-public-policy-'));
  const source = path.join(dir, 'input.json'); const output = path.join(dir, 'public.json');
  try {
    fs.writeFileSync(source, JSON.stringify(input));
    const run = () => spawnSync(process.execPath, [path.join(__dirname, 'prepare-run-policies.cjs'), source, output], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
    assert.equal(run().status, 0);
    const before = fs.readFileSync(output);
    assert.equal(run().status, 1);
    assert.deepEqual(fs.readFileSync(output), before);
  } finally {
    if (fs.existsSync(output)) fs.unlinkSync(output);
    fs.unlinkSync(source); fs.rmdirSync(dir);
  }
});

test('operator config uses the same public policies and rejects expired, inconsistent or secret-bearing input', async () => {
  const now = Date.now();
  const preparedPolicies = prepareRunPolicies({ ...certificates(), repository: 'owner/repo', repositoryId: '10',
    actorId: '30', actorLogin: 'operator', branch: 'codex/test', trustedHeadSha: 'a'.repeat(40),
    targetIPv4: '8.8.8.8', authorizedUntil: now + 60000 }, now);
  const input = { preparedPolicies, sourceRunId: '123', notBeforeMs: now - 1000, notAfterMs: now + 1000,
    instanceId: 'ins-abcdefgh', securityGroupId: 'sg-abcdefgh', region: 'ap-shanghai',
    commandIds: { sign: 'cmd-abcdefgh', start: 'cmd-bcdefghi', stop: 'cmd-cdefghij' },
    privateIPv4: '172.17.16.11', interfaceName: 'eth0', jwksFetchedAt: now - 1000, jwksExpiresAt: now + 60000,
    journalPath: path.join(os.tmpdir(), 'a303-never-written-journal.json'), pwshPath: process.execPath };
  const before = JSON.stringify(input);
  const config = prepareOperatorConfig(input, now);
  assert.equal(JSON.stringify(input), before);
  assert.equal(checkOnly(config).readyToDispatch, false);
  assert.equal(config.lifecycleTargets.instanceId, config.target.instanceId);
  assert.equal(config.securityTarget.securityGroupId, input.securityGroupId);
  const server = JSON.parse(config.serverInput);
  assert.equal(server.policy.expectedClaims.run_id, input.sourceRunId);
  assert.equal(server.policy.expectedRequest.run_id, input.sourceRunId);
  assert.equal(server.policy.expectedRequest.env_id, server.policy.expectedClaims.environment);
  assert.equal(Object.hasOwn(server, 'sourceBinding'), false, 'CSR digest binding remains the verified runtime responsibility');
  assert.equal(server.policy.githubJwksExpiresAt, input.jwksExpiresAt);
  for (const patch of [{ jwksExpiresAt: now }, { jwksFetchedAt: now + 1 }, { privateIPv4: '8.8.8.8' },
    { sourceRunId: '0' }, { notAfterMs: now - 1 }, { notBeforeMs: now - 300001 },
    { interfaceName: 'eth0;echo' }, { journalPath: 'relative.json' },
    { commandIds: { ...input.commandIds, start: input.commandIds.sign } }]) {
    assert.throws(() => prepareOperatorConfig({ ...input, ...patch }, now));
  }
  const malicious = structuredClone(preparedPolicies);
  const runner = JSON.parse(malicious.variables.A303_TLS_RUNNER_POLICY); runner.policy.tlsKey = 'PRIVATE KEY';
  malicious.variables.A303_TLS_RUNNER_POLICY = JSON.stringify(runner);
  assert.throws(() => prepareOperatorConfig({ ...input, preparedPolicies: malicious }, now));
  const mismatched = structuredClone(preparedPolicies); mismatched.trustedHeadSha = 'b'.repeat(40);
  assert.throws(() => prepareOperatorConfig({ ...input, preparedPolicies: mismatched }, now));
  let calls = 0;
  await assert.rejects(runOperatorEntry(config, {}, { enableExternalDispatch: false,
    fetchImpl: async () => { calls += 1; throw new Error('must-not-fetch'); } }), /explicit-enable/);
  assert.equal(calls, 0);
});
