'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function loadTypeScriptModule(relativePath, cache = new Map()) {
  const filePath = path.join(root, relativePath);
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
    assert.equal(specifier, 'node:crypto', `unexpected runtime dependency: ${specifier}`);
    return require(specifier);
  };

  new Function('exports', 'require', 'module', javascript)(module.exports, localRequire, module);
  cache.set(filePath, module.exports);
  return module.exports;
}

test('Node SHA-256 adapter hashes UTF-8 text and returns lowercase hex', () => {
  const { sha256Utf8Hex } = loadTypeScriptModule('apps/cloud-functions/src/adapters/sha256-utf8.ts');

  assert.equal(sha256Utf8Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256Utf8Hex('湘邻🛠'), '1ce680c32ee7f1883abbd10b79193f4891f4c487ad9c751f4b4b8cbb2e1be358');
  assert.match(sha256Utf8Hex('湘邻🛠'), /^[a-f0-9]{64}$/);
});

test('Node SHA-256 adapter produces the selected SP08 idempotency document ID vector', () => {
  const { createIdempotencyDocumentId } = loadTypeScriptModule('packages/shared/src/contracts/idempotency.ts');
  const { sha256Utf8Hex } = loadTypeScriptModule('apps/cloud-functions/src/adapters/sha256-utf8.ts');

  assert.deepEqual(createIdempotencyDocumentId({
    trustedScope: 'tenant/A|actor:17',
    operation: 'provider.profile.update',
    operationKey: '  client-42  ',
  }, sha256Utf8Hex), {
    ok: true,
    documentId: 'idem_v1_d53848e3c8063e4a92267c77f8e96c05d0bf6b39b0f4421bb083fcd755bf966b',
  });
});

test('Node digest adapter has no cloud SDK, environment-secret, or platform dependency', () => {
  const source = fs.readFileSync(
    path.join(root, 'apps/cloud-functions/src/adapters/sha256-utf8.ts'),
    'utf8',
  );

  assert.match(source, /from ['"]node:crypto['"]/);
  assert.doesNotMatch(source, /wx-server-sdk|@cloudbase\/node-sdk|process\.env|\b(?:window|document|wx)\b|\bany\b/);
});

test('CloudBase add response guard rejects SDK error-shaped results instead of treating them as inserted documents', () => {
  const { requireSingleDocumentAddReceipt } = loadTypeScriptModule(
    'apps/cloud-functions/src/adapters/cloudbase-add-result.ts',
  );
  const sdkFailure = {
    code: 'DATABASE_DUPLICATE_WRITE',
    message: 'backend detail must not escape this adapter',
    requestId: 'request-123',
  };

  assert.throws(() => requireSingleDocumentAddReceipt(sdkFailure), (error) => {
    assert.equal(error.code, 'CLOUDBASE_ADD_UNCONFIRMED');
    assert.equal(error.message, 'CloudBase add did not confirm a document insert');
    assert.doesNotMatch(error.message, /backend detail|DATABASE_DUPLICATE_WRITE|request-123/);
    return true;
  });
});

test('CloudBase add response guard returns only the confirmed document and optional request IDs', () => {
  const { requireSingleDocumentAddReceipt } = loadTypeScriptModule(
    'apps/cloud-functions/src/adapters/cloudbase-add-result.ts',
  );

  assert.deepEqual(requireSingleDocumentAddReceipt({ id: 'idem_v1_abc', requestId: 'req-1' }), {
    documentId: 'idem_v1_abc',
    requestId: 'req-1',
  });
  assert.deepEqual(requireSingleDocumentAddReceipt({ id: 'idem_v1_abc' }), {
    documentId: 'idem_v1_abc',
  });
});

test('CloudBase add response guard requires the SDK transaction receipt before callback success', () => {
  const { requireSingleDocumentAddReceipt } = loadTypeScriptModule(
    'apps/cloud-functions/src/adapters/cloudbase-add-result.ts',
  );

  assert.deepEqual(requireSingleDocumentAddReceipt({
    id: 'idem_v1_abc',
    requestId: 'req-1',
    inserted: 1,
    ok: 1,
  }, 'transaction'), {
    documentId: 'idem_v1_abc',
    requestId: 'req-1',
  });
  assert.throws(() => requireSingleDocumentAddReceipt({ id: 'idem_v1_abc' }, 'transaction'), {
    code: 'CLOUDBASE_ADD_UNCONFIRMED',
  });
  assert.throws(() => requireSingleDocumentAddReceipt({
    id: 'idem_v1_abc', inserted: 0, ok: 1,
  }, 'transaction'), {
    code: 'CLOUDBASE_ADD_UNCONFIRMED',
  });
});

test('CloudBase add response guard rejects malformed or batch-shaped results for a single document', () => {
  const { requireSingleDocumentAddReceipt } = loadTypeScriptModule(
    'apps/cloud-functions/src/adapters/cloudbase-add-result.ts',
  );

  for (const value of [null, [], {}, { ids: ['doc-1'], requestId: 'req-1' }, { id: '', requestId: 'req-1' }]) {
    assert.throws(() => requireSingleDocumentAddReceipt(value), {
      code: 'CLOUDBASE_ADD_UNCONFIRMED',
    });
  }
});

test('CloudBase add response guard remains independent of SDK, environment, and platform APIs', () => {
  const source = fs.readFileSync(
    path.join(root, 'apps/cloud-functions/src/adapters/cloudbase-add-result.ts'),
    'utf8',
  );
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, '');

  assert.doesNotMatch(code, /^\s*import\b/m);
  assert.doesNotMatch(code, /\brequire\s*\(|\bimport\s*\(/);
  assert.doesNotMatch(code, /(?:process\.env|\b(?:window|document|wx)\s*\.|:\s*any\b|\bas\s+any\b)/);
});

test('paired SP08 records distinguish local adapter evidence from target-runtime and cloud proof', () => {
  const mapping = JSON.parse(fs.readFileSync(
    path.join(root, 'docs/sp08-idempotency-physical-mapping-20261106.json'),
    'utf8',
  ));
  const progress = JSON.parse(fs.readFileSync(
    path.join(root, 'docs/sp08-data-request-contract-progress-20261105.json'),
    'utf8',
  ));
  const adapterEvidence = progress.evidence.idempotencyNodeSha256AdapterValidation;

  assert.equal(mapping.cloudMutationsPerformed, false);
  assert.equal(mapping.decision.idEncoding.status, 'shared-contract-and-node-adapter-implemented; local-target-runtime-verified; cloud-unverified');
  assert.ok(!mapping.decision.idEncoding.notProven.includes('adapter execution under the selected Node.js 20.19.x runtime'));
  assert.match(adapterEvidence.executedNodeVersion, /^v20\.19\./);
  assert.equal(adapterEvidence.targetRuntimeExecuted, true);
  assert.equal(adapterEvidence.serverAdapterAndCloudRuntimeProven, false);
  assert.equal(adapterEvidence.cloudMutationsPerformed, false);
  assert.ok(mapping.reuseSurvey.officialSources.some(({ url }) => url === 'https://r2.nodejs.org/docs/v20.19.2/api/crypto.html'));
});
