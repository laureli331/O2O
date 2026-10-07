'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateDevelopmentRecord } = require('./helpers/development-record-validator.cjs');

const repo = path.resolve(__dirname, '..');
const decoder = new TextDecoder('utf-8', { fatal: true });
const read = relative => decoder.decode(fs.readFileSync(path.join(repo, relative)));
const plan = read('docs/development-plan.md');
const record = JSON.parse(read('docs/development-decisions.json'));
const technical = read('docs/technical-decision.md');
const evidence = read('docs/external-evidence.md');
const copy = () => structuredClone(record);

test('actual adoption and task progress obey the original dependency plan', () => {
  assert.equal(validateDevelopmentRecord(record, plan), true);
  assert(technical.includes('用户实际回复：**“采用”**'));
  assert(plan.includes('后续用户回复“采用”'));
  assert(plan.includes('技术执行记录'));
});

test('resource progress preserves personal subject and verified current cloud environment', () => {
  assert.equal(record.resources.appIdExists, true);
  assert.equal(record.resources.appIdValue, 'wx358290e451cb06e7');
  assert.equal(record.resources.currentSubject, 'personal');
  assert.equal(record.resources.individualBusinessRegistration, 'willing-if-needed-not-registered');
  assert.equal(record.resources.developerToolsInstalled, true);
  assert.equal(record.resources.cloudEnvironmentOpened, true);
  assert.equal(record.cloudConsoleObservation.environmentAvailable, true);
  assert.equal(record.resources.cloudRuntimeVersion, null);
  assert.equal(record.resources.databaseMode, null);
  assert.equal(record.resources.productionBudget, null);
  assert(technical.includes('两项都没有'));
  assert(technical.includes('暂时是个人主体, 若有需要, 可注册个体工商户'));
});

test('missing user confirmation and silently substituted architecture are rejected', () => {
  const missingApproval = copy();
  missingApproval.approval.reply = '';
  assert.throws(() => validateDevelopmentRecord(missingApproval, plan), /Actual user adoption/);
  const changed = copy();
  changed.approval.database = 'postgresql';
  assert.throws(() => validateDevelopmentRecord(changed, plan), /Approved choice changed: database/);
});

test('starting product engineering before prerequisites finish is rejected', () => {
  const changed = copy();
  changed.tasks.DP07 = '执行中';
  assert.throws(() => validateDevelopmentRecord(changed, plan), /Incomplete dependency: DP07 requires DP01/);
});

test('task labels cannot substitute for unconfirmed data and business decisions', () => {
  const changed = copy();
  for (let index = 1; index <= 7; index++) changed.tasks[`DP${String(index).padStart(2, '0')}`] = '已完成';
  assert.throws(() => validateDevelopmentRecord(changed, plan), /Data handling decision is not confirmed/);
  changed.prerequisites.dataHandlingConfirmed = true;
  assert.throws(() => validateDevelopmentRecord(changed, plan), /Business configuration is not confirmed/);
});

test('missing or duplicate external conditions are rejected', () => {
  const missing = copy();
  missing.externalGates.pop();
  assert.throws(() => validateDevelopmentRecord(missing, plan), /All seven external conditions/);
  const duplicate = copy();
  duplicate.externalGates.push(duplicate.externalGates[0]);
  assert.throws(() => validateDevelopmentRecord(duplicate, plan), /All seven external conditions/);
});

test('no evidence and general documentation cannot be called project verification', () => {
  const changed = copy();
  changed.externalGates[0].status = '已完成';
  assert.throws(() => validateDevelopmentRecord(changed, plan), /Completed condition lacks project evidence: E01/);
  changed.externalGates[0].evidence = [{ kind: 'general-documentation' }];
  assert.throws(() => validateDevelopmentRecord(changed, plan), /General documentation is not project evidence: E01/);
  changed.externalGates[0].evidence = [{ kind: 'project-verification', source: 'synthetic-test-fixture' }];
  assert.throws(() => validateDevelopmentRecord(changed, plan), /Missing evidence field date: E01/);
});

test('unverified conditions cannot enable production', () => {
  const changed = copy();
  changed.productionEnabled = true;
  assert.throws(() => validateDevelopmentRecord(changed, plan), /Unverified conditions cannot enable production/);
});

test('documents link existing local sources and preserve paired fences and tables', () => {
  for (const [relative, text] of [['docs/technical-decision.md', technical], ['docs/external-evidence.md', evidence]]) {
    for (const link of text.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^(https?:\/\/|#)/.test(link[1])) continue;
      assert(fs.existsSync(path.resolve(path.dirname(path.join(repo, relative)), link[1].split('#')[0])), `Broken link: ${relative} -> ${link[1]}`);
    }
    assert.equal([...text.matchAll(/^```/gm)].length % 2, 0, `Unpaired fences: ${relative}`);
    let previous = 0;
    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith('|')) { previous = 0; continue; }
      const count = [...line.matchAll(/\|/g)].length;
      if (previous) assert.equal(count, previous, `Broken table: ${relative}`);
      previous = count;
    }
  }
});

test('external ledger covers every condition and labels draft consultations unsent', () => {
  const ids = [...evidence.matchAll(/^\| (E0[1-6]|QG01) \|/gm)].map(match => match[1]);
  assert.deepEqual(ids, ['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'QG01']);
  assert(evidence.includes('微信平台咨询草稿（未发送）'));
  assert(evidence.includes('核验供应商咨询草稿（未发送）'));
  assert(evidence.includes('未处理真实证件或支付'));
  assert.equal(record.productionEnabled, false);
  assert(record.externalGates.every(gate => gate.status !== '已完成' && gate.evidence.length === 0));
});

test('official installer verification and the confirmed installation remain traceable', () => {
  const prepared = record.preparedDeveloperTools;
  assert.equal(prepared.channel, 'stable');
  assert.equal(prepared.architecture, 'Windows-x64');
  assert.equal(new URL(prepared.source).hostname, 'devtools.wxqcloud.qq.com.cn');
  assert.equal(prepared.version, prepared.fileVersion);
  assert.equal(prepared.signatureStatus, 'Valid');
  assert.equal(prepared.signer, 'Tencent Technology (Shenzhen) Company Limited');
  assert.equal(prepared.bytes, 190935184);
  assert.match(prepared.sha256, /^[a-f0-9]{64}$/);
  assert.equal(prepared.installationExecuted, true);
  assert.equal(record.installedDeveloperTools.approvalReply, '确认');
  assert.equal(record.installedDeveloperTools.packageVersion, prepared.version);
  assert.equal(record.installedDeveloperTools.loginVerified, true);
  assert.equal(record.installedDeveloperTools.projectAccessVerified, false);
  assert(technical.includes(prepared.sha256));
  const ignoredFolders = read('.gitignore').split(/\r?\n/);
  assert(ignoredFolders.includes('.local/'), 'Local installers must not enter Git');
  assert(prepared.localPath.startsWith('.local/downloads/'));
});

test('missing installation verification and failed installer or CLI cannot be recorded as success', () => {
  const missing = copy();
  delete missing.installedDeveloperTools;
  assert.throws(() => validateDevelopmentRecord(missing, plan), /Installed tool lacks verification record/);
  const failedInstall = copy();
  failedInstall.installedDeveloperTools.installerExitCode = 1;
  assert.throws(() => validateDevelopmentRecord(failedInstall, plan), /Installation failed/);
  const failedCli = copy();
  failedCli.installedDeveloperTools.cliHelpExitCode = 1;
  assert.throws(() => validateDevelopmentRecord(failedCli, plan), /Installed CLI did not pass/);
  const unsigned = copy();
  unsigned.installedDeveloperTools.executableSignatureStatus = 'NotSigned';
  assert.throws(() => validateDevelopmentRecord(unsigned, plan), /Installed executable signature is not verified/);
});

test('configured AppID must use the official format and preserve the resource record', () => {
  const malformed = copy();
  malformed.resources.appIdValue = '12345';
  assert.throws(() => validateDevelopmentRecord(malformed, plan), /Invalid WeChat AppID format/);
  const absent = copy();
  absent.resources.appIdExists = false;
  assert.throws(() => validateDevelopmentRecord(absent, plan), /Configured AppID conflicts with resource record/);
});

test('login verification uses the explicit successful response from the active service port', () => {
  assert.equal(record.loginObservation.userReply, '已登录');
  assert.equal(record.loginObservation.cliExitCode, 0);
  assert.equal(record.loginObservation.cliError, null);
  assert.equal(record.loginObservation.servicePortEnabled, true);
  assert.equal(record.loginObservation.response.login, true);
  const missingResponse = copy();
  delete missingResponse.loginObservation.response;
  assert.throws(() => validateDevelopmentRecord(missingResponse, plan), /explicit successful login response/);
  const failedResponse = copy();
  failedResponse.loginObservation.response.login = false;
  assert.throws(() => validateDevelopmentRecord(failedResponse, plan), /explicit successful login response/);
});

test('a zero exit code with an IDE error still cannot verify login or cloud access', () => {
  const falseLogin = copy();
  falseLogin.loginObservation.cliError = 'IDE_SERVICE_PORT_DISABLED';
  falseLogin.installedDeveloperTools.loginVerified = true;
  assert.throws(() => validateDevelopmentRecord(falseLogin, plan), /CLI errors cannot verify login/);
  const falseAccess = copy();
  falseAccess.installedDeveloperTools.loginVerified = false;
  falseAccess.loginObservation.servicePortEnabled = false;
  falseAccess.installedDeveloperTools.projectAccessVerified = true;
  assert.throws(() => validateDevelopmentRecord(falseAccess, plan), /Closed service port cannot verify project access/);
  const falseQuery = copy();
  falseQuery.installedDeveloperTools.loginVerified = false;
  falseQuery.loginObservation.servicePortEnabled = false;
  falseQuery.loginObservation.cloudEnvironmentQueryExecuted = true;
  assert.throws(() => validateDevelopmentRecord(falseQuery, plan), /Cloud environment query was blocked/);
});

test('cloud system errors are distinct from an empty environment list or verified project access', () => {
  assert.equal(record.cloudEnvironmentObservation.platformRet, 1000);
  assert.equal(record.cloudEnvironmentObservation.platformErrorCode, 10);
  assert.equal(record.cloudEnvironmentObservation.queryAttempts, 3);
  assert.equal(record.cloudEnvironmentObservation.status, 'query-failed');
  assert.equal(record.cloudEnvironmentObservation.environments, null);
  assert.equal(record.cloudEnvironmentObservation.resourcesCreated, false);
  const emptyList = copy();
  emptyList.cloudEnvironmentObservation.environments = [];
  assert.throws(() => validateDevelopmentRecord(emptyList, plan), /Failed cloud query cannot be reported as an empty environment list/);
  const access = copy();
  access.cloudEnvironmentObservation.projectAccessVerified = true;
  assert.throws(() => validateDevelopmentRecord(access, plan), /Failed cloud query cannot verify project permissions/);
});

test('native diagnostics preserve successful account lookup and unresolved runtime failures separately', () => {
  const diagnosis = record.developerToolsDiagnosis;
  assert.equal(diagnosis.managedAppIdFound, true);
  assert.equal(diagnosis.nativeAuthorizationVerified, true);
  assert.equal(diagnosis.nativeCloudQuery.success, false);
  assert.equal(diagnosis.nativeCloudQuery.platformRet, 1000);
  assert.equal(diagnosis.renameProbe.toolRuntimeResult, 'EXDEV');
  assert.equal(diagnosis.renameProbe.localNodeResult, 'EXDEV');
  assert.equal(diagnosis.renameProbe.windowsNativeResult, 'success');
  assert.equal(diagnosis.renameProbe.actualCacheDecryptionExecuted, false);
  assert.equal(diagnosis.repairVerified, false);
});

test('an unsuccessful encryption experiment cannot be recorded as proof of cause or repair', () => {
  const falseCause = copy();
  falseCause.developerToolsDiagnosis.encryptionCauseVerified = true;
  assert.throws(() => validateDevelopmentRecord(falseCause, plan), /Denied decryption cannot establish/);
  const falseRepair = copy();
  falseRepair.developerToolsDiagnosis.repairVerified = true;
  assert.throws(() => validateDevelopmentRecord(falseRepair, plan), /Unverified diagnosis cannot certify repair/);
  falseRepair.developerToolsDiagnosis.encryptionCauseVerified = true;
  assert.throws(() => validateDevelopmentRecord(falseRepair, plan), /Runtime probe cannot certify the cloud button repair/);
  const falseEnvironments = copy();
  falseEnvironments.cloudEnvironmentObservation.status = 'diagnosing';
  falseEnvironments.cloudEnvironmentObservation.environments = [];
  assert.throws(() => validateDevelopmentRecord(falseEnvironments, plan), /Native cloud error cannot establish/);
});

test('a changed environment and passing rename checks cannot certify cloud UI recovery', () => {
  const observation = record.developerToolsRevalidation;
  assert.equal(observation.date, '2026-10-07');
  assert.equal(observation.renameRegression.localNode, 'passed');
  assert.equal(observation.renameRegression.wechatRuntime, 'passed');
  assert.equal(observation.encryptionTransitionCause, 'unknown');
  assert.equal(observation.actualCacheDecryptionExecuted, false);
  assert.equal(observation.pageVerification, 'blocked-by-project-trust-prompt');
  assert.equal(observation.originalSymptomResolved, false);
  const falseResolution = copy();
  falseResolution.developerToolsRevalidation.originalSymptomResolved = true;
  assert.throws(() => validateDevelopmentRecord(falseResolution, plan), /Rename regression cannot substitute/);
});

test('diagnostic permission cannot be silently expanded to real cache changes', () => {
  const broadened = copy();
  broadened.developerToolsRevalidation.actualCacheDecryptionExecuted = true;
  assert.throws(() => validateDevelopmentRecord(broadened, plan), /Actual cache decryption was not authorized/);
  const wrongScope = copy();
  wrongScope.developerToolsRevalidation.scope = 'all-user-data';
  assert.throws(() => validateDevelopmentRecord(wrongScope, plan), /Revalidation exceeds approved scope/);
});

test('current cloud UI availability does not overwrite historical CLI failures or certify root cause', () => {
  const observation = record.cloudConsoleObservation;
  assert.equal(observation.diagnosticPageDisplayed, true);
  assert.equal(observation.cloudButtonOpenedWindow, true);
  assert.equal(observation.packageLabel, '免费开发环境');
  assert.equal(observation.usageBasedBillingEnabled, false);
  assert.equal(observation.automaticRenewalEnabled, false);
  assert.equal(observation.agentCreatedResources, false);
  assert.equal(observation.agentPurchasedResources, false);
  assert.equal(observation.rootCauseVerified, false);
  assert.equal(observation.officialCliQueryReverified, false);
  assert.equal(record.cloudEnvironmentObservation.status, 'query-failed');
  const noEvidence = copy();
  delete noEvidence.cloudConsoleObservation;
  assert.throws(() => validateDevelopmentRecord(noEvidence, plan), /Opened cloud environment requires current availability evidence/);
  const unavailable = copy();
  unavailable.cloudConsoleObservation.environmentAvailable = false;
  assert.throws(() => validateDevelopmentRecord(unavailable, plan), /Opened cloud environment requires current availability evidence/);
});

test('restart verification distinguishes a closed current port from historical login success', () => {
  const observation = record.postRestartObservation;
  assert.equal(observation.restartUserReply, '已重启');
  assert.equal(observation.servicePortEnabled, false);
  assert.equal(observation.nativeConnectionStatus, 'CONNECT_ERROR');
  assert.equal(observation.cloudConsoleDisplayed, true);
  assert.equal(observation.openingActorConfirmed, false);
  const falseConnection = copy();
  falseConnection.postRestartObservation.nativeConnectionStatus = 'verified';
  assert.throws(() => validateDevelopmentRecord(falseConnection, plan), /Closed current service port cannot certify/);
  const falseActor = copy();
  falseActor.postRestartObservation.openingActorConfirmed = true;
  assert.throws(() => validateDevelopmentRecord(falseActor, plan), /Uncertain user report cannot prove/);
  const securityChange = copy();
  securityChange.postRestartObservation.securitySettingsChangedByAgent = true;
  assert.throws(() => validateDevelopmentRecord(securityChange, plan), /Security setting requires manual/);
});

test('latest platform evidence preserves unresolved eligibility and destructive decisions', () => {
  const p=record.platformProgress;
  assert.equal(p.basicInformationCompleted, true);
  assert.equal(p.name, '湘邻湘友');
  assert.equal(p.categoriesSubmitted, false);
  assert.equal(p.licenseRegistered, false);
  assert.equal(p.subjectChangeFee.amount, 300);
  assert.equal(p.subjectChangeFee.source, 'user-report');
  assert.equal(p.aiAdviceVerified, false);
  assert.equal(p.registrationRouteConfirmed, true);
  assert.equal(p.oldAccountCancelled, false);
  assert.equal(record.selectedDevelopmentEnvironment.id, 'cloud1-d1g1mv89t76512a25');
  assert.equal(record.selectedDevelopmentEnvironment.userReply, '采用，使用现有 cloud1');
  assert.equal(record.connectionRevalidation.loginResponse.login, true);
  assert.equal(record.connectionRevalidation.nativeAuthorizationVerified, false);
  assert(technical.includes('基础信息已完成'));
  assert(evidence.includes('微信开发者助手'));
  assert.equal(record.externalGates.find(g=>g.id==='E01').status, '待外部依据');
});

test('confirmed dual-account route does not fabricate completed registration or cloud purchases', () => {
  const route = record.accountRouteDecision;
  assert.equal(route.route, 'new-individual-business-miniapp');
  assert.equal(route.testAccountReply, '没问题');
  assert.equal(route.oldAccountRetained, true);
  assert.equal(route.oldAccountRenameExecuted, false);
  assert.equal(route.oldAccountNewName, null);
  assert.equal(route.oldEnvironmentAction, 'retain');
  assert.equal(route.oldEnvironmentId, record.selectedDevelopmentEnvironment.id);
  assert.equal(route.formalNameToRetain, '湘邻湘友');
  assert.equal(route.newAppId, null);
  assert.equal(route.newEnvironmentId, null);
  assert.equal(route.nameReleaseRuleVerified, false);
  assert.equal(route.newEnvironmentPriceVerified, false);
  assert.equal(route.formalVerificationAccount, 'new-miniapp-development-and-trial-versions');
  for (const key of ['licenseRegistered', 'newAccountRegistered', 'subjectChanged', 'oldAccountCancelled']) {
    assert.equal(record.platformProgress[key], false);
  }
  assert.equal(record.productionEnabled, false);
  for (const document of [technical, evidence]) {
    assert(document.includes('新注册个体工商户小程序路线已确认'));
    assert(document.includes('未注册新账号') || document.includes('新 AppID和新环境尚未取得'));
  }
  assert(plan.includes('旧账号测试不能代替正式验收'));
});
