'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('R04 network profile method keeps Cloudflare link results separate from CloudBase round trips', () => {
  const source = fs.readFileSync(path.join(__dirname, '../docs/sp01-network-profile-method-20261031.md'), 'utf8');
  assert.match(source, /speed\.cloudflare\.com/);
  assert.match(source, /手机到 Cloudflare/);
  assert.match(source, /不能换算成链路 RTT、上下行、抖动或丢包/);
  assert.match(source, /公共 Wi-Fi 单列/);
  assert.match(source, /弱网配置还需独立方法/);
  assert.match(source, /SP01 不放行/);
});

test('first Cloudflare screenshot is a single round with high loss and no false CloudBase claim', () => {
  const evidence = require('../docs/sp01-network-cloudflare-home-wifi-20261031.json');
  assert.equal(evidence.scope, 'phone-to-Cloudflare, not phone-to-CloudBase');
  assert.equal(evidence.downloadMbps, 25.5);
  assert.equal(evidence.uploadMbps, 33.5);
  assert.equal(evidence.latencyMs, 200);
  assert.equal(evidence.jitterMs, 40);
  assert.equal(evidence.packetLossPercent, 14.3);
  assert.equal(evidence.deviceAndAccessConfirmedByUser, true);
  assert.equal(evidence.deviceAndAccessIndependentlyVerifiedByScreenshot, false);
  assert.equal(evidence.independentRounds, 1);
  assert.equal(evidence.normalNetworkStableRangeFrozen, false);
  assert.equal(evidence.r04Passed, false);
});

test('second Cloudflare round retains variable loss rather than replacing the first', () => {
  const first = require('../docs/sp01-network-cloudflare-home-wifi-20261031.json');
  const second = require('../docs/sp01-network-cloudflare-home-wifi-round2-20261031.json');
  assert.equal(second.round, 2);
  assert.equal(second.downloadMbps, 27.1);
  assert.equal(second.uploadMbps, 25.1);
  assert.equal(second.latencyMs, 191);
  assert.equal(second.jitterMs, 74.3);
  assert.equal(second.packetLossPercent, 1.8);
  assert.equal(first.packetLossPercent - second.packetLossPercent, 12.5);
  assert.equal(second.normalNetworkStableRangeFrozen, false);
  assert.equal(second.scope, first.scope);
});
