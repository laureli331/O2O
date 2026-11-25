'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { dispatchReturnOnce } = require('./return-dispatch-once.cjs');

const binding = Object.freeze({ repository: 'owner/repo', repositoryId: '42', actorId: '7', sourceRunId: '123', attempt: '1',
  workflowPath: '.github/workflows/sp08-a3-03-tls-caller.yml', workflowRef: 'owner/repo/.github/workflows/sp08-a3-03-tls-caller.yml@refs/heads/codex/prep',
  workflowSha: 'a'.repeat(40), csrSha256: 'b'.repeat(64) });
const bundle = JSON.stringify({ source_run_id: '123', source_run_attempt: '1', source_commit: 'a'.repeat(40), csr_sha256: 'b'.repeat(64), source_job_id: 'source-csr' });

function fixture(fetchImpl) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'a303-return-'));
  return { directory, journalPath: path.join(directory, 'return-once.json'), fetchImpl, cleanup() { fs.unlinkSync(this.journalPath); fs.rmdirSync(directory); } };
}

function api(fetchImpl, dispatchStatus = 204) {
  return async (url, options) => {
    if (options.method === 'GET' && url.endsWith('/actions/runs/123')) return { status: 200, json: async () => ({ id: 123, repository: { id: 42 }, path: binding.workflowPath, head_sha: binding.workflowSha,
      run_attempt: 1, status: 'in_progress', conclusion: null, event: 'workflow_dispatch', actor: { id: 7 }, workflow_ref: binding.workflowRef }) };
    if (options.method === 'GET' && url.includes('/actions/workflows/')) return { status: 200, json: async () => ({ workflow_runs: [] }) };
    if (options.method === 'POST') return fetchImpl(url, options, dispatchStatus);
    throw new Error('unexpected-request');
  };
}

test('journals once before dispatch and refuses reuse across calls', async () => {
  let calls = 0;
  const f = fixture(api(async (url, options) => { calls += 1; assert.equal(JSON.parse(options.body).ref, 'codex/prep'); return { status: 204 }; }));
  try {
    const result = await dispatchReturnOnce({ binding, journalPath: f.journalPath, bundle, token: 'offline-token', fetchImpl: f.fetchImpl, now: () => 1000 });
    assert.equal(result.state, 'accepted');
    const record = JSON.parse(fs.readFileSync(f.journalPath, 'utf8'));
    assert.equal(record.state, 'accepted');
    assert.equal(record.binding.sourceRunId, binding.sourceRunId);
    assert.equal(Object.hasOwn(record, 'token'), false);
    await assert.rejects(dispatchReturnOnce({ binding, journalPath: f.journalPath, bundle, token: 'offline-token', fetchImpl: f.fetchImpl }), /dispatch-journal-already-exists/);
    assert.equal(calls, 1);
  } finally { f.cleanup(); }
});

test('unknown POST outcome leaves durable intent and cannot be retried', async () => {
  const f = fixture(api(async () => { throw new Error('connection-lost-after-send'); }));
  try {
    await assert.rejects(dispatchReturnOnce({ binding, journalPath: f.journalPath, bundle, token: 'offline-token', fetchImpl: f.fetchImpl }), /outcome-unknown/);
    assert.equal(JSON.parse(fs.readFileSync(f.journalPath, 'utf8')).state, 'intent');
    await assert.rejects(dispatchReturnOnce({ binding, journalPath: f.journalPath, bundle, token: 'offline-token', fetchImpl: f.fetchImpl }), /journal-already-exists/);
  } finally { f.cleanup(); }
});

test('rejects unbound return material before any write request', async () => {
  let posted = false;
  const f = fixture(api(async () => { posted = true; return { status: 204 }; }));
  try {
    await assert.rejects(dispatchReturnOnce({ binding, journalPath: f.journalPath, bundle: bundle.replace('123', '124'), token: 'offline-token', fetchImpl: f.fetchImpl }), /binding-mismatch/);
    assert.equal(posted, false);
    assert.equal(fs.existsSync(f.journalPath), false);
  } finally { fs.rmdirSync(f.directory); }
});
