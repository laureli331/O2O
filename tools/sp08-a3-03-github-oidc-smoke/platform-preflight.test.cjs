'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { capture, context, verifyVisible } = require('./platform-preflight.cjs');

const ref = 'refs/heads/codex/sp08-a3-03-tls-prep';
function environment() {
  return { O2O_RUNNER_REPOSITORY: 'laureli331/O2O', O2O_RUNNER_REPOSITORY_ID: '1448526589',
    O2O_RUNNER_RUN_ID: '123', O2O_RUNNER_RUN_ATTEMPT: '1', O2O_RUNNER_ACTOR: 'laureli331', O2O_RUNNER_ACTOR_ID: '280332231',
    O2O_RUNNER_REF: ref, O2O_RUNNER_WORKFLOW_REF: `laureli331/O2O/.github/workflows/sp08-a3-03-tls-caller.yml@${ref}`,
    O2O_RUNNER_WORKFLOW_SHA: 'a'.repeat(40), O2O_RUNNER_CALLED_WORKFLOW_REF: `laureli331/O2O/.github/workflows/sp08-a3-03-platform-preflight-reusable.yml@${ref}`,
    O2O_RUNNER_CALLED_WORKFLOW_SHA: 'a'.repeat(40), O2O_RUNNER_ENVIRONMENT: 'SP08-A3-03-OIDC-smoke',
    A303_PREFLIGHT_SHA: 'a'.repeat(40), GITHUB_TOKEN: 'sentinel-token' };
}
function response(url, value) {
  const result = new Response(JSON.stringify(value));
  Object.defineProperty(result, 'url', { value: url });
  return result;
}
function run() {
  return { id: 123, repository: { id: 1448526589 }, path: '.github/workflows/sp08-a3-03-tls-caller.yml',
    head_sha: 'a'.repeat(40), head_branch: 'codex/sp08-a3-03-tls-prep', status: 'in_progress', conclusion: null,
    run_attempt: 1, event: 'workflow_dispatch', actor: { id: 280332231, login: 'laureli331' } };
}
function artifact() {
  return { id: 456, name: 'sp08-a303-platform-123-1', expired: false, digest: `sha256:${'b'.repeat(64)}`, size_in_bytes: 1024,
    workflow_run: { id: 123, repository_id: 1448526589, head_sha: 'a'.repeat(40) } };
}

test('platform probe requires independently supplied SHA and real caller/called context', () => {
  const env = environment();
  assert.equal(context(env).run_id, '123');
  for (const patch of [{ A303_PREFLIGHT_SHA: '' }, { O2O_RUNNER_CALLED_WORKFLOW_REF: '' },
    { O2O_RUNNER_CALLED_WORKFLOW_SHA: 'b'.repeat(40) }, { O2O_RUNNER_ACTOR_ID: '999' }, { O2O_RUNNER_RUN_ATTEMPT: '2' }]) {
    assert.throws(() => context({ ...env, ...patch }));
  }
});

test('capture whitelists public context and version output without persisting token or overwriting', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a303-platform-'));
  const env = { ...environment(), RUNNER_TEMP: dir, GITHUB_OUTPUT: path.join(dir, 'output.txt'), SECRET_KEY: 'sentinel-secret' };
  try {
    const result = capture(env, { spawn: (binary, args, options) => {
      assert.equal(binary, 'pwsh'); assert.equal(options.shell, false); assert.equal(options.timeout, 10000);
      return { status: 0, stdout: '7.6.9\n' };
    } });
    assert.equal(result.cloudCalls, 0); assert.equal(result.oidcRequests, 0);
    const file = path.join(dir, 'a303-platform-preflight.json');
    assert.equal(fs.readFileSync(file, 'utf8').includes('sentinel'), false);
    assert.throws(() => capture(env, { spawn: () => ({ status: 0, stdout: '7.6.9' }) }), /EEXIST/);
    assert.throws(() => capture(env, { spawn: () => ({ status: 0, stdout: '7.3.0' }) }));
    fs.unlinkSync(file); fs.unlinkSync(env.GITHUB_OUTPUT);
  } finally { fs.rmdirSync(dir); }
});

test('same-job visibility performs only bounded GitHub GETs and binds artifact to that active run', async () => {
  let lists = 0; let clock = 1000; const seen = [];
  const result = await verifyVisible(environment(), { now: () => clock, sleep: async ms => { clock += ms; },
    fetchImpl: async (url, options) => {
      assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error'); seen.push(url);
      return response(url, url.includes('/artifacts?') ? { total_count: ++lists === 1 ? 0 : 1, artifacts: lists === 1 ? [] : [artifact()] } : run());
    } });
  assert.equal(result.artifactId, '456'); assert.equal(result.tlsConnections, 0);
  assert.equal(seen.length, 4); assert.equal(clock, 6000);
  assert.equal(seen.every(url => url.startsWith('https://api.github.com/repos/laureli331/O2O/actions/runs/123')), true);
});

test('probe refuses completed, foreign or ambiguous artifacts without repeating a failing request', async () => {
  for (const patch of [{ run: { ...run(), status: 'completed' } },
    { artifact: { ...artifact(), workflow_run: { ...artifact().workflow_run, head_sha: 'c'.repeat(40) } } }, { total: 2 }]) {
    let calls = 0;
    await assert.rejects(verifyVisible(environment(), { fetchImpl: async url => {
      calls += 1;
      return response(url, url.includes('/artifacts?') ? { total_count: patch.total || 1, artifacts: [patch.artifact || artifact()] } : patch.run || run());
    } }));
    assert.ok(calls <= 2);
  }
});

test('probe workflow is manual, read-only, has no OIDC minting or cloud/TLS entry and uploads one public file', () => {
  const root = path.resolve(__dirname, '../../.github/workflows');
  const caller = fs.readFileSync(path.join(root, 'sp08-a3-03-tls-caller.yml'), 'utf8');
  const reusable = fs.readFileSync(path.join(root, 'sp08-a3-03-platform-preflight-reusable.yml'), 'utf8');
  assert.match(caller, /workflow_dispatch:/); assert.match(caller, /expected_sha:/);
  assert.match(caller, /uses: \.\/.github\/workflows\/sp08-a3-03-platform-preflight-reusable.yml/);
  assert.match(caller, /inputs.preflight_only == true/);
  assert.match(caller, /inputs.preflight_only != true/);
  for (const value of [caller.split('  source-csr:')[0], reusable]) {
    assert.match(value, /id-token: none/); assert.doesNotMatch(value, /actions: write|secrets: inherit|workflow_run:|push:/);
    assert.doesNotMatch(value, /InvokeCommand|--start-approved|--execute-approved|ipify|A303_TLS_RUNNER_POLICY/);
  }
  assert.match(reusable, /timeout-minutes: 2/); assert.match(reusable, /retention-days: 1/);
  assert.match(reusable, /path: \$\{\{ steps.capture.outputs.public_file \}\}/);
});
