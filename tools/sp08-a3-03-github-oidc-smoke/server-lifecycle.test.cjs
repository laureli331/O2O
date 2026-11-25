'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { bindVerifiedSourceInput, runServerLifecycle, validateLifecycleTargets, validateServerInput } = require('./server-lifecycle.cjs');
const { buildClients } = require('./tencentcloud-a303-api.cjs');

const targets = { region: 'ap-guangzhou', instanceId: 'ins-fixture01', securityGroupId: 'sg-fixture01', startCommandId: 'cmd-fixture01', stopCommandId: 'cmd-fixture02' };
const source = { sourceRunId: '123', attempt: '1', workflowSha: 'a'.repeat(40), csrSha256: 'b'.repeat(64) };
const input = JSON.stringify({ mode: 'start-approved', authorization: 'explicit-temporary', authorizedUntil: 600000, interfaceName: 'eth0', bindIPv4: '10.0.0.2', port: 8443,
  policy: { mode: 'github-oidc', serverIPv4: '198.51.100.8', issuer: 'https://token.actions.githubusercontent.com', githubJwksKeys: [{ kid: 'fixture' }],
    githubJwksFetchedAt: 1, githubJwksExpiresAt: 500000,
    expectedClaims: { run_id: '123', run_attempt: '1', workflow_sha: source.workflowSha, repository_id: '456' },
    expectedRequest: { run_id: '123', run_attempt: '1', repository_id: '456', payload: { database_access: false } } } });

test('requires two distinct fixed-format commands and binds server input to current source, target, JWKS and public IPv4', () => {
  assert.throws(() => validateLifecycleTargets({ ...targets, stopCommandId: 'DRAFT' }), /lifecycle-stopCommandId-invalid/);
  assert.throws(() => validateLifecycleTargets({ ...targets, stopCommandId: targets.startCommandId }), /lifecycle-command-ids-must-differ/);
  const bound = bindVerifiedSourceInput(input, source);
  const b64 = validateServerInput(bound, { now: 1, instanceId: targets.instanceId, sourceRunId: source.sourceRunId, attempt: source.attempt,
    workflowSha: source.workflowSha, csrSha256: source.csrSha256, clbIPv4: '198.51.100.8' });
  assert.equal(JSON.parse(Buffer.from(b64, 'base64').toString('utf8')).sourceBinding.csr_sha256, source.csrSha256);
  assert.throws(() => validateServerInput(bound, { now: 1, instanceId: targets.instanceId, sourceRunId: source.sourceRunId,
    attempt: source.attempt, workflowSha: source.workflowSha, csrSha256: source.csrSha256, clbIPv4: '198.51.100.9' }), /server-input-binding-invalid/);
});

test('invokes start, waits for exact readiness, runs return construction, then stops and confirms cleanup', async () => {
  const actions = [];
  let nextInvocation = 0;
  const clients = buildClients({ region: targets.region, transport: async (_service, action, request) => {
    actions.push({ action, request });
    if (action === 'InvokeCommand') return { InvocationId: `inv-run${++nextInvocation}` };
    if (action === 'DescribeInvocationTasks') {
      const id = request.Filters[0].Values[0];
      const commandId = id === 'inv-run1' ? targets.startCommandId : targets.stopCommandId;
      const stdout = id === 'inv-run1' ? 'listener_ready=private_ipv4:8443\n' : 'server_stopped_and_keys_removed=true\n';
      return { TotalCount: 1, InvocationTaskSet: [{ InvocationId: id, InstanceId: targets.instanceId, CommandId: commandId,
        TaskStatus: 'SUCCESS', TaskResult: { ExitCode: 0, Dropped: 0, Output: Buffer.from(stdout).toString('base64') } }] };
    }
    throw new Error(`unexpected-action:${action}`);
  } });
  const result = await runServerLifecycle({ clients, targets, verifiedMaterials: source, serverInput: input,
    expectedInput: { clbIPv4: '198.51.100.8' }, now: () => 10, operation: async () => { actions.push({ action: 'BUILD_RETURN' }); return { artifactName: 'sp08-a303-return-123-1' }; } });
  assert.deepEqual(result, { artifactName: 'sp08-a303-return-123-1' });
  assert.deepEqual(actions.filter((item) => item.action === 'InvokeCommand').map((item) => item.request.CommandId), [targets.startCommandId, targets.stopCommandId]);
  assert.equal(JSON.parse(Buffer.from(JSON.parse(actions[0].request.Parameters).server_input_b64, 'base64').toString('utf8')).sourceBinding.csr_sha256, source.csrSha256);
  assert.deepEqual(actions.map((item) => item.action), ['InvokeCommand', 'DescribeInvocationTasks', 'BUILD_RETURN', 'InvokeCommand', 'DescribeInvocationTasks']);
  assert.equal(crypto.createHash('sha256').update(input).digest('hex').length, 64);
});

test('a nonmatching startup stdout cannot count as readiness and still runs the fixed stop command', async () => {
  const invoked = [];
  let number = 0;
  const clients = buildClients({ region: targets.region, transport: async (_service, action, request) => {
    if (action === 'InvokeCommand') { invoked.push(request.CommandId); return { InvocationId: `inv-check${++number}` }; }
    const id = request.Filters[0].Values[0];
    const output = id === 'inv-check1' ? 'anything listener_ready=private_ipv4:8443 extra\n' : 'server_stopped_and_keys_removed=true\n';
    return { TotalCount: 1, InvocationTaskSet: [{ InvocationId: id, InstanceId: targets.instanceId,
      CommandId: id === 'inv-check1' ? targets.startCommandId : targets.stopCommandId, TaskStatus: 'SUCCESS',
      TaskResult: { ExitCode: 0, Dropped: 0, Output: Buffer.from(output).toString('base64') } }] };
  } });
  await assert.rejects(runServerLifecycle({ clients, targets, verifiedMaterials: source, serverInput: input,
    expectedInput: { clbIPv4: '198.51.100.8' }, now: () => 10, operation: async () => assert.fail('return builder must not run') }), /lifecycle-result-proof-invalid-manual-recovery/);
  assert.deepEqual(invoked, [targets.startCommandId, targets.stopCommandId]);
});

test('an unknown start Invoke is never retried and still makes one fixed stop attempt', async () => {
  const invoked = [];
  let statusCalls = 0;
  const clients = buildClients({ region: targets.region, transport: async (_service, action, request) => {
    if (action === 'InvokeCommand') {
      invoked.push(request.CommandId);
      if (invoked.length === 1) throw new Error('simulated-unknown-start-result');
      return { InvocationId: 'inv-recovery' };
    }
    statusCalls += 1;
    return { TotalCount: 1, InvocationTaskSet: [{ InvocationId: 'inv-recovery', InstanceId: targets.instanceId,
      CommandId: targets.stopCommandId, TaskStatus: 'SUCCESS', TaskResult: { ExitCode: 0, Dropped: 0,
        Output: Buffer.from('server_stopped_and_keys_removed=true\n').toString('base64') } }] };
  } });
  await assert.rejects(runServerLifecycle({ clients, targets, verifiedMaterials: source, serverInput: input,
    expectedInput: { clbIPv4: '198.51.100.8' }, now: () => 10, operation: async () => assert.fail('return builder must not run') }), /lifecycle-invoke-outcome-unknown-manual-recovery/);
  assert.deepEqual(invoked, [targets.startCommandId, targets.stopCommandId]);
  assert.equal(statusCalls, 1);
});

test('review templates compose existing JWKS/server-entry inputs and expose only fixed lifecycle evidence', () => {
  const start = fs.readFileSync(path.join(__dirname, 'tat-server-start.template.sh'), 'utf8');
  const stop = fs.readFileSync(path.join(__dirname, 'tat-server-stop.template.sh'), 'utf8');
  assert.match(start, /assemble-local/);
  assert.match(start, /server-entry\.cjs" --check-only/);
  assert.match(start, /server-entry\.cjs" --start-approved/);
  assert.match(start, /listener_ready=private_ipv4:8443/);
  assert.match(start, /\$PRIVATE_IPV4:8443/);
  assert.match(stop, /ps -p "\$PID"/);
  assert.match(stop, /server_stopped_and_keys_removed=true/);
  assert.match(stop, /test ! -e "\$ROOT\/pki\/server\.key\.pem"/);
});
