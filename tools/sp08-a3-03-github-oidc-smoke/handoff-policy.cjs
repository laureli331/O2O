'use strict';

const POLICY = Object.freeze({
  repository: 'UNCONFIGURED',
  sourceWorkflowPath: '.github/workflows/sp08-a3-03-csr-source.yml',
  sourceWorkflowRef: 'UNCONFIGURED',
  sourceWorkflowSha: 'UNCONFIGURED',
  returnWorkflowPath: '.github/workflows/sp08-a3-03-csr-return.yml',
  returnWorkflowRef: 'UNCONFIGURED',
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

function requireWorkflowPolicy(side, context, policy = POLICY) {
  const trusted = requireConfiguredPolicy(policy);
  const expectedSha = side === 'source' ? trusted.sourceWorkflowSha : side === 'return' ? trusted.returnWorkflowSha : null;
  const expectedPath = side === 'source' ? trusted.sourceWorkflowPath : side === 'return' ? trusted.returnWorkflowPath : null;
  const expectedRef = side === 'source' ? trusted.sourceWorkflowRef : side === 'return' ? trusted.returnWorkflowRef : null;
  if (!expectedSha || !expectedRef || context?.repository !== trusted.repository || context?.workflowSha !== expectedSha || context?.workflowRef !== `${trusted.repository}/${expectedPath}@${expectedRef}` || context?.actorId !== trusted.operatorActorId || context?.actorLogin !== trusted.operatorLogin) throw new Error('workflow-trust-context-mismatch');
  return trusted;
}

if (require.main === module) {
  try {
    requireWorkflowPolicy(process.env.A303_POLICY_SIDE, { repository: process.env.GITHUB_REPOSITORY, workflowSha: process.env.A303_WORKFLOW_SHA, workflowRef: process.env.A303_WORKFLOW_REF, actorId: process.env.A303_ACTOR_ID, actorLogin: process.env.A303_ACTOR_LOGIN });
    process.stdout.write('policy=ready\n');
  }
  catch (error) { process.stderr.write(`handoff-policy-rejected:${error.message}\n`); process.exitCode = 1; }
}

module.exports = { POLICY, requireConfiguredPolicy, requireWorkflowPolicy };
