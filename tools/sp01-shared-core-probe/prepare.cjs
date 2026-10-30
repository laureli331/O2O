'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const destination = path.join(root, '.local/sp01-shared-react18-probe');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file)));
const write = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2));
};
fs.mkdirSync(destination, { recursive: true });
const web = read('tools/sp01-web-react-probe/package.json');
const { createManifest } = require('../sp01-taro-probe/candidate-manifest.cjs');
const miniapp = createManifest(read('tools/sp01-taro-probe/package.json'), 'unified18');
write(path.join(destination, 'package.json'), { name: 'sp01-shared-workspace-probe', version: '0.0.0',
  private: true, workspaces: ['apps/*', 'packages/*'],
  devDependencies: { typescript: '5.9.3', '@types/react': '18.3.1', '@types/node': '20.19.43' },
  overrides: { ...miniapp.overrides, ...read('docs/frontend-version-policy-20261030.json').required },
  scripts: { 'check:shared': 'tsc --noEmit -p packages/shared/tsconfig.json',
    'build:web': 'npm run build --workspace apps/web', 'build:weapp': 'npm run typecheck --workspace apps/miniapp && npm run build:weapp --workspace apps/miniapp' } });
for (const [name, manifest, source, files] of [
  ['web', web, 'sp01-web-react-probe', ['src', 'index.html', 'vite.config.ts', 'tsconfig.json']],
  ['miniapp', miniapp, 'sp01-taro-probe', ['src', 'config', 'babel.config.cjs', 'capture-build-stats.cjs', 'tsconfig.json', 'tsconfig.app.json', 'check-own-declarations.cjs', 'project.config.json']],
]) {
  const target = path.join(destination, 'apps', name);
  fs.mkdirSync(target, { recursive: true });
  for (const file of files) fs.cpSync(path.join(root, 'tools', source, file), path.join(target, file), { recursive: true });
  const next = { ...manifest, name: `sp01-shared-${name}`, dependencies: { ...manifest.dependencies, '@o2o/sp01-shared': '0.0.0' } };
  delete next.overrides;
  write(path.join(target, 'package.json'), next);
  const config = JSON.parse(fs.readFileSync(path.join(target, 'tsconfig.json')));
  config.compilerOptions.moduleResolution = 'bundler';
  write(path.join(target, 'tsconfig.json'), config);
}
fs.copyFileSync(path.join(__dirname, 'web.tsx'), path.join(destination, 'apps/web/src/main.tsx'));
fs.copyFileSync(path.join(__dirname, 'miniapp.tsx'), path.join(destination, 'apps/miniapp/src/pages/index/index.tsx'));
const miniConfig = path.join(destination, 'apps/miniapp/config/index.ts');
const originalMiniConfig = fs.readFileSync(miniConfig, 'utf8');
if (!originalMiniConfig.includes('  mini: {')) throw Error('EXPECTED_MINI_CONFIG_SECTION');
write(miniConfig, "import path from 'node:path'\n" + originalMiniConfig.replace('  mini: {',
  "  mini: {\n    compile: { include: [path.resolve(__dirname, '../../../packages/shared/src')] },"));
const shared = path.join(destination, 'packages/shared');
fs.mkdirSync(shared, { recursive: true });
fs.cpSync(path.join(__dirname, 'shared'), path.join(shared, 'src'), { recursive: true });
write(path.join(shared, 'package.json'), { name: '@o2o/sp01-shared', version: '0.0.0', private: true, type: 'module',
  exports: { './react': './src/react.ts', './model': './src/model.ts', './api': './src/api.ts' },
  peerDependencies: { react: '18.3.1' } });
write(path.join(shared, 'tsconfig.json'), { compilerOptions: { target: 'ES2020', lib: ['ES2020'],
  module: 'ESNext', moduleResolution: 'bundler', types: [], strict: true, skipLibCheck: false,
  noEmit: true, jsx: 'react-jsx' }, include: ['src'] });
const lock = path.join(__dirname, 'workspace.package-lock.json');
if (fs.existsSync(lock)) fs.copyFileSync(lock, path.join(destination, 'package-lock.json'));
console.log(JSON.stringify({ destination, formalProject: false, cloudChanged: false, sharedCopies: 1 }));
