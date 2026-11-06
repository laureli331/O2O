'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function loadTypeScriptModule(relativePath) {
  const filePath = path.join(root, relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filePath,
  }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', javascript)(module.exports, require, module);
  return module.exports;
}

test('shared canonical JSON serializer sorts object keys and preserves array order', () => {
  const { serializeCanonicalJson } = loadTypeScriptModule('packages/shared/src/contracts/canonical-json.ts');

  assert.deepEqual(serializeCanonicalJson({ z: [2, 1], a: { y: '湘邻', x: true } }), {
    ok: true,
    json: '{"a":{"x":true,"y":"湘邻"},"z":[2,1]}',
  });
  assert.deepEqual(serializeCanonicalJson({ a: { x: true, y: '湘邻' }, z: [2, 1] }), {
    ok: true,
    json: '{"a":{"x":true,"y":"湘邻"},"z":[2,1]}',
  });
});

test('shared canonical JSON serializer preserves empty strings and JSON scalar meanings', () => {
  const { serializeCanonicalJson } = loadTypeScriptModule('packages/shared/src/contracts/canonical-json.ts');

  assert.deepEqual(serializeCanonicalJson({ empty: '', no: false, zero: 0, nothing: null }), {
    ok: true,
    json: '{"empty":"","no":false,"nothing":null,"zero":0}',
  });
  assert.deepEqual(serializeCanonicalJson(-0), { ok: true, json: '0' });
  assert.deepEqual(serializeCanonicalJson(['', false, 0, null]), {
    ok: true,
    json: '["",false,0,null]',
  });
});

test('shared canonical JSON serializer rejects unsupported values and non-finite numbers', () => {
  const { serializeCanonicalJson } = loadTypeScriptModule('packages/shared/src/contracts/canonical-json.ts');

  for (const value of [undefined, () => 'x', Symbol('x'), 1n]) {
    assert.deepEqual(serializeCanonicalJson(value), { ok: false, reason: 'unsupported-value' });
  }
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.deepEqual(serializeCanonicalJson(value), { ok: false, reason: 'non-finite-number' });
  }
  assert.deepEqual(serializeCanonicalJson({ omitted: undefined }), { ok: false, reason: 'unsupported-value' });
});

test('shared canonical JSON serializer rejects accessors without evaluating them', () => {
  const { serializeCanonicalJson } = loadTypeScriptModule('packages/shared/src/contracts/canonical-json.ts');
  let getterCalls = 0;
  const value = Object.defineProperty({}, 'secret', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return 'not read';
    },
  });

  assert.deepEqual(serializeCanonicalJson(value), { ok: false, reason: 'accessor-property' });
  assert.equal(getterCalls, 0);
});

test('shared canonical JSON serializer rejects sparse arrays, extra properties, and symbols', () => {
  const { serializeCanonicalJson } = loadTypeScriptModule('packages/shared/src/contracts/canonical-json.ts');
  const sparse = new Array(1);
  const extra = [1];
  Object.defineProperty(extra, 'label', { value: 'extra', enumerable: true });
  const symbolKeyed = { value: 1, [Symbol('hidden')]: 2 };

  assert.deepEqual(serializeCanonicalJson(sparse), { ok: false, reason: 'sparse-array' });
  assert.deepEqual(serializeCanonicalJson(extra), { ok: false, reason: 'unsupported-property' });
  assert.deepEqual(serializeCanonicalJson(symbolKeyed), { ok: false, reason: 'unsupported-property' });
});

test('shared canonical JSON serializer rejects cycles and exotic object prototypes', () => {
  const { serializeCanonicalJson } = loadTypeScriptModule('packages/shared/src/contracts/canonical-json.ts');
  const cyclic = {};
  cyclic.self = cyclic;
  const custom = Object.create({ inherited: true });
  custom.own = 1;
  const date = new Date(0);
  const sharedChild = { x: 1 };

  assert.deepEqual(serializeCanonicalJson(cyclic), { ok: false, reason: 'cyclic-value' });
  assert.deepEqual(serializeCanonicalJson(custom), { ok: false, reason: 'non-plain-object' });
  assert.deepEqual(serializeCanonicalJson(date), { ok: false, reason: 'non-plain-object' });
  assert.deepEqual(serializeCanonicalJson({ left: sharedChild, right: sharedChild }), {
    ok: true,
    json: '{"left":{"x":1},"right":{"x":1}}',
  });
  assert.deepEqual(serializeCanonicalJson(Object.assign(Object.create(null), { x: 1 })), {
    ok: true,
    json: '{"x":1}',
  });
});

test('shared canonical JSON serializer contains hostile inspection failures', () => {
  const { serializeCanonicalJson } = loadTypeScriptModule('packages/shared/src/contracts/canonical-json.ts');
  const throwingProxy = new Proxy({}, {
    ownKeys() {
      throw new Error('do not expose hostile object details');
    },
  });

  assert.deepEqual(serializeCanonicalJson(throwingProxy), { ok: false, reason: 'inspection-failed' });
});

test('shared canonical JSON serializer is exported and stays platform-free with strict unknown inputs', () => {
  const source = fs.readFileSync(path.join(root, 'packages/shared/src/contracts/canonical-json.ts'), 'utf8');
  const index = fs.readFileSync(path.join(root, 'packages/shared/src/contracts/index.ts'), 'utf8');

  assert.match(index, /export \* from '\.\/canonical-json';/);
  assert.match(source, /serializeCanonicalJson\(value: unknown\)/);
  assert.doesNotMatch(source, /\bany\b|\bwindow\b|\bdocument\b|\bwx\s*\.|fetch\s*\(|collection\s*\(/);
});
