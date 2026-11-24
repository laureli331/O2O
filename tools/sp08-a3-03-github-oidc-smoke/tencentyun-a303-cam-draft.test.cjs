'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const policy = JSON.parse(fs.readFileSync(path.join(__dirname, 'tencentyun-a303-cam-draft.json'), 'utf8'));
const draft = fs.readFileSync(path.join(__dirname, 'tencentyun-a303-offline-draft.md'), 'utf8');

test('Tencent CAM draft matches documented action scopes and unresolved boundaries', () => {
  assert.match(policy.NOTICE, /DRAFT ONLY — NOT DEPLOYABLE/);
  assert.deepEqual(policy.statement.map((statement) => statement.action), [
    ['tat:InvokeCommand'],
    ['tat:DescribeInvocationTasks'],
    ['vpc:DescribeSecurityGroupPolicies', 'vpc:CreateSecurityGroupPolicies', 'vpc:DeleteSecurityGroupPolicies'],
  ]);
  assert.ok(policy.statement.every((statement) => statement.resource.some((resource) => resource.includes('<'))));
  assert.ok(policy.statement[0].resource.some((resource) => resource.includes('qcs::tat:<REGION>')));
  assert.ok(policy.statement[0].resource.some((resource) => resource.includes('qcs::cvm:<REGION>')));
  assert.ok(policy.statement[1].resource.every((resource) => resource.includes('<REGION>')));
  assert.ok(policy.statement[2].resource[0].includes('qcs::cvm:<REGION>'));
  assert.ok(!policy.statement.some((statement) => statement.action.includes('tat:DescribeInvocations')));
  assert.ok(policy.statement.every((statement) => !statement.condition));
  assert.ok(policy.statement.every((statement) => statement.action.every((action) => !action.endsWith(':*'))));
  assert.match(draft, /NOTICE text and placeholders are not technical deployment controls/);
  assert.match(draft, /45-minute cleanup deadline/);
  assert.match(draft, /qcs:ip/);
  assert.match(draft, /does not prevent shell injection/);
  assert.match(draft, /placeholder substitution/);
});
