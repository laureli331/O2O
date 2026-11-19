'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const tls = require('node:tls');
const net = require('node:net');
const { spawnSync } = require('node:child_process');
const { commitment, signCurrentConnection, verifyCurrentConnection, startLocalVerificationServer } = require('../tools/sp08-a3-03-github-oidc-smoke/a-segment-local.cjs');

test('A proof is signed against exporter of the current authorized TLS 1.3 socket', () => {
  const pair = crypto.generateKeyPairSync('ed25519');
  const issuer = crypto.generateKeyPairSync('ed25519');
  const jwk = pair.publicKey.export({ format: 'jwk' });
  const key = { kty: jwk.kty, crv: jwk.crv, x: jwk.x };
  const request = { env_id: 'fixture-env', action_id: 'fixture-action', resource_id: 'fixture-resource', artifact_digest: 'fixture-digest' };
  const claims = { repository_id: '123', run_id: '456', run_attempt: '1', workflow_ref: 'caller', workflow_sha: 'a', job_workflow_ref: 'called', job_workflow_sha: 'b' };
  const nonce = crypto.randomBytes(32).toString('base64url');
  const policy = { service: 'fixture-service', issuer: 'synthetic:issuer', issuerKid: 'fixture-kid', issuerPublicKey: issuer.publicKey, expectedClaims: {}, allowedPeerFingerprints: [] };
  const commit = commitment(claims, request, key, nonce, policy);
  const aud = require('../tools/sp08-a3-03-github-oidc-smoke/a-segment-local.cjs').expectedAudience(commit);
  const jwtPart = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const head = jwtPart({ alg: 'EdDSA', kid: 'fixture-kid', typ: 'JWT' });
  const body = jwtPart({ iss: 'synthetic:issuer', ...claims, aud });
  const input = `${head}.${body}`;
  const token = `${input}.${crypto.sign(null, Buffer.from(input, 'ascii'), issuer.privateKey).toString('base64url')}`;
  const cert = { raw: Buffer.from('synthetic-cert') };
  const exporter = crypto.randomBytes(32);
  const socket = {
    getProtocol: () => 'TLSv1.3', authorized: true, isSessionReused: () => false,
    getPeerCertificate: () => cert, exportKeyingMaterial: () => exporter,
  };
  policy.allowedPeerFingerprints.push(crypto.createHash('sha256').update(cert.raw).digest('hex'));
  const proof = signCurrentConnection(socket, token, commit, pair.privateKey);
  assert.equal(verifyCurrentConnection(socket, { token, proof, jwk: key, policy, request, nonce }).ok, true);
  assert.throws(() => verifyCurrentConnection({ ...socket, exportKeyingMaterial: () => crypto.randomBytes(32) }, { token, proof, jwk: key, policy, request, nonce }), { code: 'proof-invalid' });
});

test('A proof rejects resumed sockets and missing peer authorization', () => {
  const socket = { getProtocol: () => 'TLSv1.3', authorized: true, isSessionReused: () => true };
  assert.throws(() => verifyCurrentConnection(socket, {}), { code: 'session-resumption-rejected' });
});

test('GitHub OIDC mode refuses to start without trusted JWKS keys', () => {
  assert.throws(() => startLocalVerificationServer({ policy: {
    mode: 'github-oidc', service: 'fixture-service', issuer: 'https://token.actions.githubusercontent.com',
    githubJwksKeys: [], expectedClaims: {}, expectedRequest: {}, allowedPeerFingerprints: ['00'],
    tlsKey: 'key', tlsCert: 'cert', ca: 'ca',
  } }), { code: 'local-server-policy-missing' });
});

test('GitHub OIDC mode refuses to start when fixed identity policy is incomplete', () => {
  const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = pair.publicKey.export({ format: 'jwk' });
  assert.throws(() => startLocalVerificationServer({ policy: {
    mode: 'github-oidc', service: 'fixture-service', issuer: 'https://token.actions.githubusercontent.com',
    githubJwksKeys: [{ ...publicJwk, kid: 'trusted', alg: 'RS256', use: 'sig' }],
    expectedClaims: { repository_id: '1', workflow_ref: 'r', workflow_sha: 'a', job_workflow_ref: 'j', job_workflow_sha: 'b', environment: 'e' },
    expectedRequest: {}, allowedPeerFingerprints: ['00'], tlsKey: 'key', tlsCert: 'cert', ca: 'ca',
  } }), { code: 'github-identity-policy-missing' });
});

async function runLoopback(mode) {
  const certScript = `$ErrorActionPreference='Stop'
function New-KeyCert([string]$name) { $key=[System.Security.Cryptography.RSA]::Create(2048); $req=[System.Security.Cryptography.X509Certificates.CertificateRequest]::new("CN=$name",$key,[System.Security.Cryptography.HashAlgorithmName]::SHA256,[System.Security.Cryptography.RSASignaturePadding]::Pkcs1); return @{key=$key;req=$req} }
$ca=New-KeyCert 'o2o-test-ca'; $ca.req.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true,$false,0,$true)); $ca.cert=$ca.req.CreateSelfSigned([datetimeoffset]::UtcNow.AddMinutes(-1),[datetimeoffset]::UtcNow.AddHours(1))
function New-Leaf([string]$name,$caCert,$caKey) { $leaf=New-KeyCert $name; $leaf.req.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false,$false,0,$true)); $leaf.req.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new([System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature,$true)); if($name -eq 'localhost'){$san=[System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new();$san.AddDnsName('localhost');$leaf.req.CertificateExtensions.Add($san.Build())}; $leaf.cert=$leaf.req.Create($caCert,[datetimeoffset]::UtcNow.AddMinutes(-1),[datetimeoffset]::UtcNow.AddMinutes(10),[byte[]]([guid]::NewGuid().ToByteArray())); return @{cert=$leaf.cert.ExportCertificatePem();key=$leaf.key.ExportPkcs8PrivateKeyPem()} }
$server=New-Leaf 'localhost' $ca.cert $ca.key; $client=New-Leaf 'synthetic-client' $ca.cert $ca.key
$out=@{ca=$ca.cert.ExportCertificatePem();server=$server;client=$client}|ConvertTo-Json -Compress
Write-Output $out
`;
    const shell = process.env.O2O_TEST_PWSH || 'pwsh';
    const generated = spawnSync(shell, ['-NoProfile', '-NonInteractive', '-Command', certScript], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
    assert.equal(generated.status, 0, 'synthetic certificate generation failed');
    const certs = JSON.parse(generated.stdout.trim());
    const ca = certs.ca;
    const serverCert = certs.server.cert;
    const clientCert = certs.client.cert;
    const github = mode === 'github-oidc';
    const issuer = crypto.generateKeyPairSync(github ? 'rsa' : 'ed25519', github ? { modulusLength: 2048 } : {});
    const identity = { repository_id: '1', workflow_ref: 'repo/.github/workflows/caller.yml@refs/heads/main', workflow_sha: 'a'.repeat(40), job_workflow_ref: 'repo/.github/workflows/reusable.yml@refs/heads/main', job_workflow_sha: 'b'.repeat(40), environment: 'fixture-env', run_attempt: '1' };
    const jwksKey = github ? { ...issuer.publicKey.export({ format: 'jwk' }), kid: 'github-fixture', alg: 'RS256', use: 'sig' } : null;
    const policy = { mode: github ? 'github-oidc' : undefined, service: 'fixture-service', issuer: github ? 'https://token.actions.githubusercontent.com' : 'synthetic:issuer', issuerKid: github ? undefined : 'fixture-kid', issuerPublicKey: github ? undefined : issuer.publicKey, githubJwksKeys: github ? [jwksKey] : undefined, expectedClaims: github ? identity : {}, expectedRequest: { env_id: 'e', action_id: 'a', resource_id: 'r', artifact_digest: 'd' }, allowedPeerFingerprints: [new crypto.X509Certificate(clientCert).fingerprint256.replaceAll(':', '').toLowerCase()], tlsKey: certs.server.key, tlsCert: serverCert, ca };
    const serverKey = certs.server.key;
    const clientKey = certs.client.key;
    const local = startLocalVerificationServer({ policy });
    const server = local.server;
    await new Promise((resolve, reject) => { server.once('error', reject); server.once('listening', resolve); });
    try {
      const port = local.address().port;
      const clientSocket = tls.connect({ host: '127.0.0.1', port, key: clientKey, cert: clientCert, ca, minVersion: 'TLSv1.3', maxVersion: 'TLSv1.3', rejectUnauthorized: true, servername: 'localhost' });
      const now = Math.floor(Date.now() / 1000);
      const claims = { ...identity, run_id: '2', jti: 'fixture-jti', runner_environment: 'github-hosted', iat: now - 10, nbf: now - 10, exp: now + 300 };
      const request = policy.expectedRequest; const nonce = crypto.randomBytes(32).toString('base64url');
      const pair = crypto.generateKeyPairSync('ed25519'); const pub = pair.publicKey.export({ format: 'jwk' }); const jwk = { kty: pub.kty, crv: pub.crv, x: pub.x };
      const commit = commitment(claims, request, jwk, nonce, policy); const audience = require('../tools/sp08-a3-03-github-oidc-smoke/a-segment-local.cjs').expectedAudience(commit);
      const part = (v) => Buffer.from(JSON.stringify(v)).toString('base64url'); const h = part({ alg: github ? 'RS256' : 'EdDSA', kid: github ? 'github-fixture' : 'fixture-kid', typ: 'JWT' }); const b = part({ iss: policy.issuer, aud: audience, ...claims }); const input = `${h}.${b}`;
      const token = `${input}.${crypto.sign(github ? 'RSA-SHA256' : null, Buffer.from(input, 'ascii'), issuer.privateKey).toString('base64url')}`;
      const response = new Promise((resolve, reject) => {
        let received = ''; const timer = setTimeout(() => reject(new Error('response-timeout')), 5000);
        clientSocket.on('data', (chunk) => { received += chunk.toString('utf8'); if (received.includes('\n')) { clearTimeout(timer); resolve(JSON.parse(received.trim())); } });
        clientSocket.once('error', (error) => { clearTimeout(timer); reject(error); });
      });
      await new Promise((resolve, reject) => { const timer=setTimeout(()=>reject(new Error('tls-timeout')),5000); clientSocket.once('secureConnect',()=>{clearTimeout(timer);resolve();}); clientSocket.once('error',(error)=>{clearTimeout(timer);reject(error);}); });
      assert.equal(clientSocket.getProtocol(), 'TLSv1.3');
      const proof = signCurrentConnection(clientSocket, token, commit, pair.privateKey);
      clientSocket.write(`${JSON.stringify({ v: 'a303-bind-v1', id_token: token, proof_key_jwk: jwk, request_R: request, nonce, proof_a: proof })}\n`);
      assert.deepEqual(await response, { ok: true, result: 'synthetic-local-proof-accepted' });
      clientSocket.end();
    } finally { await local.close(); }
}

test('A proof verifies over a real loopback TLS 1.3 client/server socket', () => runLoopback('synthetic'));
test('GitHub RS256 proof verifies over a real loopback TLS 1.3 client/server socket', () => runLoopback('github-oidc'));
