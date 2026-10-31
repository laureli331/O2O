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
