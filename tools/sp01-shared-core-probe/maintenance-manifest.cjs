'use strict';
const policy = require('../../docs/frontend-version-policy-20261030.json');
const approved = policy.approvedMaintenanceCandidate;
function createMaintenanceManifest(baseline) {
  const manifest = structuredClone(baseline);
  manifest.overrides = { ...manifest.overrides, ...approved.overrides };
  return manifest;
}
function createMaintenanceWebManifest(baseline) {
  const manifest = structuredClone(baseline);
  manifest.devDependencies = { ...manifest.devDependencies, ...approved.webOnlyBuildDependencies };
  return manifest;
}
function maintenanceCandidateStatus() {
  return {
    candidateStatus: 'user-adopted-current-SP01-candidate',
    candidateScope: approved.scope,
    productVersionFrozen: approved.formalProductVersionFrozen,
  };
}
module.exports = { createMaintenanceManifest, createMaintenanceWebManifest, maintenanceCandidateStatus };
