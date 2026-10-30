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
});

test('runtime-supported interaction entries are summarized without exposing raw names or paths', () => {
  assert.deepEqual(summarizeEntries([
    { name: 'tap-private-name', entryType: 'interaction', duration: 62.4, path: '/private/page' },
    { name: 'resource-private-name', entryType: 'resource', duration: 12, uri: 'https://private.invalid' },
  ], ['interaction', 'resource']), [
    { name: '未识别', entryType: 'interaction', durationMs: 62.4 },
    { name: '未识别', entryType: 'resource', durationMs: 12 },
  ]);
});

test('capability normalizers redact unknown names and retain only finite safe durations', () => {
  assert.deepEqual(summarizeSupportedTypes(['render', { entryType: 'navigation' }, 'bad label', 5]), ['navigation', 'render']);
  assert.deepEqual(summarizeEntries([
    { name: 'firstRender', entryType: 'render', duration: 100 },
    { name: 'custom-sensitive-name', entryType: 'render', duration: 200 },
    { name: 'route', entryType: 'navigation', duration: Infinity },
  ]), [
    { name: 'firstRender', entryType: 'render', durationMs: 100 },
    { name: '未识别', entryType: 'render', durationMs: 200 },
    { name: 'route', entryType: 'navigation', durationMs: null },
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
