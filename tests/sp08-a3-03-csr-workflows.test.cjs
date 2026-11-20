'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSourceCsr } = require('../tools/sp08-a3-03-github-oidc-smoke/source-csr.cjs');
const { parseReturnBundle } = require('../tools/sp08-a3-03-github-oidc-smoke/return-bundle.cjs');
const { POLICY, requireConfiguredPolicy } = require('../tools/sp08-a3-03-github-oidc-smoke/handoff-policy.cjs');

const root = path.resolve(__dirname, '..');
const returnWorkflow = fs.readFileSync(path.join(root, '.github/workflows/sp08-a3-03-csr-return.yml'), 'utf8');
const sourceWorkflow = fs.readFileSync(path.join(root, '.github/workflows/sp08-a3-03-csr-source.yml'), 'utf8');

test('return workflow is manual only, read-only, reviewed-ref gated and pins official actions', () => {
  assert.match(returnWorkflow, /^on:\s*\n\s+workflow_dispatch:/m);
  assert.doesNotMatch(returnWorkflow, /^\s{2}(push|pull_request|schedule|workflow_run):/m);
  assert.match(returnWorkflow, /permissions:\s*\n\s+contents: read/);
  assert.match(returnWorkflow, /uses:\s*actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/);
  assert.match(returnWorkflow, /uses:\s*actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/);
  assert.ok(returnWorkflow.indexOf('handoff-policy.cjs') < returnWorkflow.indexOf('return-bundle.cjs'));
  assert.ok(returnWorkflow.indexOf('return-bundle.cjs') < returnWorkflow.indexOf('upload-artifact'));
  assert.doesNotMatch(returnWorkflow, /\$\(\$\{\{\s*inputs\.bundle/);
});

test('unconfigured trust policy refuses run and synthetic independent policy validates', () => {
  assert.throws(() => requireConfiguredPolicy(), /handoff-policy-unconfigured/);
  const fixture = { ...POLICY, repository: 'owner/repo', sourceWorkflowSha: 'a'.repeat(40), returnWorkflowSha: 'b'.repeat(40), operatorActorId: '123', operatorLogin: 'operator', caFingerprint256: 'c'.repeat(64) };
  assert.equal(requireConfiguredPolicy(fixture), fixture);
  assert.throws(() => requireConfiguredPolicy({ ...fixture, caFingerprint256: 'z'.repeat(64) }), /handoff-policy-invalid/);
});

test('return bundle enforces exact fields, public PEM bounds and source binding shape', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'a303-return-'));
  try {
    const pem = '-----BEGIN CERTIFICATE-----\nZm9v\n-----END CERTIFICATE-----\n';
    const value = { source_run_id: '123', source_job_id: 'source-csr', source_run_attempt: '1', source_commit: 'b'.repeat(40), csr_sha256: 'a'.repeat(64), leaf_certificate: pem, ca_certificate: pem };
    const result = parseReturnBundle(JSON.stringify(value), directory);
    assert.equal(result.artifactName, 'sp08-a303-return-123-1');
    assert.deepEqual(fs.readdirSync(directory).sort(), ['binding.json', 'ca.pem', 'leaf.pem']);
    for (const bad of [
      { ...value, extra: true },
      { ...value, source_run_id: '01' },
      { ...value, source_run_attempt: '2' },
      { ...value, csr_sha256: 'x' },
      { ...value, leaf_certificate: '-----BEGIN CERTIFICATE-----\nmalformed' },
    ]) assert.throws(() => parseReturnBundle(JSON.stringify(bad), directory));
    assert.throws(() => parseReturnBundle('x'.repeat(60001), directory), /bundle-size-invalid/);
  } finally {
    for (const name of ['binding.json', 'ca.pem', 'leaf.pem']) { try { fs.unlinkSync(path.join(directory, name)); } catch {} }
    fs.rmdirSync(directory);
  }
});

test('source candidate is manual only, read only, gates before key generation and cleans up exact job-local files', () => {
  assert.match(sourceWorkflow, /^on:\s*\n\s+workflow_dispatch:\s*$/m);
  assert.doesNotMatch(sourceWorkflow, /^\s{2}(push|pull_request|schedule|workflow_run):/m);
  assert.match(sourceWorkflow, /actions: read/);
  assert.match(sourceWorkflow, /uses:\s*actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/);
  assert.match(sourceWorkflow, /uses:\s*actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/);
  assert.match(sourceWorkflow, /uses:\s*actions\/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093/);
  assert.ok(sourceWorkflow.indexOf('handoff-policy.cjs') < sourceWorkflow.indexOf('source-csr.cjs'));
  assert.ok(sourceWorkflow.indexOf('poll-return.cjs') < sourceWorkflow.indexOf('download-artifact'));
  assert.ok(sourceWorkflow.indexOf('download-artifact') < sourceWorkflow.indexOf('verify-return.cjs'));
  assert.match(sourceWorkflow, /if:\s*\$\{\{ always\(\) \}\}[\s\S]*clean-source\.cjs/);
  assert.match(sourceWorkflow, /name:\s*sp08-a303-return-\$\{\{ github\.run_id \}\}-1[\s\S]*run-id:\s*\$\{\{ steps\.returned\.outputs\.run_id \}\}/);
});

test('source CSR generator creates signed synthetic request, bounded manifest and mode-restricted private key', (t) => {
  const pwshPath = process.env.O2O_TEST_PWSH;
  if (!pwshPath) { t.skip('O2O_TEST_PWSH must point to the configured PowerShell 7 executable'); return; }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'a303-source-'));
  try {
    const manifestPath = path.join(directory, 'source-manifest.json');
    const result = createSourceCsr({ pwshPath, tempDir: directory, runId: '123', runAttempt: '1', commit: 'a'.repeat(40), outputFile: manifestPath });
    if (process.platform !== 'win32') assert.equal(fs.statSync(result.keyPath).mode & 0o777, 0o600);
    assert.match(fs.readFileSync(result.csrPath, 'utf8'), /BEGIN CERTIFICATE REQUEST/);
    assert.equal(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).csr_sha256, result.csrSha256);
  } finally {
    for (const name of ['source.csr.pem', 'source.key.pem', 'source-manifest.json']) { try { fs.unlinkSync(path.join(directory, name)); } catch {} }
    fs.rmdirSync(directory);
  }
});
