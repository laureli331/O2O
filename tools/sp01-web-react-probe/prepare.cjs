'use strict';
const fs = require('node:fs');
const path = require('node:path');
const mode = process.argv[2] || 'candidate';
if (!['candidate', 'replay'].includes(mode)) throw Error('UNKNOWN_PROBE_MODE');
const destination = path.resolve(__dirname, '../../.local', mode === 'replay' ? 'sp01-web-react18-replay' : 'sp01-web-react18-probe');
fs.mkdirSync(destination, { recursive: true });
for (const name of ['package.json', 'tsconfig.json', 'tsconfig.invalid.json', 'vite.config.ts', 'index.html', 'src', 'fixtures', 'THIRD-PARTY-NOTICES.md']) {
  fs.cpSync(path.join(__dirname, name), path.join(destination, name), { recursive: true });
}
const lock = path.join(__dirname, 'package-lock.json');
if (fs.existsSync(lock)) fs.copyFileSync(lock, path.join(destination, 'package-lock.json'));
console.log(JSON.stringify({ destination, formalProject: false, cloudChanged: false }));
