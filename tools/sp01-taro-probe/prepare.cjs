'use strict';
const fs = require('node:fs');
const path = require('node:path');
const destination = path.resolve(__dirname, '../../.local/sp01-taro-probe');
fs.mkdirSync(destination, { recursive: true });
for (const name of ['package.json', 'babel.config.cjs', 'tsconfig.json', 'project.config.json', 'THIRD-PARTY-NOTICES.md', 'config', 'src']) {
  fs.cpSync(path.join(__dirname, name), path.join(destination, name), { recursive: true });
}
const lock = path.join(__dirname, 'package-lock.json');
if (fs.existsSync(lock)) fs.copyFileSync(lock, path.join(destination, 'package-lock.json'));
console.log(JSON.stringify({ destination, cloudChanges: false, formalProject: false }));
