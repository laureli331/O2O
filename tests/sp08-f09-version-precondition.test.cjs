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
    assert.ok(specifier.startsWith('.'), `unexpected runtime dependency: ${specifier}`);
    const resolved = path.resolve(path.dirname(filePath), specifier);
    const moduleFile = fs.existsSync(`${resolved}.ts`) ? `${resolved}.ts` : path.join(resolved, 'index.ts');
    return loadTypeScriptModule(path.relative(root, moduleFile), cache);
  };

  new Function('exports', 'require', 'module', javascript)(module.exports, localRequire, module);
  cache.set(filePath, module.exports);
  return module.exports;
}

test('F09 version precondition accepts a finite exact current-version match', () => {
  const { compareExpectedVersion } = loadTypeScriptModule(
    'packages/shared/src/contracts/private-address-book.ts',
  );

  assert.deepEqual(compareExpectedVersion(3, 3), { kind: 'matches' });
});

test('F09 version precondition reports a conflict when the stored version has advanced', () => {
  const { compareExpectedVersion } = loadTypeScriptModule(
    'packages/shared/src/contracts/private-address-book.ts',
  );

  assert.deepEqual(compareExpectedVersion(3, 4), { kind: 'conflict' });
});

test('F09 version precondition rejects malformed expected or stored version values without coercion', () => {
  const { compareExpectedVersion } = loadTypeScriptModule(
    'packages/shared/src/contracts/private-address-book.ts',
  );

  assert.deepEqual(compareExpectedVersion('3', 3), { kind: 'invalid-expected-version' });
  assert.deepEqual(compareExpectedVersion(Number.NaN, 3), { kind: 'invalid-expected-version' });
  assert.deepEqual(compareExpectedVersion(3, '3'), { kind: 'invalid-current-version' });
  assert.deepEqual(compareExpectedVersion(3, Number.POSITIVE_INFINITY), { kind: 'invalid-current-version' });
});
