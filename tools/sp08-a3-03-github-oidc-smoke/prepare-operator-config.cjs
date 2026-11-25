'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { requireConfiguredPolicy, parsePolicy } = require('./handoff-policy.cjs');
const { checkOnly } = require('./operator-entry.cjs');
const { buildCommandDraft } = require('./tencentyun-a303-command-draft.cjs');
const { validateServerInput, bindVerifiedSourceInput } = require('./server-lifecycle.cjs');
const { buildApprovedConfig } = require('./prepare-a-runner.cjs');
const { validateConfig } = require('./runner-entry.cjs');
const fail = () => { throw new Error('operator-config-preparation-invalid'); };

function prepareOperatorConfig(input, now = Date.now()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).sort().join('|') !== 'commandIds|instanceId|interfaceName|journalPath|jwksExpiresAt|jwksFetchedAt|notAfterMs|notBeforeMs|preparedPolicies|privateIPv4|pwshPath|region|securityGroupId|sourceRunId'
    || !/^[1-9][0-9]{0,19}$/.test(input.sourceRunId)
    || !Number.isSafeInteger(input.notBeforeMs) || !Number.isSafeInteger(input.notAfterMs)
    || input.notBeforeMs > now || input.notAfterMs < now || input.notAfterMs < input.notBeforeMs
    || input.notAfterMs - input.notBeforeMs > 300000
    || !input.preparedPolicies || input.preparedPolicies.state !== 'public-preparation-only'
    || input.preparedPolicies.readyToDispatch !== false) fail();
  const prepared = input.preparedPolicies;
  const handoff = requireConfiguredPolicy(parsePolicy(prepared.variables?.A303_HANDOFF_POLICY));
  const runner = JSON.parse(prepared.variables.A303_TLS_RUNNER_POLICY);
  if (prepared.trustedHeadSha !== handoff.sourceWorkflowSha || handoff.returnWorkflowSha !== handoff.sourceWorkflowSha
    || runner.policy?.expectedClaims?.job_workflow_sha !== handoff.sourceWorkflowSha
    || Object.keys(runner.policy).sort().join('|') !== 'ca|expectedCaFingerprint256|expectedClaims|issuer|mode|serverIPv4|service|tlsCert'
    || /PRIVATE KEY/.test(JSON.stringify(runner.policy))) fail();
  buildCommandDraft(input.commandIds);
  const claims = runner.policy.expectedClaims;
  const env = { O2O_RUNNER_REPOSITORY: handoff.repository, O2O_RUNNER_REPOSITORY_ID: claims.repository_id,
    O2O_RUNNER_RUN_ID: input.sourceRunId, O2O_RUNNER_RUN_ATTEMPT: '1', O2O_RUNNER_ACTOR: handoff.operatorLogin,
    O2O_RUNNER_ACTOR_ID: handoff.operatorActorId, O2O_RUNNER_REF: handoff.sourceWorkflowRef,
    O2O_RUNNER_WORKFLOW_REF: `${handoff.repository}/${handoff.sourceWorkflowPath}@${handoff.sourceWorkflowRef}`,
    O2O_RUNNER_WORKFLOW_SHA: handoff.sourceWorkflowSha, O2O_RUNNER_CALLED_WORKFLOW_REF: claims.job_workflow_ref,
    O2O_RUNNER_CALLED_WORKFLOW_SHA: handoff.sourceWorkflowSha, O2O_RUNNER_ENVIRONMENT: claims.environment,
    RUNNER_TEMP: path.dirname(input.journalPath), A303_PWSH: input.pwshPath };
  const approved = buildApprovedConfig({ serialized: prepared.variables.A303_TLS_RUNNER_POLICY,
    handoffSerialized: prepared.variables.A303_HANDOFF_POLICY, env, checkOnly: true });
  validateConfig(approved, env, now);
  const server = { mode: 'start-approved', authorization: 'explicit-temporary', authorizedUntil: runner.authorizedUntil,
    bindIPv4: input.privateIPv4, interfaceName: input.interfaceName, port: 8443,
    policy: { ...runner.policy, expectedClaims: { ...claims, run_id: input.sourceRunId }, expectedRequest: approved.request,
      githubJwksFetchedAt: input.jwksFetchedAt, githubJwksExpiresAt: input.jwksExpiresAt } };
  const serverInput = JSON.stringify(server);
  // This validates shape only; it does not mint trusted source provenance.
  validateServerInput(bindVerifiedSourceInput(serverInput, { sourceRunId: input.sourceRunId, attempt: '1',
    workflowSha: handoff.sourceWorkflowSha, csrSha256: '0'.repeat(64) }), { now, sourceRunId: input.sourceRunId,
    attempt: '1', workflowSha: handoff.sourceWorkflowSha, csrSha256: '0'.repeat(64), clbIPv4: runner.targetIPv4 });
  const commonTarget = { region: input.region, instanceId: input.instanceId, securityGroupId: input.securityGroupId };
  const config = { repository: handoff.repository, repositoryId: claims.repository_id, actorId: handoff.operatorActorId,
    actorLogin: handoff.operatorLogin, sourceRunId: input.sourceRunId, workflowPath: handoff.sourceWorkflowPath,
    workflowRef: env.O2O_RUNNER_WORKFLOW_REF, trustedHeadSha: handoff.sourceWorkflowSha,
    notBeforeMs: input.notBeforeMs, notAfterMs: input.notAfterMs, caFingerprint256: handoff.caFingerprint256,
    target: { ...commonTarget, commandId: input.commandIds.sign }, securityTarget: { ...commonTarget, commandId: input.commandIds.sign },
    lifecycleTargets: { ...commonTarget, startCommandId: input.commandIds.start, stopCommandId: input.commandIds.stop },
    serverInput, expectedInput: { clbIPv4: runner.targetIPv4 }, journalPath: input.journalPath, pwshPath: input.pwshPath };
  checkOnly(config);
  return config;
}

function main(args) {
  try {
    if (args.length !== 2 || !args.every(value => path.isAbsolute(value)) || fs.statSync(args[0]).size > 96000) fail();
    const result = prepareOperatorConfig(JSON.parse(fs.readFileSync(args[0], 'utf8')));
    fs.writeFileSync(args[1], JSON.stringify(result), { flag: 'wx', mode: 0o600 });
    process.stdout.write('public_operator_config_created=true; ready_to_dispatch=false\n');
    return 0;
  } catch { process.stderr.write('公开操作配置准备失败；未读取凭据或派发。\n'); return 1; }
}
if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { prepareOperatorConfig, main };
