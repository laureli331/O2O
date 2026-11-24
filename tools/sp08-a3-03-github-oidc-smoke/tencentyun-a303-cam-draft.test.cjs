'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const policy = JSON.parse(fs.readFileSync(path.join(__dirname, 'tencentyun-a303-cam-draft.json'), 'utf8'));
const draft = fs.readFileSync(path.join(__dirname, 'tencentyun-a303-offline-draft.md'), 'utf8');

test('Tencent CAM draft remains explicitly non-deployable and least-scope bounded', () => {
  assert.match(policy.NOTICE, /DRAFT ONLY — NOT DEPLOYABLE/);
  assert.ok(policy.statement.every((statement) => statement.resource.some((resource) => resource.includes('<'))));
  assert.deepEqual(policy.statement[0].action, ['tat:InvokeCommand', 'tat:DescribeInvocationTasks']);
  assert.deepEqual(policy.statement[1].resource, ['<UNRESOLVED — DO NOT GRANT UNTIL CAM RESOURCE GRANULARITY IS VERIFIED>']);
  assert.deepEqual(policy.statement[2].action, ['vpc:DescribeSecurityGroupPolicies', 'vpc:CreateSecurityGroupPolicies', 'vpc:DeleteSecurityGroupPolicies']);
  assert.ok(policy.statement.every((statement) => !statement.condition));
  assert.ok(policy.statement.every((statement) => statement.action.every((action) => !action.endsWith(':*'))));
  assert.match(draft, /NOTICE text and placeholders are not technical deployment controls/);
  assert.match(draft, /45-minute cleanup deadline/);
  assert.match(draft, /qcs:ip/);
});
