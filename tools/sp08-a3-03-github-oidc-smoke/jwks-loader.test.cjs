'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const oidc = require('./oidc-smoke.cjs');

const issuer = 'https://token.actions.githubusercontent.com';
function response(body, statusCode = 200) {
  return { statusCode, headers: { 'content-type': 'application/json; charset=utf-8' }, body: Buffer.from(JSON.stringify(body)) };
}

test('loads a fixed-origin RSA snapshot with exactly two bounded GETs', async () => {
  const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' });
  const calls = [];
  const snapshot = await oidc.loadTrustedGithubJwks({ now: 1_000, request: async (url, options) => {
    calls.push({ url: url.href, options });
    return calls.length === 1
      ? response({ issuer, jwks_uri: `${issuer}/.well-known/jwks`, id_token_signing_alg_values_supported: ['RS256'] })
      : response({ keys: [{ ...jwk, kid: 'synthetic', alg: 'RS256', use: 'sig' }] });
  } });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, `${issuer}/.well-known/openid-configuration`);
  assert.equal(calls[1].url, `${issuer}/.well-known/jwks`);
  assert.ok(calls.every(({ options }) => options.followRedirects === false && options.retries === 0));
  assert.equal(snapshot.requestBudget.used, 2);
  assert.equal(snapshot.keys[0].kid, 'synthetic');
  assert.equal(snapshot.expiresAt - snapshot.fetchedAt, oidc.JWKS_SNAPSHOT_TTL_MS);
});

test('rejects discovery that redirects trust to a caller controlled origin', async () => {
  await assert.rejects(oidc.loadTrustedGithubJwks({ request: async () => response({ issuer, jwks_uri: 'https://example.com/keys', id_token_signing_alg_values_supported: ['RS256'] }) }), /fixed-origin-rejected/);
});

test('fails closed when configuration or trusted public keys are missing', async () => {
  await assert.rejects(oidc.loadTrustedGithubJwks({ totalTimeoutMs: 20_000 }), /jwks-loader-config-invalid/);
  await assert.rejects(oidc.loadTrustedGithubJwks({ request: async () => response({}) }), /discovery-invalid/);
  await assert.rejects(oidc.loadTrustedGithubJwks({ request: async (_url, options) => options.maxBytes === 64 * 1024
    ? response({ issuer, jwks_uri: `${issuer}/.well-known/jwks`, id_token_signing_alg_values_supported: ['RS256'] })
    : response({ keys: [] }) }), /jwks-key-invalid/);
});
