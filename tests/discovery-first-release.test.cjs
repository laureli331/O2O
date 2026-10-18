'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => new TextDecoder('utf-8', { fatal: true })
  .decode(fs.readFileSync(path.join(root, file)));
const decisions = () => JSON.parse(read('docs/development-decisions.json'));

test('current discovery decision moves only the free base capability into v1 while preserving the historical v2 record', () => {
  const record = decisions();
  assert.equal(record.featurePlanning.merchantSquareRelease, 'v2');
  assert.equal(record.discoveryFirstReleaseDecision.release, 'v1');
  assert.deepEqual(record.discoveryFirstReleaseDecision.capabilities, [
    'approved-merchant-posting',
    'approved-displayable-merchant-feed',
    'post-detail',
    'favorite',
    'wechat-share',
  ]);
  assert.equal(record.discoveryFirstReleaseDecision.basePostingFree, true);
  assert.equal(record.discoveryFirstReleaseDecision.overridesHistoricalMerchantSquareRelease, true);
});

test('current discovery decision records the approved navigation, icon and notification hierarchy', () => {
  const decision = decisions().discoveryFirstReleaseDecision;
  assert.deepEqual(decision.navigation, ['首页', '发现', '发布', '服务', '我的']);
  assert.equal(decision.discoverIcon, 'compass-option-a');
  assert.equal(decision.notificationEntry, 'service-top-right');
  assert.equal(decision.notificationLevel, 'service-secondary-page');
  assert.equal(decision.designDocument, 'docs/superpowers/specs/2026-10-18-discover-navigation-design.md');
  assert.equal(decision.designCommit, 'a220bd1');
  assert.equal(decision.iconSelectionCommit, '0b735f4');
});

test('first-release discovery excludes commercial and social expansion and authorizes no real execution', () => {
  const decision = decisions().discoveryFirstReleaseDecision;
  assert.deepEqual(decision.excludedCapabilities, [
    'comment',
    'like',
    'follow',
    'video',
    'hot-ranking',
    'personalized-recommendation',
    'content-heating',
    'membership-paywall',
  ]);
  assert.deepEqual(decision.realExecution, {
    publishingEnabled: false,
    reviewEnabled: false,
    notificationsEnabled: false,
    salesEnabled: false,
    paymentsEnabled: false,
    promotionEnabled: false,
  });
});
