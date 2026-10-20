'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const recordPath = 'docs/merchant-drawer-onboarding-confirmed-20261020.json';
const documentPath = 'docs/merchant-drawer-onboarding-confirmed-20261020.md';
const entryFiles = [
  'docs/prd.md',
  'docs/development-plan.md',
  'docs/structured-design.md',
  'docs/ascii-design-prd-2.1.md',
  'docs/module-specs/current-development-basis-20261015.md',
  'docs/v2-roadmap.md',
  'CONTEXT.md',
];

test('structured record preserves confirmed drawer and onboarding decisions', () => {
  const record = JSON.parse(read(recordPath));
  assert.equal(record.status, 'confirmed-product-rules-not-launched');
  assert.equal(record.drawer.publishInsideDrawer, false);
  assert.equal(record.drawer.profileEntryLabel, '查看主页');
  assert.deepEqual(record.drawer.stats, ['subscriptions', 'favorites']);
  assert.deepEqual(record.drawer.fixedBottomEntries, ['customer-service', 'drafts', 'settings']);
  assert.deepEqual(record.onboarding.applicantTypes, [
    'licensed-business',
    'independent-service-provider-without-business-license',
  ]);
  assert.equal(record.onboarding.reviewBeforePayment, true);
  assert.equal(record.onboarding.feeCnyPerPeriod, 99);
  assert.equal(record.onboarding.periodDays, 30);
  assert.equal(record.onboarding.calendarMonthBilling, false);
  assert.equal(record.onboarding.autoRenew, false);
  assert.equal(record.onboarding.feeUnit, 'operating-profile');
  assert.equal(record.onboarding.activateOnlyAfterConfirmedPayment, true);
  assert.equal(record.onboarding.chargeWhenReviewRejected, false);
  assert.equal(record.feeBoundary.basicMerchantPostsRemainFree, true);
  assert.equal(record.feeBoundary.realPaymentLaunchAuthorized, false);
});

test('human-readable record separates confirmed rules from unresolved work', () => {
  const document = read(documentPath);
  for (const phrase of [
    '查看主页',
    '只显示“订阅”和“收藏”',
    '客服 / 草稿 / 设置',
    '无营业执照的独立服务者',
    '审核通过后再收取99元／连续30天的商家入驻费',
    '原“99元／30天商家工具会员”不再作为独立商品',
    '不自动续费',
    '基础图文主帖仍可免费提交',
    '不表示真实支付',
    '以上未确认项不得在后续实现中自行补齐',
  ]) assert.ok(document.includes(phrase), phrase);
});

test('every current entry document points to the latest decision', () => {
  for (const file of entryFiles) {
    const text = read(file);
    assert.ok(text.includes('merchant-drawer-onboarding-confirmed-20261020.md'), file);
    assert.ok(text.includes('审核通过后'), `${file}: review-before-payment`);
    assert.ok(text.includes('99元'), `${file}: activation fee`);
  }
});

test('current roadmap no longer says paid onboarding is unapproved', () => {
  const roadmap = read('docs/v2-roadmap.md');
  assert.doesNotMatch(roadmap, /不表示现已批准付费入驻/);
  assert.match(roadmap, /99元／连续30天商家入驻费/);
  assert.match(roadmap, /基础图文主帖仍免费/);
});
