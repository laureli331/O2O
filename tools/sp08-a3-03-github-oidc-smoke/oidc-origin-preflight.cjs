'use strict';

const { isIP } = require('node:net');
const { URL } = require('node:url');
const fs = require('node:fs');

const MAX_RUNTIME_URL_BYTES = 8 * 1024;
const LOCAL_SUFFIXES = Object.freeze([
  '.localhost',
  '.local',
  '.internal',
  '.test',
  '.invalid',
  '.example',
  '.home.arpa',
]);

function failure(code) {
  return { ok: false, code, networkRequestPerformed: false, tokenRequestPerformed: false };
}

function isDnsHostname(hostname) {
  if (hostname.length > 253 || hostname.endsWith('.') || !hostname.includes('.') || isIP(hostname) !== 0) return false;
  if (LOCAL_SUFFIXES.some((suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix))) return false;
  const labels = hostname.split('.');
  return labels.every((label) => label.length > 0
    && label.length <= 63
    && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label));
}

function inspectRuntimeOidcOrigin(env = process.env) {
  const rawUrl = env.ACTIONS_ID_TOKEN_REQUEST_URL;
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) return failure('missing-runtime-url');
  if (Buffer.byteLength(rawUrl, 'utf8') > MAX_RUNTIME_URL_BYTES) return failure('runtime-url-too-large');

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return failure('runtime-url-invalid');
  }

  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' || url.hash !== '') {
    return failure('runtime-url-unsafe');
  }
  if (url.port !== '' || !isDnsHostname(url.hostname)) return failure('runtime-origin-unsafe');
  if (url.searchParams.has('audience')) return failure('runtime-url-audience-present');

  return {
    ok: true,
    observedAt: new Date().toISOString(),
    origin: url.origin,
    hostname: url.hostname,
    port: 443,
    originCheck: 'bound-to-runner-injected-url',
    networkRequestPerformed: false,
    tokenRequestPerformed: false,
  };
}

if (require.main === module) {
  let result = inspectRuntimeOidcOrigin();
  if (result.ok && typeof process.env.GITHUB_OUTPUT === 'string' && process.env.GITHUB_OUTPUT.length > 0) {
    try {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `origin=${result.origin}\n`, 'utf8');
    } catch {
      result = failure('github-output-write-failed');
    }
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.ok) process.exitCode = 1;
}

module.exports = { inspectRuntimeOidcOrigin };
