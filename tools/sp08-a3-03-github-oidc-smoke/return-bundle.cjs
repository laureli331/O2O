'use strict';

const fs = require('node:fs');
const path = require('node:path');

const fail = (code) => { throw new Error(code); };
const MAX_BUNDLE_CHARS = 60000;
const MAX_PEM_CHARS = 24000;

function parseReturnBundle(serialized, outDir) {
  if (typeof serialized !== 'string' || serialized.length < 1 || serialized.length > MAX_BUNDLE_CHARS) fail('bundle-size-invalid');
  let value;
  try { value = JSON.parse(serialized); } catch { fail('bundle-json-invalid'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('bundle-shape-invalid');
  const keys = Object.keys(value).sort();
  if (keys.join(',') !== 'ca_certificate,csr_sha256,leaf_certificate,source_commit,source_job_id,source_run_attempt,source_run_id,source_started_at') fail('bundle-fields-invalid');
  if (typeof value.source_run_id !== 'string' || !/^[1-9][0-9]{0,19}$/.test(value.source_run_id)) fail('source-run-id-invalid');
  if (value.source_run_attempt !== '1') fail('source-run-attempt-invalid');
  if (value.source_job_id !== 'source-csr' || typeof value.source_commit !== 'string' || !/^[a-f0-9]{40,64}$/.test(value.source_commit)) fail('source-job-or-commit-invalid');
  if (typeof value.source_started_at !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.source_started_at) || !Number.isFinite(Date.parse(value.source_started_at))) fail('source-time-anchor-invalid');
  if (typeof value.csr_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.csr_sha256)) fail('csr-digest-invalid');
  for (const field of ['leaf_certificate', 'ca_certificate']) {
    if (typeof value[field] !== 'string' || value[field].length < 1 || value[field].length > MAX_PEM_CHARS || !value[field].startsWith('-----BEGIN CERTIFICATE-----\n') || !value[field].endsWith('-----END CERTIFICATE-----\n')) fail(`${field}-invalid`);
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'leaf.pem'), value.leaf_certificate, { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(path.join(outDir, 'ca.pem'), value.ca_certificate, { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(path.join(outDir, 'binding.json'), JSON.stringify({ source_run_id: value.source_run_id, source_job_id: value.source_job_id, source_run_attempt: value.source_run_attempt, source_commit: value.source_commit, source_started_at: value.source_started_at, csr_sha256: value.csr_sha256 }), { flag: 'wx', mode: 0o600 });
  return { artifactName: `sp08-a303-return-${value.source_run_id}-1` };
}

if (require.main === module) {
  try {
    const result = parseReturnBundle(process.env.A303_RETURN_BUNDLE, process.env.RUNNER_TEMP && path.join(process.env.RUNNER_TEMP, 'a303-return'));
    if (!process.env.RUNNER_TEMP) fail('runner-temp-required');
    if (!process.env.GITHUB_OUTPUT) fail('github-output-required');
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `artifact_name=${result.artifactName}\n`, { encoding: 'utf8', mode: 0o600 });
    process.stdout.write('public_bundle=validated\n');
  } catch (error) {
    process.stderr.write(`return-bundle-rejected:${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { parseReturnBundle };
