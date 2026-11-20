'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function createSourceCsr({ pwshPath, tempDir, runId, runAttempt, commit, outputFile }) {
  if (!/^[1-9][0-9]{0,19}$/.test(runId) || runAttempt !== '1' || !/^[a-f0-9]{40,64}$/.test(commit) || !tempDir || !outputFile) throw new Error('source-context-invalid');
  const csrPath = path.join(tempDir, 'source.csr.pem');
  const keyPath = path.join(tempDir, 'source.key.pem');
  const script = path.join(__dirname, 'create-source-csr.ps1');
  const child = spawnSync(pwshPath, ['-NoProfile', '-NonInteractive', '-File', script, '-CsrPath', csrPath, '-KeyPath', keyPath], { encoding: 'utf8', timeout: 10000, maxBuffer: 4096, windowsHide: true, shell: false });
  if (child.error || child.status !== 0) throw new Error('source-csr-generation-failed');
  fs.chmodSync(csrPath, 0o600);
  fs.chmodSync(keyPath, 0o600);
  const csr = fs.readFileSync(csrPath);
  if (csr.byteLength > 65536) throw new Error('source-csr-size-limit');
  const manifest = { source_run_id: runId, source_job_id: 'source-csr', source_run_attempt: runAttempt, source_commit: commit, csr_sha256: crypto.createHash('sha256').update(csr).digest('hex') };
  fs.writeFileSync(outputFile, JSON.stringify(manifest), { flag: 'wx', mode: 0o600 });
  return { csrPath, keyPath, csrSha256: manifest.csr_sha256 };
}

if (require.main === module) {
  try {
    if (!process.env.RUNNER_TEMP || !process.env.GITHUB_OUTPUT) throw new Error('runner-context-required');
    const result = createSourceCsr({ pwshPath: process.env.A303_PWSH, tempDir: process.env.RUNNER_TEMP, runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, commit: process.env.GITHUB_SHA, outputFile: path.join(process.env.RUNNER_TEMP, 'source-manifest.json') });
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `csr_sha256=${result.csrSha256}\n`, { encoding: 'utf8' });
    process.stdout.write('csr=generated\n');
  } catch (error) { process.stderr.write(`source-csr-rejected:${error.message}\n`); process.exitCode = 1; }
}

module.exports = { createSourceCsr };
