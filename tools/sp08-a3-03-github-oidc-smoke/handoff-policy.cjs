'use strict';

const POLICY_KEYS = Object.freeze(['caFingerprint256', 'operatorActorId', 'operatorLogin', 'repository', 'returnWorkflowPath', 'returnWorkflowRef', 'returnWorkflowSha', 'sourceWorkflowPath', 'sourceWorkflowRef', 'sourceWorkflowSha']);
const SOURCE_PATH = '.github/workflows/sp08-a3-03-csr-source.yml';
const RETURN_PATH = '.github/workflows/sp08-a3-03-csr-return.yml';

function parsePolicy(serialized) {
  if (typeof serialized !== 'string' || serialized.length < 1 || serialized.length > 4096) throw new Error('handoff-policy-missing-or-oversized');
  let policy;
  try { policy = JSON.parse(serialized); } catch { throw new Error('handoff-policy-json-invalid'); }
  if (!policy || typeof policy !== 'object' || Array.isArray(policy) || JSON.stringify(Object.keys(policy).sort()) !== JSON.stringify(POLICY_KEYS)) throw new Error('handoff-policy-schema-invalid');
  return Object.freeze(policy);
}

function requireConfiguredPolicy(policy = parsePolicy(process.env.A303_HANDOFF_POLICY)) {
  if (!policy || Object.values(policy).some((value) => typeof value !== 'string' || value.length === 0)) throw new Error('handoff-policy-unconfigured');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(policy.repository)
    || policy.sourceWorkflowPath !== SOURCE_PATH || policy.returnWorkflowPath !== RETURN_PATH
    || !/^refs\/heads\/[A-Za-z0-9_.\/-]{1,180}$/.test(policy.sourceWorkflowRef)
    || !/^refs\/heads\/[A-Za-z0-9_.\/-]{1,180}$/.test(policy.returnWorkflowRef)
    || !/^[a-f0-9]{40}$/.test(policy.sourceWorkflowSha)
    || !/^[a-f0-9]{40}$/.test(policy.returnWorkflowSha)
    || !/^[0-9]{1,20}$/.test(policy.operatorActorId)
    || !/^[A-Za-z0-9_-]{1,39}$/.test(policy.operatorLogin)
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
    requireWorkflowPolicy(process.env.A303_POLICY_SIDE, { repository: process.env.GITHUB_REPOSITORY, workflowSha: process.env.A303_WORKFLOW_SHA, workflowRef: process.env.A303_WORKFLOW_REF, actorId: process.env.A303_ACTOR_ID, actorLogin: process.env.A303_ACTOR_LOGIN }, parsePolicy(process.env.A303_HANDOFF_POLICY));
    process.stdout.write('policy=ready\n');
  }
  catch (error) { process.stderr.write(`handoff-policy-rejected:${error.message}\n`); process.exitCode = 1; }
}

module.exports = { POLICY_KEYS, parsePolicy, requireConfiguredPolicy, requireWorkflowPolicy };
