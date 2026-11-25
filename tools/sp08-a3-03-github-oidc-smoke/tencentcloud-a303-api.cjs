'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { Client: TatClient } = require('tencentcloud-sdk-nodejs-tat/tencentcloud/services/tat/v20201028/tat_client');
const { Client: VpcClient } = require('tencentcloud-sdk-nodejs-vpc/tencentcloud/services/vpc/v20170312/vpc_client');
const { csrPublicKey, validateBudget, verifyPublicCertificateBinding } = require('./csr-handoff.cjs');
const { verifyEgressManifest } = require('./egress-ip.cjs');

const fail = (code) => { throw new Error(code); };
const failWithMarker = (code, marker) => { const error = new Error(code); error.cleanupMarker = marker; throw error; };
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const IPV4 = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const placeholders = /<[^>]+>|DRAFT|TODO|UNRESOLVED|PLACEHOLDER/i;
const verifiedMaterialState = new WeakMap();
const invocationMaterialState = new WeakMap();

function validateTarget(target) {
  if (!isRecord(target) || Object.keys(target).sort().join('|') !== 'commandId|instanceId|region|securityGroupId') fail('target-fields-invalid');
  for (const [field, prefix] of [['commandId', 'cmd-'], ['instanceId', 'ins-'], ['securityGroupId', 'sg-']]) {
    const value = target[field];
    if (typeof value !== 'string' || !value.startsWith(prefix) || value.length > 64 || placeholders.test(value)) fail(`target-${field}-invalid`);
  }
  if (typeof target.region !== 'string' || !/^[a-z]+-[a-z0-9-]+$/.test(target.region) || placeholders.test(target.region)) fail('target-region-invalid');
  return Object.freeze({ ...target });
}

function validateCsr(csrPem, expectedDigest) {
  if (typeof csrPem !== 'string' || Buffer.byteLength(csrPem, 'utf8') > 65536 || !/^-----BEGIN CERTIFICATE REQUEST-----\r?\n(?:[A-Za-z0-9+/]{1,64}={0,2}\r?\n)+-----END CERTIFICATE REQUEST-----\r?\n?$/.test(csrPem)) fail('csr-format-invalid');
  const digest = crypto.createHash('sha256').update(Buffer.from(csrPem, 'utf8')).digest('hex');
  if (typeof expectedDigest !== 'string' || !/^[a-f0-9]{64}$/.test(expectedDigest) || digest !== expectedDigest) fail('csr-digest-mismatch');
  const encoded = Buffer.from(csrPem, 'utf8').toString('base64');
  if (encoded.length > 90000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) fail('csr-base64-invalid');
  return encoded;
}

function validateEgressCidr(cidr) {
  if (typeof cidr !== 'string' || !cidr.endsWith('/32')) fail('egress-cidr-invalid');
  const ip = cidr.slice(0, -3);
  if (!IPV4.test(ip) || ip.split('.').some((part) => Number(part) > 255)) fail('egress-cidr-invalid');
  return cidr;
}

async function verifySourceMaterials({ expected, token, repository, fetchImpl = globalThis.fetch, now = Date.now, pwshPath }) {
  const bounded = validateBudget({ maxPolls: 1, maxPages: 1, maxCandidates: 1, maxArtifactBytes: 65536, maxWaitMs: 300000, requestTimeoutMs: 10000, pollDelaysMs: [0] });
  if (typeof pwshPath !== 'string' || !path.isAbsolute(pwshPath)
    || typeof expected.caFingerprint256 !== 'string' || !/^[a-f0-9]{64}$/i.test(expected.caFingerprint256)
    || typeof token !== 'string' || token.length < 1 || token.length > 4096
    || typeof repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || typeof fetchImpl !== 'function'
    || !isRecord(expected) || !/^[0-9]+$/.test(expected.repositoryId) || !/^[0-9]+$/.test(expected.actorId)
    || typeof expected.actorLogin !== 'string' || !/^[A-Za-z0-9-]+$/.test(expected.actorLogin)
    || typeof expected.workflowPath !== 'string' || !/^\.github\/workflows\/[A-Za-z0-9_.-]+\.yml$/.test(expected.workflowPath)
    || !/^[a-f0-9]{40,64}$/.test(expected.trustedHeadSha) || !Number.isSafeInteger(expected.notBeforeMs)
    || !Number.isSafeInteger(expected.notAfterMs) || expected.notAfterMs < expected.notBeforeMs) fail('source-verification-config-invalid');
  const time = now();
  if (!Number.isSafeInteger(time)) fail('source-verification-time-invalid');
  const sourceRunId = expected.sourceRunId;
  if (typeof sourceRunId !== 'string' || !/^[1-9][0-9]{0,19}$/.test(sourceRunId)) fail('source-run-id-required');
  const url = `https://api.github.com/repos/${repository}/actions/runs/${sourceRunId}`;
  const requestOptions = { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(bounded.requestTimeoutMs), headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28' } };
  const response = await fetchImpl(url, requestOptions);
  if (!response || response.status !== 200 || (response.url && new URL(response.url).origin !== 'https://api.github.com')) fail('source-run-api-failed');
  const actualRun = await response.json();
  if (!isRecord(actualRun) || String(actualRun.id) !== sourceRunId || String(actualRun.repository?.id) !== expected.repositoryId
    || actualRun.path !== expected.workflowPath || actualRun.head_sha !== expected.trustedHeadSha || actualRun.run_attempt !== 1
    || actualRun.event !== 'workflow_dispatch' || actualRun.status !== 'in_progress' || actualRun.conclusion !== null
    || String(actualRun.actor?.id) !== expected.actorId || actualRun.actor?.login !== expected.actorLogin
    || typeof actualRun.created_at !== 'string' || !Number.isFinite(Date.parse(actualRun.created_at))
    || Date.parse(actualRun.created_at) < expected.notBeforeMs || Date.parse(actualRun.created_at) > Math.min(expected.notAfterMs, time)) fail('source-run-not-active-or-untrusted');
  const run = actualRun;
  const artifactListUrl = `https://api.github.com/repos/${repository}/actions/runs/${sourceRunId}/artifacts?per_page=100`;
  const listResponse = await fetchImpl(artifactListUrl, requestOptions);
  if (!listResponse || listResponse.status !== 200 || (listResponse.url && new URL(listResponse.url).origin !== 'https://api.github.com')) fail('source-artifact-list-failed');
  const artifactList = await listResponse.json();
  const expectedArtifactName = `sp08-a303-csr-${sourceRunId}-1`;
  if (!isRecord(artifactList) || artifactList.total_count !== 1 || !Array.isArray(artifactList.artifacts) || artifactList.artifacts.length !== 1) fail('source-artifact-ambiguous');
  const [artifact] = artifactList.artifacts;
  if (!isRecord(artifact) || artifact.name !== expectedArtifactName || artifact.expired !== false || !Number.isSafeInteger(artifact.id)
    || !Number.isSafeInteger(artifact.size_in_bytes) || artifact.size_in_bytes < 1 || artifact.size_in_bytes > 262144
    || typeof artifact.digest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(artifact.digest)
    || !isRecord(artifact.workflow_run) || String(artifact.workflow_run.id) !== sourceRunId
    || String(artifact.workflow_run.repository_id) !== expected.repositoryId || artifact.workflow_run.head_sha !== run.head_sha) fail('source-artifact-metadata-invalid');
  const downloadUrl = `https://api.github.com/repos/${repository}/actions/artifacts/${artifact.id}/zip`;
  const redirectResponse = await fetchImpl(downloadUrl, { ...requestOptions, redirect: 'manual' });
  if (!redirectResponse || redirectResponse.status !== 302) fail('source-artifact-redirect-invalid');
  const signedUrl = redirectResponse.headers?.get?.('location');
  let parsedSignedUrl;
  try { parsedSignedUrl = new URL(signedUrl); } catch { fail('source-artifact-download-url-invalid'); }
  if (typeof signedUrl !== 'string' || parsedSignedUrl.protocol !== 'https:' || parsedSignedUrl.username || parsedSignedUrl.password) fail('source-artifact-download-url-invalid');
  const archiveResponse = await fetchImpl(signedUrl, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(bounded.requestTimeoutMs), headers: { accept: 'application/zip' } });
  if (!archiveResponse || archiveResponse.status !== 200) fail('source-artifact-download-failed');
  if (!archiveResponse.body || typeof archiveResponse.body.getReader !== 'function') fail('source-artifact-body-invalid');
  const reader = archiveResponse.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    const bytes = Buffer.from(chunk.value);
    totalBytes += bytes.byteLength;
    if (totalBytes > 262144) { await reader.cancel(); fail('source-artifact-size-limit'); }
    chunks.push(bytes);
  }
  const archive = Buffer.concat(chunks, totalBytes);
  if (archive.byteLength !== artifact.size_in_bytes || archive.byteLength > 262144
    || `sha256:${crypto.createHash('sha256').update(archive).digest('hex')}` !== artifact.digest) fail('source-artifact-digest-mismatch');
  const zipPath = path.join(os.tmpdir(), `a303-${crypto.randomBytes(16).toString('hex')}.zip`);
  fs.writeFileSync(zipPath, archive, { flag: 'wx', mode: 0o600 });
  let extracted;
  try {
    const scriptPath = path.join(__dirname, 'read-source-artifact.ps1');
    const result = spawnSync(pwshPath, ['-NoProfile', '-NonInteractive', '-File', scriptPath, '-ZipPath', zipPath], { encoding: 'utf8', timeout: 10000, maxBuffer: 262144, windowsHide: true, shell: false });
    if (result.error || result.status !== 0 || Buffer.byteLength(result.stdout) > 220000) fail('source-artifact-extraction-failed');
    extracted = JSON.parse(result.stdout);
  } finally { fs.unlinkSync(zipPath); }
  if (!isRecord(extracted) || Object.keys(extracted).sort().join('|') !== 'egress-ip-manifest.json|source-manifest.json|source.csr.pem'
    || Object.values(extracted).some((value) => typeof value !== 'string' || value.length > 90000)) fail('source-artifact-content-invalid');
  const sourceFiles = Object.fromEntries(Object.entries(extracted).map(([name, value]) => [name, Buffer.from(value, 'base64')]));
  const sourceManifestBytes = sourceFiles['source-manifest.json'];
  if (sourceManifestBytes.byteLength > 8192) fail('source-manifest-size-limit');
  const manifestData = JSON.parse(sourceManifestBytes.toString('utf8'));
  const csr = sourceFiles['source.csr.pem'];
  const egressBytes = sourceFiles['egress-ip-manifest.json'];
  if (egressBytes.byteLength > 8192) fail('egress-manifest-size-limit');
  const egress = JSON.parse(egressBytes.toString('utf8'));
  const manifest = manifestData;
  if (!isRecord(manifest) || Object.keys(manifest).sort().join('|') !== 'csr_sha256|source_commit|source_job_id|source_run_attempt|source_run_id|source_started_at'
    || manifest.source_job_id !== 'source-csr' || manifest.source_run_attempt !== '1' || !/^[1-9][0-9]{0,19}$/.test(manifest.source_run_id)
    || !/^[a-f0-9]{40,64}$/.test(manifest.source_commit) || !/^[a-f0-9]{64}$/.test(manifest.csr_sha256)
    || typeof manifest.source_started_at !== 'string' || !Number.isFinite(Date.parse(manifest.source_started_at))) fail('source-manifest-invalid');
  if (csr.byteLength > 65536 || crypto.createHash('sha256').update(csr).digest('hex') !== manifest.csr_sha256) fail('source-csr-digest-mismatch');
  csrPublicKey(csr, { pwshPath, timeoutMs: 5000 });
  if (String(manifest.source_run_id) !== sourceRunId || manifest.source_commit !== run.head_sha) fail('source-manifest-run-binding-mismatch');
  const expectedEgress = { runId: manifest.source_run_id, runAttempt: '1', workflowSha: manifest.source_commit, csrSha256: manifest.csr_sha256 };
  const cidr = verifyEgressManifest(egress, expectedEgress, new Date(time));
  const material = Object.freeze({ sourceRunId: manifest.source_run_id, attempt: '1', workflowSha: manifest.source_commit, csrSha256: manifest.csr_sha256, csrPem: csr.toString('utf8'), cidr,
    sourceDeadline: Date.parse(manifest.source_started_at) + 300000, egressDeadline: Date.parse(egress.expires_at) });
  verifiedMaterialState.set(material, { invokeUsed: false, ingressUsed: false, csrBytes: Buffer.from(csr), expectedCaFingerprint256: expected.caFingerprint256, pwshPath });
  return material;
}

function buildClients({ region, transport }) {
  if (typeof transport !== 'function') fail('transport-required');
  const config = { credential: { secretId: '', secretKey: '' }, region, profile: { httpProfile: { reqTimeout: 10000 } } };
  class TatOfflineClient extends TatClient { async doRequest(action, request) { return transport('tat', action, request); } }
  class VpcOfflineClient extends VpcClient { async doRequest(action, request) { return transport('vpc', action, request); } }
  return Object.freeze({ tat: new TatOfflineClient(config), vpc: new VpcOfflineClient(config) });
}

function buildSdkClients({ region, credential, reqTimeoutMs = 10000 }) {
  if (typeof region !== 'string' || !/^[a-z]+-[a-z0-9-]+$/.test(region) || placeholders.test(region)
    || !isRecord(credential) || typeof credential.secretId !== 'string' || credential.secretId.length === 0
    || typeof credential.secretKey !== 'string' || credential.secretKey.length === 0
    || !Number.isSafeInteger(reqTimeoutMs) || reqTimeoutMs < 1000 || reqTimeoutMs > 30000) fail('sdk-client-config-invalid');
  const config = { credential: { secretId: credential.secretId, secretKey: credential.secretKey, ...(typeof credential.token === 'string' ? { token: credential.token } : {}) }, region,
    profile: { httpProfile: { reqTimeout: reqTimeoutMs } } };
  return Object.freeze({ tat: new TatClient(config), vpc: new VpcClient(config) });
}

async function invokeOnce({ clients, target, verifiedMaterials, now = () => Date.now() }) {
  const fixed = validateTarget(target);
  const state = isRecord(verifiedMaterials) && verifiedMaterialState.get(verifiedMaterials);
  if (!state) fail('verified-source-materials-required');
  if (state.invokeUsed) fail('invoke-already-attempted-manual-recovery');
  const timestamp = now();
  if (!Number.isSafeInteger(timestamp) || timestamp >= verifiedMaterials.sourceDeadline || timestamp >= verifiedMaterials.egressDeadline) fail('source-or-egress-deadline-expired');
  state.invokeUsed = true;
  const cidr = validateEgressCidr(verifiedMaterials.cidr);
  const csrB64 = validateCsr(verifiedMaterials.csrPem, verifiedMaterials.csrSha256);
  let invocation;
  try { invocation = await clients.tat.InvokeCommand({ CommandId: fixed.commandId, InstanceIds: [fixed.instanceId], Parameters: JSON.stringify({ csr_b64: csrB64 }), Timeout: 300 }); }
  catch { fail('invoke-outcome-unknown-manual-recovery'); }
  if (!isRecord(invocation) || typeof invocation.InvocationId !== 'string' || !/^inv-[a-z0-9]+$/.test(invocation.InvocationId)) fail('invocation-result-unknown-manual-recovery');
  const invocationState = Object.freeze({ invocationId: invocation.InvocationId, instanceId: fixed.instanceId, commandId: fixed.commandId, region: fixed.region, securityGroupId: fixed.securityGroupId, cidr, csrSha256: verifiedMaterials.csrSha256, startedAt: timestamp });
  invocationMaterialState.set(invocationState, state);
  return invocationState;
}

async function pollTask({ clients, invocation, maxPages = 1, now = () => Date.now() }) {
  if (!isRecord(invocation) || typeof invocation.invocationId !== 'string' || !/^inv-[a-z0-9]+$/.test(invocation.invocationId)
    || !Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 4) fail('invocation-state-invalid');
  const tasks = [];
  let offset = 0;
  for (let page = 0; page < maxPages; page += 1) {
    const response = await clients.tat.DescribeInvocationTasks({ Filters: [{ Name: 'invocation-id', Values: [invocation.invocationId] }, { Name: 'instance-id', Values: [invocation.instanceId] }], Limit: 100, Offset: offset, HideOutput: false });
    if (!isRecord(response) || !Number.isSafeInteger(response.TotalCount) || !Array.isArray(response.InvocationTaskSet)) fail('task-response-invalid-manual-recovery');
    tasks.push(...response.InvocationTaskSet);
    if (tasks.length >= response.TotalCount) break;
    offset += response.InvocationTaskSet.length;
    if (response.InvocationTaskSet.length === 0 || page + 1 === maxPages) fail('task-pagination-incomplete-manual-recovery');
  }
  const matches = tasks.filter((task) => isRecord(task) && task.InvocationId === invocation.invocationId && task.InstanceId === invocation.instanceId && task.CommandId === invocation.commandId);
  if (matches.length !== 1) fail('task-missing-or-ambiguous-manual-recovery');
  const task = matches[0];
  if (task.TaskStatus === 'PENDING' || task.TaskStatus === 'DELIVERING' || task.TaskStatus === 'RUNNING') return Object.freeze({ state: 'running' });
  if (task.TaskStatus !== 'SUCCESS' || !isRecord(task.TaskResult) || task.TaskResult.ExitCode !== 0 || typeof task.TaskResult.Output !== 'string' || task.TaskResult.Dropped !== 0) fail('task-failed-or-output-incomplete-manual-recovery');
  const output = decodePublicOutput(task.TaskResult.Output);
  if (output.csr_sha256 !== invocation.csrSha256) fail('task-output-csr-binding-mismatch-manual-recovery');
  const materialState = invocationMaterialState.get(invocation);
  if (!materialState) fail('task-source-binding-missing-manual-recovery');
  try {
    verifyPublicCertificateBinding({ csrBytes: materialState.csrBytes, expectedCsrSha256: invocation.csrSha256,
      leafPem: output.leaf_certificate, caPem: output.ca_certificate, expectedCaFingerprint256: materialState.expectedCaFingerprint256,
      pwshPath: materialState.pwshPath, now: now() });
  } catch { fail('task-certificate-binding-invalid-manual-recovery'); }
  return Object.freeze({ state: 'success', output });
}

async function pollUntilTerminal({ clients, invocation, maxPolls = 3, maxPages = 1, deadlineMs, now = () => Date.now(), sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), pollDelayMs = 1000 }) {
  if (!Number.isSafeInteger(maxPolls) || maxPolls < 1 || maxPolls > 4 || maxPolls * maxPages > 4
    || !Number.isSafeInteger(deadlineMs) || !Number.isSafeInteger(invocation?.startedAt) || deadlineMs > invocation.startedAt + 300000 || typeof now !== 'function' || typeof sleep !== 'function'
    || !Number.isSafeInteger(pollDelayMs) || pollDelayMs < 0) fail('poll-budget-invalid');
  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    const current = now();
    if (!Number.isSafeInteger(current) || current >= deadlineMs) fail('task-deadline-expired-manual-recovery');
    const result = await pollTask({ clients, invocation, maxPages });
    if (now() >= deadlineMs) fail('task-deadline-expired-manual-recovery');
    if (result.state !== 'running') return result;
    if (attempt + 1 === maxPolls) break;
    const remaining = deadlineMs - now();
    if (remaining <= 0) fail('task-deadline-expired-manual-recovery');
    await sleep(Math.min(pollDelayMs, remaining));
  }
  fail('task-still-running-manual-recovery');
}

function decodePublicOutput(encoded) {
  if (typeof encoded !== 'string' || encoded.length > 32000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) fail('task-output-invalid');
  const text = Buffer.from(encoded, 'base64').toString('utf8');
  if (Buffer.byteLength(text, 'utf8') > 24000) fail('task-output-truncated-manual-recovery');
  const values = Object.create(null);
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (line.length === 0) continue;
    const separator = line.indexOf('=');
    if (separator < 1) fail('task-output-not-allowlisted');
    const key = line.slice(0, separator);
    if (!['csr_sha256', 'leaf_cert_b64', 'ca_cert_b64'].includes(key) || Object.hasOwn(values, key)) fail('task-output-not-allowlisted');
    values[key] = line.slice(separator + 1);
  }
  if (Object.keys(values).sort().join('|') !== 'ca_cert_b64|csr_sha256|leaf_cert_b64'
    || typeof values.csr_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(values.csr_sha256)) fail('task-output-not-allowlisted');
  const decodeCertificate = (value) => {
    if (typeof value !== 'string' || value.length < 4 || value.length > 32000
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) fail('task-output-certificate-invalid');
    const decoded = Buffer.from(value, 'base64');
    if (decoded.toString('base64') !== value) fail('task-output-certificate-invalid');
    let pem = decoded.toString('utf8').replace(/\r\n/g, '\n');
    if (!pem.startsWith('-----BEGIN CERTIFICATE-----\n') || !pem.endsWith('-----END CERTIFICATE-----\n') && !pem.endsWith('-----END CERTIFICATE-----')) fail('task-output-certificate-invalid');
    if (!pem.endsWith('\n')) pem += '\n';
    return pem;
  };
  return Object.freeze({ csr_sha256: values.csr_sha256, leaf_certificate: decodeCertificate(values.leaf_cert_b64), ca_certificate: decodeCertificate(values.ca_cert_b64) });
}

async function addIngressRule({ clients, target, verifiedMaterials, now = () => Date.now() }) {
  const fixed = validateTarget(target);
  const materialState = isRecord(verifiedMaterials) && verifiedMaterialState.get(verifiedMaterials);
  if (!materialState) fail('verified-source-materials-required');
  const timestamp = now();
  if (materialState.ingressUsed || !Number.isSafeInteger(timestamp) || timestamp >= verifiedMaterials.sourceDeadline || timestamp >= verifiedMaterials.egressDeadline) fail('source-or-egress-expired-or-rule-already-added');
  materialState.ingressUsed = true;
  const cidr = validateEgressCidr(verifiedMaterials.cidr);
  const response = await clients.vpc.DescribeSecurityGroupPolicies({ SecurityGroupId: fixed.securityGroupId });
  const set = response && response.SecurityGroupPolicySet;
  if (!isRecord(set) || typeof set.Version !== 'string' || !Array.isArray(set.Ingress)) fail('security-group-state-invalid');
  const marker = `A303-${crypto.randomBytes(12).toString('hex')}`;
  const rule = { Protocol: 'TCP', Port: '8443', CidrBlock: cidr, Action: 'ACCEPT', PolicyDescription: marker };
  if (set.Ingress.some((entry) => isRecord(entry) && entry.Protocol?.toUpperCase() === 'TCP' && entry.Port === '8443' && entry.CidrBlock === cidr && entry.Action?.toUpperCase() === 'ACCEPT')) fail('security-group-rule-preexisting-manual-recovery');
  let createError;
  try {
    const created = await clients.vpc.CreateSecurityGroupPolicies({ SecurityGroupId: fixed.securityGroupId, SecurityGroupPolicySet: { Version: set.Version, Ingress: [rule] } });
    if (!isRecord(created) || typeof created.RequestId !== 'string') createError = new Error('unknown-response');
  } catch { createError = new Error('unknown-response'); }
  let after;
  try { after = await clients.vpc.DescribeSecurityGroupPolicies({ SecurityGroupId: fixed.securityGroupId }); }
  catch { failWithMarker('security-group-create-state-unknown-manual-recovery', marker); }
  const afterSet = after && after.SecurityGroupPolicySet;
  if (!isRecord(afterSet) || typeof afterSet.Version !== 'string' || !Array.isArray(afterSet.Ingress)) fail('security-group-created-state-unknown-manual-recovery');
  const exact = afterSet.Ingress.filter((entry) => isRecord(entry) && entry.Protocol?.toUpperCase() === 'TCP' && entry.Port === '8443' && entry.CidrBlock === cidr && entry.Action?.toUpperCase() === 'ACCEPT' && entry.PolicyDescription === marker);
  if (exact.length === 0 && createError) fail('security-group-create-not-applied');
  if (exact.length !== 1) failWithMarker('security-group-rule-ambiguous-manual-recovery', marker);
  return Object.freeze({ securityGroupId: fixed.securityGroupId, version: afterSet.Version, rule, policyIndex: exact[0].PolicyIndex, createdAt: now(), createOutcome: createError ? 'recovered-by-marker' : 'confirmed' });
}

async function removeIngressRule({ clients, lease }) {
  if (!isRecord(lease) || typeof lease.securityGroupId !== 'string' || typeof lease.version !== 'string' || !Number.isSafeInteger(lease.policyIndex)
    || !isRecord(lease.rule) || typeof lease.rule.PolicyDescription !== 'string' || !/^A303-[a-f0-9]{24}$/.test(lease.rule.PolicyDescription)) fail('security-group-lease-invalid-manual-recovery');
  const state = await clients.vpc.DescribeSecurityGroupPolicies({ SecurityGroupId: lease.securityGroupId });
  const set = state && state.SecurityGroupPolicySet;
  if (!isRecord(set) || typeof set.Version !== 'string' || !Array.isArray(set.Ingress)) fail('security-group-state-unknown-manual-recovery');
  const exact = set.Ingress.filter((entry) => isRecord(entry) && entry.PolicyDescription === lease.rule.PolicyDescription && entry.Protocol?.toUpperCase() === lease.rule.Protocol && entry.Port === lease.rule.Port && entry.CidrBlock === lease.rule.CidrBlock && entry.Action?.toUpperCase() === lease.rule.Action);
  if (exact.length !== 1) fail('security-group-rule-changed-manual-recovery');
  let deleteError = false;
  try {
    const deleted = await clients.vpc.DeleteSecurityGroupPolicies({ SecurityGroupId: lease.securityGroupId, SecurityGroupPolicySet: { Version: set.Version, Ingress: [{ PolicyIndex: exact[0].PolicyIndex }] } });
    if (!isRecord(deleted) || typeof deleted.RequestId !== 'string') deleteError = true;
  } catch { deleteError = true; }
  const finalState = await clients.vpc.DescribeSecurityGroupPolicies({ SecurityGroupId: lease.securityGroupId });
  if (!isRecord(finalState?.SecurityGroupPolicySet) || !Array.isArray(finalState.SecurityGroupPolicySet.Ingress)) failWithMarker('security-group-delete-state-unknown-manual-recovery', lease.rule.PolicyDescription);
  const remains = finalState.SecurityGroupPolicySet.Ingress.some((entry) => isRecord(entry) && entry.PolicyDescription === lease.rule.PolicyDescription);
  if (remains) failWithMarker(deleteError ? 'security-group-delete-outcome-unknown-manual-recovery' : 'security-group-delete-not-confirmed-manual-recovery', lease.rule.PolicyDescription);
  return Object.freeze({ removed: true, deleteOutcome: deleteError ? 'recovered-by-readback' : 'confirmed' });
}

async function withIngressRule({ clients, target, verifiedMaterials, operation, now = () => Date.now() }) {
  if (typeof operation !== 'function') fail('ingress-operation-required');
  const lease = await addIngressRule({ clients, target, verifiedMaterials, now });
  let result;
  let operationError;
  try { result = await operation(lease); } catch (error) { operationError = error; }
  let cleanupError;
  try { await removeIngressRule({ clients, lease }); } catch (error) { cleanupError = error; }
  if (operationError) {
    if (cleanupError) fail('operation-failed-security-group-cleanup-unknown-manual-recovery');
    throw operationError;
  }
  if (cleanupError) fail('operation-succeeded-security-group-cleanup-unknown-manual-recovery');
  return result;
}

module.exports = { addIngressRule, buildClients, buildSdkClients, decodePublicOutput, invokeOnce, pollTask, pollUntilTerminal, removeIngressRule, validateCsr, validateTarget, verifySourceMaterials, withIngressRule };
