'use strict';

const { runReadOnlyNetworkProbe } = require('../../utils/network-workflow');

function randomNonce(index) {
  const random = Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  return `sp01net_${Date.now().toString(16)}_${index}_${random}`;
}

function currentNetworkType() {
  return new Promise(resolve => wx.getNetworkType({
    success: result => resolve(typeof result.networkType === 'string' ? result.networkType : 'unknown'),
    fail: () => resolve('unknown'),
  }));
}

Page({
  data: { busy: false, report: '' },
  async start() {
    if (this.data.busy) return;
    this.setData({ busy: true, report: '' });
    try {
      const networkType = await currentNetworkType();
      const result = await runReadOnlyNetworkProbe({
        count: 30,
        clock: () => Date.now(),
        makeNonce: randomNonce,
        callFunction: options => wx.cloud.callFunction(options),
      });
      this.setData({ report: JSON.stringify({
        version: 'sp01-network-v1',
        networkType,
        clock: 'Date.now / 1ms nominal resolution; wall-clock shifts invalidate run',
        endpoint: 'sp01IdentityProbe / read-only',
        scope: 'application-roundtrip-not-link-rtt-or-packet-loss',
        ...result,
      }, null, 2) });
    } catch (error) {
      // Do not expose provider errors: they can include identity or temporary credentials.
      this.setData({ report: `采样未完成：${error instanceof RangeError ? '本机时钟变化或无效耗时' : '本机配置或云端入口异常'}。本轮不计入网络样本。` });
    } finally {
      this.setData({ busy: false });
    }
  },
  copyReport() {
    if (!this.data.report || this.data.busy) return;
    wx.setClipboardData({ data: this.data.report });
  },
});
