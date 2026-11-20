'use strict';

const crypto = require('node:crypto');

const fail = (code) => { throw new Error(code); };
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function readDerNode(bytes, offset, limit) {
  if (offset + 2 > limit) fail('csr-der-invalid');
  const tag = bytes[offset];
  let length = bytes[offset + 1];
  let headerLength = 2;
  if ((length & 0x80) !== 0) {
    const count = length & 0x7f;
    if (count < 1 || count > 4 || offset + 2 + count > limit || bytes[offset + 2] === 0) fail('csr-der-invalid');
    length = 0;
    for (let index = 0; index < count; index += 1) length = length * 256 + bytes[offset + 2 + index];
    if (length < 128) fail('csr-der-invalid');
    headerLength += count;
  }
  const start = offset + headerLength;
  const end = start + length;
  if (end > limit || end < start) fail('csr-der-invalid');
  return { tag, start, end };
}

function csrPublicKey(csrBytes) {
  const pem = csrBytes.toString('ascii');
  const match = /^-----BEGIN CERTIFICATE REQUEST-----\s*([A-Za-z0-9+/=\r\n]+)\s*-----END CERTIFICATE REQUEST-----\s*$/.exec(pem);
  if (!match) fail('csr-pem-invalid');
  const der = Buffer.from(match[1].replace(/\s/g, ''), 'base64');
  const outer = readDerNode(der, 0, der.length);
  if (outer.tag !== 0x30 || outer.end !== der.length) fail('csr-der-invalid');
  const info = readDerNode(der, outer.start, outer.end);
  if (info.tag !== 0x30) fail('csr-der-invalid');
  const version = readDerNode(der, info.start, info.end);
  const subject = readDerNode(der, version.end, info.end);
  const spki = readDerNode(der, subject.end, info.end);
  if (spki.tag !== 0x30) fail('csr-der-invalid');
  return der.subarray(subject.end, spki.end);
}

function validateBudget(budget) {
  if (!isRecord(budget)) fail('budget-invalid');
  for (const key of ['maxPolls', 'maxPages', 'maxCandidates', 'maxArtifactBytes', 'maxWaitMs', 'pollIntervalMs']) {
    if (!Number.isSafeInteger(budget[key]) || budget[key] < 1) fail(`budget-${key}-invalid`);
  }
  if (budget.maxPolls * budget.maxPages > 4 || budget.maxWaitMs > 300000 || budget.pollIntervalMs > budget.maxWaitMs) fail('budget-exceeds-hard-limit');
  return Object.freeze({ ...budget, maxListRequests: budget.maxPolls * budget.maxPages });
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

function verifyCertificateBinding({ csrBytes, expectedCsrSha256, leafPem, caPem, expectedCaFingerprint256, privateKeyPem, now = Date.now(), maxBytes = 65536 }) {
  for (const [label, value] of Object.entries({ csrBytes, leafPem, caPem, privateKeyPem })) {
    const size = Buffer.isBuffer(value) ? value.byteLength : Buffer.byteLength(value || '');
    if (size < 1 || size > maxBytes) fail(`${label}-size-limit`);
  }
  const csrDigest = crypto.createHash('sha256').update(csrBytes).digest('hex');
  if (csrDigest !== expectedCsrSha256) fail('csr-digest-mismatch');
  const ca = new crypto.X509Certificate(caPem);
  const leaf = new crypto.X509Certificate(leafPem);
  const caFingerprint = ca.fingerprint256.replaceAll(':', '').toLowerCase();
  if (caFingerprint !== expectedCaFingerprint256.toLowerCase()) fail('ca-fingerprint-mismatch');
  if (!leaf.verify(ca.publicKey) || !leaf.checkIssued(ca)) fail('certificate-chain-invalid');
  const timestamp = new Date(now);
  if (timestamp < new Date(leaf.validFrom) || timestamp > new Date(leaf.validTo)) fail('certificate-expired-or-not-yet-valid');
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const derivedPublicKey = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  const leafPublicKey = leaf.publicKey.export({ type: 'spki', format: 'der' });
  const csrKey = csrPublicKey(csrBytes);
  if (csrKey.byteLength !== leafPublicKey.byteLength || !crypto.timingSafeEqual(csrKey, leafPublicKey)) fail('csr-leaf-public-key-mismatch');
  if (!crypto.timingSafeEqual(derivedPublicKey, leafPublicKey)) fail('leaf-private-key-mismatch');
  return Object.freeze({ csrSha256: csrDigest, caFingerprint256: caFingerprint, leafFingerprint256: leaf.fingerprint256.replaceAll(':', '').toLowerCase() });
}

module.exports = { selectSourceRun, validateBudget, verifyCertificateBinding };
