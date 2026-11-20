'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { verifyCertificateBinding } = require('./csr-handoff.cjs');
const { requireConfiguredPolicy } = require('./handoff-policy.cjs');

function verifyReturn({ tempDir, artifactDir, runId, runAttempt, commit, returnRunId, pwshPath }) {
  const policy = requireConfiguredPolicy();
  const manifest = JSON.parse(fs.readFileSync(path.join(tempDir, 'source-manifest.json'), 'utf8'));
  const binding = JSON.parse(fs.readFileSync(path.join(artifactDir, 'binding.json'), 'utf8'));
  if (JSON.stringify(Object.keys(binding).sort()) !== JSON.stringify(['csr_sha256', 'source_commit', 'source_job_id', 'source_run_attempt', 'source_run_id', 'source_started_at'].sort())) throw new Error('return-binding-fields-invalid');
  for (const data of [manifest, binding]) {
    if (data.source_run_id !== runId || data.source_job_id !== 'source-csr' || data.source_run_attempt !== runAttempt || data.source_commit !== commit || data.source_started_at !== manifest.source_started_at) throw new Error('return-source-binding-mismatch');
  }
  if (manifest.csr_sha256 !== binding.csr_sha256) throw new Error('return-csr-digest-binding-mismatch');
  const csrBytes = fs.readFileSync(path.join(tempDir, 'source.csr.pem'));
  if (crypto.createHash('sha256').update(csrBytes).digest('hex') !== binding.csr_sha256) throw new Error('source-csr-digest-mismatch');
  verifyCertificateBinding({ csrBytes, expectedCsrSha256: binding.csr_sha256, leafPem: fs.readFileSync(path.join(artifactDir, 'leaf.pem'), 'utf8'), caPem: fs.readFileSync(path.join(artifactDir, 'ca.pem'), 'utf8'), expectedCaFingerprint256: policy.caFingerprint256, privateKeyPem: fs.readFileSync(path.join(tempDir, 'source.key.pem'), 'utf8'), pwshPath });
  if (!/^[1-9][0-9]{0,19}$/.test(returnRunId)) throw new Error('return-run-id-invalid');
  return Object.freeze({ accepted: true });
}

if (require.main === module) {
  try {
    const result = verifyReturn({ tempDir: process.env.RUNNER_TEMP, artifactDir: path.join(process.env.RUNNER_TEMP, 'a303-return'), runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, commit: process.env.GITHUB_SHA, returnRunId: process.env.A303_RETURN_RUN_ID, pwshPath: process.env.A303_PWSH });
    process.stdout.write(`certificate=${result.accepted ? 'accepted' : 'rejected'}\n`);
  } catch (error) { process.stderr.write(`certificate-rejected:${error.message}\n`); process.exitCode = 1; }
}

module.exports = { verifyReturn };
