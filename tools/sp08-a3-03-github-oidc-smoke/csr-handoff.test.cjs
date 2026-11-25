'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { waitForReturnRun } = require('./csr-handoff.cjs');

const budget = { maxPolls: 1, maxPages: 1, maxCandidates: 2, maxArtifactBytes: 1024, maxWaitMs: 100, requestTimeoutMs: 100,
  pollDelaysMs: [0] };
const expected = { workflowPath: '.github/workflows/sp08-a3-03-csr-return.yml', trustedHeadSha: 'a'.repeat(40), actorId: '7', actorLogin: 'operator',
  headBranch: 'codex/test', notBeforeMs: 1, notAfterMs: 1000 };
const responseFor = (json) => ({ status: 200, url: 'https://api.github.com/test', headers: { get: () => null }, json });
const selected = { id: 8, event: 'workflow_dispatch', status: 'completed', conclusion: 'success', repository: { full_name: 'owner/repo' },
  path: expected.workflowPath, head_sha: expected.trustedHeadSha, head_branch: expected.headBranch, run_attempt: 1,
  actor: { id: 7, login: 'operator' }, created_at: new Date(10).toISOString() };
const invoke = (options) => waitForReturnRun({ token: 'offline', repository: 'owner/repo', workflowId: 'sp08-a3-03-csr-return.yml',
  expected, budget, fetchImpl: async () => responseFor(async () => ({ total_count: 1, workflow_runs: [selected] })), ...options });

test('return polling deadline aborts a stalled response body and rejects a late JSON success', async () => {
  let signal;
  await assert.rejects(waitForReturnRun({ token: 'offline', repository: 'owner/repo', workflowId: 'sp08-a3-03-csr-return.yml', expected, budget,
    deadline: Date.now() + 25, fetchImpl: async (_url, options) => { signal = options.signal; return responseFor(() => new Promise(() => {})); } }), /poll-deadline-unknown/);
  assert.equal(signal.aborted, true);

  let clock = 100;
  await assert.rejects(invoke({ deadline: 200, now: () => clock, fetchImpl: async () => responseFor(async () => {
    clock = 200; return { total_count: 1, workflow_runs: [selected] };
  }) }), /poll-deadline-unknown/);
});

test('return polling refuses to start a GET after sleep crosses the absolute deadline', async () => {
  let clock = 100;
  let fetches = 0;
  await assert.rejects(waitForReturnRun({ token: 'offline', repository: 'owner/repo', workflowId: 'sp08-a3-03-csr-return.yml', expected,
    budget: { ...budget, maxPolls: 2, pollDelaysMs: [0, 50] }, deadline: 120, now: () => clock,
    sleep: async () => { clock = 120; }, fetchImpl: async () => { fetches += 1; return responseFor(async () => ({ total_count: 0, workflow_runs: [] })); } }), /poll-deadline-expired/);
  assert.equal(fetches, 1);
});

test('return polling without an absolute deadline retains its previous behavior', async () => {
  const result = await invoke();
  assert.equal(result.runId, '8');
});
