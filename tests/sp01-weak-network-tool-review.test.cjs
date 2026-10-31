'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('weak-network tool review does not claim unverified phone injection', () => {
  const text = fs.readFileSync(path.join(__dirname, '../docs/sp01-weak-network-tool-review-20261031.md'), 'utf8');
  assert.match(text, /developer\.apple\.com\/library/);
  assert.match(text, /developer\.android\.com\/studio\/run\/emulator-commandline/);
  assert.match(text, /不能直接代表现有 Android 真机微信/);
  assert.match(text, /不能当作手机微信云 SDK 的弱网注入/);
  assert.match(text, /iPhone XR 更新至 iOS 18\.7\.11 后仍未找到入口/);
  assert.match(text, /不能据此归因于 iOS 版本/);
  assert.match(text, /苹果方法暂不采用/);
  assert.match(text, /54f6377c931582ad7cb538598d089b66250328ce/);
  assert.match(text, /选定应用列表非空时调用 `addAllowedApplication`/);
  assert.match(text, /若列表为空，排除自身后将其余应用纳入 VPN/);
  assert.match(text, /暂不安装/);
  assert.match(text, /没有本地构建、APK 与源码对应性/);
  assert.match(text, /R04 与 SP01 均未通过/);
});
