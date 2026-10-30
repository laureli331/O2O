'use strict';

const { buildDeviceReport } = require('../../utils/report');

Page({
  data: { report: '' },

  onShow() {
    this.readDevice();
  },

  readDevice() {
    let report;
    try {
      const info = wx.getSystemInfoSync();
      const current = getCurrentPages().slice(-1)[0];
      const app = getApp();
      const performance = app.globalData.performance;
      let entries = [];
      try { entries = performance?.getEntries?.() || []; } catch (_) { /* report unavailable */ }
      report = buildDeviceReport({
        info,
        renderer: current?.renderer,
        performanceApiAvailable: app.globalData.performanceApiAvailable,
        observerAvailable: app.globalData.observerAvailable,
        supportedTypes: app.globalData.supportedTypes,
        entries,
        observedEntries: app.globalData.observedEntries,
      });
    } catch (_) {
      report = '本机读取失败；没有联网或调用云服务。';
    }
    this.setData({ report });
    return report;
  },

  copyReport() {
    const report = this.readDevice();
    if (!report) return;
    wx.setClipboardData({ data: report });
  },
});
