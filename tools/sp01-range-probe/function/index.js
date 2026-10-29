'use strict';
// Keep the zero-I/O entry check independent of SDK initialization.
exports.main = async (event = {}) => {
  if (event.action === 'inspect') return {
    success: true, version: 'range-entry-v2', nodeVersion: process.version,
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
  } catch (_) { return { success: false, code: 'INITIALIZATION_FAILED', phase, writes: false }; }
  if (event.action === 'dependencies') return {
    success: true, version: 'range-entry-v2', dependenciesLoaded: true, writes: false,
  };
  return handler(event);
};
