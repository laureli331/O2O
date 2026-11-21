'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const oidc = require('./oidc-smoke.cjs');
const handoff = require('./jwks-handoff.cjs');
const entry = require('./server-entry.cjs');
const ISSUER = 'https://token.actions.githubusercontent.com';
const reply = (value) => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: Buffer.from(JSON.stringify(value)) });

function fixtureConfig(now) {
  const pwsh = process.env.O2O_TEST_PWSH || 'pwsh';
  const script = `$ErrorActionPreference='Stop'
function New-KeyCert([string]$name) { $key=[System.Security.Cryptography.RSA]::Create(2048); $req=[System.Security.Cryptography.X509Certificates.CertificateRequest]::new("CN=$name",$key,[System.Security.Cryptography.HashAlgorithmName]::SHA256,[System.Security.Cryptography.RSASignaturePadding]::Pkcs1); return @{key=$key;req=$req} }
$ca=New-KeyCert 'fixture-ca'; $ca.req.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true,$false,0,$true)); $ca.cert=$ca.req.CreateSelfSigned([datetimeoffset]::UtcNow.AddMinutes(-1),[datetimeoffset]::UtcNow.AddHours(1))
function New-Leaf([string]$name,$caCert,$caKey) { $leaf=New-KeyCert $name; $leaf.req.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false,$false,0,$true)); $leaf.req.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new([System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature,$true)); if($name -eq 'localhost'){$san=[System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new();$san.AddIpAddress([System.Net.IPAddress]::Parse('192.0.2.10'));$leaf.req.CertificateExtensions.Add($san.Build());$eku=[System.Security.Cryptography.OidCollection]::new();$null=$eku.Add([System.Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.1'));$leaf.req.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($eku,$true))}; $leaf.cert=$leaf.req.Create($caCert,[datetimeoffset]::UtcNow.AddMinutes(-1),[datetimeoffset]::UtcNow.AddMinutes(10),[byte[]]([guid]::NewGuid().ToByteArray())); return @{cert=$leaf.cert.ExportCertificatePem();key=$leaf.key.ExportPkcs8PrivateKeyPem()} }
$server=New-Leaf 'localhost' $ca.cert $ca.key; $client=New-Leaf 'client' $ca.cert $ca.key; @{ca=$ca.cert.ExportCertificatePem();server=$server;client=$client}|ConvertTo-Json -Compress`;
  const generated = spawnSync(pwsh, ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
  if (generated.status !== 0) throw new Error(`fixture-certificate-generation-failed:${generated.stderr}`);
  const certs = JSON.parse(generated.stdout.trim());
  const identity = { repository_id: 'fixture-repo', run_id: 'fixture-run', run_attempt: '1', workflow_ref: 'fixture/workflow@refs/heads/main', workflow_sha: 'a'.repeat(40), job_workflow_ref: 'fixture/reusable@refs/heads/main', job_workflow_sha: 'b'.repeat(40), environment: 'fixture' };
  const expectedRequest = { v: 'a303-request-v1', method: 'POST', route_id: 'fixture-route', env_id: 'fixture-env', resource_id: 'fixture-resource', action_id: 'fixture-action', artifact_digest: 'd'.repeat(64), repository_id: identity.repository_id, run_id: identity.run_id, run_attempt: identity.run_attempt, payload: { fixture: true } };
  const ca = new crypto.X509Certificate(certs.ca);
  return { mode: 'check-only', authorizedUntil: now + 60_000, policy: {
    mode: 'github-oidc', issuer: ISSUER, service: 'fixture-service', expectedClaims: identity, expectedRequest,
    allowedPeerFingerprints: [new crypto.X509Certificate(certs.client.cert).fingerprint256.replaceAll(':', '').toLowerCase()],
    tlsKey: certs.server.key, tlsCert: certs.server.cert, ca: certs.ca, serverIPv4: '192.0.2.10',
    expectedCaFingerprint256: ca.fingerprint256.replaceAll(':', '').toLowerCase(),
  } };
}

test('synthetic loader snapshot round-trips through public handoff and existing preflight', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jwks-handoff-'));
  void t;
  const now = Date.now();
  const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'synthetic-fixture', alg: 'RS256', use: 'sig', private_material: 'must-not-leak' };
  let calls = 0;
  const request = async (url) => {
    calls += 1;
    return calls === 1 ? reply({ issuer: ISSUER, jwks_uri: `${ISSUER}/.well-known/jwks`, id_token_signing_alg_values_supported: ['RS256'] })
      : reply({ keys: [jwk] });
  };
  const snapshot = await oidc.loadTrustedGithubJwks({ request, now });
  const publicBytes = handoff.publicHandoff(snapshot);
  const publicData = JSON.parse(publicBytes.toString());
  assert.deepEqual(Object.keys(publicData).sort(), ['expiresAt', 'fetchedAt', 'issuer', 'keys']);
  assert.deepEqual(Object.keys(publicData.keys[0]).sort(), ['alg', 'e', 'kid', 'kty', 'n', 'use']);
  assert.doesNotMatch(publicBytes.toString(), /private_material|fixture-private|privateKey/);
  assert.equal(publicData.expiresAt - publicData.fetchedAt, oidc.JWKS_SNAPSHOT_TTL_MS);
  assert.equal(calls, 2);
  const handoffPath = path.join(dir, 'public.json');
  fs.writeFileSync(handoffPath, publicBytes, { flag: 'wx', mode: 0o600 });
  const templatePath = path.join(dir, 'template.json');
  const outputPath = path.join(dir, 'new-config.json');
  fs.writeFileSync(templatePath, JSON.stringify(fixtureConfig(now)));
  const result = handoff.assembleLocal(templatePath, handoffPath, outputPath, { now });
  assert.equal(result.validated, true);
  const assembled = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.deepEqual(assembled.policy.githubJwksKeys, publicData.keys);
  assert.equal(assembled.policy.issuer, ISSUER);
  assert.equal(assembled.policy.githubJwksFetchedAt, now);
  assert.equal(assembled.policy.githubJwksExpiresAt, now + oidc.JWKS_SNAPSHOT_TTL_MS);
  assert.equal(entry.validateCheckOnlyConfig(assembled, now).checked, true);
});

test('rejects expired/malformed handoffs and never overwrites an existing output', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jwks-handoff-invalid-'));
  void t;
  const now = 10_000_000;
  const template = path.join(dir, 'template.json');
  const input = path.join(dir, 'handoff.json');
  const output = path.join(dir, 'output.json');
  fs.writeFileSync(template, '{}');
  fs.writeFileSync(input, JSON.stringify({ issuer: ISSUER, keys: [], fetchedAt: now - 1_000_000, expiresAt: now - 1 }));
  assert.throws(() => handoff.assembleLocal(template, input, output, { now }), { code: 'handoff-invalid-or-expired' });
  fs.writeFileSync(input, JSON.stringify({ issuer: ISSUER, keys: [{ kid: 'x', private: 'secret' }], fetchedAt: now - 1, expiresAt: now + 1_000 }));
  assert.throws(() => handoff.assembleLocal(template, input, output, { now }), { code: 'handoff-key-invalid' });
  fs.writeFileSync(output, 'preserve-me');
  const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  let calls = 0;
  await assert.rejects(handoff.fetchPublic(output, { request: async () => {
    calls += 1;
    return calls === 1 ? reply({ issuer: ISSUER, jwks_uri: `${ISSUER}/.well-known/jwks`, id_token_signing_alg_values_supported: ['RS256'] })
      : reply({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'fixture', alg: 'RS256', use: 'sig' }] });
  }, now }), { code: 'EEXIST' });
  assert.equal(fs.readFileSync(output, 'utf8'), 'preserve-me');
});
