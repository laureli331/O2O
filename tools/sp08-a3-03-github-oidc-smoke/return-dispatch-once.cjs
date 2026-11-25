'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { requireVerifiedSourceMaterials } = require('./tencentcloud-a303-api.cjs');

const fail = (code) => { throw new Error(code); };
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const RETURN_WORKFLOW = '.github/workflows/sp08-a3-03-csr-return.yml';

function validateBinding(binding) {
  const keys = Object.keys(binding || {}).sort().join('|');
  if (!isRecord(binding) || keys !== 'actorId|attempt|csrSha256|repository|repositoryId|sourceRunId|workflowPath|workflowRef|workflowSha'
    || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(binding.repository)
    || !/^[0-9]+$/.test(binding.repositoryId) || !/^[0-9]+$/.test(binding.actorId)
    || !/^[1-9][0-9]{0,19}$/.test(binding.sourceRunId) || binding.attempt !== '1'
    || !/^[a-f0-9]{40,64}$/.test(binding.workflowSha) || !/^[a-f0-9]{64}$/.test(binding.csrSha256)
    || binding.workflowPath !== '.github/workflows/sp08-a3-03-tls-caller.yml'
    || typeof binding.workflowRef !== 'string' || !binding.workflowRef.startsWith(`${binding.repository}/${binding.workflowPath}@refs/heads/`)) fail('return-binding-invalid');
  return Object.freeze({ ...binding });
}

function validateJournalPath(filePath) {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath) || path.basename(filePath) === '.' || path.basename(filePath) === '..') fail('dispatch-journal-path-invalid');
  const parent = path.dirname(filePath);
  const parentStat = fs.lstatSync(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink() || fs.realpathSync(parent) !== path.resolve(parent)) fail('dispatch-journal-parent-invalid');
  if (fs.existsSync(filePath) || (() => { try { fs.lstatSync(filePath); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } })()) fail('dispatch-journal-already-exists-manual-recovery');
  return filePath;
}

function writeJournal(fd, record) {
  const bytes = Buffer.from(`${JSON.stringify(record)}\n`, 'utf8');
  fs.writeFileSync(fd, bytes);
  fs.fsyncSync(fd);
}

function recordReturnRunId({ journalPath, binding: rawBinding, runId }) {
  const binding = validateBinding(rawBinding);
  if (typeof runId !== 'string' || !/^[1-9][0-9]{0,19}$/.test(runId)) fail('return-run-id-invalid');
  const parent = path.dirname(journalPath);
  const stat = fs.lstatSync(journalPath);
  if (stat.isSymbolicLink() || !stat.isFile() || fs.realpathSync(parent) !== path.resolve(parent)) fail('dispatch-journal-file-invalid-manual-recovery');
  const fd = fs.openSync(journalPath, 'r+');
  try {
    const current = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
    if (!isRecord(current) || current.state !== 'accepted' || JSON.stringify(current.binding) !== JSON.stringify(binding)) fail('dispatch-journal-state-invalid-manual-recovery');
    if (current.returnRunId && current.returnRunId !== runId) fail('dispatch-journal-run-id-conflict-manual-recovery');
    const updated = { ...current, state: 'accepted', returnRunId: runId };
    fs.ftruncateSync(fd, 0); fs.writeSync(fd, `${JSON.stringify(updated)}\n`, 0, 'utf8'); fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
}

async function dispatchReturnOnce({ verifiedMaterials, journalPath, bundle, token, fetchImpl = globalThis.fetch, deadline, now = Date.now }) {
  const verified = requireVerifiedSourceMaterials(verifiedMaterials);
  const binding = validateBinding({ repository: verified.repository, repositoryId: verified.repositoryId, actorId: verified.actorId,
    sourceRunId: verified.sourceRunId, attempt: verified.attempt, workflowPath: verified.workflowPath, workflowRef: verified.workflowRef,
    workflowSha: verified.workflowSha, csrSha256: verifiedMaterials.csrSha256 });
  const filePath = validateJournalPath(journalPath);
  if (typeof bundle !== 'string' || bundle.length < 1 || bundle.length > 60000 || typeof token !== 'string' || token.length < 1 || token.length > 4096 || typeof fetchImpl !== 'function'
    || !Number.isSafeInteger(deadline) || deadline > verified.sourceDeadline) fail('return-dispatch-input-invalid');
  const apiRequest = async (url, options, code, parseJson = false) => {
    const remaining = deadline - now();
    if (!Number.isSafeInteger(remaining) || remaining <= 0) fail(`${code}-deadline-unknown-manual-recovery`);
    const controller = new AbortController();
    let timer;
    try {
      const pending = Promise.resolve().then(async () => {
        const response = await fetchImpl(url, { ...options, signal: controller.signal });
        if (now() >= deadline) throw new Error('deadline-expired');
        if (!parseJson) return { response };
        if (!response || typeof response.json !== 'function') throw new Error('response-invalid');
        const data = await response.json();
        if (now() >= deadline) throw new Error('deadline-expired');
        return { response, data };
      });
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('request-timeout')); }, remaining); });
      const result = await Promise.race([pending, timeout]);
      if (now() >= deadline) fail(`${code}-deadline-unknown-manual-recovery`);
      return result;
    } catch { fail(`${code}-outcome-unknown-manual-recovery`); }
    finally { if (timer) clearTimeout(timer); }
  };
  let body;
  try { body = JSON.parse(bundle); } catch { fail('return-bundle-invalid'); }
  if (!isRecord(body) || body.source_run_id !== binding.sourceRunId || body.source_run_attempt !== binding.attempt
    || body.source_commit !== binding.workflowSha || body.csr_sha256 !== binding.csrSha256 || body.source_job_id !== 'source-csr') fail('return-bundle-binding-mismatch');
  const headers = { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28' };
  const apiRoot = `https://api.github.com/repos/${binding.repository}`;
  const sourceResult = await apiRequest(`${apiRoot}/actions/runs/${binding.sourceRunId}`, { method: 'GET', headers, redirect: 'error' }, 'return-source-read', true);
  const sourceResponse = sourceResult.response;
  if (!sourceResponse || sourceResponse.status !== 200) fail('return-source-read-failed');
  const source = sourceResult.data;
  if (!isRecord(source) || String(source.id) !== binding.sourceRunId || String(source.repository?.id) !== binding.repositoryId
    || source.path !== binding.workflowPath || source.head_sha !== binding.workflowSha || source.run_attempt !== Number(binding.attempt)
    || source.status !== 'in_progress' || source.conclusion !== null || source.event !== 'workflow_dispatch'
    || String(source.actor?.id) !== binding.actorId || source.head_branch !== binding.workflowRef.slice(`${binding.repository}/${binding.workflowPath}@refs/heads/`.length)) fail('return-source-binding-mismatch');
  const branch = binding.workflowRef.slice(`${binding.repository}/${binding.workflowPath}@refs/heads/`.length);
  const listResult = await apiRequest(`${apiRoot}/actions/workflows/sp08-a3-03-csr-return.yml/runs?branch=${encodeURIComponent(branch)}&event=workflow_dispatch&per_page=100`, { method: 'GET', headers, redirect: 'error' }, 'return-existing-run-read', true);
  const listResponse = listResult.response;
  if (!listResponse || listResponse.status !== 200) fail('return-existing-run-read-failed');
  const listed = listResult.data;
  if (!isRecord(listed) || !Array.isArray(listed.workflow_runs)) fail('return-existing-run-response-invalid');
  const prior = listed.workflow_runs.filter((run) => isRecord(run) && run.event === 'workflow_dispatch'
    && (run.path === RETURN_WORKFLOW || run.path === `${RETURN_WORKFLOW}@${binding.workflowRef.slice(binding.workflowRef.indexOf('@') + 1)}`)
    && run.head_sha === binding.workflowSha && String(run.actor?.id) === binding.actorId);
  if (prior.length) fail('return-run-already-exists-manual-recovery');
  const createdAt = now();
  if (!Number.isSafeInteger(createdAt)) fail('dispatch-journal-time-invalid');
  const initial = { version: 1, state: 'intent', createdAt, binding };
  let fd;
  try { fd = fs.openSync(filePath, 'wx', 0o600); } catch (error) { if (error.code === 'EEXIST') fail('dispatch-journal-already-exists-manual-recovery'); throw error; }
  try { writeJournal(fd, initial); } catch (error) { try { fs.closeSync(fd); } catch {} fail('dispatch-journal-write-failed-manual-recovery'); }
  fs.closeSync(fd);
  const dispatchBody = { ref: branch, inputs: { bundle } };
  try {
    const response = await apiRequest(`${apiRoot}/actions/workflows/sp08-a3-03-csr-return.yml/dispatches`, {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(dispatchBody), redirect: 'error',
    }, 'return-dispatch');
    if (!response || response.status !== 204) fail('return-dispatch-outcome-unknown-manual-recovery');
    const fdUpdate = fs.openSync(filePath, 'r+');
    try {
      const current = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!isRecord(current) || current.state !== 'intent' || JSON.stringify(current.binding) !== JSON.stringify(binding)) fail('dispatch-journal-state-invalid-manual-recovery');
      const finalRecord = { ...current, state: 'accepted', acceptedAt: now() };
      fs.ftruncateSync(fdUpdate, 0); fs.writeSync(fdUpdate, `${JSON.stringify(finalRecord)}\n`, 0, 'utf8'); fs.fsyncSync(fdUpdate);
    } finally { fs.closeSync(fdUpdate); }
    return Object.freeze({ state: 'accepted', binding });
  } catch (error) {
    if (error && error.message === 'return-dispatch-outcome-unknown-manual-recovery') throw error;
    throw new Error('return-dispatch-outcome-unknown-manual-recovery');
  }
}

module.exports = { dispatchReturnOnce, recordReturnRunId, validateBinding, validateJournalPath };
