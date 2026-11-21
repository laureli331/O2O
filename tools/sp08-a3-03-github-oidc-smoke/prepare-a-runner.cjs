'use strict';

const path = require('node:path');
const { runnerContext, main: runnerMain, publicErrorCode } = require('./runner-entry.cjs');
const { parsePolicy, requireConfiguredPolicy, requireWorkflowPolicy } = require('./handoff-policy.cjs');

function reject(code) { const error = new Error(code); error.code = code; throw error; }
function buildApprovedConfig({ serialized, handoffSerialized, env = process.env, returnRunId, checkOnly = false }) {
  if (typeof serialized !== 'string' || serialized.length === 0 || serialized.length > 32768) reject('runner-policy-missing');
  let approved;
  try { approved = JSON.parse(serialized); } catch { reject('runner-policy-invalid'); }
  if (!approved || typeof approved !== 'object' || Array.isArray(approved)
    || JSON.stringify(Object.keys(approved).sort()) !== JSON.stringify(['authorization','authorizedUntil','mode','policy','requestTemplate','targetIPv4'].sort())) reject('runner-policy-invalid');
  const context = runnerContext(env);
  const handoff = requireWorkflowPolicy('source', { repository: context.repository, workflowSha: context.workflow_sha,
    workflowRef: context.workflow_ref, actorId: context.actor_id, actorLogin: context.actor }, requireConfiguredPolicy(parsePolicy(handoffSerialized)));
  const stable = approved.policy?.expectedClaims;
  if (!stable || Object.hasOwn(stable, 'run_id')) reject('runner-policy-invalid');
  for (const [field, value] of Object.entries(stable)) if (context[field] !== value) reject('runner-context-policy-mismatch');
  if (approved.mode !== 'start-approved' || approved.authorization !== 'explicit-temporary'
    || !Number.isSafeInteger(approved.authorizedUntil) || approved.authorizedUntil <= Date.now()
    || approved.authorizedUntil - Date.now() > 15 * 60 * 1000) reject('runner-policy-invalid');
  const template = approved.requestTemplate;
  if (!template || Object.hasOwn(template, 'run_id') || Object.hasOwn(template, 'repository_id') || Object.hasOwn(template, 'run_attempt')) reject('runner-policy-invalid');
  const request = { ...template, repository_id: context.repository_id, run_id: context.run_id, run_attempt: context.run_attempt };
  if (JSON.stringify(Object.keys(template).sort()) !== JSON.stringify(['action_id','artifact_digest','env_id','method','payload','resource_id','route_id','v'].sort())
    || !env.RUNNER_TEMP || !env.A303_PWSH) reject('runner-launch-context-invalid');
  if (approved.policy.expectedCaFingerprint256 !== handoff.caFingerprint256) reject('runner-ca-policy-mismatch');
  if (!checkOnly && !/^[1-9][0-9]*$/.test(returnRunId || '')) reject('runner-launch-context-invalid');
  const policy = { ...approved.policy, expectedRequest: request };
  const config = { mode: checkOnly ? 'check-only' : approved.mode, authorization: checkOnly ? 'local-check-only' : approved.authorization, authorizedUntil: approved.authorizedUntil,
    targetIPv4: approved.targetIPv4, port: 8443, policy, request, approvedRequest: structuredClone(request),
    verifyOptions: { tempDir: env.RUNNER_TEMP, artifactDir: path.join(env.RUNNER_TEMP, 'a303-return'), runId: context.run_id,
      runAttempt: context.run_attempt, commit: context.workflow_sha, returnRunId, pwshPath: env.A303_PWSH } };
  return config;
}
async function main(argv = process.argv.slice(2), deps = {}) {
  try {
    const checkOnly = argv[0] === '--check-only';
    if (!checkOnly && argv[0] !== '--execute-approved') reject('runner-mode-invalid');
    const config = buildApprovedConfig({ serialized: (deps.env || process.env).A303_TLS_RUNNER_POLICY,
      handoffSerialized: (deps.env || process.env).A303_HANDOFF_POLICY, env: deps.env || process.env,
      returnRunId: (deps.env || process.env).A303_RETURN_RUN_ID, checkOnly });
    return await runnerMain([checkOnly ? '--check-only' : '--execute-approved', 'in-memory'], { ...deps, readConfig: () => config });
  } catch (error) {
    (deps.writeError || ((value) => process.stderr.write(value)))(`${publicErrorCode(error)}\n`);
    return 1;
  }
}
if (require.main === module) void main().then((code) => { process.exitCode = code; });
module.exports = { buildApprovedConfig, main };
