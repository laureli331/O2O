const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const sharedRoot = path.join(root, 'packages', 'shared', 'src');

function loadTypeScriptModule(relativePath, cache = new Map()) {
  const filePath = path.resolve(sharedRoot, relativePath.endsWith('.ts') ? relativePath : `${relativePath}.ts`);
  if (cache.has(filePath)) return cache.get(filePath);

  const source = fs.readFileSync(filePath, 'utf8');
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filePath,
  }).outputText;
  const module = { exports: {} };
  cache.set(filePath, module.exports);

  const localRequire = (specifier) => {
    assert.ok(specifier.startsWith('.'), `shared contract must not load runtime dependency: ${specifier}`);
    const resolved = path.resolve(path.dirname(filePath), specifier);
    const moduleFile = fs.existsSync(`${resolved}.ts`) ? `${resolved}.ts` : path.join(resolved, 'index.ts');
    return loadTypeScriptModule(path.relative(sharedRoot, moduleFile), cache);
  };

  new Function('exports', 'require', 'module', javascript)(module.exports, localRequire, module);
  cache.set(filePath, module.exports);
  return module.exports;
}

test('shared public entry exports the SP08 request and money contracts', () => {
  const shared = loadTypeScriptModule('index.ts');

  assert.equal(typeof shared.parseCnyFen, 'function');
  assert.equal(typeof shared.formatCnyFen, 'function');
  assert.equal(typeof shared.parseCommandEnvelope, 'function');
  assert.equal(typeof shared.parseTrustedCommandContext, 'function');
  assert.equal(typeof shared.parseCommandResult, 'function');
  assert.equal(typeof shared.validatePrivateAddressBookPhone, 'function');
  assert.equal(typeof shared.validatePrivateAddressBookText, 'function');
  assert.equal(shared.COMMAND_PROTOCOL_VERSION, 1);
});

test('command result parser accepts a success result and preserves its value', () => {
  const { parseCommandResult } = loadTypeScriptModule('contracts/result.ts');
  const value = { id: 'item-1', version: 3 };

  assert.deepEqual(parseCommandResult({
    status: 'succeeded',
    requestId: 'request-1',
    value,
  }), {
    ok: true,
    value: { status: 'succeeded', requestId: 'request-1', value },
  });
});

test('command result parser preserves processing and unknown without inventing a retry decision', () => {
  const { parseCommandResult } = loadTypeScriptModule('contracts/result.ts');

  for (const status of ['processing', 'unknown']) {
    assert.deepEqual(parseCommandResult({ status, requestId: 'request-2' }), {
      ok: true,
      value: { status, requestId: 'request-2' },
    });
  }
});

test('command result parser accepts rejected and failed results only with documented error fields', () => {
  const { parseCommandResult } = loadTypeScriptModule('contracts/result.ts');
  const error = {
    category: 'dependency-failure',
    code: 'supplier-timeout',
    requestId: 'request-3',
  };

  for (const status of ['rejected', 'failed']) {
    assert.deepEqual(parseCommandResult({ status, requestId: 'request-3', error }), {
      ok: true,
      value: { status, requestId: 'request-3', error },
    });
  }
});

test('command result parser rejects unknown, incomplete, or cross-request fields', () => {
  const { parseCommandResult } = loadTypeScriptModule('contracts/result.ts');
  const inheritedFields = Object.create({ status: 'unknown', requestId: 'request-4' });

  assert.deepEqual(parseCommandResult(null), { ok: false, reason: { code: 'not-object' } });
  assert.deepEqual(parseCommandResult(inheritedFields), {
    ok: false,
    reason: { code: 'missing-field', field: 'status' },
  });
  assert.deepEqual(parseCommandResult({ status: 'done', requestId: 'request-4' }), {
    ok: false,
    reason: { code: 'invalid-status' },
  });
  assert.deepEqual(parseCommandResult({ status: 'succeeded', requestId: 'request-4' }), {
    ok: false,
    reason: { code: 'missing-field', field: 'value' },
  });
  assert.deepEqual(parseCommandResult({ status: 'unknown', requestId: 'request-4', retry: true }), {
    ok: false,
    reason: { code: 'unexpected-field', field: 'retry' },
  });
  assert.deepEqual(parseCommandResult({
    status: 'failed',
    requestId: 'request-4',
    error: { category: 'not-safe', code: 'x', requestId: 'request-4' },
  }), { ok: false, reason: { code: 'invalid-error-category' } });
  assert.deepEqual(parseCommandResult({
    status: 'failed',
    requestId: 'request-4',
    error: { category: 'internal-failure', code: 'x', requestId: 'request-5' },
  }), { ok: false, reason: { code: 'request-id-mismatch' } });
});

test('private address book phone validation accepts an exact eleven-digit value', () => {
  const { validatePrivateAddressBookPhone } = loadTypeScriptModule('contracts/private-address-book.ts');

  assert.deepEqual(validatePrivateAddressBookPhone('13800138000'), {
    ok: true,
    value: '13800138000',
  });
  assert.deepEqual(validatePrivateAddressBookPhone('00000000000'), {
    ok: true,
    value: '00000000000',
  });
});

test('private address book phone validation rejects non-strings and anything other than eleven ASCII digits', () => {
  const { validatePrivateAddressBookPhone } = loadTypeScriptModule('contracts/private-address-book.ts');

  for (const input of [null, undefined, 13800138000, {}, []]) {
    assert.deepEqual(validatePrivateAddressBookPhone(input), { ok: false, reason: 'not-string' });
  }

  for (const input of ['', '1380013800', '138001380000', '138 0013 8000', '+8613800138000', '１３８００１３８０００']) {
    assert.deepEqual(validatePrivateAddressBookPhone(input), { ok: false, reason: 'not-eleven-digits' });
  }
});

test('private address book phone validation is a pure field-shape contract with no ownership claim', () => {
  const source = fs.readFileSync(path.join(sharedRoot, 'contracts', 'private-address-book.ts'), 'utf8');
  const contractsIndex = fs.readFileSync(path.join(sharedRoot, 'contracts', 'index.ts'), 'utf8');

  assert.match(contractsIndex, /export \* from '\.\/private-address-book';/);
  assert.match(source, /does not verify control of the number/);
  assert.match(source, /Unicode code points/);
  assert.doesNotMatch(source, /\bany\b|\bwindow\b|\bdocument\b|\bwx\s*\.|fetch\s*\(|collection\s*\(/);
});

test('F09 contact text is trimmed and measured by Unicode code points', () => {
  const { validatePrivateAddressBookText } = loadTypeScriptModule('contracts/private-address-book.ts');

  assert.deepEqual(validatePrivateAddressBookText('contact', '  张三🛠  '), {
    ok: true,
    value: '张三🛠',
    characterCount: 3,
  });
});

test('F09 address-book text fields enforce only their documented code-point limits', () => {
  const { validatePrivateAddressBookText } = loadTypeScriptModule('contracts/private-address-book.ts');

  for (const [field, text, limit] of [
    ['contact', '张'.repeat(20), 20],
    ['contact', '🛠'.repeat(20), 20],
    ['detailAddress', '路'.repeat(200), 200],
    ['remark', '注'.repeat(100), 100],
  ]) {
    assert.deepEqual(validatePrivateAddressBookText(field, text), {
      ok: true,
      value: text,
      characterCount: limit,
    });
  }

  for (const [field, text] of [
    ['contact', '张'.repeat(21)],
    ['contact', '🛠'.repeat(21)],
    ['detailAddress', '路'.repeat(201)],
    ['remark', '注'.repeat(101)],
  ]) {
    assert.deepEqual(validatePrivateAddressBookText(field, text), {
      ok: false,
      reason: 'too-long',
    });
  }

  const emojiWithModifier = '🧑🏽';
  assert.deepEqual(validatePrivateAddressBookText('contact', emojiWithModifier.repeat(10)), {
    ok: true,
    value: emojiWithModifier.repeat(10),
    characterCount: 20,
  });
  assert.deepEqual(validatePrivateAddressBookText('contact', emojiWithModifier.repeat(11)), {
    ok: false,
    reason: 'too-long',
  });

  assert.deepEqual(validatePrivateAddressBookText('community', '村'.repeat(201)), {
    ok: true,
    value: '村'.repeat(201),
    characterCount: 201,
  });
});

test('F09 required text rejects blank and non-string values while optional remark may be absent', () => {
  const { validatePrivateAddressBookText } = loadTypeScriptModule('contracts/private-address-book.ts');

  for (const field of ['contact', 'community', 'detailAddress']) {
    assert.deepEqual(validatePrivateAddressBookText(field, '  \t\n '), {
      ok: false,
      reason: 'empty',
    });
    for (const input of [null, 7, {}, []]) {
      assert.deepEqual(validatePrivateAddressBookText(field, input), {
        ok: false,
        reason: 'not-string',
      });
    }
  }

  assert.deepEqual(validatePrivateAddressBookText('remark', undefined), {
    ok: true,
    value: '',
    characterCount: 0,
  });
  assert.deepEqual(validatePrivateAddressBookText('remark', '  '), {
    ok: true,
    value: '',
    characterCount: 0,
  });
  assert.deepEqual(validatePrivateAddressBookText('postalCode', '123'), {
    ok: false,
    reason: 'unknown-field',
  });
});

test('yuan decimal strings convert to integer fen without floating point', () => {
  const { parseCnyFen, formatCnyFen } = loadTypeScriptModule('contracts/money.ts');
  const examples = [
    ['0', 0, '0.00'],
    ['0.01', 1, '0.01'],
    ['1.2', 120, '1.20'],
    ['99999.99', 9_999_999, '99999.99'],
  ];

  for (const [input, expectedFen, expectedText] of examples) {
    const parsed = parseCnyFen(input);
    assert.deepEqual(parsed, { ok: true, value: expectedFen });
    assert.equal(formatCnyFen(parsed.value), expectedText);
  }
});

test('yuan decimal parser rejects unknown, imprecise, malformed, negative, and over-limit input', () => {
  const { parseCnyFen } = loadTypeScriptModule('contracts/money.ts');
  const invalidInputs = [
    null,
    undefined,
    1.01,
    '1e2',
    ' 1.00',
    '+1.00',
    '-0.01',
    '1.001',
    '100000.00',
    '1,000.00',
    '.50',
  ];

  for (const input of invalidInputs) {
    assert.equal(parseCnyFen(input).ok, false, `expected rejection for ${String(input)}`);
  }
  assert.deepEqual(parseCnyFen('100000.00'), { ok: false, reason: 'out-of-range' });
  assert.deepEqual(parseCnyFen('1.001'), { ok: false, reason: 'too-precise' });
  assert.deepEqual(parseCnyFen('01.00'), { ok: true, value: 100 });
});

test('request envelope separates untrusted client data from trusted server context', () => {
  const commandSource = fs.readFileSync(path.join(sharedRoot, 'contracts', 'command.ts'), 'utf8');
  const resultSource = fs.readFileSync(path.join(sharedRoot, 'contracts', 'result.ts'), 'utf8');
  const combined = `${commandSource}\n${resultSource}`;

  for (const requiredToken of ['operationKey', 'objectId', 'expectedVersion', 'payload', 'actorId', 'receivedAtEpochMs']) {
    assert.ok(combined.includes(requiredToken), `missing contract element ${requiredToken}`);
  }
  for (const outcome of ['succeeded', 'rejected', 'failed', 'processing', 'unknown']) {
    assert.ok(resultSource.includes(`'${outcome}'`), `missing result outcome ${outcome}`);
  }

  const clientEnvelope = commandSource.match(/export interface CommandEnvelope[\s\S]*?\n}/)?.[0];
  assert.ok(clientEnvelope, 'CommandEnvelope declaration must exist');
  assert.doesNotMatch(clientEnvelope, /actorId|receivedAtEpochMs|serverTime|role|amountFen/);
  assert.doesNotMatch(combined, /\bany\b|\bwindow\b|\bdocument\b|\bwx\s*\./);
});

test('trusted command context parser checks the adapter-provided shape without establishing trust', () => {
  const { parseTrustedCommandContext } = loadTypeScriptModule('contracts/command.ts');
  const source = fs.readFileSync(path.join(sharedRoot, 'contracts', 'command.ts'), 'utf8');
  const input = { actorId: 'actor-1', receivedAtEpochMs: 1_800_000_000_000, requestId: 'request-1' };

  assert.match(source, /does not authenticate an actor/);
  assert.doesNotMatch(source, /\bany\b|\bwindow\b|\bdocument\b|\bwx\s*\.|fetch\s*\(|collection\s*\(/);
  assert.deepEqual(parseTrustedCommandContext(input), { ok: true, value: input });
  assert.deepEqual(parseTrustedCommandContext({ actorId: 'actor-1', receivedAtEpochMs: 0, requestId: 'request-1' }), {
    ok: true,
    value: { actorId: 'actor-1', receivedAtEpochMs: 0, requestId: 'request-1' },
  });
  assert.deepEqual(parseTrustedCommandContext({ ...input, role: 'admin' }), {
    ok: false,
    reason: { code: 'unexpected-field', field: 'role' },
  });
});

test('trusted command context parser rejects malformed, incomplete, blank, and non-finite facts', () => {
  const { parseTrustedCommandContext } = loadTypeScriptModule('contracts/command.ts');
  const valid = { actorId: 'actor-1', receivedAtEpochMs: 1_800_000_000_000, requestId: 'request-1' };

  for (const input of [null, undefined, [], 'context', 1]) {
    assert.deepEqual(parseTrustedCommandContext(input), { ok: false, reason: { code: 'not-object' } });
  }
  assert.deepEqual(parseTrustedCommandContext(Object.create(valid)), {
    ok: false,
    reason: { code: 'missing-field', field: 'actorId' },
  });
  assert.deepEqual(parseTrustedCommandContext({ ...valid, actorId: '   ' }), {
    ok: false,
    reason: { code: 'empty-field', field: 'actorId' },
  });
  assert.deepEqual(parseTrustedCommandContext({ ...valid, requestId: '' }), {
    ok: false,
    reason: { code: 'empty-field', field: 'requestId' },
  });
  for (const receivedAtEpochMs of ['now', Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(parseTrustedCommandContext({ ...valid, receivedAtEpochMs }), {
      ok: false,
      reason: { code: 'invalid-field-type', field: 'receivedAtEpochMs' },
    });
  }
});

test('command envelope parser narrows only the documented generic structure', () => {
  const { parseCommandEnvelope } = loadTypeScriptModule('contracts/command.ts');
  const payload = { nested: [1, true, null] };
  const input = {
    protocolVersion: 1,
    requestId: 'req-1',
    objectId: 'object-1',
    operation: 'module-owned-operation',
    operationKey: 'op-key-1',
    expectedVersion: 3,
    payload,
  };

  assert.deepEqual(parseCommandEnvelope(input), { ok: true, value: input });
  const withoutExpectedVersion = { ...input };
  delete withoutExpectedVersion.expectedVersion;
  assert.deepEqual(parseCommandEnvelope(withoutExpectedVersion), { ok: true, value: withoutExpectedVersion });
  assert.deepEqual(parseCommandEnvelope({ ...input, payload: null }), {
    ok: true,
    value: { ...input, payload: null },
  });
  assert.deepEqual(parseCommandEnvelope({ ...input, operation: 'future-module-operation' }).ok, true);
});

test('command envelope parser rejects non-object inputs and missing own required fields', () => {
  const { parseCommandEnvelope } = loadTypeScriptModule('contracts/command.ts');
  const valid = {
    protocolVersion: 1,
    requestId: 'req-1',
    objectId: 'object-1',
    operation: 'operation-1',
    operationKey: 'op-key-1',
    payload: {},
  };

  for (const input of [null, undefined, [], 'command', 1]) {
    assert.deepEqual(parseCommandEnvelope(input), { ok: false, reason: { code: 'not-object' } });
  }

  for (const field of ['protocolVersion', 'requestId', 'objectId', 'operation', 'operationKey', 'payload']) {
    const input = { ...valid };
    delete input[field];
    assert.deepEqual(parseCommandEnvelope(input), {
      ok: false,
      reason: { code: 'missing-field', field },
    });
  }

  const inherited = Object.assign(Object.create({ requestId: 'inherited' }), valid);
  delete inherited.requestId;
  assert.deepEqual(parseCommandEnvelope(inherited), {
    ok: false,
    reason: { code: 'missing-field', field: 'requestId' },
  });
});

test('command envelope parser rejects malformed types, unsupported version, empty identifiers, and untrusted extra fields', () => {
  const { parseCommandEnvelope } = loadTypeScriptModule('contracts/command.ts');
  const valid = {
    protocolVersion: 1,
    requestId: 'req-1',
    objectId: 'object-1',
    operation: 'operation-1',
    operationKey: 'op-key-1',
    payload: {},
  };

  assert.deepEqual(parseCommandEnvelope({ ...valid, protocolVersion: 2 }), {
    ok: false,
    reason: { code: 'unsupported-protocol-version' },
  });
  for (const field of ['requestId', 'objectId', 'operation', 'operationKey']) {
    assert.deepEqual(parseCommandEnvelope({ ...valid, [field]: '' }), {
      ok: false,
      reason: { code: 'empty-field', field },
    });
    assert.deepEqual(parseCommandEnvelope({ ...valid, [field]: '   ' }), {
      ok: false,
      reason: { code: 'empty-field', field },
    });
    assert.deepEqual(parseCommandEnvelope({ ...valid, [field]: 1 }), {
      ok: false,
      reason: { code: 'invalid-field-type', field },
    });
  }
  assert.deepEqual(parseCommandEnvelope({ ...valid, expectedVersion: '3' }), {
    ok: false,
    reason: { code: 'invalid-field-type', field: 'expectedVersion' },
  });
  assert.deepEqual(parseCommandEnvelope({ ...valid, payload: undefined }), {
    ok: false,
    reason: { code: 'invalid-field-type', field: 'payload' },
  });
  for (const expectedVersion of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.deepEqual(parseCommandEnvelope({ ...valid, expectedVersion }), {
      ok: false,
      reason: { code: 'invalid-field-type', field: 'expectedVersion' },
    });
  }
  for (const field of ['actorId', 'role', 'amountFen', 'receivedAtEpochMs', 'serverTime', 'paymentConfirmed']) {
    assert.deepEqual(parseCommandEnvelope({ ...valid, [field]: 'forged' }), {
      ok: false,
      reason: { code: 'unexpected-field', field },
    });
  }
});

test('idempotency reuse replays the original outcome only for a matching validated payload', () => {
  const { resolveIdempotencyReuse } = loadTypeScriptModule('contracts/idempotency.ts');
  const originalOutcomes = [
    { status: 'succeeded', requestId: 'original-success', value: { version: 2 } },
    { status: 'rejected', requestId: 'original-rejected', error: { category: 'business-rejected', code: 'RULE', requestId: 'original-rejected' } },
    { status: 'failed', requestId: 'original-failed', error: { category: 'dependency-failure', code: 'DEPENDENCY', requestId: 'original-failed' } },
    { status: 'processing', requestId: 'original-processing' },
    { status: 'unknown', requestId: 'original-unknown' },
  ];

  for (const originalResult of originalOutcomes) {
    assert.deepEqual(resolveIdempotencyReuse('same', originalResult), {
      outcome: 'replay',
      originalResult,
    });
  }

  assert.deepEqual(resolveIdempotencyReuse('different', originalOutcomes[0]), {
    outcome: 'reject',
    reason: 'payload-mismatch',
  });
});

test('idempotency reuse is a shared pure contract and does not invent storage or transport APIs', () => {
  const source = fs.readFileSync(path.join(sharedRoot, 'contracts', 'idempotency.ts'), 'utf8');
  const contractsIndex = fs.readFileSync(path.join(sharedRoot, 'contracts', 'index.ts'), 'utf8');
  const sharedIndex = fs.readFileSync(path.join(sharedRoot, 'index.ts'), 'utf8');

  assert.match(contractsIndex, /export \* from '\.\/idempotency';/);
  assert.match(sharedIndex, /export \* from '\.\/contracts';/);
  assert.match(source, /IdempotencyPayloadComparison/);
  assert.match(source, /CommandResult/);
  assert.doesNotMatch(source, /\bany\b|\bwindow\b|\bdocument\b|\bwx\s*\.|fetch\s*\(|collection\s*\(/);
});

test('SP08 progress record keeps this local contract slice distinct from cloud/product acceptance', () => {
  const record = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sp08-data-request-contract-progress-20261105.json'), 'utf8'));

  assert.equal(record.taskId, 'SP08');
  assert.equal(record.status, 'in-progress');
  assert.equal(record.productAcceptancePassed, false);
  assert.equal(record.cloudMutationsPerformed, false);
  assert.ok(record.scope.includes('shared-idempotency-reuse-decision'));
  assert.ok(record.scope.includes('command-envelope-runtime-structure-validation'));
  assert.ok(record.scope.includes('trusted-command-context-runtime-shape-validation'));
  assert.ok(record.scope.includes('command-result-runtime-shape-validation'));
  assert.ok(record.scope.includes('f09-private-address-book-phone-shape-validation'));
  assert.ok(record.scope.includes('f09-private-address-book-text-shape-validation'));
  assert.ok(record.notProven.includes('command-result-business-outcome-evidence'));
  assert.ok(record.notProven.includes('remaining-module-specific-command-validation'));
  assert.ok(record.notProven.includes('atomic-idempotency-claim-with-business-write'));
  assert.ok(record.notProven.includes('business-transaction-concurrency'));
  assert.ok(record.notProven.includes('physical-indexes-and-uniqueness'));
});

test('SP08 database capability map distinguishes documented platform limits from synthetic probe evidence', () => {
  const map = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sp08-database-capability-map-20261105.json'), 'utf8'));

  assert.equal(map.taskId, 'SP08');
  assert.equal(map.productAcceptancePassed, false);
  assert.equal(map.cloudMutationsPerformed, false);
  assert.equal(map.selectedDatabase.mode, 'document');
  assert.equal(map.transaction.documented.serverSideOnly, true);
  assert.equal(map.transaction.documented.maxDurationSeconds, 10);
  assert.equal(map.transaction.documented.queryMethods.includes('where'), false);
  assert.equal(map.indexes.documented.uniqueIndex.supported, true);
  assert.equal(map.indexes.documented.uniqueIndex.missingFieldTreatedAsNull, true);
  assert.equal(map.transaction.syntheticProbe.commit.allDocumentsVisible, true);
  assert.equal(map.transaction.syntheticProbe.rollback.noPartialWrites, true);
  assert.equal(map.transaction.syntheticProbe.concurrentIncrement.finalValue, 2);
  assert.equal(map.transaction.syntheticProbe.concurrentIncrement.businessScenariosRepresented, false);
  assert.ok(map.stillUnproven.includes('product-data-access-paths-and-physical-indexes'));
  assert.ok(map.stillUnproven.includes('business-invariant-concurrency'));
  assert.ok(map.sources.some((source) => source.url === 'https://docs.cloudbase.net/database/transaction'));
  assert.ok(map.sources.some((source) => source.url === 'https://docs.cloudbase.net/database/data-index'));
});

test('SP08 logical ownership map covers PRD field groups without pretending to define physical schemas', () => {
  const map = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sp08-object-ownership-map-20261105.json'), 'utf8'));

  assert.equal(map.taskId, 'SP08');
  assert.equal(map.status, 'logical-draft');
  assert.equal(map.physicalSchemaDefined, false);
  assert.equal(map.cloudMutationsPerformed, false);
  assert.deepEqual(map.fieldGroups.map((group) => group.prdFieldId), Array.from({ length: 22 }, (_, index) => `F${String(index + 1).padStart(2, '0')}`));
  assert.ok(map.fieldGroups.every((group) => (
    group.ownerModule
    && Array.isArray(group.publicView)
    && Array.isArray(group.conditionalView)
    && Array.isArray(group.privateView)
    && group.snapshotRule
  )));
  assert.ok(map.snapshots.some((snapshot) => snapshot.id === 'public-request-projection' && snapshot.versioned === true));
  assert.ok(map.snapshots.some((snapshot) => snapshot.id === 'selected-address' && snapshot.editAfterSelectionChangesPriorSnapshot === false));
  assert.ok(map.snapshots.some((snapshot) => snapshot.id === 'rating-publication' && snapshot.onlyApprovedVersionIsPublic === true));
  assert.ok(map.unresolved.some((item) => item.id === 'errand-attachment-visibility'));
  assert.ok(map.unresolved.some((item) => item.id === 'merchant-post-rule-owner'));
  assert.ok(map.unresolved.some((item) => item.id === 'retention-and-erasure-periods'));
  assert.ok(map.sources.some((source) => source.path === 'docs/prd.md' && source.reference.includes('F01-F22')));
  assert.ok(map.sources.some((source) => source.path === 'docs/backend-architecture-contract-20261103.md' && source.reference.includes('Section 3')));
});
