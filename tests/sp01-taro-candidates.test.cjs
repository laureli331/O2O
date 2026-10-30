'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createManifest } = require('../tools/sp01-taro-probe/candidate-manifest.cjs');
const base = require('../tools/sp01-taro-probe/package.json');
test('peer candidate keeps the official Webpack requirement and changes only reviewed patch dependencies', () => {
  const snapshot = JSON.stringify(base);
  const next = createManifest(base, 'peer-fix');
  assert.equal(next.devDependencies.webpack, '5.91.0');
  assert.equal(next.devDependencies['@tarojs/webpack5-runner'], '4.3.1');
  assert.equal(next.dependencies.react, '18.3.1');
  assert.equal(next.overrides['schema-utils@^4.0.0'], '4.3.3');
  assert.deepEqual(next.overrides, {
    'schema-utils@^4.0.0': '4.3.3',
    'glob@>=10.2.0 <10.5.0': '10.5.0',
  });
  assert.equal(next.devDependencies['@babel/core'], '7.29.7');
  assert.equal(next.dependencies['@babel/runtime'], '7.29.10');
  assert.equal(next.devDependencies.postcss, '8.5.32');
  assert.equal(JSON.stringify(base), snapshot);
  assert.deepEqual(createManifest(base, 'baseline'), base);
  assert.throws(() => createManifest(base, '../outside'), /UNKNOWN_CANDIDATE/);
});

test('archive comparison is a separate candidate and does not alter the peer comparison', () => {
  const peer = createManifest(base, 'peer-fix');
  const archive = createManifest(base, 'archive-fix');
  assert.deepEqual(archive.dependencies, peer.dependencies);
  assert.deepEqual(archive.devDependencies, peer.devDependencies);
  assert.deepEqual(archive.overrides, { ...peer.overrides, 'adm-zip@^0.5.12': '0.6.1' });
  assert.equal(peer.overrides['adm-zip@^0.5.12'], undefined);
});

test('unified React 18 candidate aligns both application toolchains with the user policy', () => {
  const policy = require('../docs/frontend-version-policy-20261030.json');
  const web = require('../tools/sp01-web-react-probe/package.json');
  const miniapp = createManifest(base, 'unified18');
  for (const name of Object.keys(policy.required)) {
    assert.equal(web.dependencies[name] || web.devDependencies[name], policy.required[name], name);
    assert.equal(miniapp.dependencies[name] || miniapp.devDependencies[name], policy.required[name], name);
    assert.equal(base.dependencies[name] || base.devDependencies[name], policy.required[name], `base ${name}`);
  }
  const locks = [require('../tools/sp01-web-react-probe/package-lock.json'),
    require('../tools/sp01-taro-probe/variants/unified18.package-lock.json')];
  for (const lock of locks) {
    for (const [name, entry] of Object.entries(lock.packages)) {
      const match = name.match(/node_modules\/(react|react-dom|@types\/react|@types\/react-dom|typescript)$/);
      if (match) assert.equal(entry.version, policy.required[match[1]], name);
    }
  }
});
