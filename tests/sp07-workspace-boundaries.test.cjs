'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const checker = path.join(root, 'scripts', 'check-workspace-boundaries.cjs');

function runChecker(projectRoot) {
  return spawnSync(process.execPath, [checker, projectRoot], {
    cwd: root,
    encoding: 'utf8',
  });
}

function createFixture() {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'o2o-sp07-boundary-'));
  const files = {
    'package.json': JSON.stringify({
      workspaces: ['apps/*', 'packages/*'],
      scripts: { 'check:boundaries': 'node scripts/check-workspace-boundaries.cjs' },
    }),
    'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true } }),
    'apps/mini-program/package.json': JSON.stringify({
      scripts: { build: 'npm run check:boundaries && taro build --type weapp' },
    }),
    'apps/mini-program/config/index.ts': "export default { sourceRoot: 'src', outputRoot: 'dist' };\n",
    'apps/mini-program/src/index.tsx': "export const page = 'display only';\n",
    'apps/admin-web/package.json': JSON.stringify({
      scripts: { build: 'npm run check:boundaries && vite build' },
    }),
    'apps/admin-web/vite.config.ts': 'export default {};\n',
    'apps/admin-web/src/index.tsx': "export const page = 'display only';\n",
    'apps/cloud-functions/package.json': JSON.stringify({}),
    'packages/shared/package.json': JSON.stringify({}),
    'packages/shared/src/index.ts': 'export const value = 1;\n',
  };
  for (const [relative, contents] of Object.entries(files)) {
    const target = path.join(fixtureRoot, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  }
  return fixtureRoot;
}

function withFixture(callback) {
  const fixtureRoot = createFixture();
  try {
    callback(fixtureRoot);
  } finally {
    const tempRoot = path.resolve(os.tmpdir());
    const resolvedFixture = path.resolve(fixtureRoot);
    assert.ok(resolvedFixture.startsWith(`${tempRoot}${path.sep}`));
    fs.rmSync(resolvedFixture, { recursive: true, force: true });
  }
}

test('SP07 workspace boundary gate accepts the current local foundation', () => {
  const result = runChecker(root);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /workspace boundary checks passed/i);
});

test('formal web and mini-program builds run the boundary gate before their bundlers', () => {
  const rootManifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const miniManifest = JSON.parse(fs.readFileSync(path.join(root, 'apps/mini-program/package.json'), 'utf8'));
  const webManifest = JSON.parse(fs.readFileSync(path.join(root, 'apps/admin-web/package.json'), 'utf8'));

  assert.ok(rootManifest.scripts['check:boundaries']);
  assert.match(miniManifest.scripts.build, /^npm run check:boundaries && .*taro build/);
  assert.match(webManifest.scripts.build, /^npm run check:boundaries && .*vite build/);
});

test('SP07 gate rejects a build script that runs the bundler before the boundary gate', () => {
  withFixture((fixtureRoot) => {
    const manifest = path.join(fixtureRoot, 'apps/mini-program/package.json');
    fs.writeFileSync(manifest, JSON.stringify({
      scripts: { build: 'taro build --type weapp && npm run check:boundaries' },
    }));
    const result = runChecker(fixtureRoot);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}${result.stderr}`, /boundary gate before Taro build/i);
  });
});

test('SP07 gate rejects app imports that escape into QuickStart, tools, or previews', () => {
  withFixture((fixtureRoot) => {
    const app = path.join(fixtureRoot, 'apps/mini-program/src/index.tsx');
    fs.writeFileSync(app, "import '../../../tools/sp01-storage-probe/index';\n");
    const result = runChecker(fixtureRoot);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}${result.stderr}`, /outside the approved source roots/i);
  });
});

test('SP07 gate rejects explicit any and platform globals in shared source', () => {
  withFixture((fixtureRoot) => {
    const shared = path.join(fixtureRoot, 'packages/shared/src/index.ts');
    fs.writeFileSync(shared, 'export const client = wx.cloud;\nexport type Unsafe = any;\n');
    const result = runChecker(fixtureRoot);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}${result.stderr}`, /platform global|explicit any/i);
  });
});

test('SP07 gate rejects cloud deploy entry points and live SDK dependencies', () => {
  withFixture((fixtureRoot) => {
    const manifest = path.join(fixtureRoot, 'apps/cloud-functions/package.json');
    fs.writeFileSync(manifest, JSON.stringify({
      scripts: { deploy: 'cloudbase functions deploy' },
      dependencies: { 'wx-server-sdk': 'latest' },
    }));
    const result = runChecker(fixtureRoot);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}${result.stderr}`, /cloud workspace.*deploy|live cloud SDK/i);
  });
});

test('SP07 gate rejects cross-app workspace imports', () => {
  withFixture((fixtureRoot) => {
    const app = path.join(fixtureRoot, 'apps/admin-web/src/index.tsx');
    fs.writeFileSync(app, "import '@xianglin/cloud-functions/internal';\n");
    const result = runChecker(fixtureRoot);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}${result.stderr}`, /may not depend on another app workspace/i);
  });
});
