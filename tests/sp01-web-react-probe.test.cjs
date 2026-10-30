'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const manifest = require('../tools/sp01-web-react-probe/package.json');
const config = require('../tools/sp01-web-react-probe/tsconfig.json');
const negative = require('../tools/sp01-web-react-probe/tsconfig.invalid.json');

test('web compiler probe keeps full strict checking and isolates the deliberate type-error fixture', () => {
  assert.equal(config.compilerOptions.strict, true);
  assert.equal(config.compilerOptions.skipLibCheck, false);
  assert.equal(config.compilerOptions.noEmit, true);
  assert.deepEqual(config.include, ['src', 'vite.config.ts']);
  assert.equal(negative.extends, './tsconfig.json');
  assert.deepEqual(negative.include, ['fixtures/invalid.tsx']);
  assert.equal(manifest.scripts.build, 'npm run typecheck && vite build');
  assert.equal(manifest.scripts.dev, undefined);
  assert.equal(manifest.scripts.preview, undefined);
});

test('web candidate pins its own dependency set without changing Taro React 18', () => {
  const taro = require('../tools/sp01-taro-probe/package.json');
  assert.equal(taro.dependencies.react, '18.3.1');
  assert.equal(manifest.dependencies.react, manifest.dependencies['react-dom']);
  for (const version of Object.values({ ...manifest.dependencies, ...manifest.devDependencies })) {
    assert.match(version, /^\d+\.\d+\.\d+$/);
  }
  assert.equal(manifest.private, true);
});
