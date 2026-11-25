'use strict';

// Public preparation only. No credentials, API writes, dispatch or default SHA.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { requireConfiguredPolicy } = require('./handoff-policy.cjs');
const { isApprovedTargetIPv4, isPrivateIPv4, validateApprovedTargetMaterial } = require('./a-segment-local.cjs');
const fail = () => { throw new Error('run-policy-preparation-invalid'); };
const SOURCE = '.github/workflows/sp08-a3-03-tls-caller.yml';
const REUSABLE = '.github/workflows/sp08-a3-03-tls-source-reusable.yml';
const RETURN = '.github/workflows/sp08-a3-03-csr-return.yml';

function prepareRunPolicies(input, now = Date.now()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).sort().join('|') !== 'actorId|actorLogin|authorizedUntil|branch|caCertificate|repository|repositoryId|serverCertificate|targetIPv4|trustedHeadSha'
    || !/^[0-9]{1,20}$/.test(input.repositoryId) || !/^[0-9]{1,20}$/.test(input.actorId)
    || !/^[a-f0-9]{40}$/.test(input.trustedHeadSha)
    || !/^[A-Za-z0-9_.\/-]{1,180}$/.test(input.branch)
    || !isApprovedTargetIPv4(input.targetIPv4) || isPrivateIPv4(input.targetIPv4)
    || !Number.isSafeInteger(now) || !Number.isSafeInteger(input.authorizedUntil)
    || input.authorizedUntil <= now || input.authorizedUntil > now + 15 * 60 * 1000
    || typeof input.caCertificate !== 'string' || typeof input.serverCertificate !== 'string'
    || input.caCertificate.length > 16384 || input.serverCertificate.length > 16384
    || /PRIVATE KEY/.test(input.caCertificate + input.serverCertificate)) fail();
  const caFingerprint256 = new crypto.X509Certificate(input.caCertificate).fingerprint256.replaceAll(':', '').toLowerCase();
  const ref = `refs/heads/${input.branch}`;
  const handoff = requireConfiguredPolicy({ repository: input.repository, operatorActorId: input.actorId, operatorLogin: input.actorLogin,
    sourceWorkflowPath: SOURCE, sourceWorkflowRef: ref, sourceWorkflowSha: input.trustedHeadSha,
    returnWorkflowPath: RETURN, returnWorkflowRef: ref, returnWorkflowSha: input.trustedHeadSha, caFingerprint256 });
  const claims = { repository: input.repository, repository_id: input.repositoryId, run_attempt: '1', actor: input.actorLogin,
    actor_id: input.actorId, ref, workflow_ref: `${input.repository}/${SOURCE}@${ref}`, workflow_sha: input.trustedHeadSha,
    job_workflow_ref: `${input.repository}/${REUSABLE}@${ref}`, job_workflow_sha: input.trustedHeadSha,
    environment: 'SP08-A3-03-OIDC-smoke' };
  const policy = { mode: 'github-oidc', issuer: 'https://token.actions.githubusercontent.com',
    service: 'o2o-sp08-a3-03-a-segment-tls-proof', serverIPv4: input.targetIPv4,
    tlsCert: input.serverCertificate, ca: input.caCertificate, expectedCaFingerprint256: caFingerprint256, expectedClaims: claims };
  validateApprovedTargetMaterial(policy, input.targetIPv4, now);
  const requestTemplate = { v: 'a303-request-v1', method: 'POST', route_id: 'sp08-a3-03-a-segment-proof',
    env_id: claims.environment, resource_id: 'single-use-cvm-listener', action_id: 'verify-a-segment-tls-proof',
    artifact_digest: `sha256:${crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'a-segment-local.cjs'), 'utf8').replaceAll('\r\n', '\n')).digest('hex')}`,
    payload: { purpose: 'single-use-a-segment-tls-proof', database_access: false } };
  const runner = { mode: 'start-approved', authorization: 'explicit-temporary', authorizedUntil: input.authorizedUntil,
    targetIPv4: input.targetIPv4, policy, requestTemplate };
  const variables = { A303_HANDOFF_POLICY: JSON.stringify(handoff), A303_TLS_RUNNER_POLICY: JSON.stringify(runner) };
  if (Buffer.byteLength(variables.A303_HANDOFF_POLICY) > 4096 || Buffer.byteLength(variables.A303_TLS_RUNNER_POLICY) > 32768) fail();
  return Object.freeze({ state: 'public-preparation-only', trustedHeadSha: input.trustedHeadSha, readyToDispatch: false, variables });
}

function main(args) {
  try {
    if (args.length !== 2 || !args.every(value => path.isAbsolute(value))) fail();
    if (fs.statSync(args[0]).size > 48000) fail();
    const result = prepareRunPolicies(JSON.parse(fs.readFileSync(args[0], 'utf8')));
    fs.writeFileSync(args[1], JSON.stringify(result), { flag: 'wx', mode: 0o600 });
    process.stdout.write('public_policy_file_created=true; ready_to_dispatch=false\n');
    return 0;
  } catch { process.stderr.write('公开运行策略准备失败；未写入 GitHub，也未派发。\n'); return 1; }
}
if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { prepareRunPolicies, main };
