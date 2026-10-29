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
  assert.equal(result.version, 'range-entry-v2');
  assert.equal(result.writes, false);
  assert.deepEqual(imports, []);
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
