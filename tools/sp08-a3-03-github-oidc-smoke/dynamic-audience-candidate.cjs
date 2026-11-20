'use strict';

const crypto = require('node:crypto');
const aSegment = require('./a-segment-local.cjs');
const oidc = require('./oidc-smoke.cjs');

const REQUIRED = Object.freeze([
  'repository', 'repository_id', 'run_id', 'run_attempt', 'actor', 'ref',
  'workflow_ref', 'workflow_sha', 'job_workflow_ref', 'job_workflow_sha', 'environment',
]);
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function validateCandidateContext({ context, policy, action }) {
  if (!context || typeof context !== 'object' || !policy || typeof policy !== 'object') fail('trust-policy-missing');
  if (policy.approved !== true || !policy.context || typeof policy.context !== 'object') fail('trust-policy-unapproved');
  for (const field of REQUIRED) {
    const actual = context[field]; const expected = policy.context[field];
    if (typeof actual !== 'string' || !actual || typeof expected !== 'string' || !expected) fail('trust-policy-incomplete');
    if (actual !== expected) fail(`context-${field}-mismatch`);
  }
  if (!Array.isArray(policy.allowedActions) || !policy.allowedActions.includes(action)) fail('action-not-approved');
  return Object.freeze({ ...context });
}
function validateSignedClaims(claims, context, audience) {
  if (!claims || typeof claims !== 'object' || typeof audience !== 'string') fail('claims-invalid');
  for (const field of REQUIRED) if (claims[field] !== context[field]) fail(`claim-${field}-mismatch`);
  if (claims.aud !== audience) fail('audience-mismatch');
  return true;
}
function createSyntheticRequest(context) {
  return Object.freeze({ v: 'a303-request-v1', method: 'POST', route_id: 'fixture-route', env_id: context.environment,
    resource_id: 'fixture-resource', action_id: 'fixture-action', artifact_digest: 'sha256:synthetic-fixture',
    repository_id: context.repository_id, run_id: context.run_id, run_attempt: context.run_attempt,
    payload: Object.freeze({ fixture: 'candidate-only' }) });
}
function createProofMaterial() {
  const pair = crypto.generateKeyPairSync('ed25519'); const exported = pair.publicKey.export({ format: 'jwk' });
  const jwk = Object.freeze({ kty: exported.kty, crv: exported.crv, x: exported.x });
  return Object.freeze({ jwk, privateKey: pair.privateKey, nonce: crypto.randomBytes(32).toString('base64url') });
}
async function acquireCandidateToken({ context, policy, action, env, request, transport }) {
  const trusted = validateCandidateContext({ context, policy, action });
  const proof = createProofMaterial();
  const tokenContext = { ...trusted, actor: context.actor };
  const tokenResult = await aSegment.requestDynamicAudienceToken({
    identity: tokenContext, request, jwk: proof.jwk, nonce: proof.nonce,
    policy: { service: 'o2o-a303-dynamic-audience-candidate' }, env, runtimeRequest: transport,
  });
  return Object.freeze({ token: tokenResult.token, audience: tokenResult.audience, proof, context: trusted });
}
async function runCandidate({ env = process.env, request } = {}) {
  let policy;
  try { policy = JSON.parse(env.A303_DYNAMIC_AUDIENCE_TRUST_POLICY_JSON || ''); }
  catch { fail('trust-policy-unconfigured'); }
  const context = {
    repository: env.GITHUB_REPOSITORY, repository_id: env.GITHUB_REPOSITORY_ID,
    run_id: env.GITHUB_RUN_ID, run_attempt: env.GITHUB_RUN_ATTEMPT, actor: env.GITHUB_ACTOR,
    ref: env.GITHUB_REF, workflow_ref: env.GITHUB_WORKFLOW_REF, workflow_sha: env.GITHUB_WORKFLOW_SHA,
    job_workflow_ref: env.GITHUB_JOB_WORKFLOW_REF, job_workflow_sha: env.GITHUB_JOB_WORKFLOW_SHA,
    environment: env.GITHUB_ENVIRONMENT,
  };
  const action = env.A303_CANDIDATE_ACTION;
  const trusted = validateCandidateContext({ context, policy, action });
  const request_R = createSyntheticRequest(trusted);
  const acquired = await acquireCandidateToken({ context: trusted, policy, action, request: request_R, env, transport: request });
  const snapshot = await oidc.loadTrustedGithubJwks({ request });
  const compact = oidc.parseCompactJwt(acquired.token);
  const key = snapshot.keys.find((entry) => entry.kid === compact.header.kid);
  if (!key) fail('jwks-kid-not-found');
  const claims = oidc.verifyRs256CompactToken(compact, key);
  oidc.validateClaims(claims, acquired.audience, trusted.environment, trusted.run_attempt, Math.floor(Date.now() / 1000));
  validateSignedClaims(claims, trusted, acquired.audience);
  return Object.freeze({ ok: true, claimComparisons: REQUIRED.length, audienceMatch: true, requestBudget: snapshot.requestBudget.used + 1 });
}
if (require.main === module) {
  runCandidate().then((result) => process.stdout.write(`${JSON.stringify(result)}\n`)).catch((error) => {
    process.stdout.write(`${JSON.stringify({ ok: false, code: typeof error.code === 'string' ? error.code : 'candidate-rejected' })}\n`);
    process.exitCode = 1;
  });
}
module.exports = { REQUIRED, validateCandidateContext, validateSignedClaims, createSyntheticRequest, createProofMaterial, acquireCandidateToken, runCandidate };
