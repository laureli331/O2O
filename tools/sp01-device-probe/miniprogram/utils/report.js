'use strict';

const probeRevision = 'device-capability-v2-20261101-r1';

const durationStateLabels = new Map([
  ['finite', '有限数值'],
  ['missing', '缺少 duration 和 durationMs 字段'],
  ['undefined', '字段值为 undefined'],
  ['null', '字段值为 null'],
  ['non-finite', '非有限数字'],
  ['non-numeric', '非数值类型'],
]);

const safeLabels = new Set([
  'appLaunch', 'route', 'firstRender', 'firstPaint', 'firstContentfulPaint',
  'largestContentfulPaint', 'evaluateScript', 'downloadPackage', 'resourceTiming',
]);
const safeEntryTypeByName = new Map([
  ['appLaunch', 'navigation'], ['route', 'navigation'],
  ['firstRender', 'render'], ['firstPaint', 'render'],
  ['firstContentfulPaint', 'render'], ['largestContentfulPaint', 'render'],
  ['evaluateScript', 'script'], ['downloadPackage', 'loadPackage'],
  ['resourceTiming', 'resource'],
]);

function safeText(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') return value.replace(/[\r\n\u0000-\u001f]/g, ' ').slice(0, 100) || '未提供';
  return '未提供';
}

function safeMetric(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value * 10) / 10
    : null;
}

function summarizeDurationState(entry) {
  if (durationStateLabels.has(entry.durationState)) return entry.durationState;
  const hasDuration = Object.prototype.hasOwnProperty.call(entry, 'duration');
  const hasDurationMs = Object.prototype.hasOwnProperty.call(entry, 'durationMs');
  const value = entry.duration !== undefined ? entry.duration : entry.durationMs;
  if (value === undefined) return hasDuration || hasDurationMs ? 'undefined' : 'missing';
  if (value === null) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? 'finite' : 'non-finite';
  return 'non-numeric';
}

function summarizeSupportedTypes(types) {
  if (!Array.isArray(types)) return [];
  return [...new Set(types.map((item) => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') return item.entryType || item.name;
    return undefined;
  }).filter((value) => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9-]{0,39}$/.test(value)))].sort();
}

function summarizeEntries(entries, supportedTypes = []) {
  if (!Array.isArray(entries)) return [];
  const safeTypes = new Set(['navigation', 'render', 'script', ...summarizeSupportedTypes(supportedTypes)]);
  const result = [];
  for (const entry of entries) {
    if (!entry || typeof entry.entryType !== 'string' || !safeTypes.has(entry.entryType)) continue;
    const safeName = safeLabels.has(entry.name)
      && safeEntryTypeByName.get(entry.name) === entry.entryType;
    result.push({
      name: safeName ? entry.name : '未识别',
      entryType: entry.entryType,
      durationMs: safeMetric(entry.duration === undefined ? entry.durationMs : entry.duration),
      durationState: summarizeDurationState(entry),
    });
  }
  return result.slice(-20);
}

function buildDeviceReport({
  info,
  renderer,
  performanceApiAvailable,
  observerAvailable,
  supportedTypes,
  entries,
  observedEntries,
}) {
  if (!info || typeof info !== 'object') throw new TypeError('DEVICE_INFO_REQUIRED');
  const fields = [
    ['品牌', info.brand], ['型号', info.model], ['系统', info.system],
    ['微信', info.version], ['基础库', info.SDKVersion], ['平台', info.platform],
    ['屏幕逻辑宽', info.screenWidth], ['屏幕逻辑高', info.screenHeight],
    ['窗口逻辑宽', info.windowWidth], ['字体设置', info.fontSizeSetting],
  ];
  const types = summarizeSupportedTypes(supportedTypes);
  const entrySnapshot = Array.isArray(entries) && entries.length > 0 ? entries : observedEntries;
  const metrics = summarizeEntries(entrySnapshot, types);
  const routeDurationStates = metrics
    .filter((item) => item.name === 'route' && item.entryType === 'navigation')
    .map((item) => durationStateLabels.get(item.durationState) || '未分类')
    .join('；') || '未出现 route 条目';
  const hasFrameMetric = [...types, ...metrics.map((item) => item.name)]
    .some((name) => /fps|frame/i.test(name));
  return [
    '设备诊断版本：device-capability-v1',
    `探针修订：${probeRevision}`,
    ...fields.map(([label, value]) => `${label}：${safeText(value)}`),
    `页面渲染器：${safeText(renderer)}`,
    `wx.getPerformance：${performanceApiAvailable ? '可调用' : '不可用或失败'}`,
    `PerformanceObserver：${observerAvailable ? '已注册' : '不可用或失败'}`,
    `性能指标类型：${types.length ? types.join(', ') : '未提供'}`,
    `当前性能条目：${metrics.length ? metrics.map((item) => `${item.name}/${item.entryType}/${item.durationMs ?? '无耗时'}ms`).join('；') : '未提供'}`,
    `route耗时字段状态：${routeDurationStates}`,
    `明确FPS/逐帧指标：${hasFrameMetric ? '接口返回了候选名称，需另核' : '未发现'}`,
    '只在本机显示，未调用云服务或联网。性能条目不代表FPS。',
  ].join('\n');
}

module.exports = { buildDeviceReport, probeRevision, safeText, summarizeEntries, summarizeSupportedTypes };
