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

test('SP04 records the exact user-confirmed service area and three service modules', () => {
  const record = evidence();
  assert.deepEqual(record.businessConfiguration.serviceArea.value, [
    '湘阴渡社区',
    '高矿社区',
    '松柏村',
    '堡口村',
    '油塘村',
    '滩头村',
    '田心村',
    '南塘村',
    '胜利村',
    '湘阴村',
  ]);
  assert.equal(record.businessConfiguration.serviceArea.status, 'user-confirmed');
  assert.equal(record.businessConfiguration.serviceArea.source, 'user-reply-2026-10-27');
  assert.equal(record.businessConfiguration.registrationAddressEstablishesServiceArea, false);
  assert.deepEqual(record.businessConfiguration.serviceCategories.value, [
    '家电维修求助与服务人员目录',
    '居民二手物品信息发布',
    '代买代取代送需求报价匹配',
  ]);
  assert.equal(record.businessConfiguration.serviceCategories.status, 'user-confirmed');
  assert.equal(record.businessConfiguration.serviceCategories.source, 'user-reply-2026-10-27');
  assert.equal(record.businessConfiguration.serviceCategories.scope, '本项目服务模块名称，不代表微信平台官方服务类目已确认');
  assert.equal(record.businessConfiguration.serviceArea.recommendationStatus, 'superseded-by-user-confirmation');
  assert.match(record.businessConfiguration.serviceArea.recommendation, /已被用户明确确认的十地点清单取代/);
});

test('SP04 records the confirmed service hours and next-day handling after 22:00', () => {
  const record = evidence();
  assert.equal(record.operations.coverageSchedule.status, 'user-confirmed');
  assert.deepEqual(record.operations.coverageSchedule.shiftArrangement, {
    partner: '白班',
    user: '晚班',
    source: 'user-reply-2026-10-27',
  });
  assert.deepEqual(record.operations.coverageSchedule.managementDutyHours, {
    partner: { start: '09:00', end: '17:00' },
    user: { start: '17:00', end: '22:00' },
    source: 'user-reply-2026-10-27',
    scope: 'management-review-and-handover-only',
  });
  assert.deepEqual(record.operations.coverageSchedule.serviceAvailabilityHours, {
    start: '09:00',
    end: '22:00',
    source: 'user-reply-2026-10-27',
  });
  assert.equal(record.operations.coverageSchedule.unattendedHandling, '22:00后次日处理');
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
  assert.ok(task.executionProgress.completedChecks.some((check) => check.includes('湘阴渡社区') && check.includes('湘阴村')));
  assert.ok(task.executionProgress.completedChecks.some((check) => check.includes('09:00') && check.includes('22:00')));
  assert.ok(task.executionProgress.completedChecks.some((check) => check.includes('顾客服务时段09:00—22:00') && check.includes('22:00后请求次日处理')));
  assert.ok(task.executionProgress.blockedChecks.every((check) => !check.includes('顾客可预约服务时段')));
  assert.ok(plan.sources.includes('docs/sp04-operations-configuration-20261027.md'));
  assert.ok(plan.sources.includes('docs/sp04-operations-configuration-20261027.json'));
});

test('SP04 report includes evidence limits, rollback, and every remaining user or platform dependency', () => {
  const doc = read('docs/sp04-operations-configuration-20261027.md').replace(/\s/g, '');
  for (const phrase of [
    '截图未显示AppID',
    '不能证明新AppID已接通',
    '不把它当服务范围',
    '用户确认伙伴09:00—17:00、本人17:00—22:00',
    '首发服务范围（用户确认）',
    '湘阴渡社区、高矿社区、松柏村、堡口村、油塘村、滩头村、田心村、南塘村、胜利村、湘阴村',
    '湘阴渡社区来自用户明确确认',
    '不能识别具体自然人',
    '不承诺24小时值守',
    '正式环境必须绑定已完成备案的自定义域名',
    '没有创建云环境、部署托管',
    '回退',
    '服务范围、三类项目服务、管理值班、09:00—22:00服务时段及22:00后次日处理均已由用户确认',
    '用户另确认顾客服务时段为09:00—22:00，22:00后收到的请求次日处理',
  ]) {
    assert.ok(doc.includes(phrase), phrase);
  }
  assert.ok(!doc.includes('顾客实际可预约服务时段是否与管理值班相同'));
  assert.ok(!doc.includes('22:00后或其他无人值班时段如何处理请求'));
});
