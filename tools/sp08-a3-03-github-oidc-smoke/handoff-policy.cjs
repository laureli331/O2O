'use strict';

const POLICY = Object.freeze({
  repository: 'UNCONFIGURED',
  sourceWorkflowPath: '.github/workflows/sp08-a3-03-csr-source.yml',
  sourceWorkflowSha: 'UNCONFIGURED',
  returnWorkflowPath: '.github/workflows/sp08-a3-03-csr-return.yml',
  returnWorkflowSha: 'UNCONFIGURED',
  operatorActorId: 'UNCONFIGURED',
  operatorLogin: 'UNCONFIGURED',
  caFingerprint256: 'UNCONFIGURED',
});

function requireConfiguredPolicy(policy = POLICY) {
  if (!policy || Object.values(policy).some((value) => typeof value !== 'string' || value.length === 0 || value === 'UNCONFIGURED')) throw new Error('handoff-policy-unconfigured');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(policy.repository)
    || !/^[a-f0-9]{40}$/.test(policy.sourceWorkflowSha)
    || !/^[a-f0-9]{40}$/.test(policy.returnWorkflowSha)
    || !/^[0-9]{1,20}$/.test(policy.operatorActorId)
    || !/^[a-f0-9]{64}$/.test(policy.caFingerprint256)) throw new Error('handoff-policy-invalid');
  return policy;
}

if (require.main === module) {
  try { requireConfiguredPolicy(); process.stdout.write('policy=ready\n'); }
  catch (error) { process.stderr.write(`handoff-policy-rejected:${error.message}\n`); process.exitCode = 1; }
}

module.exports = { POLICY, requireConfiguredPolicy };
