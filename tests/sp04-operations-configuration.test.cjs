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
  assert.equal(record.date, '2026-10-27');
  assert.equal(record.lastUpdated, '2026-10-28');
  assert.ok(read('docs/sp04-operations-configuration-20261027.md').includes('创建日期：2026-10-27；最近更新：2026-10-28'));
  assert.equal(record.cloudConsoleScreenshot.name, 'user-provided-2026-10-27');
  assert.equal(record.cloudConsoleScreenshot.visibleEnvironmentName, 'cloud1');
  assert.equal(record.cloudConsoleScreenshot.visibleBadge, '微信体验版');
  assert.equal(record.cloudConsoleScreenshot.visibleOverviewState, '暂无数据');
  assert.equal(record.cloudConsoleScreenshot.visibleDatabaseState, '找不到可用的集合');
  assert.equal(record.cloudConsoleScreenshot.appIdVisible, false);
  assert.equal(record.cloudConsoleScreenshot.environmentOwnerAppId, null);
  assert.equal(record.cloudConsoleScreenshot.provesNewAppIdConnection, false);
});

test('SP04 records the CloudBase detail screenshot as visible AppID-to-environment evidence', () => {
  const record = evidence();
  assert.deepEqual(record.environmentDetailsScreenshot, {
    source: 'user-provided-screenshot-codex-clipboard-735eb7db-3e6f-4f27-b5c0-040361142474.png',
    receivedDate: '2026-10-28',
    visibleEnvironmentScope: '我的环境',
    visibleApplicationName: '湘邻湘友',
    visibleAppId: 'wx2414399d423dfb65',
    visibleEnvironmentName: 'cloud1',
    visibleEnvironmentId: 'cloud1-d2gjahlq39bf141c7',
    visibleCreatedAt: '2026-10-27 22:28:44',
    provesTargetAppEnvironmentAssociation: true,
    provesCloudBaseApiOrRuntimeAccess: false,
  });
  assert.ok(read('docs/sp04-operations-configuration-20261027.md').includes('页面同屏显示目标 AppID `wx2414399d423dfb65` 和环境 ID `cloud1-d2gjahlq39bf141c7`'));
});

test('SP04 records that the open diagnostic project uses the old AppID, not the new target', () => {
  const crossCheck = evidence().appIdCrossCheck;
  assert.deepEqual(crossCheck, {
    currentProjectAppId: 'wx358290e451cb06e7',
    currentProjectAppIdConfirmedByUser: false,
    projectConfigPath: '.local/permission-check/project.config.json',
    targetNewAppId: 'wx2414399d423dfb65',
    currentProjectMatchesNewAppId: false,
    evidenceMethod: 'read-only-local-config',
    historicalUserReportCurrentProjectAppIdMatch: true,
    screenshotBoundAppId: null,
    oldAppIdReadOnlyResult: {
      appId: 'wx358290e451cb06e7',
      environmentId: 'cloud1-d1g1mv89t76512a25',
      scope: 'development-and-controlled-testing-only',
      provesScreenshotOwner: false,
    },
  });
});

test('SP04 excludes old cloud1 based on the user-reported subject difference without claiming live verification', () => {
  const record = evidence();
  assert.deepEqual(record.cloudEnvironmentReuseAssessment, {
    resourceAppId: 'wx358290e451cb06e7',
    resourceEnvironmentId: 'cloud1-d1g1mv89t76512a25',
    targetNewAppId: 'wx2414399d423dfb65',
    status: 'excluded-by-user-reported-different-subject',
    eligibleScopeIfApproved: null,
    subjectRelationshipUserReport: {
      resourceSubject: 'personal',
      targetSubjectCategory: 'individual-business-or-company',
      targetLegalFormConfirmed: false,
      sameSubject: false,
      date: '2026-10-27',
      evidenceLevel: 'user-report-not-live-platform-verification',
    },
    sameSubjectVerified: false,
    sameSubjectRequirementSatisfiedBasedOnUserReport: false,
    resourceSharingEnabledOrAuthorized: false,
    sharingConfigurationMutationAuthorized: false,
    provesNewAppIdConnection: false,
    provesHostingLoginDomainOrPricing: false,
    officialRule: 'A Tencent Cloud account can bind one mini-program; the resource-side mini-program may share CloudBase resources including cloud functions and cloud database with other mini-programs of the same subject; CloudBase environments cannot be migrated across accounts.',
    sources: [
      'https://cloud.tencent.com/document/faq/876/57380',
      'https://cloud.tencent.com/document/faq/876/18438',
    ],
  });
  assert.equal(record.evidenceGates.find((gate) => gate.id === 'E06').passed, false);
  assert.ok(record.remainingChecks.some((item) => item.includes('不符合官方同主体共享条件')));
  assert.ok(record.remainingChecks.some((item) => item.includes('新号自己的CloudBase环境')));
  const doc = read('docs/sp04-operations-configuration-20261027.md');
  assert.ok(doc.includes('一个腾讯云账号只能绑定一个小程序'));
  assert.ok(doc.includes('旧号为个人主体，新号为个体工商户/公司主体'));
  assert.ok(doc.includes('不符合官方同主体共享条件'));
  assert.ok(doc.includes('这是用户报告，未通过平台后台实时核验'));
  assert.ok(doc.includes('不代表托管、登录、域名或费用已经配置'));
  const plan = load('docs/v1-executable-development-plan-20261027.json');
  const task = plan.tasks.find((entry) => entry.id === 'SP04');
  assert.equal(task.status, 'in-progress');
  assert.equal(task.productAcceptancePassed, false);
  assert.ok(task.executionProgress.blockedChecks.some((item) => item.includes('目标新AppID自己的CloudBase环境')));
});

test('SP04 records the DevTools project list without claiming all local projects were searched', () => {
  const record = evidence();
  assert.deepEqual(record.devtoolsProjectManagerObservation, {
    visibleRegisteredProjectCount: 1,
    visibleProjects: [{
      name: 'O2O environment verification',
      path: 'E:\\O2O\\.local\\permission-check',
    }],
    targetNewAppId: 'wx2414399d423dfb65',
    targetProjectListed: false,
    appIdVisibleInProjectManager: false,
    scope: 'wechat-devtools-registered-project-list-only',
    evidenceMethod: 'read-only-visible-ui-observation',
  });
  assert.ok(record.remainingChecks.some((item) => item.includes('列表外或其他账号/设备')));
  const doc = read('docs/sp04-operations-configuration-20261027.md');
  assert.ok(doc.includes('目标新AppID对应工程当时未出现在当前列表中'));
  assert.ok(doc.includes('此结果仅适用于该开发者工具当时显示的已登记工程列表'));
});

test('SP04 keeps an inaccessible official category source separate from eligibility conclusions', () => {
  const record = evidence();
  assert.deepEqual(record.officialCategorySourceLookup, {
    lookupDate: '2026-10-27',
    officialUrl: 'https://developers.weixin.qq.com/miniprogram/product/material/',
    directPageAccess: 'non-retryable-error',
    officialDomainRestrictedSearch: 'no-results',
    eligibilityConclusion: null,
    provesCategoryUnavailable: false,
    evidenceMethod: 'public-web-read-only',
  });
  assert.deepEqual(record.categoryPickerObservation, {
    sourceScreenshots: [
      'codex-clipboard-bec8e09b-c65b-4574-bcc0-8ceb0636029d.png',
      'codex-clipboard-54786573-29f3-42d1-a95c-f2586d709fe7.png',
    ],
    screenshotAppIdVisible: false,
    selectedAndSaved: false,
    homeServicesOption: {
      path: ['生活服务', '家政服务'],
      description: '适用于提供家政服务，如保姆、月嫂、房屋保洁、家电维修、数码电器维修等在线预约等服务。',
    },
    errandSearch: {
      term: '跑腿',
      visibleResults: [
        ['物流服务', '查件'],
        ['物流服务', '装卸搬运'],
      ],
      exactRunErrandCategoryVisible: false,
    },
    secondhandSearch: {
      observed: false,
      result: null,
    },
    scope: 'visible-user-provided-portal-screenshots-only',
    evidenceMethod: 'review-of-user-provided-screenshots',
  });
  const doc = read('docs/sp04-operations-configuration-20261027.md');
  assert.ok(doc.includes('本轮尝试打开微信官方'));
  assert.ok(doc.includes('不能据此判断相关类目不存在、可申请或不可申请'));
  assert.ok(doc.includes('“生活服务 > 家政服务”的说明包含家电维修'));
  assert.ok(doc.includes('搜索“跑腿”时，截图只显示“物流服务 > 查件”和“物流服务 > 装卸搬运”'));
  assert.ok(doc.includes('没有保存最终服务类目'));
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

test('SP04 records no confirmed repair or errand providers without inventing credential checks or coverage', () => {
  const record = evidence();
  assert.deepEqual(record.businessConfiguration.providerSupply, {
    status: 'user-reported-no-confirmed-willing-providers',
    source: 'user-reply-2026-10-27',
    confirmedWillingProviderCounts: { homeRepair: 0, errand: 0 },
    credentialReviewStatus: 'not-confirmed',
    tenLocationCoverageStatus: 'not-confirmed',
  });
  assert.equal(record.evidenceGates.find((gate) => gate.id === 'E05').passed, false);
  assert.ok(record.remainingChecks.some((item) => item.includes('目前没有已确认愿意接单的维修或代买代取服务者')));
  const doc = read('docs/sp04-operations-configuration-20261027.md');
  assert.ok(doc.includes('目前没有已确认愿意接单的家电维修或代买代取服务者'));
  assert.ok(doc.includes('资质审核状态和十个地点的实际覆盖尚未确认'));
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

test('SP04 records current official CloudBase tariffs as candidates without claiming a project quote', () => {
  const record = evidence();
  const pricing = record.webAdministration.publishedPricing;
  assert.deepEqual(pricing, {
    sourceUrl: 'https://cloud.tencent.com/document/product/876/127357',
    checkedAt: '2026-10-27',
    sourcePageUpdatedAt: '2026-10-26',
    billingModel: 'resource-points',
    pointValueCny: { points: 1000, cny: 1 },
    regions: {
      shanghai: {
        staticHostingTrafficCnyPerGb: 0.21,
        staticHostingStorageCnyPerGbDay: 0.00394,
      },
      singapore: {
        staticHostingTrafficCnyPerGb: 0.46,
        staticHostingStorageCnyPerGbDay: 0.00454,
      },
    },
    freeExperienceCandidate: {
      policyScope: 'console-resource-point-redemption-code-trial',
      redemptionCodeEnvironmentsPerCloudBaseAccount: 1,
      monthlyPoints: 3000,
      devTestPurpose: true,
      renewalTermMonths: 6,
      autoRenewal: false,
      renewalPolicyAppliesToWechatExperience: false,
      supportsResourcePacksOrPayAsYouGo: false,
      publishedAfterReleaseExpiryDays: 15,
      appliesToScreenshotEnvironment: null,
    },
    newUserGuideTrialCandidate: {
      sourceUrl: 'https://cloud.tencent.com/document/product/876/56375',
      sourcePageUpdatedAt: '2026-04-21',
      policyScope: 'cloudbase-new-user-onboarding-guide',
      firstUseOffer: 'one-month-free-personal-plan-environment',
      firstUseEligibilityVerified: false,
      currentWizardMappingVerified: false,
    },
    monthlyQuoteCny: null,
    quoteStatus: 'not-computable-without-region-domain-and-usage-estimates',
    purchaseAuthorized: false,
  });
  assert.equal(record.webAdministration.monthlyHostingQuote.value, null);
  assert.equal(record.budget.confirmedMonthlyCashCapCny, 500);
  assert.equal(record.budget.purchaseAuthorized, false);
  const doc = read('docs/sp04-operations-configuration-20261027.md');
  assert.ok(doc.includes('资源点计费模式的公开单价候选'));
  assert.ok(doc.includes('不能据此形成项目月报价'));
  assert.ok(doc.includes('截图中的“微信体验版”是否对应免费体验环境仍未核实'));
  assert.ok(doc.includes('免费体验入口和适用规则有区别'));
  assert.ok(doc.includes('每个云开发账号'));
  assert.ok(doc.includes('初次使用可免费体验1个月个人版环境'));
  assert.ok(doc.includes('当前开发者工具向导适用哪种体验'));
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
  assert.ok(task.executionProgress.completedChecks.some((check) => check.includes('控制台兑换码体验') && check.includes('初次使用个人版一个月免费说明')));
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
