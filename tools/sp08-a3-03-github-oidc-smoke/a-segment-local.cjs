'use strict';

// Offline-only A-segment proof primitives. The issuer verifier and policy are
// injected by the caller; this module never performs network requests.
const crypto = require('node:crypto');
const tls = require('node:tls');
const oidc = require('./oidc-smoke.cjs');
const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com';

const LABEL = 'EXPORTER-Channel-Binding';
const PREFIX = 'O2O-A303-A\n1\n';
const AUDIENCE_PREFIX = 'urn:o2o:a303-bind-v1:';

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function parseJsonNoDuplicates(input) {
  let offset = 0;
  const ws = () => { while (/[ \t\r\n]/.test(input[offset] || '')) offset += 1; };
  const string = () => { const start = offset++; while (offset < input.length) { if (input[offset] === '\\') { offset += 2; continue; } if (input[offset++] === '"') return JSON.parse(input.slice(start, offset)); } fail('invalid-json'); };
  function value(depth) {
    if (depth > 64) fail('invalid-json'); ws();
    if (input[offset] === '"') return string();
    if (input[offset] === '{') { offset += 1; ws(); const out = Object.create(null); const seen = new Set(); if (input[offset] === '}') { offset += 1; return out; } while (offset < input.length) { ws(); if (input[offset] !== '"') fail('invalid-json'); const k = string(); if (seen.has(k)) fail('duplicate-json-key'); seen.add(k); ws(); if (input[offset++] !== ':') fail('invalid-json'); Object.defineProperty(out, k, { value: value(depth + 1), enumerable: true }); ws(); if (input[offset] === '}') { offset += 1; return out; } if (input[offset++] !== ',') fail('invalid-json'); } fail('invalid-json'); }
    if (input[offset] === '[') { offset += 1; ws(); const out = []; if (input[offset] === ']') { offset += 1; return out; } while (offset < input.length) { out.push(value(depth + 1)); ws(); if (input[offset] === ']') { offset += 1; return out; } if (input[offset++] !== ',') fail('invalid-json'); } fail('invalid-json'); }
    const tail = input.slice(offset); const literal = /^(?:true|false|null)/.exec(tail); if (literal) { offset += literal[0].length; return literal[0] === 'null' ? null : literal[0] === 'true'; }
    const number = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(tail); if (number) { offset += number[0].length; const n = JSON.parse(number[0]); if (!Number.isFinite(n)) fail('invalid-json'); return n; } fail('invalid-json');
  }
  if (typeof input !== 'string') fail('invalid-json'); const result = value(0); ws(); if (offset !== input.length) fail('invalid-json'); return result;
}
function b64(value) { return Buffer.from(value).toString('base64url'); }
function decode(value, length) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) fail('invalid-base64url');
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.toString('base64url') !== value || (length !== undefined && bytes.length !== length)) fail('invalid-base64url');
  return bytes;
}
function sha(value) { return crypto.createHash('sha256').update(value).digest(); }
function exactKeys(value, expected) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...expected].sort().join('\0');
}
function thumbprint(jwk) {
  if (!exactKeys(jwk, ['kty', 'crv', 'x']) || jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519') fail('invalid-proof-key');
  decode(jwk.x, 32);
  const bytes = Buffer.from(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x }), 'utf8');
  return b64(sha(bytes));
}
function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail('invalid-canonical-value'); return JSON.stringify(value); }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  fail('invalid-canonical-value');
}
function commitment(claims, request, jwk, nonce, policy) {
  return {
    v: 'a303-bind-v1', svc: policy.service,
    repository_id: claims.repository_id, run_id: claims.run_id, run_attempt: claims.run_attempt,
    caller_workflow_ref: claims.workflow_ref, caller_workflow_sha: claims.workflow_sha,
    called_workflow_ref: claims.job_workflow_ref, called_workflow_sha: claims.job_workflow_sha,
    env: request.env_id, action: request.action_id, resource: request.resource_id,
    artifact: request.artifact_digest,
    request: b64(sha(Buffer.from(canonical(request), 'utf8'))),
    proof_key_thumbprint: thumbprint(jwk), nonce,
  };
}
function expectedAudience(value) { return `${AUDIENCE_PREFIX}${b64(sha(Buffer.from(canonical(value), 'utf8')))}`; }
async function requestDynamicAudienceToken({ identity, request, jwk, nonce, policy, env, runtimeRequest }) {
  const identityKeys = ['repository_id', 'run_id', 'run_attempt', 'workflow_ref', 'workflow_sha', 'job_workflow_ref', 'job_workflow_sha'];
  if (!identity || identityKeys.some((key) => typeof identity[key] !== 'string' || identity[key].length === 0)) fail('github-identity-policy-missing');
  if (!request || ['env_id', 'action_id', 'resource_id', 'artifact_digest'].some((key) => typeof request[key] !== 'string' || request[key].length === 0)) fail('request-policy-missing');
  if (!policy || typeof policy.service !== 'string' || !policy.service) fail('local-server-policy-missing');
  const commit = commitment(identity, request, jwk, nonce, policy);
  const audience = expectedAudience(commit);
  const token = await oidc.requestGithubIdToken({ env, audience, request: runtimeRequest });
  return Object.freeze({ token, commit, audience });
}
function proofMessage(token, commit, exporter) {
  if (typeof token !== 'string' || !/^[\x21-\x7e]+$/.test(token)) fail('invalid-token-bytes');
  const tokenBytes = Buffer.from(token, 'ascii');
  return Buffer.from(`${PREFIX}${b64(sha(tokenBytes))}\n${b64(sha(Buffer.from(canonical(commit), 'utf8')))}\n${b64(exporter)}`, 'utf8');
}
function signCurrentConnection(socket, token, commit, privateKey) {
  if (!socket || socket.getProtocol() !== 'TLSv1.3') fail('tls-version-rejected');
  const exporter = socket.exportKeyingMaterial(32, LABEL, Buffer.alloc(0));
  return b64(crypto.sign(null, proofMessage(token, commit, exporter), privateKey));
}

// Single-use offline A-segment client entry. Identity and action context are
// explicit inputs; callers must supply the already-approved TLS client
// material and an injected token transport (tests use a signed local fixture).
async function runLocalAClient({ identity, request, policy, env, runtimeRequest, tlsOptions, randomBytes = crypto.randomBytes }) {
  if (!tlsOptions || tlsOptions.host !== '127.0.0.1' || tlsOptions.minVersion !== 'TLSv1.3' || tlsOptions.maxVersion !== 'TLSv1.3'
    || tlsOptions.rejectUnauthorized !== true || !tlsOptions.key || !tlsOptions.cert || !tlsOptions.ca) fail('local-client-policy-missing');
  const pair = crypto.generateKeyPairSync('ed25519');
  const exported = pair.publicKey.export({ format: 'jwk' });
  const jwk = { kty: exported.kty, crv: exported.crv, x: exported.x };
  const nonceBytes = randomBytes(32);
  if (!Buffer.isBuffer(nonceBytes) || nonceBytes.length !== 32) fail('nonce-generation-failed');
  const nonce = b64(nonceBytes);
  const { token, commit } = await requestDynamicAudienceToken({ identity, request, jwk, nonce, policy, env, runtimeRequest });
  if (typeof token !== 'string' || token.length > 16384) fail('invalid-token');
  const socket = tls.connect(tlsOptions);
  return await new Promise((resolve, reject) => {
    let response = ''; let done = false; let sent = false;
    const finish = (error, value) => { if (done) return; done = true; clearTimeout(timer); socket.destroy(); error ? reject(error) : resolve(value); };
    const timer = setTimeout(() => finish(Object.assign(new Error('local-client-timeout'), { code: 'local-client-timeout' })), 5000);
    socket.once('error', (error) => finish(error));
    socket.once('secureConnect', () => {
      try {
        if (sent || socket.getProtocol() !== 'TLSv1.3' || socket.authorized !== true || socket.isSessionReused()) fail('tls-peer-rejected');
        sent = true;
        const proof = signCurrentConnection(socket, token, commit, pair.privateKey);
        const envelope = JSON.stringify({ v: 'a303-bind-v1', id_token: token, proof_key_jwk: jwk, request_R: request, nonce, proof_a: proof });
        if (Buffer.byteLength(envelope, 'utf8') > 65536) fail('envelope-size-limit');
        socket.write(`${envelope}\n`);
      } catch (error) { finish(error); }
    });
    socket.on('data', (chunk) => {
      response += chunk.toString('utf8');
      if (Buffer.byteLength(response, 'utf8') > 4096) return finish(Object.assign(new Error('response-size-limit'), { code: 'response-size-limit' }));
      const newline = response.indexOf('\n');
      if (newline >= 0) {
        if (newline !== response.length - 1) return finish(Object.assign(new Error('response-invalid'), { code: 'response-invalid' }));
        try { const result = parseJsonNoDuplicates(response.slice(0, newline)); if (!result || result.ok !== true) return finish(Object.assign(new Error(result && result.code || 'verification-rejected'), { code: result && result.code || 'verification-rejected' })); finish(null, result); }
        catch (error) { finish(error); }
      }
    });
  });
}
function parseJsonUnique(text) {
  const value = JSON.parse(text);
  // The local verifier accepts only the synthetic issuer's compact EdDSA JWT.
  // Its issuer signs these bytes; duplicate-key rejection is handled by the
  // existing smoke parser before this helper is used in production integration.
  return value;
}
function verifySyntheticToken(token, policy) {
  if (typeof token !== 'string' || !/^[\x21-\x7e]+$/.test(token)) fail('invalid-token');
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) fail('invalid-token');
  const [head, body, sig] = parts;
  const header = parseJsonNoDuplicates(decode(head).toString('utf8'));
  const claims = parseJsonNoDuplicates(decode(body).toString('utf8'));
  if (!exactKeys(header, ['alg', 'kid', 'typ']) || header.alg !== 'EdDSA' || header.typ !== 'JWT' || header.kid !== policy.issuerKid) fail('issuer-header-rejected');
  if (!crypto.verify(null, Buffer.from(`${head}.${body}`, 'ascii'), policy.issuerPublicKey, decode(sig, 64))) fail('issuer-signature-rejected');
  if (!claims || claims.iss !== policy.issuer) fail('issuer-claim-rejected');
  return claims;
}
function verifyGithubToken(token, policy) {
  const now = Date.now();
  if (policy.issuer !== GITHUB_ISSUER || !Array.isArray(policy.githubJwksKeys) || policy.githubJwksKeys.length === 0
    || !Number.isSafeInteger(policy.githubJwksFetchedAt) || !Number.isSafeInteger(policy.githubJwksExpiresAt)
    || policy.githubJwksExpiresAt <= now || policy.githubJwksExpiresAt - policy.githubJwksFetchedAt > oidc.JWKS_SNAPSHOT_TTL_MS
    || policy.githubJwksFetchedAt > now) fail('github-jwks-snapshot-expired');
  const compact = oidc.parseCompactJwt(token);
  const candidates = policy.githubJwksKeys.filter((key) => key && key.kid === compact.header.kid);
  if (candidates.length !== 1) fail('jwks-kid-not-found');
  const claims = oidc.verifyRs256CompactToken(compact, candidates[0]);
  if (!claims || claims.iss !== GITHUB_ISSUER) fail('issuer-claim-rejected');
  return claims;
}
function requireGithubPolicy(policy) {
  const required = ['repository_id', 'workflow_ref', 'workflow_sha', 'job_workflow_ref', 'job_workflow_sha', 'environment', 'run_attempt'];
  if (!policy.expectedClaims || required.some((name) => typeof policy.expectedClaims[name] !== 'string' || policy.expectedClaims[name].length === 0)
    || policy.expectedClaims.run_attempt !== '1') fail('github-identity-policy-missing');
}
function validateLocalServerMaterial(policy) {
  try {
    const ip = policy.serverIPv4;
    if (typeof ip !== 'string' || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)
      || ip.split('.').some((part) => Number(part) > 255)) fail('local-server-policy-missing');
    const server = new crypto.X509Certificate(policy.tlsCert);
    const key = crypto.createPrivateKey(policy.tlsKey);
    const ca = new crypto.X509Certificate(policy.ca);
    if (!server.checkPrivateKey(key) || Date.parse(server.validFrom) > Date.now() || Date.parse(server.validTo) <= Date.now()) fail('tls-server-certificate-invalid');
    const san = server.subjectAltName || '';
    if (!san.split(/,\s*/).includes(`IP Address:${ip}`)) fail('tls-server-ip-san-mismatch');
    if (!server.keyUsage || !server.keyUsage.includes('1.3.6.1.5.5.7.3.1')) fail('tls-server-auth-eku-missing');
    const expectedCa = policy.expectedCaFingerprint256;
    if (typeof expectedCa !== 'string' || !/^[a-f0-9]{64}$/.test(expectedCa)
      || ca.fingerprint256.replaceAll(':', '').toLowerCase() !== expectedCa) fail('tls-ca-pin-mismatch');
    const pins = policy.allowedPeerFingerprints;
    if (!Array.isArray(pins) || pins.length === 0 || pins.some((pin) => typeof pin !== 'string' || !/^[a-f0-9]{64}$/.test(pin))) fail('client-certificate-pin-invalid');
    if (!policy.expectedClaims || !policy.expectedRequest || !policy.service) fail('local-server-policy-missing');
    if (policy.mode === 'github-oidc') {
      const required = ['repository_id', 'run_id', 'run_attempt', 'workflow_ref', 'workflow_sha', 'job_workflow_ref', 'job_workflow_sha', 'environment'];
      if (required.some((name) => typeof policy.expectedClaims[name] !== 'string' || !policy.expectedClaims[name].length)) fail('github-identity-policy-missing');
      if (!policy.expectedRequest || typeof policy.expectedRequest !== 'object'
        || ['v', 'method', 'route_id', 'env_id', 'resource_id', 'action_id', 'artifact_digest', 'repository_id', 'run_id', 'run_attempt', 'payload'].some((name) => !(name in policy.expectedRequest))) fail('github-request-policy-missing');
    }
  } catch (error) {
    if (error && typeof error.code === 'string') throw error;
    fail('tls-server-material-invalid');
  }
}
function verifyCurrentConnection(socket, { token, proof, jwk, policy, request, nonce }) {
  if (!socket || socket.getProtocol() !== 'TLSv1.3' || socket.authorized !== true) fail('tls-peer-rejected');
  if (typeof socket.isSessionReused === 'function' && socket.isSessionReused()) fail('session-resumption-rejected');
  const peer = socket.getPeerCertificate(true);
  if (!peer || !peer.raw || !policy.allowedPeerFingerprints.includes(sha(peer.raw).toString('hex'))) fail('peer-identity-rejected');
  const claims = policy.mode === 'github-oidc' ? verifyGithubToken(token, policy) : verifySyntheticToken(token, policy);
  for (const [key, expected] of Object.entries(policy.expectedClaims)) if (claims[key] !== expected) fail('claim-policy-mismatch');
  const commit = commitment(claims, request, jwk, nonce, policy);
  const audience = expectedAudience(commit);
  if (policy.mode === 'github-oidc') oidc.validateClaims(claims, audience, policy.expectedClaims.environment, policy.expectedClaims.run_attempt, Math.floor(Date.now() / 1000));
  else if (claims.aud !== audience) fail('audience-mismatch');
  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const exporter = socket.exportKeyingMaterial(32, LABEL, Buffer.alloc(0));
  if (!crypto.verify(null, proofMessage(token, commit, exporter), key, decode(proof, 64))) fail('proof-invalid');
  return { ok: true, result: 'synthetic-local-proof-accepted' };
}

function startLocalVerificationServer(options) {
  const { policy } = options || {};
  if (!options || !policy || !policy.tlsKey || !policy.tlsCert || !policy.ca
    || !policy.issuer || (policy.mode !== 'github-oidc' && (!policy.issuerKid || !policy.issuerPublicKey))
    || (policy.mode === 'github-oidc' && (policy.issuer !== GITHUB_ISSUER || !Array.isArray(policy.githubJwksKeys) || policy.githubJwksKeys.length === 0
      || !Number.isSafeInteger(policy.githubJwksFetchedAt) || !Number.isSafeInteger(policy.githubJwksExpiresAt)
      || policy.githubJwksExpiresAt <= Date.now() || policy.githubJwksExpiresAt - policy.githubJwksFetchedAt > oidc.JWKS_SNAPSHOT_TTL_MS))
    || !Array.isArray(policy.allowedPeerFingerprints) || policy.allowedPeerFingerprints.length === 0
    || !policy.expectedClaims || !policy.expectedRequest || !policy.service
    || (options.host !== undefined && options.host !== '127.0.0.1')) fail('local-server-policy-missing');
  validateLocalServerMaterial(policy);
  if (policy.mode === 'github-oidc') requireGithubPolicy(policy);
  const server = tls.createServer({ key: policy.tlsKey, cert: policy.tlsCert, ca: policy.ca, requestCert: true, rejectUnauthorized: true, minVersion: 'TLSv1.3', maxVersion: 'TLSv1.3' }, (socket) => {
    socket.setTimeout(options.timeoutMs || 5000, () => socket.destroy());
    let data = ''; let complete = false;
    socket.on('data', (chunk) => {
      if (complete) return;
      data += chunk.toString('utf8');
      if (Buffer.byteLength(data, 'utf8') > (options.maxBytes || 65536)) { complete = true; socket.destroy(); return; }
      const newline = data.indexOf('\n');
      if (newline < 0) return;
      if (newline !== data.length - 1) { complete = true; socket.destroy(); return; }
      complete = true;
      try {
        const envelope = parseJsonNoDuplicates(data.slice(0, newline));
        if (!exactKeys(envelope, ['v', 'id_token', 'proof_key_jwk', 'request_R', 'nonce', 'proof_a']) || envelope.v !== 'a303-bind-v1') fail('invalid-envelope');
        if (JSON.stringify(envelope.request_R) !== JSON.stringify(policy.expectedRequest)) fail('request-policy-mismatch');
        verifyCurrentConnection(socket, { token: envelope.id_token, proof: envelope.proof_a, jwk: envelope.proof_key_jwk, policy, request: envelope.request_R, nonce: envelope.nonce });
        socket.end(`${JSON.stringify({ ok: true, result: 'synthetic-local-proof-accepted' })}\n`);
      } catch (error) {
        socket.end(`${JSON.stringify({ ok: false, code: typeof error.code === 'string' ? error.code : 'verification-rejected' })}\n`);
      }
    });
    socket.on('error', () => {});
  });
  server.on('error', () => {});
  server.listen(options.port || 0, '127.0.0.1');
  return { server, close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())), address: () => server.address() };
}

module.exports = { AUDIENCE_PREFIX, commitment, expectedAudience, requestDynamicAudienceToken, signCurrentConnection, runLocalAClient, verifyCurrentConnection, validateLocalServerMaterial, startLocalVerificationServer };
