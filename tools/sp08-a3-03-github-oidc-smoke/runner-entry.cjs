'use strict';

// Explicit runner-side entry. Check-only is local and never requests OIDC or opens TLS.
const fs = require('node:fs');
const { isDeepStrictEqual } = require('node:util');
const { verifyReturnAndRunApprovedA } = require('./verify-return.cjs');

function reject(code) { const error = new Error(code); error.code = code; throw error; }

const CONTEXT_FIELDS = Object.freeze(['repository', 'repository_id', 'run_id', 'run_attempt', 'actor', 'actor_id', 'ref', 'workflow_ref', 'workflow_sha', 'job_workflow_ref', 'job_workflow_sha', 'environment']);
const REQUEST_FIELDS = Object.freeze(['v', 'method', 'route_id', 'env_id', 'resource_id', 'action_id', 'artifact_digest', 'repository_id', 'run_id', 'run_attempt', 'payload']);
const PUBLIC_ERRORS = new Set(['runner-config-invalid', 'runner-config-mode-mismatch', 'runner-context-incomplete', 'runner-context-invalid', 'runner-claim-policy-mismatch', 'runner-request-context-mismatch', 'runner-approved-request-mismatch', 'runner-verify-context-mismatch', 'approved-target-policy-invalid', 'tls-server-ip-san-mismatch', 'tls-server-certificate-invalid', 'tls-server-auth-eku-missing', 'tls-ca-pin-mismatch', 'tls-server-ca-binding-invalid', 'authorization-window-expired', 'return-source-binding-mismatch', 'return-csr-digest-binding-mismatch', 'source-csr-digest-mismatch', 'return-run-id-invalid', 'local-client-policy-missing', 'tls-peer-rejected', 'tls-peer-certificate-mismatch', 'audience-mismatch', 'proof-invalid', 'issuer-signature-rejected', 'github-jwks-snapshot-expired', 'jwks-kid-not-found', 'invalid-token', 'github-identity-policy-missing', 'github-request-policy-missing', 'verification-rejected']);

function runnerContext(env) {
  const names = Object.freeze({ repository: 'O2O_RUNNER_REPOSITORY', repository_id: 'O2O_RUNNER_REPOSITORY_ID', run_id: 'O2O_RUNNER_RUN_ID', run_attempt: 'O2O_RUNNER_RUN_ATTEMPT', actor: 'O2O_RUNNER_ACTOR', actor_id: 'O2O_RUNNER_ACTOR_ID', ref: 'O2O_RUNNER_REF', workflow_ref: 'O2O_RUNNER_WORKFLOW_REF', workflow_sha: 'O2O_RUNNER_WORKFLOW_SHA', job_workflow_ref: 'O2O_RUNNER_CALLED_WORKFLOW_REF', job_workflow_sha: 'O2O_RUNNER_CALLED_WORKFLOW_SHA', environment: 'O2O_RUNNER_ENVIRONMENT' });
  const context = Object.fromEntries(CONTEXT_FIELDS.map((field) => [field, env[names[field]]]));
  if (CONTEXT_FIELDS.some((field) => typeof context[field] !== 'string' || context[field].length === 0)) reject('runner-context-incomplete');
  if (!/^[1-9][0-9]*$/.test(context.repository_id) || !/^[1-9][0-9]*$/.test(context.run_id)
    || context.run_attempt !== '1' || !/^[0-9]+$/.test(context.actor_id)) reject('runner-context-invalid');
  return context;
}

function runnerIdentity(config, env) {
  const context = runnerContext(env);
  const expected = config.policy.expectedClaims;
  for (const field of CONTEXT_FIELDS.filter((field) => field !== 'run_id')) {
    const claimField = field === 'repository' ? 'repository' : field;
    if (expected[claimField] !== context[field]) reject('runner-claim-policy-mismatch');
  }
  if (Object.hasOwn(expected, 'run_id')) reject('runner-config-invalid');
  const approved = config.approvedRequest;
  if (!approved || !isDeepStrictEqual(Object.keys(config.request).sort(), [...REQUEST_FIELDS].sort())
    || !isDeepStrictEqual(Object.keys(approved).sort(), [...REQUEST_FIELDS].sort())
    || !isDeepStrictEqual(config.request, approved)) reject('runner-approved-request-mismatch');
  if (config.request.repository_id !== context.repository_id || config.request.run_id !== context.run_id
    || config.request.run_attempt !== context.run_attempt || config.request.env_id !== context.environment) reject('runner-request-context-mismatch');
  const verify = config.verifyOptions;
  if (!verify || verify.runId !== context.run_id || verify.runAttempt !== context.run_attempt || verify.commit !== context.workflow_sha) reject('runner-verify-context-mismatch');
  return { repository_id: context.repository_id, run_id: context.run_id, run_attempt: context.run_attempt,
    workflow_ref: context.workflow_ref, workflow_sha: context.workflow_sha,
    job_workflow_ref: context.job_workflow_ref, job_workflow_sha: context.job_workflow_sha };
}

function validateConfig(config, env = process.env, now = Date.now()) {
  if (!config || typeof config !== 'object' || Array.isArray(config)
    || (config.mode !== 'check-only' && config.mode !== 'start-approved')
    || config.authorization !== (config.mode === 'check-only' ? 'local-check-only' : 'explicit-temporary')
    || !Number.isSafeInteger(config.authorizedUntil) || config.authorizedUntil <= now
    || config.authorizedUntil - now > 15 * 60 * 1000
    || typeof config.targetIPv4 !== 'string' || !isAllowedTargetIPv4(config.targetIPv4)
    || config.port !== 8443 || !config.policy || config.policy.serverIPv4 !== config.targetIPv4
    || !config.policy.expectedClaims || !config.request || !config.verifyOptions) reject('runner-config-invalid');
  const { validateApprovedTargetMaterial } = require('./a-segment-local.cjs');
  validateApprovedTargetMaterial(config.policy, config.targetIPv4, now);
  runnerIdentity(config, env);
  return Object.freeze({ checked: true, mode: config.mode, target: 'approved-ipv4:8443', networkRequests: 0, listenersBound: 0 });
}

function isAllowedTargetIPv4(value) {
  return require('./a-segment-local.cjs').isApprovedTargetIPv4(value);
}
function publicErrorCode(error) { return error && typeof error.code === 'string' && PUBLIC_ERRORS.has(error.code) ? error.code : 'runner-entry-failed'; }

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
  } catch (error) { err(`${publicErrorCode(error)}\n`); return 1; }
}

if (require.main === module) void main().then((code) => { process.exitCode = code; });
module.exports = { validateConfig, runnerContext, runnerIdentity, isAllowedTargetIPv4, publicErrorCode, main };
