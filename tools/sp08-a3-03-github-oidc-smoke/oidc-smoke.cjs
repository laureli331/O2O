'use strict';

const crypto = require('node:crypto');
const https = require('node:https');

const ISSUER = 'https://token.actions.githubusercontent.com';
const DISCOVERY_URL = `${ISSUER}/.well-known/openid-configuration`;
const JWKS_URL = `${ISSUER}/.well-known/jwks`;
const AUDIENCE_PREFIX = 'urn:o2o:a303-bind-v1:';
const REQUEST_LIMIT = 3;
const REQUEST_TIMEOUT_MS = 5_000;
const TOTAL_TIMEOUT_MS = 15_000;
const RESPONSE_LIMITS = Object.freeze({
  token: 64 * 1024,
  discovery: 64 * 1024,
  jwks: 256 * 1024,
});

class SmokeError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SmokeError';
    this.code = code;
  }
}

function fail(code) {
  throw new SmokeError(code);
}

function parseJsonUnique(text) {
  let index = 0;
  const whitespace = () => {
    while (text[index] === ' ' || text[index] === '\t' || text[index] === '\r' || text[index] === '\n') index += 1;
  };
  const parseString = () => {
    const start = index;
    index += 1;
    while (index < text.length) {
      const character = text[index];
      if (character === '\\') {
        index += 2;
      } else if (character === '"') {
        index += 1;
        return JSON.parse(text.slice(start, index));
      } else {
        index += 1;
      }
    }
    fail('invalid-json');
  };
  const parseValue = (depth) => {
    if (depth > 64) fail('invalid-json');
    whitespace();
    if (text[index] === '"') return parseString();
    if (text[index] === '{') {
      index += 1;
      whitespace();
      const value = Object.create(null);
      const names = new Set();
      if (text[index] === '}') {
        index += 1;
        return value;
      }
      while (index < text.length) {
        whitespace();
        if (text[index] !== '"') fail('invalid-json');
        const name = parseString();
        if (names.has(name)) fail('duplicate-json-key');
        names.add(name);
        whitespace();
        if (text[index] !== ':') fail('invalid-json');
        index += 1;
        Object.defineProperty(value, name, {
          value: parseValue(depth + 1),
          enumerable: true,
          configurable: false,
          writable: false,
        });
        whitespace();
        if (text[index] === '}') {
          index += 1;
          return value;
        }
        if (text[index] !== ',') fail('invalid-json');
        index += 1;
      }
      fail('invalid-json');
    }
    if (text[index] === '[') {
      index += 1;
      whitespace();
      const value = [];
      if (text[index] === ']') {
        index += 1;
        return value;
      }
      while (index < text.length) {
        value.push(parseValue(depth + 1));
        whitespace();
        if (text[index] === ']') {
          index += 1;
          return value;
        }
        if (text[index] !== ',') fail('invalid-json');
        index += 1;
      }
      fail('invalid-json');
    }
    const tail = text.slice(index);
    const literal = /^(?:true|false|null)/.exec(tail);
    if (literal) {
      index += literal[0].length;
      if (literal[0] === 'true') return true;
      if (literal[0] === 'false') return false;
      return null;
    }
    const number = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(tail);
    if (number) {
      index += number[0].length;
      const parsed = JSON.parse(number[0]);
      if (!Number.isFinite(parsed)) fail('invalid-json');
      return parsed;
    }
    fail('invalid-json');
  };

  if (typeof text !== 'string') fail('invalid-json');
  const value = parseValue(0);
  whitespace();
  if (index !== text.length) fail('invalid-json');
  return value;
}

function decodeCanonicalBase64url(value, maxBytes) {
  if (typeof value !== 'string' || value.length === 0 || !/^[A-Za-z0-9_-]+$/.test(value)) fail('invalid-jwt');
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.length > maxBytes || decoded.toString('base64url') !== value) fail('invalid-jwt');
  return decoded;
}

function parseCompactJwt(token) {
  if (typeof token !== 'string' || Buffer.byteLength(token, 'ascii') !== token.length || token.length > RESPONSE_LIMITS.token) fail('invalid-jwt');
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) fail('invalid-jwt');
  const headerBytes = decodeCanonicalBase64url(parts[0], 16 * 1024);
  const payloadBytes = decodeCanonicalBase64url(parts[1], RESPONSE_LIMITS.token);
  const signature = decodeCanonicalBase64url(parts[2], 16 * 1024);
  const header = parseJsonUnique(headerBytes.toString('utf8'));
  if (header === null || typeof header !== 'object' || Array.isArray(header)) fail('invalid-jwt-header');
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length === 0 || (Object.hasOwn(header, 'crit') && (!Array.isArray(header.crit) || header.crit.length > 0)) || Object.hasOwn(header, 'b64')) fail('unsupported-jwt-header');
  return { header, payloadBytes, signature, signingInput: `${parts[0]}.${parts[1]}` };
}

function requireStringClaim(claims, name) {
  if (typeof claims[name] !== 'string' || claims[name].length === 0) fail('claim-schema');
}

function validateClaims(claims, expectedAudience, expectedEnvironment, expectedRunAttempt, nowSeconds) {
  if (claims === null || typeof claims !== 'object' || Array.isArray(claims)) fail('claim-schema');
  if (claims.iss !== ISSUER) fail('issuer-mismatch');
  if (typeof claims.aud !== 'string' || claims.aud !== expectedAudience) fail('audience-mismatch');

  const stringClaims = [
    'jti', 'repository_id', 'run_id', 'run_attempt',
    'workflow_ref', 'workflow_sha', 'job_workflow_ref', 'job_workflow_sha',
    'runner_environment', 'environment',
  ];
  for (const name of stringClaims) requireStringClaim(claims, name);
  for (const name of ['repository_id', 'run_id', 'run_attempt']) {
    if (!/^[1-9][0-9]*$/.test(claims[name])) fail('claim-id-invalid');
  }
  if (claims.run_attempt !== expectedRunAttempt) fail('run-attempt-mismatch');
  if (claims.environment !== expectedEnvironment) fail('environment-mismatch');
  if (claims.runner_environment !== 'github-hosted') fail('runner-environment-mismatch');

  for (const name of ['iat', 'nbf', 'exp']) {
    if (typeof claims[name] !== 'number' || !Number.isSafeInteger(claims[name])) fail('claim-time-type');
  }
  if (claims.iat > nowSeconds || claims.nbf > nowSeconds || claims.exp <= nowSeconds || claims.exp <= claims.iat || claims.exp <= claims.nbf) fail('claim-time-invalid');

  return Object.fromEntries([...stringClaims, 'iat', 'nbf', 'exp'].map((name) => [name, typeof claims[name]]));
}

function validateHttpsUrl(raw, code) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(code);
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' || url.hash !== '') fail(code);
  return url;
}

function getHeader(headers, name) {
  if (headers === null || typeof headers !== 'object') return undefined;
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name);
  return key === undefined ? undefined : headers[key];
}

function makeHttpsGet(url, { headers, maxBytes, timeoutMs, signal }) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: 'GET',
      headers,
      rejectUnauthorized: true,
      maxHeaderSize: 16 * 1024,
      agent: false,
    }, (response) => {
      const chunks = [];
      let byteLength = 0;
      response.on('data', (chunk) => {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        byteLength += bytes.length;
        if (byteLength > maxBytes) {
          response.destroy();
          request.destroy();
          reject(new SmokeError('response-too-large'));
          return;
        }
        chunks.push(bytes);
      });
      response.on('end', () => resolve({
        statusCode: response.statusCode || 0,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
      response.on('error', () => reject(new SmokeError('transport-failed')));
    });

    request.setTimeout(timeoutMs, () => request.destroy(new SmokeError('request-timeout')));
    const abort = () => request.destroy(new SmokeError('total-timeout'));
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
    request.on('close', () => signal.removeEventListener('abort', abort));
    request.on('error', (error) => reject(error instanceof SmokeError ? error : new SmokeError('transport-failed')));
    request.end();
  });
}

function raceAbort(promise, signal) {
  if (signal.aborted) return Promise.reject(new SmokeError('total-timeout'));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new SmokeError('total-timeout'));
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

async function runOidcSmoke({ env = process.env, request = makeHttpsGet, nowSeconds = Math.floor(Date.now() / 1000), totalTimeoutMs = TOTAL_TIMEOUT_MS } = {}) {
  const bearer = env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  const rawRequestUrl = env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const expectedAudience = env.A303_OIDC_SMOKE_AUDIENCE;
  const expectedEnvironment = env.A303_EXPECTED_GITHUB_ENVIRONMENT;
  const expectedOidcOrigin = env.A303_EXPECTED_OIDC_ORIGIN;
  const runAttempt = env.GITHUB_RUN_ATTEMPT;
  if (typeof bearer !== 'string' || bearer.length === 0) fail('missing-runtime-credential');
  if (typeof expectedEnvironment !== 'string' || expectedEnvironment.length === 0) fail('missing-environment-policy');
  if (typeof expectedOidcOrigin !== 'string' || expectedOidcOrigin.length === 0) fail('missing-oidc-origin-policy');
  if (runAttempt !== '1') fail('rerun-not-authorized');
  if (typeof expectedAudience !== 'string' || !expectedAudience.startsWith(AUDIENCE_PREFIX) || expectedAudience.length !== AUDIENCE_PREFIX.length + 43 || !/^[A-Za-z0-9_-]{43}$/.test(expectedAudience.slice(AUDIENCE_PREFIX.length))) fail('invalid-smoke-audience');

  const oidcBaseUrl = validateHttpsUrl(rawRequestUrl, 'invalid-runtime-url');
  const expectedOriginUrl = validateHttpsUrl(expectedOidcOrigin, 'invalid-oidc-origin-policy');
  if (expectedOriginUrl.origin !== expectedOidcOrigin || oidcBaseUrl.origin !== expectedOriginUrl.origin) fail('runtime-origin-mismatch');
  if (oidcBaseUrl.searchParams.has('audience')) fail('runtime-url-has-audience');
  const oidcRequestUrl = new URL(oidcBaseUrl.toString());
  oidcRequestUrl.searchParams.set('audience', expectedAudience);
  if (oidcRequestUrl.origin !== oidcBaseUrl.origin) fail('runtime-origin-changed');

  const controller = new AbortController();
  const totalTimer = setTimeout(() => controller.abort(), totalTimeoutMs);
  const counts = { total: 0, token: 0, discovery: 0, jwks: 0 };
  const requestJson = async (kind, url, headers = {}) => {
    if (counts.total >= REQUEST_LIMIT || counts[kind] >= 1) fail('request-budget-exceeded');
    const parsedUrl = validateHttpsUrl(String(url), 'invalid-request-url');
    counts.total += 1;
    counts[kind] += 1;
    const maxBytes = RESPONSE_LIMITS[kind];
    const promise = Promise.resolve().then(() => request(parsedUrl, {
      method: 'GET',
      headers,
      maxBytes,
      timeoutMs: REQUEST_TIMEOUT_MS,
      followRedirects: false,
      retries: 0,
      signal: controller.signal,
    }));
    let response;
    try {
      response = await raceAbort(promise, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) fail('total-timeout');
      if (error instanceof SmokeError && error.code === 'request-timeout') fail('request-timeout');
      fail('transport-failed');
    }
    const body = Buffer.isBuffer(response.body) ? response.body : Buffer.from(response.body || '');
    if (body.length > maxBytes) fail('response-too-large');
    if (response.statusCode >= 300 && response.statusCode < 400) fail('redirect-rejected');
    if (response.statusCode !== 200) fail('http-status-rejected');
    const contentType = getHeader(response.headers, 'content-type');
    if (typeof contentType !== 'string' || !/^application\/json(?:\s*;|\s*$)/i.test(contentType)) fail('content-type-rejected');
    return parseJsonUnique(body.toString('utf8'));
  };

  try {
    const tokenResponse = await requestJson('token', oidcRequestUrl, {
      accept: 'application/json',
      authorization: `Bearer ${bearer}`,
    });
    if (tokenResponse === null || typeof tokenResponse !== 'object' || typeof tokenResponse.value !== 'string') fail('token-response-invalid');
    const compact = parseCompactJwt(tokenResponse.value);

    const discovery = await requestJson('discovery', DISCOVERY_URL, { accept: 'application/json' });
    if (discovery === null || discovery.issuer !== ISSUER || !Array.isArray(discovery.id_token_signing_alg_values_supported) || !discovery.id_token_signing_alg_values_supported.includes('RS256')) fail('discovery-invalid');
    const jwksUrl = validateHttpsUrl(discovery.jwks_uri, 'discovery-jwks-url-invalid');
    const issuerOrigin = new URL(ISSUER).origin;
    if (jwksUrl.origin !== issuerOrigin || jwksUrl.href !== JWKS_URL) fail('discovery-jwks-origin-invalid');

    const jwks = await requestJson('jwks', jwksUrl, { accept: 'application/json' });
    if (jwks === null || !Array.isArray(jwks.keys)) fail('jwks-invalid');
    const keyIds = jwks.keys.filter((key) => key !== null && typeof key === 'object' && typeof key.kid === 'string').map((key) => key.kid);
    if (new Set(keyIds).size !== keyIds.length) fail('jwks-duplicate-kid');
    const candidates = jwks.keys.filter((key) => key !== null && typeof key === 'object' && key.kid === compact.header.kid);
    if (candidates.length !== 1) fail('jwks-kid-not-found');
    const jwk = candidates[0];
    if (jwk.kty !== 'RSA' || jwk.alg !== 'RS256' || jwk.use !== 'sig' || typeof jwk.n !== 'string' || typeof jwk.e !== 'string') fail('jwks-key-invalid');

    let publicKey;
    try {
      publicKey = crypto.createPublicKey({ key: { kty: 'RSA', n: jwk.n, e: jwk.e }, format: 'jwk' });
    } catch {
      fail('jwks-key-invalid');
    }
    if (publicKey.asymmetricKeyDetails?.modulusLength < 2048) fail('jwks-key-invalid');
    const signatureOk = crypto.verify('RSA-SHA256', Buffer.from(compact.signingInput, 'ascii'), publicKey, compact.signature);
    if (!signatureOk) fail('signature-invalid');

    const claims = parseJsonUnique(compact.payloadBytes.toString('utf8'));
    const claimTypes = validateClaims(claims, expectedAudience, expectedEnvironment, runAttempt, nowSeconds);
    return {
      ok: true,
      issuerSignatureVerified: true,
      audienceMatches: true,
      claimTypes,
      requestBudget: { limit: REQUEST_LIMIT, used: counts.total, redirectsFollowed: 0, retries: 0 },
      limits: {
        perRequestTimeoutMs: REQUEST_TIMEOUT_MS,
        totalTimeoutMs,
        bodyBytes: RESPONSE_LIMITS,
      },
    };
  } catch (error) {
    if (controller.signal.aborted) fail('total-timeout');
    if (error instanceof SmokeError) throw error;
    fail('smoke-failed');
  } finally {
    clearTimeout(totalTimer);
  }
}

if (require.main === module) {
  runOidcSmoke().then((result) => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }).catch((error) => {
    process.stdout.write(`${JSON.stringify({ ok: false, code: error instanceof SmokeError ? error.code : 'smoke-failed' })}\n`);
    process.exitCode = 1;
  });
}

module.exports = { runOidcSmoke };
