'use strict';
function createMaintenanceManifest(baseline) {
  const manifest = structuredClone(baseline);
  manifest.overrides = { ...manifest.overrides,
    'adm-zip@^0.5.12': '0.6.1', 'serialize-javascript@^6.0.2': '7.1.4' };
  return manifest;
}
function createMaintenanceWebManifest(baseline) {
  const manifest = structuredClone(baseline);
  manifest.devDependencies = { ...manifest.devDependencies, esbuild: '0.28.2' };
  return manifest;
}
module.exports = { createMaintenanceManifest, createMaintenanceWebManifest };
