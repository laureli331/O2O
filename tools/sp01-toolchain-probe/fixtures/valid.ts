App({
  globalData: { sdkVersion: '' },
  onLaunch() {
    const info = wx.getSystemInfoSync();
    this.globalData.sdkVersion = info.SDKVersion;
  },
});
