'use strict';

const { prepareOperatorConfig } = require('./prepare-operator-config.cjs');
const { runOperatorEntry } = require('./operator-entry.cjs');
const fail = (code) => { throw new Error(code); };
const INPUT_KEYS = 'commandIds|instanceId|interfaceName|journalPath|jwksExpiresAt|jwksFetchedAt|preparedPolicies|privateIPv4|pwshPath|region|securityGroupId';
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const runId = (value) => (typeof value === 'string' || typeof value === 'number' && Number.isSafeInteger(value)) && /^[1-9][0-9]{0,19}$/.test(String(value));
const SOURCE = '.github/workflows/sp08-a3-03-tls-caller.yml';

function checkAwaitPlan(plan, now = Date.now()) {
  if (!record(plan) || Object.keys(plan).sort().join('|') !== 'operatorInput|resourceCleanupAtMs|watchUntilMs'
    || !record(plan.operatorInput) || Object.keys(plan.operatorInput).sort().join('|') !== INPUT_KEYS
    || !Number.isSafeInteger(now) || !Number.isSafeInteger(plan.watchUntilMs)
    || plan.watchUntilMs <= now || plan.watchUntilMs > now + 60000
    || !Number.isSafeInteger(plan.resourceCleanupAtMs)
    || plan.resourceCleanupAtMs < plan.watchUntilMs + 360000) fail('await-plan-window-invalid');
  // Validate the complete static template, without selecting or trusting a real run.
  const template = prepareOperatorConfig({ ...plan.operatorInput, sourceRunId: '1', notBeforeMs: now, notAfterMs: now }, now);
  const server = JSON.parse(template.serverInput);
  if (server.authorizedUntil < plan.watchUntilMs + 360000
    || plan.operatorInput.jwksExpiresAt < plan.watchUntilMs + 360000) fail('await-plan-lifetime-insufficient');
  return { state: 'check-only', readyToDispatch: false };
}

async function readJson(url, token, deadline, { fetchImpl, now }) {
  const remaining = deadline - now();
  if (remaining <= 0) fail('await-source-deadline');
  const controller = new AbortController();
  let timer;
  const pending = Promise.resolve().then(async () => {
    const response = await fetchImpl(url, { method: 'GET', redirect: 'error', signal: controller.signal,
      headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28' } });
    if (!response || response.status !== 200 || response.url !== url || response.headers?.get('link')
      || !response.body?.getReader) fail('await-source-response-invalid');
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        size += item.value.byteLength;
        if (size > 65536) { controller.abort(); void reader.cancel().catch(() => {}); fail('await-source-response-too-large'); }
        chunks.push(Buffer.from(item.value));
      }
      if (now() >= deadline) fail('await-source-deadline');
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } finally { reader.releaseLock(); }
  });
  try {
    return await Promise.race([pending, new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('await-source-request-unknown')); }, Math.min(remaining, 10000));
    })]);
  } finally { clearTimeout(timer); }
}

async function awaitSourceOperator({ plan, envelope, enableExternalDispatch, fetchImpl = globalThis.fetch,
  now = Date.now, sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)), run = runOperatorEntry, onReady = () => {} }) {
  if (enableExternalDispatch !== true) fail('await-source-explicit-enable-required');
  // Freeze caller-owned public inputs before any asynchronous work.
  const snapshot = structuredClone(plan);
  const checkedAt = now();
  checkAwaitPlan(snapshot, checkedAt);
  const secrets = require('./local-operator-launcher.cjs').validateSecretEnvelope(envelope, checkedAt);
  if (Date.parse(envelope.expiration) < snapshot.watchUntilMs + 360000 || secrets.token.length > 4096) fail('await-source-credential-lifetime-insufficient');
  if (typeof fetchImpl !== 'function' || typeof sleep !== 'function' || typeof run !== 'function' || typeof onReady !== 'function') fail('await-source-dependency-invalid');
  const input = snapshot.operatorInput;
  const policy = JSON.parse(input.preparedPolicies.variables.A303_TLS_RUNNER_POLICY);
  const claims = policy.policy.expectedClaims;
  const branch = claims.ref.slice('refs/heads/'.length);
  const listUrl = `https://api.github.com/repos/${claims.repository}/actions/workflows/sp08-a3-03-tls-caller.yml/runs?event=workflow_dispatch&branch=${encodeURIComponent(branch)}&per_page=100&page=1`;
  const validateList = (body) => {
    if (!record(body) || !Number.isSafeInteger(body.total_count) || body.total_count < 0 || body.total_count > 100
      || !Array.isArray(body.workflow_runs) || body.workflow_runs.length !== body.total_count) fail('await-source-list-invalid');
    return body.workflow_runs;
  };
  const baseline = validateList(await readJson(listUrl, secrets.token, snapshot.watchUntilMs, { fetchImpl, now }));
  const baselineIds = new Set(baseline.map(item => {
    if (!record(item) || !runId(item.id)) fail('await-source-baseline-invalid');
    return String(item.id);
  }));
  // GitHub timestamps have second precision. Exclude the baseline IDs as well as older timestamps.
  const startedAt = Math.floor(now() / 1000) * 1000;
  if (now() >= snapshot.watchUntilMs) fail('await-source-deadline');
  onReady();
  let pinnedRunId;
  for (let poll = 0; poll < 12; poll += 1) {
    if (now() >= snapshot.watchUntilMs) fail('await-source-deadline');
    const body = await readJson(listUrl, secrets.token, snapshot.watchUntilMs, { fetchImpl, now });
    const candidates = validateList(body).filter(item => record(item) && !baselineIds.has(String(item.id)) && item.path === SOURCE
      && String(item.repository?.id) === claims.repository_id && item.repository?.full_name === claims.repository
      && item.head_sha === input.preparedPolicies.trustedHeadSha && item.head_branch === branch
      && item.event === 'workflow_dispatch' && String(item.actor?.id) === claims.actor_id && item.actor?.login === claims.actor
      && typeof item.created_at === 'string' && Date.parse(item.created_at) >= startedAt
      && Date.parse(item.created_at) <= Math.min(now(), snapshot.watchUntilMs));
    if (candidates.length > 1) fail('await-source-ambiguous');
    if (candidates.length === 1) {
      const source = candidates[0];
      const id = String(source.id);
      if (!runId(source.id) || source.run_attempt !== 1 || source.conclusion !== null
        || !['queued', 'in_progress', 'waiting', 'pending', 'requested'].includes(source.status)
        || pinnedRunId && pinnedRunId !== id) fail('await-source-run-invalid');
      pinnedRunId = id;
      if (source.status === 'in_progress') {
        const artifacts = await readJson(`https://api.github.com/repos/${claims.repository}/actions/runs/${id}/artifacts?per_page=100`,
          secrets.token, snapshot.watchUntilMs, { fetchImpl, now });
        if (!record(artifacts) || !Number.isSafeInteger(artifacts.total_count) || artifacts.total_count < 0
          || artifacts.total_count > 1 || !Array.isArray(artifacts.artifacts) || artifacts.artifacts.length !== artifacts.total_count) fail('await-source-artifacts-invalid');
        if (artifacts.total_count === 1) {
          const item = artifacts.artifacts[0];
          if (!record(item) || item.name !== `sp08-a303-csr-${id}-1` || item.expired !== false) fail('await-source-artifact-invalid');
          // Discovery is not provenance. The existing entry re-reads and verifies run, archive, CSR and egress binding.
          const config = prepareOperatorConfig({ ...input, sourceRunId: id, notBeforeMs: startedAt, notAfterMs: now() }, now());
          return run(config, secrets, { enableExternalDispatch: true, now, fetchImpl });
        }
      }
    } else if (pinnedRunId) fail('await-source-run-disappeared');
    if (poll < 11) await sleep(Math.min(5000, Math.max(0, snapshot.watchUntilMs - now())));
  }
  fail('await-source-poll-limit');
}

module.exports = { checkAwaitPlan, awaitSourceOperator };
