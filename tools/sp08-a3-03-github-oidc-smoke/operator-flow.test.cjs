'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runOperatorFlow } = require('./operator-flow.cjs');
const { checkOnly, validateEntryConfig, runOperatorEntry } = require('./operator-entry.cjs');

test('operator flow never reaches any injected client without explicit external dispatch enablement', async () => {
  let calls = 0;
  await assert.rejects(runOperatorFlow({ clients: { tat: { InvokeCommand: async () => { calls += 1; } } },
    verifiedMaterials: {}, enableExternalDispatch: false }), /explicit-enable/);
  assert.equal(calls, 0);
});

test('operator entry check-only validates the declared shape without creating clients or dispatching', () => {
  const input = { repository: 'owner/repo', repositoryId: '456', actorId: '789', actorLogin: 'operator',
    sourceRunId: '123', workflowPath: '.github/workflows/sp08-a3-03-tls-caller.yml', workflowRef: 'owner/repo/.github/workflows/sp08-a3-03-tls-caller.yml@refs/heads/codex/test',
    trustedHeadSha: 'a'.repeat(40), notBeforeMs: 1000, notAfterMs: 2000, caFingerprint256: 'a'.repeat(64),
    target: { region: 'ap-shanghai', instanceId: 'ins-test', securityGroupId: 'sg-test', commandId: 'cmd-test' },
    lifecycleTargets: { region: 'ap-shanghai', instanceId: 'ins-test', securityGroupId: 'sg-test', startCommandId: 'cmd-start', stopCommandId: 'cmd-stop' },
    securityTarget: { region: 'ap-shanghai', instanceId: 'ins-test', securityGroupId: 'sg-test', commandId: 'cmd-test' },
    serverInput: JSON.stringify({ mode: 'start-approved', authorization: 'example-token', authorizedUntil: 2000, bindIPv4: '10.0.0.2',
      interfaceName: 'eth0', port: 8443, policy: { serverIPv4: '198.51.100.8', expectedClaims: {}, expectedRequest: {} } }),
    expectedInput: { clbIPv4: '198.51.100.8' }, journalPath: require('node:path').join(require('node:os').tmpdir(), 'entry-journal.json'),
    pwshPath: 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe' };
  assert.equal(checkOnly(input).readyToDispatch, false);
  assert.equal(validateEntryConfig(input), input);
  assert.throws(() => validateEntryConfig({ ...input, sourceRunId: '0' }), /config-invalid/);
  return runOperatorEntry(input, {}, { enableExternalDispatch: false, fetchImpl: async () => { throw new Error('must-not-fetch'); } })
    .then(() => assert.fail('explicit enablement should be required'), (error) => assert.match(error.message, /explicit-enable/));
});
