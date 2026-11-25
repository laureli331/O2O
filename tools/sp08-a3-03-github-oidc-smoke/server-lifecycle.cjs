'use strict';

const crypto = require('node:crypto');
const localA = require('./a-segment-local.cjs');
const { withIngressRule } = require('./tencentcloud-a303-api.cjs');

const fail = (code) => { throw new Error(code); };
const placeholders = /<[^>]+>|DRAFT|TODO|UNRESOLVED|PLACEHOLDER/i;
const invocationIds = new WeakSet();

function validateLifecycleTargets(targets) {
  if (!targets || typeof targets !== 'object' || Array.isArray(targets)
    || Object.keys(targets).sort().join('|') !== 'instanceId|region|securityGroupId|startCommandId|stopCommandId') fail('lifecycle-target-fields-invalid');
  for (const [key, prefix] of [['instanceId', 'ins-'], ['securityGroupId', 'sg-'], ['startCommandId', 'cmd-'], ['stopCommandId', 'cmd-']]) {
    if (typeof targets[key] !== 'string' || !targets[key].startsWith(prefix) || targets[key].length > 64 || placeholders.test(targets[key])) fail(`lifecycle-${key}-invalid`);
  }
  if (targets.startCommandId === targets.stopCommandId) fail('lifecycle-command-ids-must-differ');
  if (typeof targets.region !== 'string' || !/^[a-z]+-[a-z0-9-]+$/.test(targets.region) || placeholders.test(targets.region)) fail('lifecycle-region-invalid');
  return Object.freeze({ ...targets });
}

function validateServerInput(serialized, expected) {
  if (typeof serialized !== 'string' || Buffer.byteLength(serialized, 'utf8') > 48000) fail('server-input-size-invalid');
  let input;
  try { input = JSON.parse(serialized); } catch { fail('server-input-json-invalid'); }
  const keys = Object.keys(input || {}).sort().join('|');
  if (keys !== 'authorization|authorizedUntil|bindIPv4|interfaceName|mode|policy|port|sourceBinding') fail('server-input-fields-invalid');
  const claims = input.policy && input.policy.expectedClaims;
  const request = input.policy && input.policy.expectedRequest;
  if (!input.sourceBinding || typeof input.sourceBinding !== 'object' || Array.isArray(input.sourceBinding)
    || input.mode !== 'start-approved' || !Number.isSafeInteger(input.authorizedUntil) || input.authorizedUntil <= expected.now || input.authorizedUntil > expected.now + 15 * 60 * 1000
    || input.authorization !== 'explicit-temporary'
    || typeof input.interfaceName !== 'string' || !/^[A-Za-z0-9_.:-]{1,32}$/.test(input.interfaceName)
    || typeof input.bindIPv4 !== 'string' || !localA.isPrivateIPv4(input.bindIPv4)
    || input.port !== 8443 || !claims || !request || claims.run_id !== expected.sourceRunId || claims.run_attempt !== expected.attempt
    || claims.workflow_sha !== expected.workflowSha || request.run_id !== expected.sourceRunId || request.run_attempt !== expected.attempt
    || request.repository_id !== claims.repository_id || request.payload?.database_access !== false
    || input.sourceBinding.run_id !== expected.sourceRunId || input.sourceBinding.run_attempt !== expected.attempt
    || input.sourceBinding.workflow_sha !== expected.workflowSha || input.sourceBinding.csr_sha256 !== expected.csrSha256
    || input.policy.serverIPv4 !== expected.clbIPv4 || input.policy.mode !== 'github-oidc'
    || !Number.isSafeInteger(input.policy.githubJwksFetchedAt) || !Number.isSafeInteger(input.policy.githubJwksExpiresAt)
    || input.policy.githubJwksFetchedAt > expected.now || input.policy.githubJwksExpiresAt <= expected.now
    || input.policy.githubJwksExpiresAt - input.policy.githubJwksFetchedAt > 15 * 60 * 1000) fail('server-input-binding-invalid');
  return Buffer.from(serialized, 'utf8').toString('base64');
}

function bindVerifiedSourceInput(serialized, source) {
  if (typeof serialized !== 'string' || Buffer.byteLength(serialized, 'utf8') > 48000) fail('server-input-size-invalid');
  let input;
  try { input = JSON.parse(serialized); } catch { fail('server-input-json-invalid'); }
  const keys = Object.keys(input || {}).sort().join('|');
  if (keys !== 'authorization|authorizedUntil|bindIPv4|interfaceName|mode|policy|port') fail('server-input-fields-invalid');
  return JSON.stringify({ ...input, sourceBinding: { run_id: source.sourceRunId, run_attempt: source.attempt,
    workflow_sha: source.workflowSha, csr_sha256: source.csrSha256 } });
}

async function invokeLifecycleCommand({ clients, target, commandId, parameters, now }) {
  const startedAt = now();
  let response;
  try { response = await clients.tat.InvokeCommand({ CommandId: commandId, InstanceIds: [target.instanceId], Parameters: JSON.stringify(parameters), Timeout: 300 }); }
  catch { fail('lifecycle-invoke-outcome-unknown-manual-recovery'); }
  if (!response || typeof response.InvocationId !== 'string' || !/^inv-[a-z0-9]+$/.test(response.InvocationId)) fail('lifecycle-invocation-unknown-manual-recovery');
  const invocation = Object.freeze({ invocationId: response.InvocationId, commandId, instanceId: target.instanceId, startedAt });
  invocationIds.add(invocation);
  return invocation;
}

async function pollLifecycleTask({ clients, invocation, expectedOutput, now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  if (!invocationIds.has(invocation)) fail('lifecycle-invocation-untrusted');
  const deadline = invocation.startedAt + 300000;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (now() >= deadline) fail('lifecycle-task-deadline-manual-recovery');
    const response = await clients.tat.DescribeInvocationTasks({ Filters: [{ Name: 'invocation-id', Values: [invocation.invocationId] }, { Name: 'instance-id', Values: [invocation.instanceId] }], Limit: 100, Offset: 0, HideOutput: false });
    if (!response || !Number.isSafeInteger(response.TotalCount) || !Array.isArray(response.InvocationTaskSet) || response.TotalCount !== 1 || response.InvocationTaskSet.length !== 1) fail('lifecycle-task-ambiguous-manual-recovery');
    const task = response.InvocationTaskSet[0];
    if (task.InvocationId !== invocation.invocationId || task.InstanceId !== invocation.instanceId || task.CommandId !== invocation.commandId) fail('lifecycle-task-binding-invalid');
    if (['PENDING', 'DELIVERING', 'RUNNING'].includes(task.TaskStatus)) {
      if (attempt === 3) break;
      await sleep(Math.min(1000, deadline - now()));
      continue;
    }
    if (task.TaskStatus !== 'SUCCESS' || !task.TaskResult || task.TaskResult.ExitCode !== 0 || task.TaskResult.Dropped !== 0 || typeof task.TaskResult.Output !== 'string') fail('lifecycle-task-failed-manual-recovery');
    const output = Buffer.from(task.TaskResult.Output, 'base64').toString('utf8');
    if (Buffer.from(output, 'utf8').toString('base64') !== task.TaskResult.Output || output !== `${expectedOutput}\n`) fail('lifecycle-result-proof-invalid-manual-recovery');
    return Object.freeze({ state: 'success', evidence: expectedOutput });
  }
  fail('lifecycle-task-still-running-manual-recovery');
}

async function runServerLifecycle({ clients, targets, verifiedMaterials, serverInput, expectedInput, operation, now = Date.now, sleep }) {
  const fixed = validateLifecycleTargets(targets);
  if (!verifiedMaterials || typeof verifiedMaterials.sourceRunId !== 'string' || typeof verifiedMaterials.attempt !== 'string'
    || typeof verifiedMaterials.workflowSha !== 'string' || typeof verifiedMaterials.csrSha256 !== 'string'
    || typeof operation !== 'function') fail('lifecycle-source-or-operation-invalid');
  const boundInput = bindVerifiedSourceInput(serverInput, verifiedMaterials);
  const inputB64 = validateServerInput(boundInput, { ...expectedInput, now: now(), instanceId: fixed.instanceId,
    sourceRunId: verifiedMaterials.sourceRunId, attempt: verifiedMaterials.attempt, workflowSha: verifiedMaterials.workflowSha, csrSha256: verifiedMaterials.csrSha256 });
  let startError;
  let result;
  try {
    const start = await invokeLifecycleCommand({ clients, target: fixed, commandId: fixed.startCommandId, parameters: { server_input_b64: inputB64 }, now });
    await pollLifecycleTask({ clients, invocation: start, expectedOutput: 'listener_ready=private_ipv4:8443', now, ...(sleep ? { sleep } : {}) });
    result = await operation();
  } catch (error) { startError = error; }
  let stopError;
  try {
    const stop = await invokeLifecycleCommand({ clients, target: fixed, commandId: fixed.stopCommandId, parameters: { source_run_id: verifiedMaterials.sourceRunId }, now });
    await pollLifecycleTask({ clients, invocation: stop, expectedOutput: 'server_stopped_and_keys_removed=true', now, ...(sleep ? { sleep } : {}) });
  } catch (error) { stopError = error; }
  if (startError) {
    if (stopError) throw Object.assign(new Error('lifecycle-failed-stop-unknown-manual-recovery', { cause: startError }), { stopErrorCode: stopError.message });
    throw startError;
  }
  if (stopError) fail('lifecycle-return-built-stop-unknown-manual-recovery');
  return result;
}

async function runServerLifecycleWithIngress({ clients, securityTarget, verifiedMaterials, lifecycleOptions, now = Date.now }) {
  return withIngressRule({ clients, target: securityTarget, verifiedMaterials, now,
    operation: async () => runServerLifecycle({ ...lifecycleOptions, clients, verifiedMaterials, now }) });
}

module.exports = { bindVerifiedSourceInput, runServerLifecycle, runServerLifecycleWithIngress, validateLifecycleTargets, validateServerInput };
