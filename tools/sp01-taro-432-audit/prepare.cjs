'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createManifest } = require('./candidate-manifest.cjs');
const candidate = process.argv[2] || 'baseline';
const manifest = createManifest(require('./package.json'), candidate);
const destination = path.resolve(__dirname, '../../.local', candidate === 'baseline' ? 'sp01-taro-probe' : `sp01-taro-probe-${candidate}`);
fs.mkdirSync(destination, { recursive: true });
for (const name of ['package.json', 'babel.config.cjs', 'capture-build-stats.cjs', 'tsconfig.json', 'tsconfig.app.json', 'check-own-declarations.cjs', 'project.config.json', 'THIRD-PARTY-NOTICES.md', 'config', 'src']) {
  fs.cpSync(path.join(__dirname, name), path.join(destination, name), { recursive: true });
}
fs.writeFileSync(path.join(destination, 'package.json'), JSON.stringify(manifest, null, 2));
const lock = path.join(__dirname, candidate === 'baseline' ? 'package-lock.json' : `variants/${candidate}.package-lock.json`);
if (fs.existsSync(lock)) fs.copyFileSync(lock, path.join(destination, 'package-lock.json'));
console.log(JSON.stringify({ destination, candidate, cloudChanges: false, formalProject: false }));
