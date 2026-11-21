'use strict';

// Explicit runner-side entry. Check-only is local and never requests OIDC or opens TLS.
const fs = require('node:fs');
const net = require('node:net');
const { verifyReturnAndRunApprovedA } = require('./verify-return.cjs');

function reject(code) { const error = new Error(code); error.code = code; throw error; }

function runnerIdentity(config, env) {
  const requiredEnv = ['GITHUB_REPOSITORY', 'GITHUB_REPOSITORY_ID', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_WORKFLOW_REF', 'GITHUB_WORKFLOW_SHA'];
  if (requiredEnv.some((name) => typeof env[name] !== 'string' || env[name].length === 0)
    || env.GITHUB_RUN_ATTEMPT !== '1') reject('runner-context-invalid');
  const expected = config.policy.expectedClaims;
  const identity = { repository_id: env.GITHUB_REPOSITORY_ID, run_id: env.GITHUB_RUN_ID, run_attempt: env.GITHUB_RUN_ATTEMPT,
    workflow_ref: env.GITHUB_WORKFLOW_REF, workflow_sha: env.GITHUB_WORKFLOW_SHA,
    job_workflow_ref: expected.job_workflow_ref, job_workflow_sha: expected.job_workflow_sha };
  for (const key of Object.keys(identity)) if (expected[key] !== identity[key]) reject('runner-claim-policy-mismatch');
  if (config.request.repository_id !== identity.repository_id || config.request.run_id !== identity.run_id
    || config.request.run_attempt !== identity.run_attempt) reject('runner-request-context-mismatch');
  return identity;
}

function validateConfig(config, env = process.env, now = Date.now()) {
  if (!config || typeof config !== 'object' || Array.isArray(config)
    || (config.mode !== 'check-only' && config.mode !== 'start-approved')
    || config.authorization !== (config.mode === 'check-only' ? 'local-check-only' : 'explicit-temporary')
    || !Number.isSafeInteger(config.authorizedUntil) || config.authorizedUntil <= now
    || config.authorizedUntil - now > 15 * 60 * 1000
    || typeof config.targetIPv4 !== 'string' || net.isIPv4(config.targetIPv4) !== true
    || config.port !== 8443 || !config.policy || config.policy.serverIPv4 !== config.targetIPv4
    || !config.policy.expectedClaims || !config.request || !config.verifyOptions) reject('runner-config-invalid');
  const { validateApprovedTargetMaterial } = require('./a-segment-local.cjs');
  validateApprovedTargetMaterial(config.policy, config.targetIPv4, now);
  runnerIdentity(config, env);
  return Object.freeze({ checked: true, mode: config.mode, target: 'approved-ipv4:8443', networkRequests: 0, listenersBound: 0 });
}

async function main(argv = process.argv.slice(2), deps = {}) {
  const out = deps.writeOut || ((value) => process.stdout.write(value));
  const err = deps.writeError || ((value) => process.stderr.write(value));
  if (argv.length !== 2 || !['--check-only', '--execute-approved'].includes(argv[0])) { err('usage: node runner-entry.cjs --check-only|--execute-approved <local-config.json>\n'); return 2; }
  try {
    const config = (deps.readConfig || ((file) => JSON.parse(fs.readFileSync(file, 'utf8'))))(argv[1]);
    const mode = argv[0] === '--check-only' ? 'check-only' : 'start-approved';
    if (config.mode !== mode) reject('runner-config-mode-mismatch');
    const env = deps.env || process.env;
    validateConfig(config, env);
    if (mode === 'check-only') { out(`${JSON.stringify({ checked: true, mode, networkRequests: 0, tlsConnections: 0 })}\n`); return 0; }
    if (Date.now() >= config.authorizedUntil) reject('runner-authorization-expired');
    const result = await (deps.execute || verifyReturnAndRunApprovedA)({ verifyOptions: config.verifyOptions,
      identity: runnerIdentity(config, env), request: config.request, policy: config.policy, env,
      approvedTarget: { ipv4: config.targetIPv4, port: 8443 }, authorizationDeadline: config.authorizedUntil, runtimeRequest: deps.runtimeRequest });
    out(`${JSON.stringify({ mode, accepted: result.ok === true, result: result.ok === true ? 'accepted' : 'rejected', tokenRequests: 1, tlsConnections: 1 })}\n`);
    return result.ok === true ? 0 : 1;
  } catch (error) { err(`${error && typeof error.code === 'string' ? error.code : 'runner-entry-failed'}\n`); return 1; }
}

if (require.main === module) void main().then((code) => { process.exitCode = code; });
module.exports = { validateConfig, main };
