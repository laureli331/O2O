'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { inspectArtifacts } = require('../tools/sp01-taro-probe/inspect-artifacts.cjs');
function files() {
  return { 'app.js': 'synthetic js', 'app.json': JSON.stringify({ pages: ['pages/index/index'] }),
    'pages/index/index.js': 'synthetic page js', 'pages/index/index.json': '{}',
    'pages/index/index.wxml': '<import src="../../base.wxml"/>', 'base.wxml': '<template name="synthetic"/>' };
}
test('build evidence requires nonempty WeChat artifacts and existing local WXML imports', () => {
  const result = inspectArtifacts(files());
  assert.equal(result.artifactsPresent, true);
  assert.equal(result.realDeviceVerified, false);
  assert.equal(result.devtoolsCompilationVerified, false);
  assert.equal(result.productAcceptancePassed, false);
  assert.ok(result.totalBytes > 0);
});
test('missing, malformed, empty and path-escaping generated artifacts are rejected', () => {
  for (const mutate of [
    (f) => { delete f['app.js']; }, (f) => { f['app.json'] = '{'; },
    (f) => { f['pages/index/index.js'] = ''; }, (f) => { delete f['base.wxml']; },
    (f) => { f['app.json'] = JSON.stringify({ pages: ['../../outside'] }); },
  ]) { const f = files(); mutate(f); assert.throws(() => inspectArtifacts(f)); }
});
