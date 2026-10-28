'use strict';

// Local compatibility check. The child receives only synthetic context and has
// socket access blocked before loading the real locked SDK and function entry.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const worker = String.raw`
  const assert = require('assert').strict;
  let networkAttempts = 0;
  const denyNetwork = () => { networkAttempts += 1; throw new Error('NETWORK_DISABLED'); };
  require('net').Socket.prototype.connect = denyNetwork;
  require('tls').connect = denyNetwork;
  require('dgram').Socket.prototype.send = denyNetwork;
  global.fetch = denyNetwork;
  (async () => {
    const entry = require('./index.js');
    const event = { nonce: 'sp01-local-runtime-check' };
    const result = await entry.main(event);
    const expected = require('crypto').createHash('sha256')
      .update('wx2414399d423dfb65\0synthetic-local-account\0' + event.nonce)
      .digest('hex').slice(0, 24);
    assert.deepEqual(result, { success: true, fingerprint: expected, appMatchesTarget: true });
    process.env.WX_APPID = 'wx0000000000000000';
    assert.deepEqual(await entry.main(event), { success: false, errorCode: 'APP_ID_MISMATCH' });
    delete process.env.WX_CONTEXT_KEYS;
    await assert.rejects(entry.main(event), { code: 'IDENTITY_CONTEXT_MISSING' });
    console.log(JSON.stringify({
      nodeVersion: process.version, entryLoaded: true, syntheticContextVerified: true,
      wrongAppRejected: true, missingContextRejected: true, blockedNetworkAttempts: networkAttempts,
      wxSdkVersion: require('wx-server-sdk/package.json').version,
      cloudbaseSdkVersion: require('@cloudbase/node-sdk/package.json').version
    }));
  })().catch((error) => {
    // The entire process has synthetic inputs; still return only a bounded name/code.
    const safe = (value) => /^[A-Za-z0-9_:-]{1,60}$/.test(String(value)) ? String(value) : 'UNKNOWN';
    console.error(JSON.stringify({ success: false, name: safe(error.name), code: safe(error.code), networkAttempts }));
    process.exitCode = 1;
  });
`;

const result = spawnSync(process.argv[2] || process.execPath, ['-e', worker], {
  cwd: path.join(__dirname, 'cloudfunctions/sp01IdentityProbe'),
  encoding: 'utf8', timeout: 15000,
  env: {
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
    WX_CONTEXT_KEYS: 'WX_OPENID,WX_APPID',
    WX_OPENID: 'synthetic-local-account',
    WX_APPID: 'wx2414399d423dfb65',
    SCF_NAMESPACE: 'synthetic-local-environment',
  },
});
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) process.stderr.write(`Local runtime process failed: ${result.error.code}\n`);
process.exitCode = result.status === 0 ? 0 : 1;
