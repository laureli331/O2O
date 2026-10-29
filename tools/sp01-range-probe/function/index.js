'use strict';
const tcb = require('@cloudbase/node-sdk');
const { readRange } = require('./range-reader.cjs');
const { createHandler } = require('./handler');
const app = tcb.init({ env: 'cloud1-d2gjahlq39bf141c7' });
exports.main = createHandler({ app, readRange });
