'use strict';

const fs = require('node:fs');
const path = require('node:path');

if (!process.env.RUNNER_TEMP) process.exitCode = 1;
else {
  for (const name of ['source.key.pem', 'source.csr.pem', 'source-manifest.json', 'egress-ip-manifest.json']) {
    const target = path.join(process.env.RUNNER_TEMP, name);
    try { fs.unlinkSync(target); } catch (error) { if (error.code !== 'ENOENT') process.exitCode = 1; }
  }
}
