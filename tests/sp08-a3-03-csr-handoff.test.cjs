'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { selectSourceRun, validateBudget, verifyCertificateBinding, waitForReturnRun } = require('../tools/sp08-a3-03-github-oidc-smoke/csr-handoff.cjs');

const budget = { maxPolls: 1, maxPages: 1, maxCandidates: 10, maxArtifactBytes: 65536, maxWaitMs: 60000, requestTimeoutMs: 10000, pollIntervalMs: 5000 };
const expected = { repositoryId: '123', trustedHeadSha: 'a'.repeat(40), actorId: '77', actorLogin: 'operator', workflowPath: '.github/workflows/csr-source.yml', notBeforeMs: 1000, notAfterMs: 2000 };
const source = { event: 'workflow_dispatch', status: 'completed', conclusion: 'success', repository: { id: 123 }, path: expected.workflowPath, head_sha: expected.trustedHeadSha, run_attempt: 1, actor: { id: 77, login: 'operator' }, created_at: new Date(1500).toISOString() };

test('selects exactly one source run bound to trusted workflow, commit, actor, repository, time and attempt', () => {
  assert.equal(selectSourceRun([source], expected, budget), source);
  for (const change of [{ event: 'pull_request' }, { conclusion: 'failure' }, { head_sha: 'b'.repeat(40) }, { run_attempt: 2 }, { actor: { id: 77, login: 'other' } }]) {
    assert.throws(() => selectSourceRun([{ ...source, ...change }], expected, budget), /source-run-not-found/);
  }
  assert.throws(() => selectSourceRun([source, source], expected, budget), /source-run-ambiguous/);
});

test('source listing budget is explicit and hard bounded', () => {
  assert.equal(validateBudget(budget).maxListRequests, 1);
  assert.throws(() => validateBudget({ ...budget, maxPolls: 5, maxPages: 1 }), /hard-limit/);
  assert.throws(() => validateBudget({ ...budget, maxWaitMs: 300001 }), /hard-limit/);
  assert.throws(() => selectSourceRun(Array(11).fill(source), expected, budget), /candidate-count-limit/);
});

test('return-run polling uses fixed API origin, bounded GETs and rejects redirects, pages, ambiguity and timeout', async () => {
  const run = { id: 456, event: 'workflow_dispatch', status: 'completed', conclusion: 'success', repository: { full_name: 'org/repo' }, path: expected.workflowPath, head_sha: expected.trustedHeadSha, run_attempt: 1, actor: { id: 77, login: 'operator' }, created_at: new Date(1500).toISOString() };
  const seen = [];
  const fetchImpl = async (url, options) => { seen.push({ url, options }); return { status: 200, url, headers: { get: () => null }, json: async () => ({ total_count: 1, workflow_runs: [run] }) }; };
  const selected = await waitForReturnRun({ token: 'mock-token', repository: 'org/repo', workflowId: 'return.yml', expected, budget, fetchImpl });
  assert.equal(selected.runId, '456');
  assert.equal(seen.length, 1);
  assert.match(seen[0].url, /^https:\/\/api\.github\.com\//);
  assert.equal(seen[0].options.redirect, 'error');
  await assert.rejects(waitForReturnRun({ token: 'mock-token', repository: 'org/repo', workflowId: 'return.yml', expected, budget, fetchImpl: async () => ({ status: 302, headers: { get: () => null } }) }), /poll-http-failed/);
  await assert.rejects(waitForReturnRun({ token: 'mock-token', repository: 'org/repo', workflowId: 'return.yml', expected, budget, fetchImpl: async (url) => ({ status: 200, url, headers: { get: () => 'https://api.github.com/page=2' }, json: async () => ({ total_count: 101, workflow_runs: [] }) }) }), /poll-pagination-limit/);
  await assert.rejects(waitForReturnRun({ token: 'mock-token', repository: 'org/repo', workflowId: 'return.yml', expected, budget, fetchImpl: async (url) => ({ status: 200, url, headers: { get: () => null }, json: async () => ({ total_count: 0, workflow_runs: [] }) }), sleep: async () => {} }), /return-run-timeout/);
});

test('poll schedule makes four bounded GETs at 0, 90, 180 and 270 seconds', async () => {
  const scheduleBudget = { ...budget, maxPolls: 4, maxPages: 1, maxWaitMs: 300000, pollDelaysMs: [0, 90000, 90000, 90000] };
  const observed = [];
  let elapsed = 0;
  const response = async (url) => { observed.push(elapsed); return { status: 200, url, headers: { get: () => null }, json: async () => ({ total_count: 0, workflow_runs: [] }) }; };
  await assert.rejects(waitForReturnRun({ token: 'mock-token', repository: 'org/repo', workflowId: 'return.yml', expected, budget: scheduleBudget, fetchImpl: response, sleep: async (delay) => { elapsed += delay; } }), /return-run-timeout/);
  assert.deepEqual(observed, [0, 90000, 180000, 270000]);
  assert.equal(observed.length, 4);
  assert.throws(() => validateBudget({ ...scheduleBudget, maxWaitMs: 269999 }), /budget-exceeds-hard-limit/);
  assert.throws(() => validateBudget({ ...scheduleBudget, requestTimeoutMs: 30001 }), /budget-exceeds-hard-limit/);
});

test('CSR digest and all certificate inputs are size bounded before parsing', () => {
  const bytes = Buffer.from('synthetic csr');
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  assert.throws(() => verifyCertificateBinding({ csrBytes: bytes, expectedCsrSha256: '0'.repeat(64), leafPem: 'x', caPem: 'x', expectedCaFingerprint256: '0'.repeat(64), privateKeyPem: 'x' }), /csr-digest-mismatch/);
  assert.throws(() => verifyCertificateBinding({ csrBytes: Buffer.alloc(20), expectedCsrSha256: digest, leafPem: 'x', caPem: 'x', expectedCaFingerprint256: '0'.repeat(64), privateKeyPem: 'x', maxBytes: 10 }), /csrBytes-size-limit/);
});

test('validates synthetic CSR signature, CSR/leaf/private key binding, CA pin, validity and clientAuth EKU', (t) => {
  const pwshPath = process.env.O2O_TEST_PWSH;
  if (!pwshPath) { t.skip('O2O_TEST_PWSH must point to the configured PowerShell 7 executable'); return; }
  const fixtureScript = String.raw`
$ErrorActionPreference='Stop'
function New-KeyRequest([string]$name) { $key=[System.Security.Cryptography.RSA]::Create(2048); $request=[System.Security.Cryptography.X509Certificates.CertificateRequest]::new("CN=$name",$key,[System.Security.Cryptography.HashAlgorithmName]::SHA256,[System.Security.Cryptography.RSASignaturePadding]::Pkcs1); return @{key=$key;request=$request} }
$ca=New-KeyRequest 'fixture-ca'; $ca.request.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true,$false,0,$true)); $caCert=$ca.request.CreateSelfSigned([datetimeoffset]::UtcNow.AddMinutes(-1),[datetimeoffset]::UtcNow.AddHours(1))
$leaf=New-KeyRequest 'fixture-leaf'; $leaf.request.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false,$false,0,$true)); $leaf.request.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new([System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature,$true)); $eku=[System.Security.Cryptography.OidCollection]::new(); if($env:FIXTURE_EKU -eq 'yes'){$null=$eku.Add([System.Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.2')); $leaf.request.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($eku,$true))} elseif($env:FIXTURE_EKU -eq 'wrong'){$null=$eku.Add([System.Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.1')); $leaf.request.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($eku,$true))}; $leafCert=$leaf.request.Create($caCert,[datetimeoffset]::UtcNow.AddMinutes(-1),[datetimeoffset]::UtcNow.AddMinutes(30),[byte[]]([guid]::NewGuid().ToByteArray()))
$csr=$leaf.request.CreateSigningRequestPem(); $obj=@{csr=$csr;ca=$caCert.ExportCertificatePem();leaf=$leafCert.ExportCertificatePem();key=$leaf.key.ExportPkcs8PrivateKeyPem();otherKey=(New-KeyRequest 'other').key.ExportPkcs8PrivateKeyPem()}; $obj | ConvertTo-Json -Compress
`;
  function makeFixture(withEku) {
    const child = spawnSync(pwshPath, ['-NoProfile', '-NonInteractive', '-Command', fixtureScript], { encoding: 'utf8', timeout: 15000, maxBuffer: 32768, env: { ...process.env, FIXTURE_EKU: String(withEku) }, windowsHide: true, shell: false });
    assert.equal(child.status, 0, child.stderr);
    return JSON.parse(child.stdout);
  }
  const fixture = makeFixture('yes');
  const csrBytes = Buffer.from(fixture.csr);
  const expectedCsrSha256 = crypto.createHash('sha256').update(csrBytes).digest('hex');
  const expectedCaFingerprint256 = new crypto.X509Certificate(fixture.ca).fingerprint256.replaceAll(':', '').toLowerCase();
  const valid = { csrBytes, expectedCsrSha256, leafPem: fixture.leaf, caPem: fixture.ca, expectedCaFingerprint256, privateKeyPem: fixture.key, pwshPath };
  assert.equal(verifyCertificateBinding(valid).csrSha256, expectedCsrSha256);
  assert.throws(() => verifyCertificateBinding({ ...valid, privateKeyPem: fixture.otherKey }), /leaf-private-key-mismatch/);
  const damagedDer = Buffer.from(fixture.csr.replace(/-----[^-]+-----/g, '').replace(/\s/g, ''), 'base64');
  damagedDer[damagedDer.length - 12] ^= 1;
  const damagedB64 = damagedDer.toString('base64').match(/.{1,64}/g).join('\n');
  const damagedCsr = Buffer.from(`-----BEGIN CERTIFICATE REQUEST-----\n${damagedB64}\n-----END CERTIFICATE REQUEST-----\n`);
  assert.throws(() => verifyCertificateBinding({ ...valid, csrBytes: damagedCsr, expectedCsrSha256: crypto.createHash('sha256').update(damagedCsr).digest('hex') }), /csr-signature-invalid-or-parser-failed/);
  for (const eku of ['no', 'wrong']) {
    const invalid = makeFixture(eku);
    const invalidCsr = Buffer.from(invalid.csr);
    assert.throws(() => verifyCertificateBinding({ ...valid, csrBytes: invalidCsr, expectedCsrSha256: crypto.createHash('sha256').update(invalidCsr).digest('hex'), leafPem: invalid.leaf, caPem: invalid.ca, expectedCaFingerprint256: new crypto.X509Certificate(invalid.ca).fingerprint256.replaceAll(':', '').toLowerCase(), privateKeyPem: invalid.key }), /client-auth-eku-required/, `EKU case ${eku}`);
  }
});
