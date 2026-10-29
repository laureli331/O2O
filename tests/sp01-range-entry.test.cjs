'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../tools/sp01-range-probe/function/index.js'), 'utf8');

test('deployed entry inspect returns without importing SDK or experiment dependencies', async () => {
  const imports = [];
  const context = { exports: {}, process: { version: 'v20.19.3' }, require: (name) => {
    imports.push(name);
    throw Error('synthetic dependency startup failure');
  } };
  vm.runInNewContext(source, context);
  const result = await context.exports.main({ action: 'inspect' });
  assert.equal(result.success, true);
  assert.equal(result.version, 'range-entry-v3');
  assert.equal(result.writes, false);
  assert.deepEqual(imports, []);
});

test('SDK load diagnostic exposes only standard code and safe package name', async () => {
  const context = { exports: {}, process, require: () => {
    throw Object.assign(Error("Cannot find module '@cloudbase/node-sdk'\nRequire stack: private-path"), { code: 'MODULE_NOT_FOUND' });
  } };
  vm.runInNewContext(source, context);
  const result = await context.exports.main({ action: 'dependencies' });
  assert.equal(result.errorCode, 'MODULE_NOT_FOUND');
  assert.equal(result.missingPackage, '@cloudbase/node-sdk');
  assert.equal(result.errorName, 'Error');
  assert.doesNotMatch(JSON.stringify(result), /private-path|Require stack/);
});

test('arbitrary error fields and filesystem module paths are never exposed', async () => {
  const context = { exports: {}, process, require: () => {
    throw Object.assign(Error("Cannot find module '/var/user/private-token'"), { code: 'private-token', name: 'private-token' });
  } };
  vm.runInNewContext(source, context);
  const result = await context.exports.main({ action: 'dependencies' });
  assert.equal(result.errorCode, 'UNCLASSIFIED');
  assert.equal(result.missingPackage, null);
  assert.doesNotMatch(JSON.stringify(result), /private-token|var\/user/);
});

test('invalid action does not initialize dependencies', async () => {
  const context = { exports: {}, process, require: () => { throw Error('must not import'); } };
  vm.runInNewContext(source, context);
  assert.equal((await context.exports.main({ action: 'invalid' })).code, 'INVALID_ACTION');
});

test('dependency startup exception is reported without its private details or cloud writes', async () => {
  const context = { exports: {}, process, require: () => { throw Error('private token'); } };
  vm.runInNewContext(source, context);
  const result = await context.exports.main({ action: 'dependencies' });
  assert.equal(result.code, 'INITIALIZATION_FAILED');
  assert.equal(result.phase, 'sdk-load');
  assert.equal(result.writes, false);
  assert.doesNotMatch(JSON.stringify(result), /private token/);
});
