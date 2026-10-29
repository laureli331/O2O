'use strict';
// Keep the zero-I/O entry check independent of SDK initialization.
exports.main = async (event = {}) => {
  if (event.action === 'inspect') return {
    success: true, version: 'range-entry-v3', nodeVersion: process.version,
    writes: false, dependenciesLoaded: false,
  };
  if (!['dependencies', 'run'].includes(event.action)) return { success: false, code: 'INVALID_ACTION' };
  let phase = 'sdk-load';
  let handler;
  try {
    const tcb = require('@cloudbase/node-sdk');
    phase = 'helper-load';
    const { readRange } = require('./range-reader.cjs');
    const { createHandler } = require('./handler');
    phase = 'sdk-init';
    const app = tcb.init({ env: 'cloud1-d2gjahlq39bf141c7' });
    handler = createHandler({ app, readRange });
  } catch (error) {
    const errorCode = ['MODULE_NOT_FOUND', 'ERR_REQUIRE_ESM', 'ERR_PACKAGE_PATH_NOT_EXPORTED',
      'ERR_MODULE_NOT_FOUND', 'ERR_DLOPEN_FAILED', 'ERR_PACKAGE_IMPORT_NOT_DEFINED'].includes(error?.code)
      ? error.code : 'UNCLASSIFIED';
    const errorName = ['Error', 'SyntaxError', 'TypeError', 'ReferenceError', 'RangeError'].includes(error?.name)
      ? error.name : 'Error';
    const match = errorCode === 'MODULE_NOT_FOUND' && typeof error.message === 'string'
      ? /^Cannot find module '((?:@[a-z0-9._-]+\/)?[a-z0-9_-][a-z0-9._-]*)'/.exec(error.message) : null;
    return { success: false, version: 'range-entry-v3', code: 'INITIALIZATION_FAILED',
      phase, writes: false, errorCode, errorName, missingPackage: match ? match[1] : null };
  }
  if (event.action === 'dependencies') return {
    success: true, version: 'range-entry-v3', dependenciesLoaded: true, writes: false,
  };
  return handler(event);
};
