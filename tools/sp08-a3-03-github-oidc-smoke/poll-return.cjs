'use strict';

const fs = require('node:fs');
const { waitForReturnRun } = require('./csr-handoff.cjs');
const { requireConfiguredPolicy } = require('./handoff-policy.cjs');

async function main() {
  const policy = requireConfiguredPolicy();
  const startMs = Date.parse(process.env.GITHUB_RUN_STARTED_AT || '');
  if (!Number.isFinite(startMs) || !process.env.GITHUB_OUTPUT) throw new Error('source-time-or-output-invalid');
  const selected = await waitForReturnRun({
    token: process.env.GITHUB_TOKEN,
    repository: policy.repository,
    workflowId: 'sp08-a3-03-csr-return.yml',
    expected: { workflowPath: policy.returnWorkflowPath, trustedHeadSha: policy.returnWorkflowSha, actorId: policy.operatorActorId, actorLogin: policy.operatorLogin, notBeforeMs: startMs, notAfterMs: startMs + 300000 },
    budget: { maxPolls: 4, maxPages: 1, maxCandidates: 10, maxArtifactBytes: 65536, maxWaitMs: 300000, pollIntervalMs: 5000 },
    fetchImpl: globalThis.fetch,
  });
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `run_id=${selected.runId}\n`, { encoding: 'utf8' });
  process.stdout.write('return_run=selected\n');
}

if (require.main === module) main().catch((error) => { process.stderr.write(`return-run-rejected:${error.message}\n`); process.exitCode = 1; });
module.exports = { main };
