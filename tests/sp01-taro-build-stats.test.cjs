'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const CaptureBuildStats = require('../tools/sp01-taro-probe/capture-build-stats.cjs');

test('diagnostic plugin uses public hooks and excludes source from saved module evidence', () => {
  const directory = path.resolve(__dirname, '../.local/stats-plugin-test');
  let callback;
  new CaptureBuildStats().apply({ context: directory, hooks: { done: { tap(name, handler) {
    assert.equal(name, 'SP01CaptureBuildStats');
    callback = handler;
  } } } });
  callback({ toJson(options) {
    assert.equal(options.source, false);
    assert.equal(options.all, false);
    assert.equal(options.nestedModules, true);
    assert.equal(options.chunkModules, true);
    assert.equal(options.modulesSpace, Infinity);
    assert.equal(options.orphanModules, true);
    assert.equal(options.groupModulesByAttributes, false);
    return { modules: [{ name: 'synthetic-module', chunks: [1] }] };
  } });
  const result = JSON.parse(fs.readFileSync(path.join(directory, 'build-evidence/webpack-stats.json')));
  assert.deepEqual(result, { modules: [{ name: 'synthetic-module', chunks: [1] }] });
});
