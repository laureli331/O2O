'use strict';

const crypto = require('node:crypto');
const localA = require('./a-segment-local.cjs');
const { requestWithinDeadline, requireVerifiedCallerCompletion, requireVerifiedSourceMaterials, withIngressRule } = require('./tencentcloud-a303-api.cjs');

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

async function invokeLifecycleCommand({ clients, target, commandId, parameters, now, deadline }) {
  const startedAt = now();
  const remaining = deadline - startedAt;
  if (!Number.isSafeInteger(startedAt) || !Number.isSafeInteger(remaining) || remaining <= 0) fail('lifecycle-deadline-expired-manual-recovery');
  let response;
  try { response = await requestWithinDeadline({ client: clients.tat, method: 'InvokeCommand', args: [{ CommandId: commandId, InstanceIds: [target.instanceId], Parameters: JSON.stringify(parameters), Timeout: Math.min(300, Math.max(1, Math.floor(remaining / 1000))) }], deadline, now }); }
  catch { fail('lifecycle-invoke-outcome-unknown-manual-recovery'); }
  if (!response || typeof response.InvocationId !== 'string' || !/^inv-[a-z0-9]+$/.test(response.InvocationId)) fail('lifecycle-invocation-unknown-manual-recovery');
  const invocation = Object.freeze({ invocationId: response.InvocationId, commandId, instanceId: target.instanceId, startedAt });
  invocationIds.add(invocation);
  return invocation;
}

async function pollLifecycleTask({ clients, invocation, expectedOutput, deadline, now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  if (!invocationIds.has(invocation)) fail('lifecycle-invocation-untrusted');
  const taskDeadline = Math.min(deadline, invocation.startedAt + 300000);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (now() >= taskDeadline) fail('lifecycle-task-deadline-manual-recovery');
    const response = await requestWithinDeadline({ client: clients.tat, method: 'DescribeInvocationTasks', args: [{ Filters: [{ Name: 'invocation-id', Values: [invocation.invocationId] }, { Name: 'instance-id', Values: [invocation.instanceId] }], Limit: 100, Offset: 0, HideOutput: false }], deadline: taskDeadline, now });
    if (!response || !Number.isSafeInteger(response.TotalCount) || !Array.isArray(response.InvocationTaskSet) || response.TotalCount !== 1 || response.InvocationTaskSet.length !== 1) fail('lifecycle-task-ambiguous-manual-recovery');
    const task = response.InvocationTaskSet[0];
    if (task.InvocationId !== invocation.invocationId || task.InstanceId !== invocation.instanceId || task.CommandId !== invocation.commandId) fail('lifecycle-task-binding-invalid');
    if (now() >= taskDeadline) fail('lifecycle-task-deadline-manual-recovery');
    if (['PENDING', 'DELIVERING', 'RUNNING'].includes(task.TaskStatus)) {
      if (attempt === 3) break;
      await sleep(Math.min(1000, taskDeadline - now()));
      continue;
    }
    if (task.TaskStatus !== 'SUCCESS' || !task.TaskResult || task.TaskResult.ExitCode !== 0 || task.TaskResult.Dropped !== 0 || typeof task.TaskResult.Output !== 'string') fail('lifecycle-task-failed-manual-recovery');
    const output = Buffer.from(task.TaskResult.Output, 'base64').toString('utf8');
    if (Buffer.from(output, 'utf8').toString('base64') !== task.TaskResult.Output || output !== `${expectedOutput}\n`) fail('lifecycle-result-proof-invalid-manual-recovery');
    return Object.freeze({ state: 'success', evidence: expectedOutput });
  }
  fail('lifecycle-task-still-running-manual-recovery');
}

async function awaitTerminalWithin(promise, deadline, now) {
  const remaining = deadline - now();
  if (!Number.isSafeInteger(remaining) || remaining <= 0) return null;
  let timer;
  try {
    return await Promise.race([Promise.resolve(promise), new Promise((resolve) => { timer = setTimeout(() => resolve(null), remaining); })]);
  } finally { if (timer) clearTimeout(timer); }
}

async function runServerLifecycle({ clients, targets, verifiedMaterials, serverInput, expectedInput, buildReturn, awaitCallerTlsCompletion, now = Date.now, sleep }) {
  const fixed = validateLifecycleTargets(targets);
  const sourceState = requireVerifiedSourceMaterials(verifiedMaterials);
  if (!verifiedMaterials || typeof verifiedMaterials.sourceRunId !== 'string' || typeof verifiedMaterials.attempt !== 'string'
    || typeof verifiedMaterials.workflowSha !== 'string' || typeof verifiedMaterials.csrSha256 !== 'string'
    || typeof buildReturn !== 'function' || typeof awaitCallerTlsCompletion !== 'function') fail('lifecycle-source-or-operation-invalid');
  const startDeadline = Math.min(sourceState.sourceDeadline, sourceState.egressDeadline, sourceState.callerJobDeadline, sourceState.resourceDeadline);
  const parsedInput = JSON.parse(serverInput);
  const cleanupDeadline = Math.min(sourceState.resourceDeadline, Number.isSafeInteger(parsedInput.authorizedUntil) ? parsedInput.authorizedUntil : sourceState.resourceDeadline);
  const boundInput = bindVerifiedSourceInput(serverInput, verifiedMaterials);
  const startAt = now();
  if (startAt >= startDeadline || startAt >= cleanupDeadline) fail('lifecycle-start-window-expired');
  const inputB64 = validateServerInput(boundInput, { ...expectedInput, now: startAt, instanceId: fixed.instanceId,
    sourceRunId: verifiedMaterials.sourceRunId, attempt: verifiedMaterials.attempt, workflowSha: verifiedMaterials.workflowSha, csrSha256: verifiedMaterials.csrSha256 });
  const startDeadlineWithSnapshot = Math.min(startDeadline, JSON.parse(boundInput).policy.githubJwksExpiresAt);
  let startError;
  let result;
  try {
    const start = await invokeLifecycleCommand({ clients, target: fixed, commandId: fixed.startCommandId, parameters: { server_input_b64: inputB64 }, now, deadline: startDeadlineWithSnapshot });
    await pollLifecycleTask({ clients, invocation: start, expectedOutput: 'listener_ready=private_ipv4:8443', deadline: startDeadlineWithSnapshot, now, ...(sleep ? { sleep } : {}) });
    result = await awaitTerminalWithin(buildReturn(), Math.min(sourceState.callerJobDeadline, cleanupDeadline), now);
    if (!result) fail('return-build-deadline-unknown-manual-recovery');
    const completion = awaitCallerTlsCompletion({ returnResult: result, deadline: Math.min(sourceState.callerJobDeadline, cleanupDeadline) });
    const terminal = await awaitTerminalWithin(completion, Math.min(sourceState.callerJobDeadline, cleanupDeadline), now);
    if (!terminal) fail('caller-tls-completion-unknown-manual-recovery');
    const verified = requireVerifiedCallerCompletion(terminal);
    if (verified.runId !== verifiedMaterials.sourceRunId || verified.runAttempt !== verifiedMaterials.attempt
      || verified.workflowSha !== verifiedMaterials.workflowSha || verified.workflowPath !== sourceState.workflowPath
      || verified.workflowRef !== sourceState.workflowRef || verified.repositoryId !== sourceState.repositoryId
      || verified.actorId !== sourceState.actorId) fail('caller-tls-completion-binding-mismatch');
  } catch (error) { startError = error; }
  let stopError;
  try {
    const stop = await invokeLifecycleCommand({ clients, target: fixed, commandId: fixed.stopCommandId, parameters: { source_run_id: verifiedMaterials.sourceRunId }, now, deadline: cleanupDeadline });
    await pollLifecycleTask({ clients, invocation: stop, expectedOutput: 'server_stopped_and_keys_removed=true', deadline: cleanupDeadline, now, ...(sleep ? { sleep } : {}) });
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
