'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const definitions = [
  ['sign', 'tat-sign-csr.template.sh', ['csr_b64', 'source_run_id']],
  ['start', 'tat-server-start.template.sh', ['server_input_b64', 'source_run_id']],
  ['stop', 'tat-server-stop.template.sh', ['source_run_id']],
];

function buildCommandDraft(ids) {
  if (!ids || Object.keys(ids).sort().join('|') !== 'sign|start|stop') throw new Error('command-id-fields-invalid');
  const seen = new Set();
  const commands = definitions.map(([kind, filename, parameters]) => {
    const id = ids[kind];
    if (typeof id !== 'string' || !/^cmd-[a-z0-9]{8,64}$/.test(id) || /DRAFT|TODO|<|>/i.test(id) || seen.has(id)) throw new Error(`command-id-${kind}-invalid-or-duplicate`);
    seen.add(id);
    const script = fs.readFileSync(path.join(root, filename), 'utf8').replace(/\r\n/g, '\n');
    const content = Buffer.from(script, 'utf8').toString('base64');
    return Object.freeze({ id, kind, scriptSha256: crypto.createHash('sha256').update(script, 'utf8').digest('hex'),
      createCommandInput: Object.freeze({ CommandName: `a303-${kind}-DRAFT`, Description: 'DRAFT ONLY — review required', Content: content,
        CommandType: 'SHELL', Timeout: 300, EnableParameter: true, WorkingDirectory: '/root' }), parameterNames: parameters });
  });
  return Object.freeze({ NOTICE: 'DRAFT ONLY — NOT DEPLOYABLE. Explicit IDs and resource inputs are required; this file cannot submit or grant.', commands });
}

function buildPolicy({ region, accountUin, instanceId, securityGroupId, commandIds }) {
  const values = [region, accountUin, instanceId, securityGroupId];
  if (values.some((value) => typeof value !== 'string' || /<|>|DRAFT|TODO|UNRESOLVED|\*/i.test(value))) throw new Error('policy-input-placeholder-or-wildcard');
  if (!/^[a-z]+-[a-z0-9-]+$/.test(region) || !/^\d{8,20}$/.test(accountUin)
    || !/^ins-[a-z0-9]{8,64}$/.test(instanceId) || !/^sg-[a-z0-9]{8,64}$/.test(securityGroupId)) throw new Error('policy-input-invalid');
  const commands = buildCommandDraft(commandIds);
  const commandResources = commands.commands.map(({ id }) => `qcs::tat:${region}:uin/${accountUin}:command/${id}`);
  const instance = `qcs::cvm:${region}:uin/${accountUin}:instance/${instanceId}`;
  const securityGroup = `qcs::cvm:${region}:uin/${accountUin}:sg/${securityGroupId}`;
  return Object.freeze({ NOTICE: 'DRAFT ONLY — review required; no policy is submitted or granted.', version: '2.0', statement: [
    ...commandResources.map((command) => ({ resource: [command, instance], action: ['tat:InvokeCommand'], effect: 'allow' })),
    ...commandResources.map((command) => ({ resource: [command, instance], action: ['tat:DescribeInvocationTasks'], effect: 'allow' })),
    { resource: [securityGroup], action: ['vpc:DescribeSecurityGroupPolicies', 'vpc:CreateSecurityGroupPolicies', 'vpc:DeleteSecurityGroupPolicies'], effect: 'allow' },
  ] });
}

module.exports = { buildCommandDraft, buildPolicy };
