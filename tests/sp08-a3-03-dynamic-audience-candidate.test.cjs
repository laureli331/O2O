'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const candidate = require('../tools/sp08-a3-03-github-oidc-smoke/dynamic-audience-candidate.cjs');
const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/sp08-a3-03-dynamic-audience-candidate.yml'), 'utf8');
const reusable = fs.readFileSync(path.join(__dirname, '../.github/workflows/sp08-a3-03-dynamic-audience-candidate-reusable.yml'), 'utf8');
const context = Object.fromEntries(candidate.REQUIRED.map((key) => [key, key === 'run_attempt' ? '1' : key === 'repository_id' ? '1234' : key === 'run_id' ? '2345' : `fixture-${key}`]));
const policy = { approved: true, context, allowedActions: ['fixture-proof-check'] };
test('candidate context requires independently approved exact policy fields and action', () => {
  assert.throws(() => candidate.validateCandidateContext({ context, action: 'fixture-proof-check' }), { code: 'trust-policy-missing' });
  assert.throws(() => candidate.validateCandidateContext({ context, policy: { ...policy, context: { ...context, workflow_sha: 'wrong' } }, action: 'fixture-proof-check' }), { code: 'context-workflow_sha-mismatch' });
  assert.throws(() => candidate.validateCandidateContext({ context, policy, action: 'other' }), { code: 'action-not-approved' });
  assert.deepEqual(candidate.validateCandidateContext({ context, policy, action: 'fixture-proof-check' }), context);
});
test('signed claim comparison independently checks caller, called workflow and exact audience', () => {
  const claims = { ...context, aud: 'urn:o2o:a303-bind-v1:fixture' };
  assert.equal(candidate.validateSignedClaims(claims, context, claims.aud), true);
  for (const field of ['workflow_ref', 'workflow_sha', 'job_workflow_ref', 'job_workflow_sha', 'repository_id', 'run_id', 'run_attempt', 'environment']) {
    assert.throws(() => candidate.validateSignedClaims({ ...claims, [field]: 'mismatch' }, context, claims.aud), { code: `claim-${field}-mismatch` });
  }
  assert.throws(() => candidate.validateSignedClaims(claims, context, `${claims.aud}x`), { code: 'audience-mismatch' });
});
test('synthetic action fixture and fresh proof material have bounded documented shape', () => {
  const request = candidate.createSyntheticRequest(context); const proof = candidate.createProofMaterial();
  assert.equal(request.payload.fixture, 'candidate-only'); assert.equal(request.action_id, 'fixture-action');
  assert.equal(Buffer.from(proof.nonce, 'base64url').length, 32); assert.equal(proof.jwk.crv, 'Ed25519');
  assert.equal(crypto.createPublicKey({ key: proof.jwk, format: 'jwk' }).asymmetricKeyType, 'ed25519');
});
test('candidate workflows are dispatch-only, pinned to isolated ref and fail closed by default', () => {
  assert.match(workflow, /workflow_dispatch:/); assert.match(workflow, /refs\/heads\/codex\/sp08-a3-03-tls-prep/);
  assert.match(workflow, /uses:\s*\.\/\.github\/workflows\/sp08-a3-03-dynamic-audience-candidate-reusable\.yml/);
  assert.match(reusable, /workflow_call:/); assert.match(reusable, /contents:\s*read/); assert.match(reusable, /id-token:\s*write/);
  assert.match(reusable, /fail closed/i); assert.doesNotMatch(reusable, /A303_OIDC_SMOKE_AUDIENCE/);
});
test('candidate CLI runs one dynamic token GET and two fixed discovery/JWKS GETs then verifies exact RS256 claims', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'fixture-key', alg: 'RS256', use: 'sig' };
  const claims = { iss: 'https://token.actions.githubusercontent.com', ...context, jti: 'fixture-jti', runner_environment: 'github-hosted', environment: context.environment,
    iat: Math.floor(Date.now() / 1000) - 1, nbf: Math.floor(Date.now() / 1000) - 1, exp: Math.floor(Date.now() / 1000) + 60 };
  const env = { ACTIONS_ID_TOKEN_REQUEST_URL: 'https://oidc.test/request', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'fixture-bearer', A303_EXPECTED_OIDC_ORIGIN: 'https://oidc.test',
    A303_DYNAMIC_AUDIENCE_TRUST_POLICY_JSON: JSON.stringify(policy), A303_CANDIDATE_ACTION: 'fixture-proof-check',
    GITHUB_REPOSITORY: context.repository, GITHUB_REPOSITORY_ID: context.repository_id, GITHUB_RUN_ID: context.run_id, GITHUB_RUN_ATTEMPT: context.run_attempt,
    GITHUB_ACTOR: context.actor, GITHUB_REF: context.ref, GITHUB_WORKFLOW_REF: context.workflow_ref, GITHUB_WORKFLOW_SHA: context.workflow_sha,
    GITHUB_JOB_WORKFLOW_REF: context.job_workflow_ref, GITHUB_JOB_WORKFLOW_SHA: context.job_workflow_sha, GITHUB_ENVIRONMENT: context.environment };
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url: url.href, options });
    const json = (value) => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
    if (url.origin === 'https://oidc.test') {
      claims.aud = url.searchParams.get('audience');
      const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
      const input = `${encode({ alg: 'RS256', kid: jwk.kid, typ: 'JWT' })}.${encode(claims)}`;
      return json({ value: `${input}.${crypto.sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}` });
    }
    return calls.length === 2
      ? json({ issuer: 'https://token.actions.githubusercontent.com', jwks_uri: 'https://token.actions.githubusercontent.com/.well-known/jwks', id_token_signing_alg_values_supported: ['RS256'] })
      : json({ keys: [jwk] });
  };
  const result = await candidate.runCandidate({ env, request });
  assert.deepEqual(result, { ok: true, claimComparisons: candidate.REQUIRED.length, audienceMatch: true, requestBudget: 3 });
  assert.equal(calls.length, 3);
  assert.equal(calls.filter((call) => new URL(call.url).origin === 'https://oidc.test').length, 1);
  assert.equal(calls.filter((call) => new URL(call.url).origin === 'https://token.actions.githubusercontent.com').length, 2);
  assert.ok(calls.every(({ options }) => options.retries === 0 && options.followRedirects === false));
});
