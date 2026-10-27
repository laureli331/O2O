'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const load = (file) => JSON.parse(read(file));

function evidence() {
  return load('docs/sp04-operations-configuration-20261027.json');
}

test('SP04 keeps the CloudBase screenshot separate from AppID ownership evidence', () => {
  const record = evidence();
  assert.equal(record.cloudConsoleScreenshot.name, 'user-provided-2026-10-27');
  assert.equal(record.cloudConsoleScreenshot.visibleEnvironmentName, 'cloud1');
  assert.equal(record.cloudConsoleScreenshot.visibleBadge, '微信体验版');
  assert.equal(record.cloudConsoleScreenshot.visibleOverviewState, '暂无数据');
  assert.equal(record.cloudConsoleScreenshot.visibleDatabaseState, '找不到可用的集合');
  assert.equal(record.cloudConsoleScreenshot.appIdVisible, false);
  assert.equal(record.cloudConsoleScreenshot.environmentOwnerAppId, null);
  assert.equal(record.cloudConsoleScreenshot.provesNewAppIdConnection, false);
});

test('SP04 records unconfirmed service coverage and operating hours as unresolved, not synthetic defaults', () => {
  const record = evidence();
  assert.equal(record.businessConfiguration.serviceArea.value, null);
  assert.equal(record.businessConfiguration.serviceArea.status, 'awaiting-user-confirmation');
  assert.deepEqual(record.businessConfiguration.serviceCategories.value, []);
  assert.equal(record.businessConfiguration.serviceCategories.status, 'awaiting-user-confirmation');
  assert.equal(record.operations.coverageSchedule.value, null);
  assert.equal(record.operations.coverageSchedule.status, 'awaiting-user-confirmation');
  assert.equal(record.businessConfiguration.registrationAddressIsServiceArea, false);
});

test('SP04 preserves the confirmed shared-account and no-24-hour operating rules', () => {
  const record = evidence();
  assert.equal(record.operations.managementAccounts, 1);
  assert.equal(record.operations.sharedManagementAccount, true);
  assert.equal(record.operations.actualHumanAttribution, false);
  assert.equal(record.operations.separateOperatorAccounts, false);
  assert.equal(record.operations.twoPersonReview, false);
  assert.equal(record.operations.promisesTwentyFourHourCoverage, false);
  assert.equal(record.operations.confirmedSource, 'docs/module-specs/business-closeout-confirmed-20261015.md');
});

test('SP04 treats Web hosting docs as capability evidence, not account provisioning, login, or price evidence', () => {
  const record = evidence();
  assert.equal(record.webAdministration.model, 'custom-web-primary-miniapp-light-duty');
  assert.equal(record.webAdministration.sharedBackendAndPermissions, true);
  assert.equal(record.webAdministration.hostingProvider.value, null);
  assert.equal(record.webAdministration.hostingProvider.status, 'not-selected');
  assert.equal(record.webAdministration.customDomain.value, null);
  assert.equal(record.webAdministration.loginMethod.value, null);
  assert.equal(record.webAdministration.monthlyHostingQuote.value, null);
  assert.equal(record.webAdministration.accountProvisioningVerified, false);
  assert.equal(record.webAdministration.productionCustomDomainRequiredByReviewedDocs, true);
  assert.match(record.webAdministration.sources.staticHosting, /^https:\/\/cloud\.tencent\.com\/document\/product\/876\/46900$/);
  assert.match(record.webAdministration.sources.httpAccess, /^https:\/\/cloud\.tencent\.com\/document\/product\/876\/130728$/);
});

test('SP04 records browser installation separately from tested support and blocks false completion', () => {
  const record = evidence();
  assert.equal(record.localDevice.environment, 'Windows 11');
  assert.ok(record.localDevice.installedBrowsers.length >= 1);
  assert.ok(record.localDevice.installedBrowsers.every((browser) => browser.version && browser.compatibilityTested === false));
  assert.equal(record.localDevice.webHostingAndLoginTested, false);
  assert.deepEqual(record.evidenceGates.map((gate) => gate.passed), [false, false]);
  assert.equal(record.cloudWritesOrDeploymentPerformed, false);

  const plan = load('docs/v1-executable-development-plan-20261027.json');
  const task = plan.tasks.find((entry) => entry.id === 'SP04');
  assert.equal(task.status, 'in-progress');
  assert.equal(task.productAcceptancePassed, false);
  assert.ok(task.executionProgress.blockedChecks.length >= 1);
  assert.ok(plan.sources.includes('docs/sp04-operations-configuration-20261027.md'));
  assert.ok(plan.sources.includes('docs/sp04-operations-configuration-20261027.json'));
});

test('SP04 report includes evidence limits, rollback, and every remaining user or platform dependency', () => {
  const doc = read('docs/sp04-operations-configuration-20261027.md').replace(/\s/g, '');
  for (const phrase of [
    '截图未显示AppID',
    '不能证明新AppID已接通',
    '不把它当服务范围',
    '不能识别具体自然人',
    '不承诺24小时值守',
    '正式环境必须绑定已完成备案的自定义域名',
    '没有创建云环境、部署托管',
    '回退',
    '服务范围与开放时段仍待用户确认',
  ]) {
    assert.ok(doc.includes(phrase), phrase);
  }
});
