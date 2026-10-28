'use strict';

const { createHandler } = require('./handler');

exports.createHandler = createHandler;

exports.main = async (event) => {
  const cloudbase = require('@cloudbase/node-sdk');
  const sdkVersion = require('@cloudbase/node-sdk/package.json').version;
  const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
  const db = app.database();
  return createHandler({
    db,
    nodeVersion: process.version,
    sdkVersion,
  })(event);
};
