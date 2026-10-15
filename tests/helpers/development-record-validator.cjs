'use strict';

// Validates development records only. This is not a production feature gate.
const assert = require('node:assert/strict');

const taskStates = new Set([
  '未开始', '资料准备中', '待用户确认', '待外部依据', '执行中', '待验收', '已完成',
]);

function validateDevelopmentRecord(record, plan) {
  assert.equal(record.schemaVersion, 1, 'Unsupported development record version');
  assert.equal(record.approval.reply, '采用', 'Actual user adoption must be recorded');
  const approvedChoices = {
    frontend: 'native-wechat-typescript',
    backend: 'node-cloud-functions',
    database: 'cloudbase',
    storage: 'cloudbase-storage',
    scheduler: 'cloud-timer-with-recovery',
    operations: 'miniapp-two-independent-equal-role-accounts',
    developmentScope: 'local-and-controlled-tests',
    purchasePolicy: 'confirm-cost-before-purchase',
  };
  for (const [choice, expected] of Object.entries(approvedChoices)) {
    assert.equal(record.approval[choice], expected, `Approved choice changed: ${choice}`);
  }

  // The initial adoption stays historical; explicit later approval is the active operations policy.
  const activeOperations = record.currentOperationsApproval;
  assert.equal(activeOperations?.operations, 'miniapp-shared-owner-management-account', 'Current operations override missing or changed');
  assert.equal(activeOperations.managementAccountCount, 1, 'Current operations account count');
  assert.equal(activeOperations.separatePartnerAccountRequired, false, 'Current operations must not require a partner account');
  assert.equal(activeOperations.actualHumanOperatorAttribution, false, 'Shared login cannot identify the actual human operator');
  assert.equal(activeOperations.productionAccountConfigured, false, 'Current operations approval is not actual configuration');
  assert.equal(activeOperations.previousApprovalIsHistorical, true, 'Initial operations approval must remain historical');

  if (record.resources.appIdValue !== null) {
    assert.match(record.resources.appIdValue, /^wx[0-9a-f]{16}$/, 'Invalid WeChat AppID format');
    assert.equal(record.resources.appIdExists, true, 'Configured AppID conflicts with resource record');
  }

  assert.equal(typeof record.resources.developerToolsInstalled, 'boolean', 'Installation state must be explicit');
  assert.equal(record.preparedDeveloperTools.installationExecuted, record.resources.developerToolsInstalled, 'Prepared and installed tool states disagree');
  if (record.resources.developerToolsInstalled) {
    const installed = record.installedDeveloperTools;
    assert(installed, 'Installed tool lacks verification record');
    assert.equal(installed.approvalReply, '确认', 'Installation lacks user confirmation');
    assert.equal(installed.installerExitCode, 0, 'Installation failed');
    assert.equal(installed.packageVersion, record.preparedDeveloperTools.version, 'Installed package version mismatch');
    assert.equal(installed.executableSignatureStatus, 'Valid', 'Installed executable signature is not verified');
    assert.equal(installed.cliHelpExitCode, 0, 'Installed CLI did not pass');
  }
  if (record.loginObservation) {
    assert.equal(record.loginObservation.userReply, '已登录', 'User login report is missing');
    if (record.loginObservation.cliError !== null) {
      assert.equal(record.installedDeveloperTools.loginVerified, false, 'CLI errors cannot verify login, even when exit code is zero');
    }
    if (record.installedDeveloperTools.loginVerified) {
      assert.equal(record.loginObservation.cliExitCode, 0, 'Login command did not succeed');
      assert.equal(record.loginObservation.servicePortEnabled, true, 'Verified login requires an active service port');
      assert.equal(record.loginObservation.response?.login, true, 'Verified login requires an explicit successful login response');
      assert.equal(record.loginObservation.verificationStatus, 'verified', 'Login verification status disagrees with verified result');
    }
    if (!record.loginObservation.servicePortEnabled) {
      assert.equal(record.installedDeveloperTools.projectAccessVerified, false, 'Closed service port cannot verify project access');
      assert.equal(record.loginObservation.cloudEnvironmentQueryExecuted, false, 'Cloud environment query was blocked by the closed service port');
    }
  }
  if (record.cloudEnvironmentObservation?.status === 'query-failed') {
    assert.equal(record.cloudEnvironmentObservation.environments, null, 'Failed cloud query cannot be reported as an empty environment list');
    assert.equal(record.cloudEnvironmentObservation.projectAccessVerified, false, 'Failed cloud query cannot verify project permissions');
    assert.equal(record.installedDeveloperTools.projectAccessVerified, false, 'Failed cloud query cannot verify installed tool project access');
  }

  const diagnosis = record.developerToolsDiagnosis;
  if (diagnosis) {
    if (!diagnosis.nativeCloudQuery.success) {
      assert.equal(record.cloudEnvironmentObservation.environments, null, 'Native cloud error cannot establish an environment list');
    }
    if (!diagnosis.encryptionCauseVerified) {
      assert.equal(diagnosis.repairVerified, false, 'Unverified diagnosis cannot certify repair');
    }
    if (!diagnosis.cloudButtonRootCauseVerified) {
      assert.equal(diagnosis.repairVerified, false, 'Runtime probe cannot certify the cloud button repair');
    }
    if (diagnosis.renameProbe.syntheticDecryptionResult === 'Access is denied') {
      assert.equal(diagnosis.encryptionCauseVerified, false, 'Denied decryption cannot establish an encryption control experiment');
    }
  }

  const revalidation = record.developerToolsRevalidation;
  if (revalidation) {
    assert.equal(revalidation.scope, 'synthetic-diagnostic-directory-only', 'Revalidation exceeds approved scope');
    assert.equal(revalidation.actualCacheDecryptionExecuted, false, 'Actual cache decryption was not authorized');
    if (revalidation.encryptionTransitionCause === 'unknown') {
      assert.equal(diagnosis.encryptionCauseVerified, false, 'Changed environment cannot prove the encryption hypothesis');
    }
    if (revalidation.pageVerification !== 'passed' || revalidation.cloudButtonVerification !== 'passed' || revalidation.cloudEnvironmentVerification !== 'passed') {
      assert.equal(revalidation.originalSymptomResolved, false, 'Rename regression cannot substitute for original symptom verification');
    }
  }

  if (record.resources.cloudEnvironmentOpened) {
    assert.equal(record.cloudConsoleObservation?.environmentAvailable, true, 'Opened cloud environment requires current availability evidence');
    assert.equal(record.cloudConsoleObservation?.cloudButtonOpenedWindow, true, 'Environment observation lacks cloud console verification');
    assert.equal(record.cloudConsoleObservation?.verificationMethod, 'native-window-and-visible-ui', 'Environment verification method must be explicit');
  }

  const restart = record.postRestartObservation;
  if (restart) {
    if (restart.openingUserReply === '好像点了') {
      assert.equal(restart.openingActorConfirmed, false, 'Uncertain user report cannot prove who opened the environment');
    }
    assert.equal(restart.securitySettingsChangedByAgent, false, 'Security setting requires manual user action');
    if (!restart.servicePortEnabled) {
      assert.notEqual(restart.nativeConnectionStatus, 'verified', 'Closed current service port cannot certify restart-time connection');
    }
  }

  const tasks = new Map();
  for (const match of plan.matchAll(/^\| (DP\d{2}) \|[^\r\n]+/gm)) {
    const cells = match[0].split('|').map(cell => cell.trim());
    assert(!tasks.has(match[1]), `Duplicate task: ${match[1]}`);
    tasks.set(match[1], [...cells[4].matchAll(/DP\d{2}/g)].map(item => item[0]));
  }
  assert.equal(tasks.size, 48, 'Original forty tasks and eight new tasks must be retained');
  const allTaskIds = Array.from({length:48}, (_,i) => 'DP' + String(i+1).padStart(2,'0'));
  assert.deepEqual([...tasks.keys()].sort(), allTaskIds, 'Task numbering must retain all original and added IDs');
  assert.deepEqual(Object.keys(record.tasks).sort(), allTaskIds, 'Every task needs an explicit actual status');
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    assert(tasks.has(id), 'Unknown dependency: ' + id);
    assert(!visiting.has(id), 'Dependency cycle: ' + id);
    if(visited.has(id)) return;
    visiting.add(id);
    for(const dependency of tasks.get(id)) visit(dependency);
    visiting.delete(id); visited.add(id);
  }
  for(const id of tasks.keys()) visit(id);
  for(const [id, required] of [['DP03','DP41'], ['DP36','DP48']]) {
    assert(tasks.get(id).includes(required), 'Required new prerequisite: ' + id + ' requires ' + required);
  }
  const feature = record.featurePlanning;
  assert(feature, 'Current feature planning must be recorded');
  assert.equal(feature.prdVersion, '1.5', 'Current PRD version must match planning');
  assert.equal(feature.planTaskCount, 48, 'Feature planning task count mismatch');
  assert.equal(feature.baseScopeRetained, true, 'Original scope cannot be removed');
  assert.deepEqual(feature.v1AiBusinesses, ['errands','secondhand'], 'AI business scope changed');
  assert.equal(feature.inputCharacterLimit, 1000, 'AI input limit changed');
  for(const flag of ['historicalReference','privateFieldsSentToModel','v1ModelReadsImages','automaticOverwrite','automaticPublish','automaticRetry','rawAiAnalysisLogs']) {
    assert.equal(feature[flag], false, 'AI boundary changed: ' + flag);
  }
  assert.equal(feature.userImagesOptional, true, 'Images must remain optional');
  assert.equal(feature.userDraftSaveExplicit, true, 'Cloud drafts require explicit save');
  assert.equal(feature.dashboardRoles, 'two-independent-equal-role-operators', 'Dashboard role scope changed');
  assert.deepEqual(feature.dashboardFilters, ['date-range','business-type'], 'Dashboard filters changed');
  assert.equal(feature.dashboardCutoff, 'previous-natural-day-Asia/Shanghai', 'Dashboard cutoff changed');
  assert.equal(feature.errandFunnelCohort, 'firstPublishedAt', 'Funnel cohort changed');
  assert.equal(feature.aiPublicationAttribution, 'last-adopted-valid-draft-first-publication', 'AI attribution changed');
  assert.deepEqual(feature.v2Scope, ['VP01','VP02','VP03','VP04','VP05'], 'Second version scope changed');
  if(['provider','model','channel','dailyQuota','dailyBudget','monthlyBudget','concurrencyLimit','timeoutMs','outputTokenLimit'].some(key => feature[key] == null)) {
    assert.equal(feature.realAiEnabled, false, 'Unknown AI configuration cannot enable real calls');
  }
  if(feature.newAnalyticsRetention == null) assert.equal(feature.newProductionAnalyticsEnabled, false, 'Unknown retention cannot enable production analytics');
  for (const [id, status] of Object.entries(record.tasks)) {
    assert(tasks.has(id), `Unknown task: ${id}`);
    assert(taskStates.has(status), `Invalid task status: ${id}`);
    // Material preparation may proceed independently, as allowed by the plan.
    if (['执行中', '待验收', '已完成'].includes(status)) {
      for (const dependency of tasks.get(id)) {
        assert.equal(record.tasks[dependency], '已完成', `Incomplete dependency: ${id} requires ${dependency}`);
      }
    }
  }

  const gateIds = ['AG01', 'DG01', 'E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'QG01'];
  assert.deepEqual(record.externalGates.map(gate => gate.id).sort(), gateIds, 'All nine external conditions must be tracked exactly once');
  for (const gate of record.externalGates) {
    assert(['待外部依据', '待用户确认', '已完成'].includes(gate.status), `Invalid condition status: ${gate.id}`);
    assert(Array.isArray(gate.evidence), `Evidence must be a list: ${gate.id}`);
    if (gate.status === '已完成') {
      assert(gate.evidence.length > 0, `Completed condition lacks project evidence: ${gate.id}`);
      for (const evidence of gate.evidence) {
        assert.equal(evidence.kind, 'project-verification', `General documentation is not project evidence: ${gate.id}`);
        for (const field of ['source', 'date', 'scope', 'result', 'reviewer']) {
          assert(typeof evidence[field] === 'string' && evidence[field].trim(), `Missing evidence field ${field}: ${gate.id}`);
        }
        assert.equal(evidence.result, 'passed', `Evidence did not pass: ${gate.id}`);
      }
    }
  }
  assert.equal(typeof record.productionEnabled, 'boolean', 'Production state must be explicit');
  if (record.productionEnabled) {
    assert(record.externalGates.every(gate => gate.status === '已完成'), 'Unverified conditions cannot enable production');
    assert.equal(record.tasks.DP40, '已完成', 'Production requires final acceptance');
  }
  if (['执行中', '待验收', '已完成'].includes(record.tasks.DP07)) {
    assert.equal(record.prerequisites.dataHandlingConfirmed, true, 'Data handling decision is not confirmed');
    assert.equal(record.prerequisites.businessConfigurationConfirmed, true, 'Business configuration is not confirmed');
  }
  return true;
}

module.exports = { validateDevelopmentRecord };
