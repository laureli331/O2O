'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildDeviceReport, summarizeEntries, summarizeSupportedTypes } = require('../tools/sp01-device-probe/miniprogram/utils/report');

test('device capability report only includes approved device fields and never infers a renderer', () => {
  const report = buildDeviceReport({
    info: { brand: 'HUAWEI', model: 'BON-AL00', system: 'Android 12', version: '8.0.79', SDKVersion: '3.17.5', platform: 'android', screenWidth: 360, screenHeight: 800, windowWidth: 360, fontSizeSetting: 16, openid: 'private' },
    renderer: undefined,
    performanceApiAvailable: true,
    observerAvailable: true,
    supportedTypes: ['navigation', 'render', 'script'],
    entries: [{ name: 'firstRender', entryType: 'render', duration: 81.25, path: '/private/path' }],
    observedEntries: [],
  });
  assert.match(report, /页面渲染器：未提供/);
  assert.match(report, /基础库：3\.17\.5/);
  assert.match(report, /firstRender\/render\/81\.3ms/);
  assert.doesNotMatch(report, /private/);
  assert.match(report, /明确FPS\/逐帧指标：未发现/);
  assert.match(report, /探针修订：device-capability-v2-20261101-r1/);
});

test('route report distinguishes a missing duration field from an invalid numeric duration', () => {
  const report = buildDeviceReport({
    info: { brand: 'OPPO', model: 'PLJ110', system: 'Android 17', version: '8.0.79', SDKVersion: '3.17.5', platform: 'android', screenWidth: 360, screenHeight: 776, windowWidth: 360, fontSizeSetting: 16 },
    renderer: 'webview',
    performanceApiAvailable: true,
    observerAvailable: true,
    supportedTypes: ['navigation'],
    entries: [
      { name: 'route', entryType: 'navigation', navigationType: 'navigateTo', path: '/private/path' },
      { name: 'appLaunch', entryType: 'navigation', duration: Infinity },
    ],
    observedEntries: [],
  });
  assert.match(report, /route\/navigation\/无耗时ms/);
  assert.match(report, /route耗时字段状态：缺少 duration 和 durationMs 字段/);
  assert.doesNotMatch(report, /private|navigateTo/);
});

test('runtime-supported interaction entries are summarized without exposing raw names or paths', () => {
  assert.deepEqual(summarizeEntries([
    { name: 'tap-private-name', entryType: 'interaction', duration: 62.4, path: '/private/page' },
    { name: 'resource-private-name', entryType: 'resource', duration: 12, uri: 'https://private.invalid' },
  ], ['interaction', 'resource']), [
    { name: '未识别', entryType: 'interaction', durationMs: 62.4, durationState: 'finite' },
    { name: '未识别', entryType: 'resource', durationMs: 12, durationState: 'finite' },
  ]);
});

test('already-sanitized observer entries retain durationMs when rendered again', () => {
  const report = buildDeviceReport({
    info: { brand: 'OPPO', model: 'PLJ110', system: 'Android 17', version: '8.0.79', SDKVersion: '3.17.5', platform: 'android', screenWidth: 360, screenHeight: 776, windowWidth: 360, fontSizeSetting: 16 },
    renderer: 'webview',
    performanceApiAvailable: true,
    observerAvailable: true,
    supportedTypes: ['navigation'],
    entries: [],
    observedEntries: [{ name: 'route', entryType: 'navigation', durationMs: 84.5 }],
  });
  assert.match(report, /route\/navigation\/84\.5ms/);
});

test('the full performance buffer snapshot takes precedence over overlapping observer rows', () => {
  const report = buildDeviceReport({
    info: { brand: 'OPPO', model: 'PLJ110', system: 'Android 17', version: '8.0.79', SDKVersion: '3.17.5', platform: 'android', screenWidth: 360, screenHeight: 776, windowWidth: 360, fontSizeSetting: 16 },
    renderer: 'webview',
    performanceApiAvailable: true,
    observerAvailable: true,
    supportedTypes: ['interaction', 'navigation'],
    entries: [{ name: 'route', entryType: 'navigation', duration: 84.5 }],
    observedEntries: [
      { name: 'route', entryType: 'navigation', durationMs: 84.5 },
      { name: 'tap', entryType: 'interaction', durationMs: 4 },
    ],
  });
  assert.equal((report.match(/route\/navigation\/84\.5ms/g) || []).length, 1);
  assert.doesNotMatch(report, /interaction\/4ms/);
});

test('capability normalizers redact unknown names and retain only finite safe durations', () => {
  assert.deepEqual(summarizeSupportedTypes(['render', { entryType: 'navigation' }, 'bad label', 5]), ['navigation', 'render']);
  assert.deepEqual(summarizeEntries([
    { name: 'firstRender', entryType: 'render', duration: 100 },
    { name: 'custom-sensitive-name', entryType: 'render', duration: 200 },
    { name: 'route', entryType: 'navigation', duration: Infinity },
    { name: 'firstPaint', entryType: 'render', duration: null },
    { name: 'route', entryType: 'navigation', duration: undefined },
    { name: 'route', entryType: 'navigation', duration: 'private-value' },
    { name: 'route', entryType: 'navigation' },
  ]), [
    { name: 'firstRender', entryType: 'render', durationMs: 100, durationState: 'finite' },
    { name: '未识别', entryType: 'render', durationMs: 200, durationState: 'finite' },
    { name: 'route', entryType: 'navigation', durationMs: null, durationState: 'non-finite' },
    { name: 'firstPaint', entryType: 'render', durationMs: null, durationState: 'null' },
    { name: 'route', entryType: 'navigation', durationMs: null, durationState: 'undefined' },
    { name: 'route', entryType: 'navigation', durationMs: null, durationState: 'non-numeric' },
    { name: 'route', entryType: 'navigation', durationMs: null, durationState: 'missing' },
  ]);
});

test('copying the report refreshes current observer entries instead of copying the initial snapshot', () => {
  const page = fs.readFileSync(path.resolve(__dirname, '../tools/sp01-device-probe/miniprogram/pages/index/index.js'), 'utf8');
  const copyHandler = page.match(/copyReport\(\)\s*\{([\s\S]*?)\n  \},/);
  assert.ok(copyHandler, 'copyReport handler exists');
  assert.match(copyHandler[1], /const report = this\.readDevice\(\);/);
  assert.ok(copyHandler[1].indexOf('this.readDevice()') < copyHandler[1].indexOf('wx.setClipboardData'));
  assert.match(page, /this\.setData\(\{ report \}\);\s*return report;/);
});

test('isolated project uses target AppID and makes no network, cloud, or storage calls', () => {
  const root = path.resolve(__dirname, '../tools/sp01-device-probe/miniprogram');
  const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../tools/sp01-device-probe/project.config.json'), 'utf8'));
  assert.equal(config.appid, 'wx2414399d423dfb65');
  assert.equal(config.libVersion, '3.17.4');
  for (const relative of ['app.js', 'pages/index/index.js', 'utils/report.js']) {
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    assert.doesNotMatch(source, /wx\.cloud|wx\.request|wx\.uploadFile|wx\.downloadFile|wx\.getTempFileURL|writeFile|setStorage/, relative);
  }
  const page = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const view = fs.readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8');
  assert.match(view, /bindtap="copyReport"/);
  assert.match(page, /copyReport\(\)\s*\{[\s\S]*?wx\.setClipboardData/);
  assert.doesNotMatch(app, /copyReport|setClipboardData/);
  assert.match(app, /observer\.observe\(\{\s*entryTypes:\s*this\.globalData\.supportedTypes\s*\}\)/);
});
