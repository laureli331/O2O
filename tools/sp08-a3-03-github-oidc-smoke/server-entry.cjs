'use strict';

// Explicit offline preflight entry. It reads a caller-supplied local JSON file,
// validates the existing A-segment TLS/JWKS material, and never binds or fetches.
const fs = require('node:fs');
const os = require('node:os');
const localA = require('./a-segment-local.cjs');

function validateCheckOnlyConfig(config, now = Date.now()) {
  if (!config || typeof config !== 'object' || Array.isArray(config)
    || config.mode !== 'check-only' || !Number.isSafeInteger(config.authorizedUntil)
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
      || config.policy.githubJwksExpiresAt <= now) {
      const error = new Error('server-entry-jwks-snapshot-invalid'); error.code = 'server-entry-jwks-snapshot-invalid'; throw error;
    }
  }
  return Object.freeze({ checked: true, mode: 'check-only', networkRequests: 0, listenersBound: 0 });
}

function main(argv = process.argv.slice(2)) {
  if (argv.length !== 2 || (argv[0] !== '--check-only' && argv[0] !== '--start-approved')) {
    process.stderr.write('usage: node server-entry.cjs --check-only|--start-approved <local-config.json>\n');
    return 2;
  }
  try {
    const config = JSON.parse(fs.readFileSync(argv[1], 'utf8'));
    const result = argv[0] === '--check-only' ? validateCheckOnlyConfig(config) : startApproved(config);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    const code = error && typeof error.code === 'string' ? error.code : 'server-entry-check-failed';
    process.stderr.write(`${code}\n`);
    return 1;
  }
}

function startApproved(config, { interfaces = os.networkInterfaces(), bind = (server, host, port) => server.listen(port, host) } = {}) {
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
  localA.validateLocalServerMaterial(config.policy, now);
  return localA.startSingleUseAListenerCandidate({
    policy: config.policy, host: config.bindIPv4, interfaceName: config.interfaceName,
    interfaces: [{ name: config.interfaceName, addresses }], port: 8443,
    authorizedUntil: config.authorizedUntil, bind,
  });
}

if (require.main === module) process.exitCode = main();
module.exports = { validateCheckOnlyConfig, startApproved, main };
