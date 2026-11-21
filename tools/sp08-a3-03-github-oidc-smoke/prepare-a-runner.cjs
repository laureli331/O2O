'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { runnerContext, main: runnerMain } = require('./runner-entry.cjs');

function reject(code) { const error = new Error(code); error.code = code; throw error; }
function buildApprovedConfig({ serialized, env = process.env, returnRunId }) {
  if (typeof serialized !== 'string' || serialized.length === 0 || serialized.length > 32768) reject('runner-policy-missing');
  let approved;
  try { approved = JSON.parse(serialized); } catch { reject('runner-policy-invalid'); }
  if (!approved || typeof approved !== 'object' || Array.isArray(approved)
    || JSON.stringify(Object.keys(approved).sort()) !== JSON.stringify(['authorization','authorizedUntil','mode','policy','requestTemplate','targetIPv4','verifyTemplate'].sort())) reject('runner-policy-invalid');
  const context = runnerContext(env);
  const stable = approved.policy?.expectedClaims;
  if (!stable || Object.hasOwn(stable, 'run_id')) reject('runner-policy-invalid');
  for (const [field, value] of Object.entries(stable)) if (context[field] !== value) reject('runner-context-policy-mismatch');
  if (approved.mode !== 'start-approved' || approved.authorization !== 'explicit-temporary'
    || !Number.isSafeInteger(approved.authorizedUntil) || approved.authorizedUntil <= Date.now()
    || approved.authorizedUntil - Date.now() > 15 * 60 * 1000) reject('runner-policy-invalid');
  const template = approved.requestTemplate;
  if (!template || Object.hasOwn(template, 'run_id') || Object.hasOwn(template, 'repository_id') || Object.hasOwn(template, 'run_attempt')) reject('runner-policy-invalid');
  const request = { ...template, repository_id: context.repository_id, run_id: context.run_id, run_attempt: context.run_attempt };
  const verify = approved.verifyTemplate;
  if (!verify || !/^[1-9][0-9]*$/.test(returnRunId || '') || !env.RUNNER_TEMP || !env.A303_PWSH) reject('runner-launch-context-invalid');
  const policy = { ...approved.policy, expectedRequest: request };
  const config = { mode: approved.mode, authorization: approved.authorization, authorizedUntil: approved.authorizedUntil,
    targetIPv4: approved.targetIPv4, port: 8443, policy, request, approvedRequest: structuredClone(request),
    verifyOptions: { tempDir: env.RUNNER_TEMP, artifactDir: path.join(env.RUNNER_TEMP, 'a303-return'), runId: context.run_id,
      runAttempt: context.run_attempt, commit: context.workflow_sha, returnRunId, pwshPath: env.A303_PWSH,
      ...verify } };
  if (verify.runId || verify.runAttempt || verify.commit || verify.returnRunId || verify.tempDir || verify.artifactDir || verify.pwshPath) reject('runner-policy-invalid');
  return config;
}
async function main(argv = process.argv.slice(2), deps = {}) {
  try {
    const checkOnly = argv[0] === '--check-only';
    if (!checkOnly && argv[0] !== '--execute-approved') reject('runner-mode-invalid');
    const config = buildApprovedConfig({ serialized: (deps.env || process.env).A303_TLS_RUNNER_POLICY,
      env: deps.env || process.env, returnRunId: checkOnly ? '1' : (deps.env || process.env).A303_RETURN_RUN_ID });
    if (checkOnly) { config.mode = 'check-only'; config.authorization = 'local-check-only'; }
    return await runnerMain([checkOnly ? '--check-only' : '--execute-approved', 'in-memory'], { ...deps, readConfig: () => config });
  } catch (error) {
    (deps.writeError || ((value) => process.stderr.write(value)))(`${error.code || 'runner-policy-invalid'}\n`);
    return 1;
  }
}
if (require.main === module) void main().then((code) => { process.exitCode = code; });
module.exports = { buildApprovedConfig, main };
