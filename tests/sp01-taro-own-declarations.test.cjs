'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { checkOwnDeclarations } = require('../tools/sp01-taro-probe/check-own-declarations.cjs');
const parent = path.resolve(__dirname, '../.local/taro-own-declaration-tests');
fs.mkdirSync(parent, { recursive: true });
test('own declarations use strict full checking and cannot inherit skipLibCheck from the app', () => {
  const root = fs.mkdtempSync(path.join(parent, 'case-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src/own.d.ts'), 'declare const x: string;');
  const result = checkOwnDeclarations(root, (_node, args) => {
    const config = JSON.parse(fs.readFileSync(args[args.indexOf('--project') + 1], 'utf8'));
    assert.equal(config.compilerOptions.strict, true);
    assert.equal(config.compilerOptions.skipLibCheck, false);
    assert.equal(config.files.length, 1);
    assert.deepEqual(config.compilerOptions.types, []);
    return { status: 2 };
  });
  assert.equal(result.success, false);
  assert.equal(result.compilerExitCode, 2);
  assert.equal(result.declarationCount, 1);
});
test('empty inventory is explicit and does not pretend that declaration type checking ran', () => {
  const root = fs.mkdtempSync(path.join(parent, 'empty-'));
  const result = checkOwnDeclarations(root, () => { throw Error('must not compile'); });
  assert.equal(result.success, true);
  assert.equal(result.declarationCount, 0);
  assert.equal(result.compilerExecuted, false);
});

test('active app config and commands keep strict source checks and separate full vendor and own declarations', () => {
  const source = path.resolve(__dirname, '../tools/sp01-taro-probe');
  const app = JSON.parse(fs.readFileSync(path.join(source, 'tsconfig.app.json'), 'utf8'));
  const vendor = JSON.parse(fs.readFileSync(path.join(source, 'tsconfig.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
  assert.equal(app.compilerOptions.strict, true);
  assert.equal(app.compilerOptions.skipLibCheck, true);
  assert.equal(vendor.compilerOptions.strict, true);
  assert.equal(vendor.compilerOptions.skipLibCheck, false);
  assert.match(manifest.scripts.typecheck, /typecheck:app.*&&.*typecheck:own-declarations/);
  assert.match(manifest.scripts['typecheck:vendor'], /--project tsconfig.json/);
});
