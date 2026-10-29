'use strict';
const fs = require('node:fs');
const path = require('node:path');
const source = path.join(__dirname, 'function');
const destination = path.resolve(__dirname, '../../.local/sp01RangeProbe');
fs.mkdirSync(destination, { recursive: true });
for (const name of ['index.js', 'handler.js', 'package.json', 'package-lock.json']) {
  fs.copyFileSync(path.join(source, name), path.join(destination, name));
}
fs.copyFileSync(path.resolve(__dirname, '../sp01-storage-probe/range-reader.cjs'), path.join(destination, 'range-reader.cjs'));
console.log(JSON.stringify({ destination, functionName: 'sp01RangeProbe', cloudChanges: false }));
