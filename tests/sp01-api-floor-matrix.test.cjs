'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const matrixPath = path.join(__dirname, '../docs/sp01-api-floor-matrix-20261101.json');
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
const readiness = require('../docs/sp01-readiness-review-20261030.json');
const markdown = fs.readFileSync(path.join(__dirname, '../docs/sp01-api-floor-matrix-20261101.md'), 'utf8');

test('API floor matrix pins its official evidence source and reuse decision', () => {
  assert.equal(matrix.sourceAudit.officialApiEvidence.repositoryCommit, '6092df9100c73b84e140c20b9a42a8e8799e0660');
  assert.equal(matrix.sourceAudit.officialApiEvidence.packageVersion, '5.2.3');
  assert.equal(matrix.sourceAudit.officialApiEvidence.license, 'MIT');
  assert.equal(matrix.sourceAudit.taroComponentDeclarationEvidence.packageVersion, '4.3.1');
  assert.equal(matrix.sourceAudit.taroComponentDeclarationEvidence.license, 'MIT');
  assert.match(matrix.sourceAudit.taroComponentDeclarationEvidence.role, /No package, runtime dependency/);
  assert.match(matrix.sourceAudit.reuseDecision, /no third-party implementation|不|no runtime dependency/i);
  assert.equal(matrix.projectConstraints.sp07Started, false);
});

test('known API minima remain scoped to the exact API or flow', () => {
  const byId = Object.fromEntries(matrix.apiRequirements.map((row) => [row.id, row]));
  assert.equal(byId['IMAGE-SELECTION'].minimumBaseLibrary, '2.10.0');
  assert.equal(byId['PHONE-VERIFICATION'].callbackMinimumBaseLibrary, '1.2.0');
  assert.equal(byId['PHONE-VERIFICATION'].codeFlowMinimumBaseLibrary, '2.21.2');
  assert.equal(byId['PRIVACY-AUTHORIZATION'].requiredForFirstRelease, true);
  assert.equal(byId['PRIVACY-AUTHORIZATION'].candidate, 'button open-type=getPhoneNumber|agreePrivacyAuthorization');
  assert.equal(byId['PRIVACY-AUTHORIZATION'].implementationLocked, true);
  assert.equal(byId['PRIVACY-AUTHORIZATION'].minimumBaseLibrary, '2.32.3');
  assert.equal(byId['PRIVACY-AUTHORIZATION'].selectedRoute.confirmedByUser, 'A');
  assert.equal(byId['PRIVACY-AUTHORIZATION'].status, 'selected-route-minimum-established-global-floor-still-open');
  assert.equal(
    byId['PRIVACY-AUTHORIZATION'].candidateMinimums.find((candidate) => candidate.candidate === 'wx.onNeedPrivacyAuthorization').minimumBaseLibrary,
    '2.32.3',
  );
  assert.equal(
    byId['PRIVACY-AUTHORIZATION'].candidateMinimums.find((candidate) => candidate.candidate === 'button open-type=getPhoneNumber|agreePrivacyAuthorization').minimumBaseLibrary,
    '2.32.3',
  );
  assert.equal(
    byId['PRIVACY-AUTHORIZATION'].candidateMinimums.find((candidate) => candidate.candidate === 'standalone button open-type=agreePrivacyAuthorization before getPhoneNumber').minimumBaseLibrary,
    null,
  );
  assert.equal(byId['DIAGNOSTIC-PERFORMANCE'].minimumBaseLibrary, '2.11.0');
  assert.equal(byId['AUTH-LOGIN'].minimumBaseLibrary, null);
  assert.equal(byId['CLOUD-FUNCTION-CALL'].minimumBaseLibrary, null);
  assert.equal(byId['CLOUD-FILE-UPLOAD'].minimumBaseLibrary, null);
  assert.match(byId['AUTH-LOGIN'].versionEvidence, /plugin-only/);
  assert.match(byId['CLOUD-FILE-UPLOAD'].versionEvidence, /plugin-only/);
});

test('CloudBase namespace minimum is conditional on choosing the direct wx.cloud route', () => {
  const byId = Object.fromEntries(matrix.apiRequirements.map((row) => [row.id, row]));
  const callFunction = byId['CLOUD-FUNCTION-CALL'].candidateMinimums.find((candidate) => candidate.candidate === 'wx.cloud.callFunction');
  const cloudUpload = byId['CLOUD-FILE-UPLOAD'].candidateMinimums.find((candidate) => candidate.candidate === 'wx.cloud.uploadFile');
  const directUpload = byId['CLOUD-FILE-UPLOAD'].candidateMinimums.find((candidate) => candidate.candidate === 'wx.uploadFile');

  assert.equal(callFunction.minimumBaseLibrary, '2.2.3');
  assert.equal(cloudUpload.minimumBaseLibrary, '2.2.3');
  assert.equal(directUpload.minimumBaseLibrary, null);
  assert.equal(byId['CLOUD-FUNCTION-CALL'].minimumBaseLibrary, null);
  assert.equal(byId['CLOUD-FILE-UPLOAD'].minimumBaseLibrary, null);
  assert.match(callFunction.sourceUrl, /docs\.cloudbase\.net\/recipes\/add-cloud-function-wechat-miniprogram/);
  assert.match(markdown, /CloudBase 官方小程序云函数接入教程/);
});

test('unknown required API floors prevent a global support promise', () => {
  assert.equal(matrix.floorAnalysis.knownConditionalLowerBound, '2.32.3');
  assert.match(matrix.floorAnalysis.conditionalBasis, /selected privacy-and-phone route floor/i);
  assert.equal(matrix.floorAnalysis.globalMinimumSupportedBaseLibrary, null);
  assert.equal(matrix.floorAnalysis.devicePolicyFrozen, false);
  assert.equal(matrix.floorAnalysis.decision, 'Do not freeze a global minimum or device support group from this matrix alone. Keep R03 pending.');
  assert.ok(matrix.apiRequirements.some((row) => row.requiredForFirstRelease && row.minimumBaseLibrary === null));
  assert.equal(matrix.floorAnalysis.observedDeviceBaseLibraryReports.reportedValue, '3.17.5');
  assert.match(matrix.floorAnalysis.observedDeviceBaseLibraryReports.interpretation, /not a minimum support promise/);
});

test('gated and diagnostic APIs do not set the first-release floor', () => {
  const payment = matrix.apiRequirements.find((row) => row.id === 'PAYMENT');
  const performance = matrix.apiRequirements.find((row) => row.id === 'DIAGNOSTIC-PERFORMANCE');
  assert.equal(payment.requiredForFirstRelease, false);
  assert.equal(payment.status, 'gated-not-part-of-current-floor');
  assert.equal(performance.requiredForFirstRelease, false);
  assert.equal(performance.status, 'diagnostic-only-excluded-from-product-floor');
  assert.ok(matrix.excludedFromFloor.some((row) => row.capability === 'GPS/location picker'));
});

test('readiness index references the matrix and keeps R03 and SP01 pending', () => {
  const item = readiness.openItems.find((row) => row.id === 'R03');
  assert.ok(readiness.sources.includes('docs/sp01-api-floor-matrix-20261101.json'));
  assert.equal(item.state, 'pending');
  assert.equal(item.apiFloorMatrix.evidence, 'docs/sp01-api-floor-matrix-20261101.json');
  assert.equal(item.apiFloorMatrix.knownConditionalLowerBound, '2.32.3');
  assert.equal(item.apiFloorMatrix.status, 'selected-privacy-route-minimum-known-global-floor-pending-upload-route-and-product-validation');
  assert.equal(item.apiFloorMatrix.globalMinimumSupportedBaseLibrary, null);
  assert.equal(readiness.sp01Passed, false);
  assert.equal(readiness.sp07Started, false);
  assert.match(markdown, /微信 API 最低版本证据矩阵/);
  assert.match(markdown, /全局最低基础库和支持设备组继续留空/);
});
