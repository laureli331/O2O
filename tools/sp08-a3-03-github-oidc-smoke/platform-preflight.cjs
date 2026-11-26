'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { readJson } = require('./github-json-read.cjs');
const { runnerContext } = require('./runner-entry.cjs');
const fail = () => { throw new Error('platform-preflight-rejected'); };
const BRANCH = 'refs/heads/codex/sp08-a3-03-tls-prep';
const CALLER = '.github/workflows/sp08-a3-03-tls-caller.yml';
const CALLED = '.github/workflows/sp08-a3-03-platform-preflight-reusable.yml';

function context(env) {
  const value = runnerContext(env);
  if (!/^[a-f0-9]{40}$/.test(env.A303_PREFLIGHT_SHA || '') || value.repository !== 'laureli331/O2O'
    || value.repository_id !== '1448526589' || value.actor !== 'laureli331' || value.actor_id !== '280332231'
    || value.ref !== BRANCH || value.workflow_ref !== `${value.repository}/${CALLER}@${BRANCH}`
    || value.job_workflow_ref !== `${value.repository}/${CALLED}@${BRANCH}`
    || value.workflow_sha !== env.A303_PREFLIGHT_SHA || value.job_workflow_sha !== env.A303_PREFLIGHT_SHA
    || value.environment !== 'SP08-A3-03-OIDC-smoke') fail();
  return value;
}

function capture(env, { spawn = spawnSync } = {}) {
  const value = context(env);
  if (!path.isAbsolute(env.RUNNER_TEMP || '') || !path.isAbsolute(env.GITHUB_OUTPUT || '')
    || /[\r\n]/.test(env.RUNNER_TEMP + env.GITHUB_OUTPUT) || Number(process.versions.node.split('.')[0]) < 20) fail();
  const result = spawn('pwsh', ['-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.ToString()'],
    { encoding: 'utf8', timeout: 10000, maxBuffer: 1024, windowsHide: true, shell: false });
  const version = result.stdout?.trim();
  if (result.error || result.status !== 0 || !/^7\.(?:[4-9]|[1-9][0-9]+)\.[0-9]+$/.test(version || '')) fail();
  const file = path.join(env.RUNNER_TEMP, 'a303-platform-preflight.json');
  const publicData = { schema: 'a303-platform-preflight-v1', context: value, node: process.versions.node, pwsh: version,
    cloudCalls: 0, oidcRequests: 0, tlsConnections: 0 };
  fs.writeFileSync(file, JSON.stringify(publicData), { flag: 'wx', mode: 0o600 });
  fs.appendFileSync(env.GITHUB_OUTPUT, `public_file=${file}\n`);
  return publicData;
}

async function verifyVisible(env, { fetchImpl = globalThis.fetch, now = Date.now,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const value = context(env);
  if (typeof env.GITHUB_TOKEN !== 'string' || !env.GITHUB_TOKEN || env.GITHUB_TOKEN.length > 4096) fail();
  const deadline = now() + 30000;
  const root = `https://api.github.com/repos/${value.repository}/actions/runs/${value.run_id}`;
  const get = url => readJson(url, env.GITHUB_TOKEN, deadline, { fetchImpl, now });
  for (let poll = 0; poll < 4; poll += 1) {
    const run = await get(root);
    if (String(run.id) !== value.run_id || String(run.repository?.id) !== value.repository_id || run.path !== CALLER
      || run.head_sha !== value.workflow_sha || run.status !== 'in_progress' || run.conclusion !== null
      || run.run_attempt !== 1 || run.event !== 'workflow_dispatch' || String(run.actor?.id) !== value.actor_id
      || run.actor?.login !== value.actor || run.head_branch !== BRANCH.slice('refs/heads/'.length)) fail();
    const list = await get(`${root}/artifacts?per_page=100`);
    if (!Number.isSafeInteger(list.total_count) || !Array.isArray(list.artifacts) || list.total_count < 0
      || list.total_count > 1 || list.artifacts.length !== list.total_count) fail();
    if (list.total_count === 1) {
      const item = list.artifacts[0];
      if (item.name !== `sp08-a303-platform-${value.run_id}-1` || item.expired !== false
        || !Number.isSafeInteger(item.id) || item.id <= 0 || !Number.isSafeInteger(item.size_in_bytes)
        || item.size_in_bytes <= 0 || item.size_in_bytes > 262144 || !/^sha256:[a-f0-9]{64}$/.test(item.digest || '')
        || String(item.workflow_run?.id) !== value.run_id || String(item.workflow_run?.repository_id) !== value.repository_id
        || item.workflow_run?.head_sha !== value.workflow_sha) fail();
      return { state: 'platform-preflight-visible', runId: value.run_id, artifactId: String(item.id), cloudCalls: 0, oidcRequests: 0, tlsConnections: 0 };
    }
    if (poll < 3) await sleep(Math.min(5000, Math.max(0, deadline - now())));
  }
  fail();
}

async function main(args, env = process.env) {
  try {
    if (args.length !== 1) fail();
    if (args[0] === '--capture') { capture(env); process.stdout.write('platform_context_checked=true\n'); }
    else if (args[0] === '--verify-visible') process.stdout.write(`${JSON.stringify(await verifyVisible(env))}\n`);
    else fail();
    return 0;
  } catch { process.stderr.write('platform_preflight_failed=true\n'); return 1; }
}
if (require.main === module) main(process.argv.slice(2)).then(code => { process.exitCode = code; });
module.exports = { capture, context, verifyVisible };
