'use strict';

// Explicit offline preflight entry. It reads a caller-supplied local JSON file,
// validates the existing A-segment TLS/JWKS material. Check-only never binds/fetches.
const fs = require('node:fs');
const os = require('node:os');
const localA = require('./a-segment-local.cjs');
const oidc = require('./oidc-smoke.cjs');

function validateConfigMaterial(config, mode, now) {
  if (!config || typeof config !== 'object' || Array.isArray(config)
    || config.mode !== mode || !Number.isSafeInteger(config.authorizedUntil)
    || !Number.isSafeInteger(now) || config.authorizedUntil <= now
    || config.authorizedUntil - now > 15 * 60 * 1000) {
    const error = new Error('server-entry-authorization-invalid'); error.code = 'server-entry-authorization-invalid'; throw error;
  }
  localA.validateLocalServerMaterial(config.policy, now);
  if (config.policy.mode === 'github-oidc') {
    if (config.policy.issuer !== 'https://token.actions.githubusercontent.com'
      || !Array.isArray(config.policy.githubJwksKeys) || config.policy.githubJwksKeys.length === 0
      || !Number.isSafeInteger(config.policy.githubJwksFetchedAt)
      || !Number.isSafeInteger(config.policy.githubJwksExpiresAt)
      || config.policy.githubJwksFetchedAt > now
      || config.policy.githubJwksExpiresAt <= now
      || config.policy.githubJwksExpiresAt - config.policy.githubJwksFetchedAt > oidc.JWKS_SNAPSHOT_TTL_MS) {
      const error = new Error('server-entry-jwks-snapshot-invalid'); error.code = 'server-entry-jwks-snapshot-invalid'; throw error;
    }
  }
}

function validateCheckOnlyConfig(config, now = Date.now()) {
  validateConfigMaterial(config, 'check-only', now);
  return Object.freeze({ checked: true, mode: 'check-only', networkRequests: 0, listenersBound: 0 });
}

async function main(argv = process.argv.slice(2), deps = {}) {
  const writeOut = deps.writeOut || ((value) => process.stdout.write(value));
  const writeError = deps.writeError || ((value) => process.stderr.write(value));
  if (argv.length !== 2 || (argv[0] !== '--check-only' && argv[0] !== '--start-approved')) {
    writeError('usage: node server-entry.cjs --check-only|--start-approved <local-config.json>\n');
    return 2;
  }
  try {
    const config = (deps.readConfig || ((filename) => JSON.parse(fs.readFileSync(filename, 'utf8'))))(argv[1]);
    if (argv[0] === '--check-only') {
      validateCheckOnlyConfig(config);
      writeOut(`${JSON.stringify({ checked: true, mode: 'check-only', networkRequests: 0, listenerAttempts: 0, listenersActive: 0 })}\n`);
      return 0;
    }
    const listener = (deps.startApproved || startApproved)(config, deps.startOptions);
    let interrupted = false;
    const stop = () => { interrupted = true; void listener.close(); };
    const onInt = () => stop();
    const onTerm = () => stop();
    process.on('SIGINT', onInt);
    process.on('SIGTERM', onTerm);
    try {
      await listener.closed;
    } finally {
      process.off('SIGINT', onInt);
      process.off('SIGTERM', onTerm);
    }
    const accepted = listener.accepted === true;
    writeOut(`${JSON.stringify({ mode: 'start-approved', ready: false, accepted, result: accepted ? 'accepted' : 'not-accepted', interrupted, listenerAttempts: 1, listenersActive: 0, networkRequests: 0 })}\n`);
    return accepted && !interrupted ? 0 : 1;
  } catch (error) {
    const code = error && typeof error.code === 'string' ? error.code : 'server-entry-check-failed';
    writeError(`${code}\n`);
    return 1;
  }
}

function startApproved(config, { interfaces = os.networkInterfaces(), bind = (server, host, port, signal) => server.listen({ port, host, signal }) } = {}) {
  const now = Date.now();
  if (!config || config.mode !== 'start-approved' || config.authorization !== 'explicit-temporary'
    || !Number.isSafeInteger(config.authorizedUntil) || config.authorizedUntil <= now
    || config.authorizedUntil - now > 15 * 60 * 1000
    || typeof config.interfaceName !== 'string' || config.interfaceName.length === 0
    || typeof config.bindIPv4 !== 'string' || !localA.isPrivateIPv4(config.bindIPv4)
    || config.port !== 8443 || typeof bind !== 'function') {
    const error = new Error('server-entry-authorization-invalid'); error.code = 'server-entry-authorization-invalid'; throw error;
  }
  const addresses = interfaces[config.interfaceName];
  if (!Array.isArray(addresses) || !addresses.some((address) => address && address.address === config.bindIPv4
    && address.family === 'IPv4' && address.internal === false)) {
    const error = new Error('server-entry-interface-address-mismatch'); error.code = 'server-entry-interface-address-mismatch'; throw error;
  }
  validateConfigMaterial(config, 'start-approved', now);
  return localA.startSingleUseAListenerCandidate({
    policy: config.policy, host: config.bindIPv4, interfaceName: config.interfaceName,
    interfaces: [{ name: config.interfaceName, addresses }], port: 8443,
    authorizedUntil: config.authorizedUntil, bind,
  });
}

if (require.main === module) void main().then((code) => { process.exitCode = code; });
module.exports = { validateCheckOnlyConfig, startApproved, main };
