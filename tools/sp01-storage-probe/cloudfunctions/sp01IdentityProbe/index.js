'use strict';

const cloud = require('wx-server-sdk');
const { TARGET_APP_ID } = require('./identity-contract');
const { createIdentityHandler } = require('./handler');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = createIdentityHandler({
  getWXContext: () => cloud.getWXContext(),
  expectedAppId: TARGET_APP_ID,
});
