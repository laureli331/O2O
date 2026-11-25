'use strict';

const { invokeOnce, pollUntilTerminal, requireVerifiedSourceMaterials, validateTarget } = require('./tencentcloud-a303-api.cjs');
const { bindVerifiedSourceInput, runServerLifecycleWithIngress, validateLifecycleTargets, validateServerInput } = require('./server-lifecycle.cjs');
const { dispatchReturnOnce, recordReturnRunId } = require('./return-dispatch-once.cjs');

const fail = (code) => { throw new Error(code); };

async function runOperatorFlow({ enableExternalDispatch, clients, target, lifecycleTargets, securityTarget, verifiedMaterials, serverInput, expectedInput,
  journalPath, token, fetchImpl = globalThis.fetch, awaitReturnRunArtifact, awaitCallerTlsCompletion, now = Date.now, sleep }) {
  if (enableExternalDispatch !== true || typeof awaitReturnRunArtifact !== 'function'
    || typeof awaitCallerTlsCompletion !== 'function') fail('operator-flow-explicit-enable-or-callback-required');
  const verified = requireVerifiedSourceMaterials(verifiedMaterials);
  const sourceTarget = validateTarget(target);
  const fixedLifecycle = validateLifecycleTargets(lifecycleTargets);
  if (sourceTarget.region !== fixedLifecycle.region || sourceTarget.instanceId !== fixedLifecycle.instanceId
    || sourceTarget.securityGroupId !== fixedLifecycle.securityGroupId || securityTarget?.region !== fixedLifecycle.region
    || securityTarget?.securityGroupId !== fixedLifecycle.securityGroupId) fail('operator-targets-disagree');
  const startAt = now();
  const boundServerInput = bindVerifiedSourceInput(serverInput, verifiedMaterials);
  validateServerInput(boundServerInput, { ...expectedInput, now: startAt, instanceId: fixedLifecycle.instanceId,
    sourceRunId: verified.sourceRunId, attempt: verified.attempt, workflowSha: verified.workflowSha, csrSha256: verifiedMaterials.csrSha256 });
  const invoke = await invokeOnce({ clients, target: sourceTarget, verifiedMaterials, now,
    deadline: Math.min(verified.sourceDeadline, verified.egressDeadline) });
  const certificate = await pollUntilTerminal({ clients, invocation: invoke, deadlineMs: Math.min(verified.sourceDeadline, verified.egressDeadline, invoke.startedAt + 300000), now, ...(sleep ? { sleep } : {}) });
  if (!certificate || certificate.state !== 'success' || !certificate.output) fail('operator-certificate-unverified');
  const lifecycle = await runServerLifecycleWithIngress({ clients, securityTarget, verifiedMaterials,
    lifecycleOptions: { targets: lifecycleTargets, serverInput, expectedInput,
      buildReturn: async () => {
        const bundle = JSON.stringify({ source_run_id: verified.sourceRunId, source_job_id: 'source-csr', source_run_attempt: verified.attempt,
          source_commit: verified.workflowSha, source_started_at: new Date(verified.sourceStartedAt).toISOString(), csr_sha256: verifiedMaterials.csrSha256,
          leaf_certificate: certificate.output.leaf_certificate, ca_certificate: certificate.output.ca_certificate });
        const dispatch = await dispatchReturnOnce({ verifiedMaterials, journalPath, bundle, token, fetchImpl,
          deadline: Math.min(verified.sourceDeadline, verified.egressDeadline, verified.callerJobDeadline), now });
        if (!dispatch || dispatch.state !== 'accepted') fail('operator-return-dispatch-unconfirmed-manual-recovery');
        const artifact = await awaitReturnRunArtifact({ dispatch, verifiedMaterials, deadline: verified.callerJobDeadline });
        if (!artifact || String(artifact.sourceRunId) !== verified.sourceRunId || artifact.runAttempt !== verified.attempt
          || artifact.workflowSha !== verified.workflowSha) fail('operator-return-artifact-binding-invalid');
        recordReturnRunId({ journalPath, binding: dispatch.binding, runId: String(artifact.returnRunId) });
        return Object.freeze({ ...artifact, certificate: certificate.output });
      },
      awaitCallerTlsCompletion: async ({ returnResult, deadline }) => {
        if (!returnResult || !returnResult.certificate) fail('operator-return-material-missing');
        return awaitCallerTlsCompletion({ returnResult, deadline, verifiedMaterials });
      }, now, ...(sleep ? { sleep } : {}) }, now });
  return Object.freeze({ state: 'tls-complete', sourceRunId: verified.sourceRunId, sourceRunAttempt: verified.attempt,
    workflowSha: verified.workflowSha, returnRunId: lifecycle.returnRunId });
}

module.exports = { runOperatorFlow };
