'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { verifyCertificateBinding } = require('./csr-handoff.cjs');
const { requireConfiguredPolicy } = require('./handoff-policy.cjs');
const { runLocalAClient } = require('./a-segment-local.cjs');
const { runApprovedAClient } = require('./a-segment-local.cjs');

function verifyReturn({ tempDir, artifactDir, runId, runAttempt, commit, returnRunId, pwshPath, onVerifiedMaterial, policy: suppliedPolicy }) {
  const policy = requireConfiguredPolicy(suppliedPolicy);
  const manifest = JSON.parse(fs.readFileSync(path.join(tempDir, 'source-manifest.json'), 'utf8'));
  const binding = JSON.parse(fs.readFileSync(path.join(artifactDir, 'binding.json'), 'utf8'));
  if (JSON.stringify(Object.keys(binding).sort()) !== JSON.stringify(['csr_sha256', 'source_commit', 'source_job_id', 'source_run_attempt', 'source_run_id', 'source_started_at'].sort())) throw new Error('return-binding-fields-invalid');
  for (const data of [manifest, binding]) {
    if (data.source_run_id !== runId || data.source_job_id !== 'source-csr' || data.source_run_attempt !== runAttempt || data.source_commit !== commit || data.source_started_at !== manifest.source_started_at) throw new Error('return-source-binding-mismatch');
  }
  if (manifest.csr_sha256 !== binding.csr_sha256) throw new Error('return-csr-digest-binding-mismatch');
  const csrBytes = fs.readFileSync(path.join(tempDir, 'source.csr.pem'));
  if (crypto.createHash('sha256').update(csrBytes).digest('hex') !== binding.csr_sha256) throw new Error('source-csr-digest-mismatch');
  const leafPem = fs.readFileSync(path.join(artifactDir, 'leaf.pem'), 'utf8');
  const caPem = fs.readFileSync(path.join(artifactDir, 'ca.pem'), 'utf8');
  const privateKeyPem = fs.readFileSync(path.join(tempDir, 'source.key.pem'), 'utf8');
  const verified = verifyCertificateBinding({ csrBytes, expectedCsrSha256: binding.csr_sha256, leafPem, caPem, expectedCaFingerprint256: policy.caFingerprint256, privateKeyPem, pwshPath });
  if (!/^[1-9][0-9]{0,19}$/.test(returnRunId)) throw new Error('return-run-id-invalid');
  if (onVerifiedMaterial !== undefined) {
    if (typeof onVerifiedMaterial !== 'function') throw new Error('verified-material-callback-invalid');
    onVerifiedMaterial(Object.freeze({ leafPem, caPem, privateKeyPem, csrBytes: Buffer.from(csrBytes), binding: Object.freeze({ ...binding }), verified }));
  }
  return Object.freeze({ accepted: true });
}

async function verifyReturnAndRunLocalA({ verifyOptions, identity, request, policy, env, runtimeRequest, tlsOptions }) {
  if (!tlsOptions || tlsOptions.host !== '127.0.0.1' || 'key' in tlsOptions || 'cert' in tlsOptions || 'ca' in tlsOptions) throw new Error('local-client-policy-missing');
  let clientPromise;
  verifyReturn({ ...verifyOptions, onVerifiedMaterial: (material) => {
    clientPromise = runLocalAClient({ identity, request, policy, env, runtimeRequest,
      tlsOptions: { ...tlsOptions, key: material.privateKeyPem, cert: material.leafPem, ca: material.caPem } });
  } });
  if (!clientPromise) throw new Error('verified-material-missing');
  return await clientPromise;
}

async function verifyReturnAndRunApprovedA({ verifyOptions, identity, request, policy, env, runtimeRequest, approvedTarget, authorizationDeadline }) {
  if (!approvedTarget || typeof approvedTarget.ipv4 !== 'string' || approvedTarget.port !== 8443
    || policy?.serverIPv4 !== approvedTarget.ipv4) throw new Error('approved-target-policy-invalid');
  let clientPromise;
  verifyReturn({ ...verifyOptions, onVerifiedMaterial: (material) => {
    clientPromise = runApprovedAClient({ identity, request, policy, env, runtimeRequest,
      approvedTarget, authorizationDeadline,
      tlsOptions: { host: approvedTarget.ipv4, port: 8443, minVersion: 'TLSv1.3', maxVersion: 'TLSv1.3', rejectUnauthorized: true,
        key: material.privateKeyPem, cert: material.leafPem, ca: material.caPem } });
  } });
  if (!clientPromise) throw new Error('verified-material-missing');
  return await clientPromise;
}

if (require.main === module) {
  try {
    const result = verifyReturn({ tempDir: process.env.RUNNER_TEMP, artifactDir: path.join(process.env.RUNNER_TEMP, 'a303-return'), runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, commit: process.env.GITHUB_SHA, returnRunId: process.env.A303_RETURN_RUN_ID, pwshPath: process.env.A303_PWSH });
    process.stdout.write(`certificate=${result.accepted ? 'accepted' : 'rejected'}\n`);
  } catch (error) { process.stderr.write(`certificate-rejected:${error.message}\n`); process.exitCode = 1; }
}

module.exports = { verifyReturn, verifyReturnAndRunLocalA, verifyReturnAndRunApprovedA };
