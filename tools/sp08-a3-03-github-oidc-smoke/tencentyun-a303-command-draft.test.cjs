'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCommandDraft, buildPolicy, validateCommandDraft } = require('./tencentyun-a303-command-draft.cjs');

const ids = { sign: 'cmd-abcdefgh', start: 'cmd-bcdefghi', stop: 'cmd-cdefghij' };
test('command draft carries exact reviewed scripts and parameter declarations', () => {
  const draft = buildCommandDraft(ids);
  assert.match(draft.NOTICE, /DRAFT ONLY/);
  assert.deepEqual(draft.commands.map((command) => command.parameterNames), [
    ['csr_b64', 'source_run_id'], ['server_input_b64', 'source_run_id'], ['source_run_id'],
  ]);
  for (const command of draft.commands) {
    assert.ok(Buffer.from(command.createCommandInput.Content, 'base64').toString('utf8').length > 0);
    assert.equal(command.createCommandInput.Timeout, 300);
    assert.equal(command.createCommandInput.EnableParameter, true);
    assert.match(command.scriptSha256, /^[a-f0-9]{64}$/);
  }
  assert.equal(validateCommandDraft(draft), true);
});

test('command draft verifier rejects changed template bytes, digest, parameters and CreateCommand fields', () => {
  const original = buildCommandDraft(ids);
  const changed = (mutate) => {
    const copy = structuredClone(original);
    mutate(copy.commands[0]);
    return () => validateCommandDraft(copy);
  };
  assert.throws(changed((item) => { item.createCommandInput.Content = Buffer.from('echo altered\n').toString('base64'); }), /content-or-digest-invalid/);
  assert.throws(changed((item) => { item.scriptSha256 = '0'.repeat(64); }), /content-or-digest-invalid/);
  assert.throws(changed((item) => { item.parameterNames.push('extra'); }), /fields-invalid/);
  assert.throws(changed((item) => { item.createCommandInput.Unreviewed = true; }), /content-or-digest-invalid/);
});

test('CAM candidate scopes invoke and task read to three distinct commands and one instance', () => {
  const policy = buildPolicy({ region: 'ap-shanghai', accountUin: '1234567890', instanceId: 'ins-abcdefgh', securityGroupId: 'sg-abcdefgh', commandIds: ids });
  assert.equal(policy.statement.length, 7);
  assert.deepEqual(policy.statement.slice(0, 3).map((item) => item.resource[0].split('/').at(-1)), Object.values(ids));
  assert.ok(policy.statement.slice(0, 6).every((item) => item.resource[1] === 'qcs::cvm:ap-shanghai:uin/1234567890:instance/ins-abcdefgh'));
  assert.deepEqual(policy.statement[6].action, ['vpc:DescribeSecurityGroupPolicies', 'vpc:CreateSecurityGroupPolicies', 'vpc:DeleteSecurityGroupPolicies']);
});

test('rejects duplicate commands and placeholder or wildcard policy inputs', () => {
  assert.throws(() => buildCommandDraft({ ...ids, stop: ids.start }), /duplicate/);
  assert.throws(() => buildCommandDraft({ ...ids, sign: '<COMMAND_ID>' }), /invalid/);
  assert.throws(() => buildPolicy({ region: '<REGION>', accountUin: '1234567890', instanceId: 'ins-abcdefgh', securityGroupId: 'sg-abcdefgh', commandIds: ids }), /placeholder/);
  assert.throws(() => buildPolicy({ region: 'ap-shanghai', accountUin: '1234567890', instanceId: '*', securityGroupId: 'sg-abcdefgh', commandIds: ids }), /placeholder/);
});
