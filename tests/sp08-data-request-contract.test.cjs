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

test('SP08 progress record keeps this local contract slice distinct from cloud/product acceptance', () => {
  const record = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sp08-data-request-contract-progress-20261105.json'), 'utf8'));

  assert.equal(record.taskId, 'SP08');
  assert.equal(record.status, 'in-progress');
  assert.equal(record.productAcceptancePassed, false);
  assert.equal(record.cloudMutationsPerformed, false);
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
