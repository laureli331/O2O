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
const { checkAwaitPlan, awaitSourceOperator } = require('./await-source-operator.cjs');

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

function awaitFixture() {
  const certs = certificates();
  const time = Math.floor(Date.now() / 1000) * 1000;
  const plan = { watchDurationMs: 60000, resourceCleanupAtMs: time + 600000,
    operatorInput: { preparedPolicies: prepareRunPolicies({ ...certs, repository: 'owner/repo', repositoryId: '10',
      actorId: '30', actorLogin: 'operator', branch: 'codex/test', trustedHeadSha: 'a'.repeat(40),
      targetIPv4: '8.8.8.8', authorizedUntil: time + 600000 }, time),
    instanceId: 'ins-abcdefgh', securityGroupId: 'sg-abcdefgh', region: 'ap-shanghai',
    commandIds: { sign: 'cmd-abcdefgh', start: 'cmd-bcdefghi', stop: 'cmd-cdefghij' },
    privateIPv4: '172.17.16.4', interfaceName: 'eth0', jwksFetchedAt: time - 1000, jwksExpiresAt: time + 600000,
    journalPath: path.join(os.tmpdir(), 'a303-await-never-written.json'), pwshPath: process.execPath } };
  const envelope = { credential: { secretId: 'sentinel-id', secretKey: 'sentinel-key', token: 'sentinel-sts' },
    token: 'sentinel-github', expiration: new Date(time + 600000).toISOString() };
  const source = { id: 123, repository: { id: 10, full_name: 'owner/repo' }, actor: { id: 30, login: 'operator' },
    event: 'workflow_dispatch', status: 'in_progress', conclusion: null, run_attempt: 1,
    path: '.github/workflows/sp08-a3-03-tls-caller.yml', head_sha: 'a'.repeat(40), head_branch: 'codex/test', created_at: new Date(time).toISOString() };
  return { plan, envelope, source, time };
}

function jsonResponse(url, body, status = 200, headers = {}) {
  const response = new Response(JSON.stringify(body), { status, headers });
  Object.defineProperty(response, 'url', { value: url });
  return response;
}

test('await-source validates public preparation, deadlines and distinct secrets before any network call', async () => {
  const { plan, envelope, time } = awaitFixture();
  assert.equal(checkAwaitPlan(plan, time).readyToDispatch, false);
  let calls = 0;
  const options = { plan, envelope, now: () => time, fetchImpl: async () => { calls += 1; throw new Error('must-not-fetch'); } };
  await assert.rejects(awaitSourceOperator(options), /explicit-enable/);
  for (const patch of [{ watchDurationMs: 0 }, { watchDurationMs: 60001 }, { watchUntilMs: time + 60000 },
    { resourceCleanupAtMs: time + 419999 }, { extra: true },
    { operatorInput: { ...plan.operatorInput, sourceRunId: '123' } },
    { operatorInput: { ...plan.operatorInput, jwksExpiresAt: time + 419999 } }]) {
    assert.throws(() => checkAwaitPlan({ ...plan, ...patch }, time));
  }
  await assert.rejects(awaitSourceOperator({ ...options, enableExternalDispatch: true,
    envelope: { ...envelope, expiration: new Date(time + 419999).toISOString() } }), /lifetime-insufficient/);
  assert.equal(calls, 0);
});

test('await-source discovers one active run and public artifact then builds the real config once without dispatching source', async () => {
  const { plan, envelope, source, time } = awaitFixture();
  const original = JSON.stringify(plan);
  let clock = time;
  let lists = 0;
  let artifacts = 0;
  let runs = 0;
  let ready = 0;
  const seen = [];
  const result = await awaitSourceOperator({ plan, envelope, enableExternalDispatch: true, now: () => clock,
    onReady: () => { ready += 1; assert.equal(lists, 1); assert.equal(artifacts, 0); },
    sleep: async delay => { clock += delay; },
    fetchImpl: async (url, options) => {
      seen.push(url); assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
      assert.equal(options.headers.authorization, 'Bearer sentinel-github');
      if (url.includes('/artifacts?')) {
        artifacts += 1;
        return jsonResponse(url, { total_count: artifacts === 1 ? 0 : 1,
          artifacts: artifacts === 1 ? [] : [{ name: 'sp08-a303-csr-123-1', expired: false }] });
      }
      lists += 1;
      return jsonResponse(url, { total_count: lists <= 2 ? 0 : 1,
        workflow_runs: lists <= 2 ? [] : [{ ...source, status: lists === 3 ? 'queued' : 'in_progress' }] });
    }, run: async (config, secrets, options) => {
      runs += 1; assert.equal(checkOnly(config).readyToDispatch, false);
      assert.equal(config.sourceRunId, '123'); assert.equal(config.notBeforeMs, time);
      assert.equal(config.notAfterMs, clock); assert.equal(secrets.credential.token, 'sentinel-sts');
      assert.equal(options.enableExternalDispatch, true);
      assert.equal(Object.hasOwn(JSON.parse(config.serverInput), 'sourceBinding'), false);
      return { state: 'tls-complete', sourceRunId: config.sourceRunId };
    } });
  assert.equal(result.sourceRunId, '123'); assert.equal(runs, 1);
  assert.equal(lists, 5); assert.equal(artifacts, 2); assert.equal(ready, 1); assert.equal(JSON.stringify(plan), original);
  assert.equal(seen.every(url => url.startsWith('https://api.github.com/repos/owner/repo/actions/')), true);
});

test('credential-entry delay does not consume discovery duration or extend any absolute authorization deadline', async () => {
  const { plan, envelope, source, time } = awaitFixture();
  checkAwaitPlan(plan, time); // PowerShell precheck before credential prompts.
  const afterInput = time + 61000;
  assert.equal(checkAwaitPlan(plan, afterInput).readyToDispatch, false);
  let calls = 0;
  let invoked = 0;
  await awaitSourceOperator({ plan, envelope, enableExternalDispatch: true, now: () => afterInput,
    fetchImpl: async url => {
      calls += 1;
      return jsonResponse(url, calls === 1 ? { total_count: 0, workflow_runs: [] }
        : url.includes('/artifacts?') ? { total_count: 1, artifacts: [{ name: 'sp08-a303-csr-123-1', expired: false }] }
        : { total_count: 1, workflow_runs: [{ ...source, created_at: new Date(afterInput).toISOString() }] });
    }, run: async config => {
      invoked += 1;
      assert.equal(config.notBeforeMs, afterInput);
      assert.equal(JSON.parse(config.serverInput).authorizedUntil, time + 600000);
      return { state: 'tls-complete', sourceRunId: '123' };
    } });
  assert.equal(invoked, 1);
  await assert.rejects(awaitSourceOperator({ plan, envelope, enableExternalDispatch: true, now: () => time + 180001,
    fetchImpl: async () => assert.fail('absolute recovery margin exhausted; must-not-fetch') }), /window-invalid/);
  assert.equal(plan.resourceCleanupAtMs, time + 600000);
  assert.equal(plan.operatorInput.jwksExpiresAt, time + 600000);
  assert.equal(envelope.expiration, new Date(time + 600000).toISOString());
});

test('await-source rejects ambiguous, completed or retried sources and malformed artifacts without operator calls', async () => {
  const { plan, envelope, source, time } = awaitFixture();
  for (const candidates of [[source, { ...source, id: 124 }], [{ ...source, status: 'completed', conclusion: 'failure' }], [{ ...source, run_attempt: 2 }]]) {
    let writes = 0;
    let calls = 0;
    await assert.rejects(awaitSourceOperator({ plan, envelope, enableExternalDispatch: true, now: () => time,
      fetchImpl: async url => { calls += 1; return jsonResponse(url,
        { total_count: calls === 1 ? 0 : candidates.length, workflow_runs: calls === 1 ? [] : candidates }); },
      run: async () => { writes += 1; } }), /await-source-(ambiguous|run-invalid)/);
    assert.equal(writes, 0);
  }
  let calls = 0;
  await assert.rejects(awaitSourceOperator({ plan, envelope, enableExternalDispatch: true, now: () => time,
    fetchImpl: async url => { calls += 1; return jsonResponse(url, calls === 1 ? { total_count: 0, workflow_runs: [] } : url.includes('/artifacts?')
      ? { total_count: 1, artifacts: [{ name: 'other', expired: false }] }
      : { total_count: 1, workflow_runs: [source] }); }, run: async () => assert.fail('must-not-run') }), /artifact-invalid/);
});

test('await-source ignores old or mismatched identities, has twelve-poll and hard-clock bounds, and never retries failed GETs', async () => {
  const { plan, envelope, source, time } = awaitFixture();
  let clock = time;
  let calls = 0;
  const stale = { ...source, created_at: new Date(time - 1).toISOString() };
  await assert.rejects(awaitSourceOperator({ plan, envelope, enableExternalDispatch: true, now: () => clock,
    sleep: async delay => { clock += delay; }, fetchImpl: async url => { calls += 1; return jsonResponse(url,
      { total_count: 2, workflow_runs: [stale, { ...source, head_sha: 'b'.repeat(40) }] }); },
    run: async () => assert.fail('must-not-run') }), /poll-limit/);
  assert.equal(calls, 13); assert.equal(clock - time, 55000);
  calls = 0;
  await assert.rejects(awaitSourceOperator({ plan, envelope, enableExternalDispatch: true, now: () => time,
    fetchImpl: async url => { calls += 1; return jsonResponse(url, {}, 503); } }), /response-invalid/);
  assert.equal(calls, 1);
  const shortPlan = { ...plan, watchDurationMs: 25 };
  await assert.rejects(awaitSourceOperator({ plan: shortPlan, envelope, enableExternalDispatch: true, now: () => time,
    fetchImpl: async () => new Promise(() => {}) }), /request-unknown/);
});

test('await-source bounds response bodies and rejects pagination, foreign URLs and stalled streams before readiness', async () => {
  const { plan, envelope, time } = awaitFixture();
  const factories = [
    url => jsonResponse(url, {}, 200, { link: '<https://api.github.com/page=2>; rel="next"' }),
    () => jsonResponse('https://example.invalid', {}),
    url => jsonResponse(url, 'x'.repeat(65537)),
  ];
  for (const factory of factories) {
    let calls = 0; let ready = 0;
    await assert.rejects(awaitSourceOperator({ plan, envelope, enableExternalDispatch: true, now: () => time,
      onReady: () => { ready += 1; }, fetchImpl: async url => { calls += 1; return factory(url); } }), /await-source-response/);
    assert.equal(calls, 1); assert.equal(ready, 0);
  }
  let ready = 0;
  await assert.rejects(awaitSourceOperator({ plan: { ...plan, watchDurationMs: 25 }, envelope,
    enableExternalDispatch: true, now: () => time, onReady: () => { ready += 1; }, fetchImpl: async url => {
      const response = new Response(new ReadableStream({ start() {} }));
      Object.defineProperty(response, 'url', { value: url }); return response;
    } }), /request-unknown/);
  assert.equal(ready, 0);
});

test('await-source excludes the initial run IDs and never switches from a pinned source to a replacement', async () => {
  const { plan, envelope, source, time } = awaitFixture();
  let clock = time; let lists = 0;
  await assert.rejects(awaitSourceOperator({ plan, envelope, enableExternalDispatch: true, now: () => clock,
    sleep: async delay => { clock += delay; }, fetchImpl: async url => {
      lists += 1;
      // The baseline run has the same second timestamp but must not be adopted.
      const item = lists === 1 ? source : { ...source, id: lists === 2 ? 124 : 125, status: 'queued' };
      return jsonResponse(url, { total_count: 1, workflow_runs: [item] });
    }, run: async () => assert.fail('must-not-run') }), /run-invalid/);
  assert.equal(lists, 3);
});

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
