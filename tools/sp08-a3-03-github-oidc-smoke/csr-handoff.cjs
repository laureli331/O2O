'use strict';

const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const fail = (code) => { throw new Error(code); };
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const verifiedReturnRuns = new WeakSet();

function requireVerifiedReturnRun(value) {
  if (!value || !verifiedReturnRuns.has(value)) fail('return-run-evidence-unverified');
  return value;
}

function csrPublicKey(csrBytes, { pwshPath, timeoutMs }) {
  if (typeof pwshPath !== 'string' || pwshPath.length === 0) fail('pwsh-path-required');
  const parser = path.join(__dirname, 'read-csr-spki.ps1');
  const result = spawnSync(pwshPath, ['-NoProfile', '-NonInteractive', '-File', parser], {
    input: csrBytes,
    encoding: 'buffer',
    timeout: timeoutMs,
    maxBuffer: 16384,
    windowsHide: true,
    shell: false,
  });
  if (result.error || result.status !== 0 || result.stdout.byteLength < 1 || result.stdout.byteLength > 8192) fail('csr-signature-invalid-or-parser-failed');
  const encoded = result.stdout.toString('ascii').trim();
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) fail('csr-spki-output-invalid');
  return Buffer.from(encoded, 'base64');
}

function validateBudget(budget) {
  if (!isRecord(budget)) fail('budget-invalid');
  for (const key of ['maxPolls', 'maxPages', 'maxCandidates', 'maxArtifactBytes', 'maxWaitMs', 'requestTimeoutMs']) {
    if (!Number.isSafeInteger(budget[key]) || budget[key] < 1) fail(`budget-${key}-invalid`);
  }
  const delays = budget.pollDelaysMs || Array.from({ length: budget.maxPolls }, (_, index) => index === 0 ? 0 : budget.pollIntervalMs);
  if (!Array.isArray(delays) || delays.length !== budget.maxPolls || delays.some((delay) => !Number.isSafeInteger(delay) || delay < 0)) fail('budget-poll-delays-invalid');
  if (budget.maxPolls * budget.maxPages > 4 || budget.maxWaitMs > 300000 || budget.requestTimeoutMs > 30000 || delays.reduce((sum, value) => sum + value, 0) > budget.maxWaitMs) fail('budget-exceeds-hard-limit');
  return Object.freeze({ ...budget, pollDelaysMs: Object.freeze([...delays]), maxListRequests: budget.maxPolls * budget.maxPages });
}

function selectSourceRun(runs, expected, budget) {
  const bounded = validateBudget(budget);
  if (!Array.isArray(runs) || runs.length > bounded.maxCandidates) fail('candidate-count-limit');
  if (!isRecord(expected) || !/^[0-9]+$/.test(expected.repositoryId) || !/^[a-f0-9]{40,64}$/.test(expected.trustedHeadSha) || !/^[0-9]+$/.test(expected.actorId) || typeof expected.actorLogin !== 'string' || typeof expected.workflowPath !== 'string' || !expected.workflowPath.startsWith('.github/workflows/')) fail('expected-source-invalid');
  const valid = runs.filter((run) => isRecord(run)
    && run.event === 'workflow_dispatch' && run.status === 'completed' && run.conclusion === 'success'
    && String(run.repository?.id) === expected.repositoryId
    && run.path === expected.workflowPath && run.head_sha === expected.trustedHeadSha
    && run.run_attempt === 1
    && String(run.actor?.id) === expected.actorId && run.actor?.login === expected.actorLogin
    && typeof run.created_at === 'string' && Number.isFinite(Date.parse(run.created_at))
    && Date.parse(run.created_at) >= expected.notBeforeMs && Date.parse(run.created_at) <= expected.notAfterMs);
  if (valid.length !== 1) fail(valid.length ? 'source-run-ambiguous' : 'source-run-not-found');
  return valid[0];
}

async function waitForReturnRun({ token, repository, workflowId, expected, budget, fetchImpl, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), deadline, now = Date.now }) {
  const bounded = validateBudget(budget);
  if (typeof token !== 'string' || token.length < 1 || token.length > 4096 || typeof repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !/^[A-Za-z0-9_.-]+$/.test(workflowId) || typeof fetchImpl !== 'function') fail('poll-configuration-invalid');
  const origin = 'https://api.github.com';
  const endpoint = `${origin}/repos/${repository}/actions/workflows/${workflowId}/runs?event=workflow_dispatch&status=completed&per_page=${bounded.maxCandidates}&page=1`;
  const validateResponse = (response) => {
    if (!response || response.status !== 200 || response.url && new URL(response.url).origin !== origin) fail('poll-http-failed');
    if (typeof response.json !== 'function') fail('poll-response-invalid');
  };
  const request = async () => {
    if (deadline === undefined) {
      const response = await fetchImpl(endpoint, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(bounded.requestTimeoutMs), headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28' } });
      validateResponse(response);
      return { response, body: await response.json() };
    }
    const remaining = deadline - now();
    if (!Number.isSafeInteger(remaining) || remaining <= 0) fail('poll-deadline-expired');
    const controller = new AbortController();
    let timer;
    try {
      const pending = Promise.resolve().then(async () => {
        const response = await fetchImpl(endpoint, { method: 'GET', redirect: 'error', signal: controller.signal, headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28' } });
        if (now() >= deadline) fail('poll-deadline-unknown');
        validateResponse(response);
        const body = await response.json();
        if (now() >= deadline) fail('poll-deadline-unknown');
        return { response, body };
      });
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('poll-timeout')); }, Math.min(remaining, bounded.requestTimeoutMs)); });
      const result = await Promise.race([pending, timeout]);
      if (now() >= deadline) fail('poll-deadline-unknown');
      return result;
    } catch { fail('poll-deadline-unknown'); }
    finally { if (timer) clearTimeout(timer); }
  };
  for (let poll = 0; poll < bounded.maxPolls; poll += 1) {
    if (deadline !== undefined) {
      if (!Number.isSafeInteger(deadline) || typeof now !== 'function') fail('poll-deadline-invalid');
      const remaining = deadline - now();
      if (remaining <= 0) fail('poll-deadline-expired');
      const delay = Math.min(bounded.pollDelaysMs[poll], remaining);
      if (delay > 0) await sleep(delay);
      if (now() >= deadline) fail('poll-deadline-expired');
    } else if (bounded.pollDelaysMs[poll] > 0) await sleep(bounded.pollDelaysMs[poll]);
    const { response, body } = await request();
    if (!response || response.status !== 200 || response.url && new URL(response.url).origin !== origin) fail('poll-http-failed');
    const link = response.headers?.get?.('link');
    if (link) fail('poll-pagination-limit');
    if (!isRecord(body) || !Array.isArray(body.workflow_runs) || body.workflow_runs.length > bounded.maxCandidates || !Number.isSafeInteger(body.total_count)) fail('poll-response-invalid');
    const matching = body.workflow_runs.filter((run) => isRecord(run)
      && run.event === 'workflow_dispatch' && run.status === 'completed' && run.conclusion === 'success'
      && String(run.repository?.full_name) === repository && run.path === expected.workflowPath
      && run.head_sha === expected.trustedHeadSha && run.run_attempt === 1
      && String(run.actor?.id) === expected.actorId && run.actor?.login === expected.actorLogin
      && (expected.headBranch === undefined || run.head_branch === expected.headBranch)
      && typeof run.created_at === 'string' && Date.parse(run.created_at) >= expected.notBeforeMs && Date.parse(run.created_at) <= expected.notAfterMs);
    if (matching.length > 1) fail('return-run-ambiguous');
    if (matching.length === 1) {
      const selected = Object.freeze({ runId: String(matching[0].id), attempt: matching[0].run_attempt, headSha: matching[0].head_sha,
        workflowPath: matching[0].path, headBranch: matching[0].head_branch, repository, actorId: expected.actorId, actorLogin: expected.actorLogin });
      verifiedReturnRuns.add(selected);
      return selected;
    }
  }
  fail('return-run-timeout');
}

function verifyCertificateBinding({ csrBytes, expectedCsrSha256, leafPem, caPem, expectedCaFingerprint256, privateKeyPem, pwshPath, now = Date.now(), maxBytes = 65536, timeoutMs = 5000 }) {
  for (const [label, value] of Object.entries({ csrBytes, leafPem, caPem, privateKeyPem })) {
    const size = Buffer.isBuffer(value) ? value.byteLength : Buffer.byteLength(value || '');
    if (size < 1 || size > maxBytes) fail(`${label}-size-limit`);
  }
  const csrDigest = crypto.createHash('sha256').update(csrBytes).digest('hex');
  if (csrDigest !== expectedCsrSha256) fail('csr-digest-mismatch');
  const ca = new crypto.X509Certificate(caPem);
  const leaf = new crypto.X509Certificate(leafPem);
  if (ca.raw.equals(leaf.raw)) fail('ca-must-not-be-leaf');
  const caFingerprint = ca.fingerprint256.replaceAll(':', '').toLowerCase();
  if (caFingerprint !== expectedCaFingerprint256.toLowerCase()) fail('ca-fingerprint-mismatch');
  if (!leaf.verify(ca.publicKey) || !leaf.checkIssued(ca)) fail('certificate-chain-invalid');
  if (!Array.isArray(leaf.keyUsage) || !leaf.keyUsage.includes('1.3.6.1.5.5.7.3.2')) fail('client-auth-eku-required');
  const timestamp = new Date(now);
  if (timestamp < new Date(leaf.validFrom) || timestamp > new Date(leaf.validTo)) fail('certificate-expired-or-not-yet-valid');
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const derivedPublicKey = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  const leafPublicKey = leaf.publicKey.export({ type: 'spki', format: 'der' });
  const csrKey = csrPublicKey(csrBytes, { pwshPath, timeoutMs });
  if (csrKey.byteLength !== leafPublicKey.byteLength || !crypto.timingSafeEqual(csrKey, leafPublicKey)) fail('csr-leaf-public-key-mismatch');
  if (!crypto.timingSafeEqual(derivedPublicKey, leafPublicKey)) fail('leaf-private-key-mismatch');
  return Object.freeze({ csrSha256: csrDigest, caFingerprint256: caFingerprint, leafFingerprint256: leaf.fingerprint256.replaceAll(':', '').toLowerCase() });
}

function verifyPublicCertificateBinding({ csrBytes, expectedCsrSha256, leafPem, caPem, expectedCaFingerprint256, pwshPath, now = Date.now(), maxBytes = 65536, timeoutMs = 5000 }) {
  for (const [label, value] of Object.entries({ csrBytes, leafPem, caPem })) {
    const size = Buffer.isBuffer(value) ? value.byteLength : Buffer.byteLength(value || '');
    if (size < 1 || size > maxBytes) fail(`${label}-size-limit`);
  }
  if (typeof expectedCsrSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(expectedCsrSha256)
    || crypto.createHash('sha256').update(csrBytes).digest('hex') !== expectedCsrSha256) fail('csr-digest-mismatch');
  if (typeof expectedCaFingerprint256 !== 'string' || !/^[a-f0-9]{64}$/i.test(expectedCaFingerprint256)) fail('ca-fingerprint-invalid');
  const ca = new crypto.X509Certificate(caPem);
  const leaf = new crypto.X509Certificate(leafPem);
  if (ca.raw.equals(leaf.raw)) fail('ca-must-not-be-leaf');
  const caFingerprint = ca.fingerprint256.replaceAll(':', '').toLowerCase();
  if (caFingerprint !== expectedCaFingerprint256.toLowerCase()) fail('ca-fingerprint-mismatch');
  if (!leaf.verify(ca.publicKey) || !leaf.checkIssued(ca)) fail('certificate-chain-invalid');
  if (!Array.isArray(leaf.keyUsage) || !leaf.keyUsage.includes('1.3.6.1.5.5.7.3.2')) fail('client-auth-eku-required');
  const timestamp = new Date(now);
  if (timestamp < new Date(leaf.validFrom) || timestamp > new Date(leaf.validTo)) fail('certificate-expired-or-not-yet-valid');
  const csrKey = csrPublicKey(csrBytes, { pwshPath, timeoutMs });
  const leafKey = leaf.publicKey.export({ type: 'spki', format: 'der' });
  if (csrKey.byteLength !== leafKey.byteLength || !crypto.timingSafeEqual(csrKey, leafKey)) fail('csr-leaf-public-key-mismatch');
  return Object.freeze({ csrSha256: expectedCsrSha256, caFingerprint256: caFingerprint, leafFingerprint256: leaf.fingerprint256.replaceAll(':', '').toLowerCase() });
}

module.exports = { csrPublicKey, requireVerifiedReturnRun, selectSourceRun, validateBudget, verifyCertificateBinding, verifyPublicCertificateBinding, waitForReturnRun };
