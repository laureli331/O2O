'use strict';

const { buildDeviceReport } = require('../../utils/report');

Page({
  data: { report: '' },

  onShow() {
    this.readDevice();
  },

  readDevice() {
    try {
      const info = wx.getSystemInfoSync();
      const current = getCurrentPages().slice(-1)[0];
      const app = getApp();
      const performance = app.globalData.performance;
      let entries = [];
      try { entries = performance?.getEntries?.() || []; } catch (_) { /* report unavailable */ }
      const report = buildDeviceReport({
        info,
        renderer: current?.renderer,
        performanceApiAvailable: app.globalData.performanceApiAvailable,
        observerAvailable: app.globalData.observerAvailable,
        supportedTypes: app.globalData.supportedTypes,
        entries,
        observedEntries: app.globalData.observedEntries,
      });
      this.setData({ report });
    } catch (_) {
      this.setData({ report: '本机读取失败；没有联网或调用云服务。' });
    }
  },

  copyReport() {
    if (!this.data.report) return;
    wx.setClipboardData({ data: this.data.report });
  },
});
