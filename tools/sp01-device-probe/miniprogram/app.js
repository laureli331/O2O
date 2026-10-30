'use strict';

const { summarizeEntries, summarizeSupportedTypes } = require('./utils/report');

App({
  globalData: {
    performanceApiAvailable: false,
    observerAvailable: false,
    supportedTypes: [],
    observedEntries: [],
    performance: null,
  },

  onLaunch() {
    try {
      if (typeof wx.getPerformance !== 'function') return;
      const performance = wx.getPerformance();
      this.globalData.performanceApiAvailable = true;
      this.globalData.performance = performance;
      const observer = performance.createObserver((entryList) => {
        const entries = entryList?.getEntries?.() || [];
        this.globalData.observedEntries = summarizeEntries([
          ...this.globalData.observedEntries,
          ...entries,
        ]);
      });
      this.globalData.supportedTypes = summarizeSupportedTypes(observer?.supportedEntryTypes);
      observer.observe({ entryTypes: ['navigation', 'render', 'script'] });
      this.globalData.observerAvailable = true;
    } catch (_) {
      // Capability failures are shown as unavailable; raw runtime messages are not exposed.
    }
  },
});
