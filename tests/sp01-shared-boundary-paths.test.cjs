'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { within, allowedImport } = require('../tools/sp01-shared-core-probe/check-boundaries.cjs');
test('shared dependency boundary rejects sibling-prefix and parent escapes rather than using path prefixes', () => {
  const root = path.resolve('synthetic/shared');
  const file = path.join(root, 'api/client.ts');
  assert.equal(within(root, `${root}-other/file.ts`), false);
  assert.equal(allowedImport('../contracts', file, root), true);
  assert.equal(allowedImport('../../../apps/web', file, root), false);
  assert.equal(allowedImport('react', file, root), true);
  for (const name of ['react-dom', '@tarojs/taro', 'node:fs', 'apps/web', '@o2o/platform-adapters']) {
    assert.equal(allowedImport(name, file, root), false);
  }
});
