'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function loadTypeScriptModule(relativePath, cache = new Map()) {
  const unresolvedPath = path.resolve(root, relativePath);
  const filePath = unresolvedPath.endsWith('.ts') ? unresolvedPath : `${unresolvedPath}.ts`;
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
    if (specifier === 'node:crypto') return require(specifier);
    assert.ok(specifier.startsWith('.'), `unexpected runtime dependency: ${specifier}`);
    const resolved = path.resolve(path.dirname(filePath), specifier);
    const moduleFile = fs.existsSync(`${resolved}.ts`) ? `${resolved}.ts` : path.join(resolved, 'index.ts');
    return loadTypeScriptModule(path.relative(root, moduleFile), cache);
  };

  new Function('exports', 'require', 'module', javascript)(module.exports, localRequire, module);
  cache.set(filePath, module.exports);
  return module.exports;
}

function command(name = 'New address') {
  return {
    operation: 'create',
    payload: {
      draft: {
        contact: name,
        phone: '13800138000',
        community: '湘阴渡社区',
        detailAddress: '测试地址',
        remark: '',
      },
      makeDefault: true,
    },
  };
}

function successfulResult(value = { addressId: 'addr-1', version: 1 }) {
  return { status: 'succeeded', requestId: 'request-original', value };
}

test('F09 idempotency inspection produces a non-sensitive new-claim candidate', () => {
  const { preparePrivateAddressBookIdempotencyDecision } = loadTypeScriptModule(
    'apps/cloud-functions/src/application/private-address-book-idempotency.ts',
  );
  const { sha256Utf8Hex } = loadTypeScriptModule('apps/cloud-functions/src/adapters/sha256-utf8.ts');

  const result = preparePrivateAddressBookIdempotencyDecision({
    trustedScope: 'owner:account-1',
    operationKey: 'client-key-1',
    command: command(),
    existingOutcome: null,
    sha256Utf8Hex,
  });

  assert.equal(result.kind, 'new-claim-candidate');
  assert.match(result.documentId, /^idem_v1_[a-f0-9]{64}$/);
  assert.match(result.payloadDigest, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(result), /13800138000|测试地址|New address/);
});

test('F09 idempotency inspection replays the original result after envelope parsing', () => {
  const { preparePrivateAddressBookIdempotencyDecision } = loadTypeScriptModule(
    'apps/cloud-functions/src/application/private-address-book-idempotency.ts',
  );
  const { createPrivateAddressBookCommandPayloadDigest } = loadTypeScriptModule(
    'packages/shared/src/contracts/private-address-book-command-digest.ts',
  );
  const { sha256Utf8Hex } = loadTypeScriptModule('apps/cloud-functions/src/adapters/sha256-utf8.ts');
  const originalResult = successfulResult();
  const payloadDigest = createPrivateAddressBookCommandPayloadDigest(command(), sha256Utf8Hex);
  assert.equal(payloadDigest.ok, true);

  const result = preparePrivateAddressBookIdempotencyDecision({
    trustedScope: 'owner:account-1',
    operationKey: 'client-key-1',
    command: command(),
    existingOutcome: { payloadDigest: payloadDigest.digest, originalResult },
    sha256Utf8Hex,
  });

  assert.deepEqual(result, {
    kind: 'replay',
    documentId: result.documentId,
    originalResult,
  });
  assert.equal(result.originalResult.requestId, 'request-original');
});

test('F09 idempotency inspection rejects a reused key with a different normalized payload', () => {
  const { preparePrivateAddressBookIdempotencyDecision } = loadTypeScriptModule(
    'apps/cloud-functions/src/application/private-address-book-idempotency.ts',
  );
  const { createPrivateAddressBookCommandPayloadDigest } = loadTypeScriptModule(
    'packages/shared/src/contracts/private-address-book-command-digest.ts',
  );
  const { sha256Utf8Hex } = loadTypeScriptModule('apps/cloud-functions/src/adapters/sha256-utf8.ts');
  const originalDigest = createPrivateAddressBookCommandPayloadDigest(command(), sha256Utf8Hex);
  assert.equal(originalDigest.ok, true);

  const result = preparePrivateAddressBookIdempotencyDecision({
    trustedScope: 'owner:account-1',
    operationKey: 'client-key-1',
    command: command('Different address'),
    existingOutcome: { payloadDigest: originalDigest.digest, originalResult: successfulResult() },
    sha256Utf8Hex,
  });

  assert.equal(result.kind, 'reject');
  assert.equal(result.reason, 'payload-mismatch');
  assert.equal(result.documentId.startsWith('idem_v1_'), true);
});

test('F09 idempotency inspection validates untrusted commands and stored outcome shapes', () => {
  const { preparePrivateAddressBookIdempotencyDecision } = loadTypeScriptModule(
    'apps/cloud-functions/src/application/private-address-book-idempotency.ts',
  );
  const { sha256Utf8Hex } = loadTypeScriptModule('apps/cloud-functions/src/adapters/sha256-utf8.ts');
  const base = {
    trustedScope: 'owner:account-1',
    operationKey: 'client-key-1',
    command: command(),
    existingOutcome: null,
    sha256Utf8Hex,
  };

  assert.deepEqual(preparePrivateAddressBookIdempotencyDecision({ ...base, command: { operation: 'forged' } }), {
    kind: 'invalid',
    reason: 'invalid-command',
  });
  assert.deepEqual(preparePrivateAddressBookIdempotencyDecision({ ...base, trustedScope: '   ' }), {
    kind: 'invalid',
    reason: 'invalid-claim-input',
  });
  assert.deepEqual(preparePrivateAddressBookIdempotencyDecision({
    ...base,
    existingOutcome: { payloadDigest: 'not-a-digest', originalResult: successfulResult() },
  }), {
    kind: 'invalid',
    reason: 'invalid-existing-outcome',
  });
  assert.deepEqual(preparePrivateAddressBookIdempotencyDecision({
    ...base,
    existingOutcome: { payloadDigest: 'a'.repeat(64), originalResult: { status: 'succeeded' } },
  }), {
    kind: 'invalid',
    reason: 'invalid-existing-outcome',
  });
});

test('F09 same-key lookup scope and operation remain part of the deterministic ID', () => {
  const { preparePrivateAddressBookIdempotencyDecision } = loadTypeScriptModule(
    'apps/cloud-functions/src/application/private-address-book-idempotency.ts',
  );
  const { sha256Utf8Hex } = loadTypeScriptModule('apps/cloud-functions/src/adapters/sha256-utf8.ts');
  const input = {
    trustedScope: 'owner:account-1',
    operationKey: 'client-key-1',
    command: command(),
    existingOutcome: null,
    sha256Utf8Hex,
  };
  const original = preparePrivateAddressBookIdempotencyDecision(input);
  const differentScope = preparePrivateAddressBookIdempotencyDecision({
    ...input,
    trustedScope: 'owner:account-2',
  });
  const differentKey = preparePrivateAddressBookIdempotencyDecision({
    ...input,
    operationKey: 'client-key-2',
  });
  const differentOperation = preparePrivateAddressBookIdempotencyDecision({
    ...input,
    command: { operation: 'delete', expectedVersion: 1, payload: { addressId: 'addr-1' } },
  });

  assert.equal(original.kind, 'new-claim-candidate');
  assert.notEqual(original.documentId, differentScope.documentId);
  assert.notEqual(original.documentId, differentKey.documentId);
  assert.notEqual(original.documentId, differentOperation.documentId);
});
