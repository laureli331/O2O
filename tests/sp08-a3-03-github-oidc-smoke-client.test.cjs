const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { runOidcSmoke } = require('../tools/sp08-a3-03-github-oidc-smoke/oidc-smoke.cjs');

const EXPECTED_AUDIENCE = `urn:o2o:a303-bind-v1:${'A'.repeat(43)}`;
const NOW_SECONDS = Math.floor(Date.now() / 1000);

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

function makeToken(pair, claims, kid = 'fixture-rsa-key') {
  const publicJwk = pair.publicKey.export({ format: 'jwk' });
  const header = { alg: 'RS256', kid, typ: 'JWT' };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput, 'ascii'), pair.privateKey);
  return {
    token: `${signingInput}.${b64url(signature)}`,
    jwk: { kty: 'RSA', alg: 'RS256', use: 'sig', kid, n: publicJwk.n, e: publicJwk.e },
  };
}

function makeFixture(overrides = {}) {
  const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const claims = {
    iss: 'https://token.actions.githubusercontent.com',
    aud: EXPECTED_AUDIENCE,
    jti: 'fixture-jti',
    repository_id: '123456789',
    run_id: '900719925474099312345',
    run_attempt: '1',
    workflow_ref: 'laureli331/O2O/.github/workflows/smoke.yml@refs/heads/codex/test',
    workflow_sha: 'a'.repeat(40),
    job_workflow_ref: 'laureli331/O2O/.github/workflows/smoke-reusable.yml@refs/heads/codex/test',
    job_workflow_sha: 'b'.repeat(40),
    runner_environment: 'github-hosted',
    environment: 'fixture-environment',
    nbf: NOW_SECONDS - 30,
    iat: NOW_SECONDS - 10,
    exp: NOW_SECONDS + 300,
    ...overrides.claims,
  };
  const signed = makeToken(pair, claims, overrides.kid || 'fixture-rsa-key');
  const discovery = {
    issuer: 'https://token.actions.githubusercontent.com',
    jwks_uri: 'https://token.actions.githubusercontent.com/.well-known/jwks',
    id_token_signing_alg_values_supported: ['RS256'],
  };
  const jwks = { keys: [signed.jwk, ...(overrides.extraKeys || [])] };
  const env = {
    ACTIONS_ID_TOKEN_REQUEST_URL: 'https://oidc.test/request?job=fixture',
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'fixture-bearer-secret',
    GITHUB_RUN_ATTEMPT: '1',
    A303_OIDC_SMOKE_AUDIENCE: EXPECTED_AUDIENCE,
    A303_EXPECTED_GITHUB_ENVIRONMENT: 'fixture-environment',
    A303_EXPECTED_OIDC_ORIGIN: 'https://oidc.test',
  };
  const responses = [
    { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: signed.token }) },
    { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(discovery) },
    { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(jwks) },
  ];
  const requests = [];
  const request = async (url, options) => {
    requests.push({ url: String(url), options });
    const next = responses.shift();
    if (!next) throw new Error('fixture request budget exceeded');
    if (typeof overrides.response === 'function') return overrides.response(requests.length, next, requests);
    return next;
  };
  return { env, request, requests, responses, claims, signed };
}

test('bounded smoke verifies one RS256 token with exactly three local-stubbed requests and emits no token or claim values', async () => {
  const fixture = makeFixture();
  const result = await runOidcSmoke({ env: fixture.env, request: fixture.request, nowSeconds: NOW_SECONDS });

  assert.equal(fixture.requests.length, 3);
  assert.equal(fixture.requests[0].url, `https://oidc.test/request?job=fixture&audience=${encodeURIComponent(EXPECTED_AUDIENCE)}`);
  assert.equal(Object.entries(fixture.requests[0].options.headers).find(([name]) => name.toLowerCase() === 'authorization')?.[1], 'Bearer fixture-bearer-secret');
  assert.deepEqual(fixture.requests.slice(1).map((entry) => new URL(entry.url).origin), [
    'https://token.actions.githubusercontent.com',
    'https://token.actions.githubusercontent.com',
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.requestBudget.limit, 3);
  assert.equal(result.requestBudget.used, 3);
  assert.equal(result.requestBudget.redirectsFollowed, 0);
  assert.equal(result.requestBudget.retries, 0);
  assert.equal(result.issuerSignatureVerified, true);
  assert.equal(result.audienceMatches, true);
  assert.equal(result.claimTypes.repository_id, 'string');
  assert.equal(result.claimTypes.run_id, 'string');
  assert.equal(result.claimTypes.run_attempt, 'string');
  assert.equal(result.claimTypes.iat, 'number');
  assert.equal(result.claimTypes.nbf, 'number');
  assert.equal(result.claimTypes.exp, 'number');
  for (const entry of fixture.requests) {
    assert.equal(entry.options.timeoutMs, 5_000);
    assert.equal(entry.options.retries, 0);
    assert.equal(entry.options.followRedirects, false);
    assert.equal(entry.options.signal.aborted, false);
  }
  assert.equal(JSON.stringify(result).includes('fixture-bearer-secret'), false);
  assert.equal(JSON.stringify(result).includes(fixture.signed.token), false);
  assert.equal(JSON.stringify(result).includes(fixture.claims.run_id), false);
});

test('insecure runner URL is rejected before sending the bearer', async () => {
  const fixture = makeFixture();
  fixture.env.ACTIONS_ID_TOKEN_REQUEST_URL = 'http://oidc.test/request';

  await assert.rejects(
    runOidcSmoke({ env: fixture.env, request: fixture.request, nowSeconds: NOW_SECONDS }),
    (error) => error.code === 'invalid-runtime-url',
  );
  assert.equal(fixture.requests.length, 0);
});

test('missing expected runner OIDC origin blocks before any request', async () => {
  const fixture = makeFixture();
  delete fixture.env.A303_EXPECTED_OIDC_ORIGIN;

  await assert.rejects(
    runOidcSmoke({ env: fixture.env, request: fixture.request, nowSeconds: NOW_SECONDS }),
    (error) => error.code === 'missing-oidc-origin-policy',
  );
  assert.equal(fixture.requests.length, 0);
});

test('runner OIDC origin mismatch blocks before sending the bearer', async () => {
  const fixture = makeFixture();
  fixture.env.A303_EXPECTED_OIDC_ORIGIN = 'https://different.invalid';

  await assert.rejects(
    runOidcSmoke({ env: fixture.env, request: fixture.request, nowSeconds: NOW_SECONDS }),
    (error) => error.code === 'runtime-origin-mismatch',
  );
  assert.equal(fixture.requests.length, 0);
});

test('OIDC redirects are rejected without following the Location target', async () => {
  const fixture = makeFixture();
  fixture.responses[0] = {
    statusCode: 302,
    headers: { location: 'https://attacker.invalid/collect', 'content-type': 'application/json' },
    body: '{}',
  };

  await assert.rejects(
    runOidcSmoke({ env: fixture.env, request: fixture.request, nowSeconds: NOW_SECONDS }),
    (error) => error.code === 'redirect-rejected',
  );
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.requests[0].options.followRedirects, false);
  assert.equal(fixture.requests[0].options.retries, 0);
});

test('oversized response is rejected before JSON parsing and further endpoint requests', async () => {
  const fixture = makeFixture({
    response: (call, response) => call === 1
      ? { ...response, body: Buffer.alloc(64 * 1024 + 1, 0x20) }
      : response,
  });

  await assert.rejects(
    runOidcSmoke({ env: fixture.env, request: fixture.request, nowSeconds: NOW_SECONDS }),
    (error) => error.code === 'response-too-large',
  );
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.requests[0].options.maxBytes, 64 * 1024);
});

test('non-finite JSON numbers in issuer responses are rejected', async () => {
  const fixture = makeFixture({
    response: (call, response) => call === 2
      ? { ...response, body: '{"issuer":"https://token.actions.githubusercontent.com","jwks_uri":"https://token.actions.githubusercontent.com/.well-known/jwks","id_token_signing_alg_values_supported":["RS256"],"ignored":1e999}' }
      : response,
  });

  await assert.rejects(
    runOidcSmoke({ env: fixture.env, request: fixture.request, nowSeconds: NOW_SECONDS }),
    (error) => error.code === 'invalid-json',
  );
  assert.equal(fixture.requests.length, 2);
});

test('signature failure is reported before untrusted issuer claims are interpreted', async () => {
  const fixture = makeFixture({ claims: { iss: 'https://attacker.invalid' } });
  const tokenResponse = JSON.parse(fixture.responses[0].body);
  const parts = tokenResponse.value.split('.');
  const signature = Buffer.from(parts[2], 'base64url');
  signature[0] ^= 0x01;
  tokenResponse.value = `${parts[0]}.${parts[1]}.${signature.toString('base64url')}`;
  fixture.responses[0] = { ...fixture.responses[0], body: JSON.stringify(tokenResponse) };

  await assert.rejects(
    runOidcSmoke({ env: fixture.env, request: fixture.request, nowSeconds: NOW_SECONDS }),
    (error) => error.code === 'signature-invalid',
  );
  assert.equal(fixture.requests.length, 3);
});

test('signed token with numeric repository ID fails the documented string schema', async () => {
  const fixture = makeFixture({ claims: { repository_id: 123 } });

  await assert.rejects(
    runOidcSmoke({ env: fixture.env, request: fixture.request, nowSeconds: NOW_SECONDS }),
    (error) => error.code === 'claim-schema',
  );
  assert.equal(fixture.requests.length, 3);
});

test('rerun attempt is rejected before the bearer is sent', async () => {
  const fixture = makeFixture();
  fixture.env.GITHUB_RUN_ATTEMPT = '2';

  await assert.rejects(
    runOidcSmoke({ env: fixture.env, request: fixture.request, nowSeconds: NOW_SECONDS }),
    (error) => error.code === 'rerun-not-authorized',
  );
  assert.equal(fixture.requests.length, 0);
});

test('signed run_attempt must match the workflow attempt value', async () => {
  const fixture = makeFixture({ claims: { run_attempt: '2' } });

  await assert.rejects(
    runOidcSmoke({ env: fixture.env, request: fixture.request, nowSeconds: NOW_SECONDS }),
    (error) => error.code === 'run-attempt-mismatch',
  );
  assert.equal(fixture.requests.length, 3);
});

test('signed token with string NumericDate fails the documented numeric timestamp schema', async () => {
  const fixture = makeFixture({ claims: { iat: String(NOW_SECONDS - 10) } });

  await assert.rejects(
    runOidcSmoke({ env: fixture.env, request: fixture.request, nowSeconds: NOW_SECONDS }),
    (error) => error.code === 'claim-time-type',
  );
});

test('discovery cannot redirect JWKS retrieval to a different origin', async () => {
  const fixture = makeFixture({
    response: (call, response) => call === 2
      ? { ...response, body: JSON.stringify({
        issuer: 'https://token.actions.githubusercontent.com',
        jwks_uri: 'https://attacker.invalid/jwks',
        id_token_signing_alg_values_supported: ['RS256'],
      }) }
      : response,
  });

  await assert.rejects(
    runOidcSmoke({ env: fixture.env, request: fixture.request, nowSeconds: NOW_SECONDS }),
    (error) => error.code === 'discovery-jwks-origin-invalid',
  );
  assert.equal(fixture.requests.length, 2);
});

test('global deadline aborts a stalled request and reports a sanitized code', async () => {
  const fixture = makeFixture();
  const request = async (url, options) => {
    fixture.requests.push({ url: String(url), options });
    return new Promise(() => {});
  };

  await assert.rejects(
    runOidcSmoke({ env: fixture.env, request, nowSeconds: NOW_SECONDS, totalTimeoutMs: 10 }),
    (error) => error.code === 'total-timeout' && !error.message.includes('fixture-bearer-secret'),
  );
  assert.equal(fixture.requests.length, 1);
});

test('transport error details never escape the sanitized client error', async () => {
  const fixture = makeFixture();
  const request = async (url, options) => {
    fixture.requests.push({ url: String(url), options });
    throw new Error(`transport failed with ${fixture.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`);
  };

  await assert.rejects(
    runOidcSmoke({ env: fixture.env, request, nowSeconds: NOW_SECONDS }),
    (error) => error.code === 'transport-failed' && !error.message.includes('fixture-bearer-secret'),
  );
});
