'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createMaintenanceManifest, createMaintenanceWebManifest, maintenanceCandidateStatus } = require('./maintenance-manifest.cjs');
const root = path.resolve(__dirname, '../..');
const baseline = path.join(root, '.local/sp01-shared-react18-probe');
const destination = path.join(root, '.local/sp01-shared-react18-maintenance-probe');
if (fs.existsSync(destination)) throw Error('CANDIDATE_ALREADY_EXISTS_NO_OVERWRITE');
const read = file => JSON.parse(fs.readFileSync(path.join(baseline, file), 'utf8'));
const manifest = createMaintenanceManifest(read('package.json'));
// Fail before writing when baseline inputs are missing. Copy sources only, never installed packages or products.
for (const file of ['apps', 'packages', 'package-lock.json']) fs.accessSync(path.join(baseline, file));
fs.mkdirSync(destination);
const exclude = new Set(['node_modules', 'dist', 'build-evidence']);
for (const name of ['apps', 'packages']) fs.cpSync(path.join(baseline, name), path.join(destination, name), {
  recursive: true, filter: source => !exclude.has(path.basename(source)),
});
// Keep the baseline lock as evidence; this comparison must resolve its new overrides afresh.
fs.copyFileSync(path.join(baseline, 'package-lock.json'), path.join(destination, 'baseline.package-lock.json'));
const candidateLock = path.join(__dirname, 'maintenance.workspace.package-lock.json');
if (fs.existsSync(candidateLock)) fs.copyFileSync(candidateLock, path.join(destination, 'package-lock.json'));
fs.writeFileSync(path.join(destination, 'package.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(destination, 'apps/web/package.json'), JSON.stringify(createMaintenanceWebManifest(read('apps/web/package.json')), null, 2));
console.log(JSON.stringify({ destination, baselineModified: false, cloudChanged: false, ...maintenanceCandidateStatus() }));
