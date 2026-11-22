'use strict';

// Offline handoff only: callers provide transport and local paths. No TAT/network
// integration is performed here; fetchedAt/expiresAt are metadata, not provenance.
const fs = require('node:fs');
const crypto = require('node:crypto');
const oidc = require('./oidc-smoke.cjs');
const serverEntry = require('./server-entry.cjs');
const ISSUER = 'https://token.actions.githubusercontent.com';
const MAX_HANDOFF_BYTES = 36 * 1024;
const KEYS = ['kty', 'alg', 'use', 'kid', 'n', 'e'];

function publicHandoff(snapshot) {
  if (!snapshot || snapshot.issuer !== ISSUER || !Array.isArray(snapshot.keys)
    || !Number.isSafeInteger(snapshot.fetchedAt) || !Number.isSafeInteger(snapshot.expiresAt)
    || snapshot.expiresAt - snapshot.fetchedAt !== oidc.JWKS_SNAPSHOT_TTL_MS) throw coded('handoff-snapshot-invalid');
  const keys = snapshot.keys.map((key) => {
    if (!key || key.kty !== 'RSA' || key.alg !== 'RS256' || key.use !== 'sig'
      || typeof key.kid !== 'string' || !key.kid || typeof key.n !== 'string' || typeof key.e !== 'string') throw coded('handoff-key-invalid');
    return Object.fromEntries(KEYS.map((name) => [name, key[name]]));
  });
  if (!keys.length || new Set(keys.map((key) => key.kid)).size !== keys.length) throw coded('handoff-key-invalid');
  const bytes = Buffer.from(JSON.stringify({ issuer: ISSUER, keys, fetchedAt: snapshot.fetchedAt, expiresAt: snapshot.expiresAt }));
  if (bytes.length > MAX_HANDOFF_BYTES) throw coded('handoff-too-large');
  return bytes;
}

async function fetchPublic(outputPath, { request, now = Date.now() } = {}) {
  const snapshot = await oidc.loadTrustedGithubJwks({ request, now });
  const bytes = publicHandoff(snapshot);
  fs.writeFileSync(outputPath, bytes, { flag: 'wx', mode: 0o600 });
  return Object.freeze({ written: true, bytes: bytes.length, fetchedAt: snapshot.fetchedAt, expiresAt: snapshot.expiresAt });
}

function assembleLocal(templatePath, handoffPath, outputPath, { now = Date.now() } = {}) {
  if (fs.statSync(handoffPath).size > MAX_HANDOFF_BYTES) throw coded('handoff-too-large');
  const handoff = oidc.parseJsonUnique(fs.readFileSync(handoffPath, 'utf8'));
  if (!handoff || typeof handoff !== 'object' || Array.isArray(handoff)
    || Object.keys(handoff).some((key) => !['issuer', 'keys', 'fetchedAt', 'expiresAt'].includes(key))
    || handoff.issuer !== ISSUER || !Array.isArray(handoff.keys)
    || !Number.isSafeInteger(handoff.fetchedAt) || !Number.isSafeInteger(handoff.expiresAt)
    || handoff.fetchedAt > now || handoff.expiresAt <= now
    || handoff.expiresAt - handoff.fetchedAt > oidc.JWKS_SNAPSHOT_TTL_MS) throw coded('handoff-invalid-or-expired');
  const keys = handoff.keys.map((key) => {
    if (!key || typeof key !== 'object' || Array.isArray(key) || Object.keys(key).some((name) => !KEYS.includes(name))
      || KEYS.some((name) => typeof key[name] !== 'string') || key.kty !== 'RSA' || key.alg !== 'RS256' || key.use !== 'sig' || !key.kid) throw coded('handoff-key-invalid');
    try {
      const publicKey = crypto.createPublicKey({ key: { kty: 'RSA', n: key.n, e: key.e }, format: 'jwk' });
      if ((publicKey.asymmetricKeyDetails?.modulusLength || 0) < 2048) throw new Error('short-rsa-key');
    } catch { throw coded('handoff-key-invalid'); }
    return Object.fromEntries(KEYS.map((name) => [name, key[name]]));
  });
  if (!keys.length || new Set(keys.map((key) => key.kid).values()).size !== keys.length) throw coded('handoff-key-invalid');
  const config = structuredClone(oidc.parseJsonUnique(fs.readFileSync(templatePath, 'utf8')));
  if (!config || !['check-only', 'start-approved'].includes(config.mode) || !config.policy || config.policy.mode !== 'github-oidc') throw coded('local-template-invalid');
  config.policy.issuer = ISSUER;
  config.policy.githubJwksKeys = keys;
  config.policy.githubJwksFetchedAt = handoff.fetchedAt;
  config.policy.githubJwksExpiresAt = handoff.expiresAt;
  if (config.mode === 'check-only') serverEntry.validateCheckOnlyConfig(config, now);
  else serverEntry.validateStartApprovedConfig(config, { now });
  const bytes = Buffer.from(JSON.stringify(config));
  if (bytes.length > MAX_HANDOFF_BYTES + 256 * 1024) throw coded('local-config-too-large');
  fs.writeFileSync(outputPath, bytes, { flag: 'wx', mode: 0o600 });
  return Object.freeze({ written: true, bytes: bytes.length, validated: true });
}

async function main(argv = process.argv.slice(2), deps = {}) {
  const writeOut = deps.writeOut || ((value) => process.stdout.write(value));
  const writeError = deps.writeError || ((value) => process.stderr.write(value));
  if (argv[0] === 'fetch-public' && argv.length === 2) {
    try {
      const result = await fetchPublic(argv[1], deps.fetchOptions);
      writeOut(`${JSON.stringify({ command: 'fetch-public', ...result })}\n`);
      return 0;
    } catch (error) {
      writeError(`${error && typeof error.code === 'string' ? error.code : 'jwks-handoff-failed'}\n`);
      return 1;
    }
  }
  if (argv[0] === 'assemble-local' && argv.length === 4) {
    try {
      const result = assembleLocal(argv[1], argv[2], argv[3], deps.assembleOptions);
      writeOut(`${JSON.stringify({ command: 'assemble-local', ...result })}\n`);
      return 0;
    } catch (error) {
      writeError(`${error && typeof error.code === 'string' ? error.code : 'jwks-handoff-failed'}\n`);
      return 1;
    }
  }
  writeError('usage: node jwks-handoff.cjs fetch-public <public-output.json> | assemble-local <local-template.json> <public-handoff.json> <new-config.json>\n');
  return 2;
}

function coded(code) { const error = new Error(code); error.code = code; return error; }
if (require.main === module) void main().then((code) => { process.exitCode = code; });
module.exports = { publicHandoff, fetchPublic, assembleLocal, main, MAX_HANDOFF_BYTES };
