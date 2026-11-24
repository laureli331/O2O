'use strict';

const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');

const ENDPOINT = 'https://api.ipify.org/';
const MAX_BODY_BYTES = 64;
const MAX_AGE_MS = 5 * 60 * 1000;
const TOTAL_TIMEOUT_MS = 10000;

function fail(code) { throw new Error(code); }

function isUsablePublicIpv4(value) {
  if (typeof value !== 'string' || net.isIP(value) !== 4) return false;
  const octets = value.split('.').map(Number);
  const [a, b, c] = octets;
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return !(a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 0 || b === 2 || b === 168))
    || (a === 192 && b === 88 && c === 99)
    || (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100))
    || (a === 203 && b === 0 && c === 113));
}

function validateContext(context) {
  if (!context || !/^[1-9][0-9]{0,19}$/.test(context.runId)
    || context.runAttempt !== '1' || !/^[a-f0-9]{40,64}$/.test(context.workflowSha)
    || !/^[a-f0-9]{64}$/.test(context.csrSha256)) fail('egress-context-invalid');
}

function requestPublicIpv4(request = https.get, totalTimeoutMs = TOTAL_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let req;
    let res;
    const timer = setTimeout(() => finish(new Error('egress-total-timeout')), totalTimeoutMs);
    const done = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        if (res && typeof res.destroy === 'function') res.destroy();
        if (req && typeof req.destroy === 'function') req.destroy();
      }
      if (error) reject(error); else resolve(value);
    };
    const finish = done;
    try {
      req = request(ENDPOINT, { timeout: 5000, headers: { accept: 'text/plain' } }, (response) => {
        res = response;
        if (response.statusCode !== 200 || response.headers.location !== undefined) {
          done(new Error('egress-http-response-rejected')); return;
        }
        const chunks = [];
        let bytes = 0;
        response.on('data', (chunk) => {
          const raw = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          bytes += raw.length;
          if (bytes > MAX_BODY_BYTES) { done(new Error('egress-response-too-large')); return; }
          chunks.push(raw);
        });
        response.on('end', () => {
          const body = Buffer.concat(chunks);
          if (body.some((byte) => byte > 0x7f)) { done(new Error('egress-response-nonascii')); return; }
          const ip = body.toString('ascii').trim();
          if (!isUsablePublicIpv4(ip)) { done(new Error('egress-ip-invalid')); return; }
          done(null, ip);
        });
        response.on('error', () => done(new Error('egress-response-failed')));
      });
    } catch { done(new Error('egress-request-failed')); return; }
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', () => done(new Error('egress-request-failed')));
  });
}

async function createEgressManifest({ context, outputFile, now = () => new Date(), request }) {
  validateContext(context);
  if (!outputFile) fail('egress-output-required');
  const ip = await requestPublicIpv4(request);
  const queriedAt = now();
  if (!(queriedAt instanceof Date) || !Number.isFinite(queriedAt.getTime())) fail('egress-time-invalid');
  const manifest = {
    schema: 'sp08-a303-egress-ip-v1',
    source_run_id: context.runId,
    source_run_attempt: context.runAttempt,
    workflow_sha: context.workflowSha,
    csr_sha256: context.csrSha256,
    query_source: 'https://api.ipify.org/',
    queried_at: queriedAt.toISOString(),
    ipv4: ip,
    cidr_suggestion: `${ip}/32`,
    expires_at: new Date(queriedAt.getTime() + MAX_AGE_MS).toISOString(),
    identity_note: 'Public IP observation only; not an identity credential or authorization.'
  };
  fs.writeFileSync(outputFile, JSON.stringify(manifest), { flag: 'wx', mode: 0o600 });
  return manifest;
}

function verifyEgressManifest(value, expected, now = new Date()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('egress-manifest-invalid');
  const keys = ['schema', 'source_run_id', 'source_run_attempt', 'workflow_sha', 'csr_sha256', 'query_source', 'queried_at', 'ipv4', 'cidr_suggestion', 'expires_at', 'identity_note'];
  if (Object.keys(value).sort().join('|') !== keys.slice().sort().join('|')) fail('egress-manifest-schema-invalid');
  validateContext({ runId: value.source_run_id, runAttempt: value.source_run_attempt, workflowSha: value.workflow_sha, csrSha256: value.csr_sha256 });
  if (!expected || value.source_run_id !== expected.runId || value.source_run_attempt !== expected.runAttempt
    || value.workflow_sha !== expected.workflowSha || value.csr_sha256 !== expected.csrSha256) fail('egress-binding-mismatch');
  if (value.schema !== 'sp08-a303-egress-ip-v1' || value.query_source !== ENDPOINT
    || value.identity_note !== 'Public IP observation only; not an identity credential or authorization.'
    || !isUsablePublicIpv4(value.ipv4) || value.cidr_suggestion !== `${value.ipv4}/32`) fail('egress-manifest-content-invalid');
  const queried = Date.parse(value.queried_at);
  const expires = Date.parse(value.expires_at);
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail('egress-now-invalid');
  const isoMillis = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
  if (!isoMillis.test(value.queried_at) || !isoMillis.test(value.expires_at)
    || !Number.isFinite(queried) || !Number.isFinite(expires) || expires - queried !== MAX_AGE_MS
    || queried > now.getTime() || expires <= now.getTime()) fail('egress-manifest-time-invalid');
  return value.cidr_suggestion;
}

function readExpectedContext(file) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join('|') !== ['csrSha256', 'runAttempt', 'runId', 'workflowSha'].sort().join('|')) fail('egress-expected-context-invalid');
  validateContext(value);
  return value;
}

function verifyManifestFile(manifestFile, expectedContextFile, now = new Date()) {
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const expected = readExpectedContext(expectedContextFile);
  return verifyEgressManifest(manifest, expected, now);
}

if (require.main === module) {
  (async () => {
    try {
      if (process.argv[2] === 'verify') {
        if (process.argv.length !== 5) fail('egress-verify-usage');
        process.stdout.write(`${verifyManifestFile(process.argv[3], process.argv[4])}\n`);
        return;
      }
      const { RUNNER_TEMP, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, GITHUB_WORKFLOW_SHA, GITHUB_OUTPUT } = process.env;
      if (!RUNNER_TEMP || !GITHUB_OUTPUT || !process.env.A303_CSR_SHA256) fail('egress-runner-context-required');
      const outputFile = path.join(RUNNER_TEMP, 'egress-ip-manifest.json');
      const manifest = await createEgressManifest({
        context: { runId: GITHUB_RUN_ID, runAttempt: GITHUB_RUN_ATTEMPT, workflowSha: GITHUB_WORKFLOW_SHA, csrSha256: process.env.A303_CSR_SHA256 },
        outputFile
      });
      fs.appendFileSync(GITHUB_OUTPUT, `egress_ipv4=${manifest.ipv4}\negress_manifest=${outputFile}\n`, 'utf8');
      process.stdout.write('egress-ip=observed; identity=unverified\n');
    } catch (error) { process.stderr.write(`egress-ip-rejected:${error.message}\n`); process.exitCode = 1; }
  })();
}

module.exports = { createEgressManifest, isUsablePublicIpv4, readExpectedContext, requestPublicIpv4, verifyEgressManifest, verifyManifestFile };
