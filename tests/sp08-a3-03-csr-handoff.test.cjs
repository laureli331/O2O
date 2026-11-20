'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { selectSourceRun, validateBudget, verifyCertificateBinding } = require('../tools/sp08-a3-03-github-oidc-smoke/csr-handoff.cjs');

const budget = { maxPolls: 1, maxPages: 1, maxCandidates: 10, maxArtifactBytes: 65536, maxWaitMs: 60000, pollIntervalMs: 5000 };
const expected = { repositoryId: '123', trustedHeadSha: 'a'.repeat(40), actorId: '77', actorLogin: 'operator', workflowPath: '.github/workflows/csr-source.yml', notBeforeMs: 1000, notAfterMs: 2000 };
const source = { event: 'workflow_dispatch', status: 'completed', conclusion: 'success', repository: { id: 123 }, path: expected.workflowPath, head_sha: expected.trustedHeadSha, run_attempt: 1, actor: { id: 77, login: 'operator' }, created_at: new Date(1500).toISOString() };

test('selects exactly one source run bound to trusted workflow, commit, actor, repository, time and attempt', () => {
  assert.equal(selectSourceRun([source], expected, budget), source);
  for (const change of [{ event: 'pull_request' }, { conclusion: 'failure' }, { head_sha: 'b'.repeat(40) }, { run_attempt: 2 }, { actor: { id: 77, login: 'other' } }]) {
    assert.throws(() => selectSourceRun([{ ...source, ...change }], expected, budget), /source-run-not-found/);
  }
  assert.throws(() => selectSourceRun([source, source], expected, budget), /source-run-ambiguous/);
});

test('source listing budget is explicit and hard bounded', () => {
  assert.equal(validateBudget(budget).maxListRequests, 1);
  assert.throws(() => validateBudget({ ...budget, maxPolls: 5, maxPages: 1 }), /hard-limit/);
  assert.throws(() => validateBudget({ ...budget, maxWaitMs: 300001 }), /hard-limit/);
  assert.throws(() => selectSourceRun(Array(11).fill(source), expected, budget), /candidate-count-limit/);
});

test('CSR digest and all certificate inputs are size bounded before parsing', () => {
  const bytes = Buffer.from('synthetic csr');
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  assert.throws(() => verifyCertificateBinding({ csrBytes: bytes, expectedCsrSha256: '0'.repeat(64), leafPem: 'x', caPem: 'x', expectedCaFingerprint256: '0'.repeat(64), privateKeyPem: 'x' }), /csr-digest-mismatch/);
  assert.throws(() => verifyCertificateBinding({ csrBytes: Buffer.alloc(20), expectedCsrSha256: digest, leafPem: 'x', caPem: 'x', expectedCaFingerprint256: '0'.repeat(64), privateKeyPem: 'x', maxBytes: 10 }), /csrBytes-size-limit/);
});
