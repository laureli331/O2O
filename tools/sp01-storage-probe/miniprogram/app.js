'use strict';

const { TARGET_ENV_ID } = require('./utils/probe-contract');

App({
  onLaunch() {
    if (wx.cloud) wx.cloud.init({ env: TARGET_ENV_ID });
  },
});
