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
  assert.equal(shared.COMMAND_PROTOCOL_VERSION, 1);
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
  assert.ok(record.notProven.includes('module-specific-command-validation'));
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
