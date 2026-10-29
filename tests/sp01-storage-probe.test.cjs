'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const path = require('node:path');
const contract = require('../tools/sp01-storage-probe/miniprogram/utils/probe-contract');
const { createIdentityHandler } = require('../tools/sp01-storage-probe/cloudfunctions/sp01IdentityProbe/handler');
const identityContract = require('../tools/sp01-storage-probe/cloudfunctions/sp01IdentityProbe/identity-contract');
const { createProbeWorkflow } = require('../tools/sp01-storage-probe/miniprogram/utils/probe-workflow');

const nonce = 'sp01-check-20261028-a7c31e';
const ownerFingerprint = 'a'.repeat(24);
const otherFingerprint = 'b'.repeat(24);
const fileID = 'cloud://cloud1-d2gjahlq39bf141c7.636c-cloud1-d2gjahlq39bf141c7-1518394589/sp01_permission_probe/owner-probe-a7c31e.txt';
const cloudPath = 'sp01_permission_probe/owner-probe-a7c31e.txt';
const ownerContent = 'SP01-SYNTHETIC-OWNER:a7c31e';
const bundle = { version: 1, nonce, ownerFingerprint, fileID, cloudPath, ownerContent };

function loadProbePage(wx) {
  const pagePath = path.resolve(__dirname, '../tools/sp01-storage-probe/miniprogram/pages/index/index.js');
  let page;
  const pageModule = { exports: {} };
  vm.runInNewContext(fs.readFileSync(pagePath, 'utf8'), {
    require: createRequire(pagePath),
    module: pageModule,
    exports: pageModule.exports,
    Page: (definition) => { page = definition; },
    wx,
  }, { filename: pagePath });
  return page;
}

for (const scenario of [
  { name: 'matching content', response: { data: ownerContent }, expected: /内容与原证明一致/ },
  { name: 'changed content', response: { data: 'SP01-SYNTHETIC-OTHER:b5e209' }, expected: /内容已变化/ },
  { name: 'missing data', response: {}, expected: /内容未能核验/ },
  { name: 'non-text data', response: { data: new ArrayBuffer(4) }, expected: /内容未能核验/ },
  { name: 'read failure', failed: true, expected: /内容未能核验/ },
]) {
  test(`owner verification uses the readFile callback data: ${scenario.name}`, async () => {
    const page = loadProbePage({
      cloud: {
        callFunction: async () => ({ result: { success: true, fingerprint: ownerFingerprint, appMatchesTarget: true } }),
        downloadFile: async ({ fileID: requested }) => {
          assert.equal(requested, fileID);
          return { tempFilePath: '/tmp/owner-proof.txt', statusCode: 200 };
        },
      },
      getFileSystemManager: () => ({
        readFile: (options) => {
          assert.equal(options.encoding, 'utf8');
          assert.equal(options.filePath, '/tmp/owner-proof.txt');
          if (scenario.failed) options.fail({ errMsg: 'synthetic-read-failure' });
          else options.success(scenario.response);
        },
      }),
    });
    page.data = { ...page.data, bundleText: JSON.stringify(bundle) };
    page.setData = (update) => Object.assign(page.data, update);
    await page.verifyOwnerFile();
    assert.match(page.data.report, scenario.expected);
    assert.doesNotMatch(page.data.report, /SP01-SYNTHETIC|synthetic-read-failure/);
    assert.equal(page.data.busy, false);
  });
}

test('nonce, target file ID, synthetic path, and proof are constrained to this probe', () => {
  assert.equal(contract.validateNonce(nonce), true);
  for (const invalid of ['', 'short', 'contains spaces 123', 'x'.repeat(65), '真实姓名-测试码-2026']) {
    assert.equal(contract.validateNonce(invalid), false, `rejected nonce: ${invalid}`);
  }
  assert.equal(contract.validateOwnerBundle(bundle).valid, true);
  assert.equal(contract.validateOwnerBundle({ ...bundle, cloudPath: '../private/file.txt' }).valid, false);
  assert.equal(contract.validateOwnerBundle({ ...bundle, cloudPath: 'sp01_permission_probe/other.txt' }).valid, false);
  assert.equal(contract.validateOwnerBundle({ ...bundle, fileID: fileID.replace('cloud1-d2gjahlq39bf141c7', 'wrong-env') }).valid, false);
  assert.equal(contract.validateOwnerBundle({ ...bundle, ownerContent: 'personal data' }).valid, false);
});

test('same identity is gated before any storage call, different identity is allowed', () => {
  assert.deepEqual(contract.compareIdentity(ownerFingerprint, ownerFingerprint), { sameAccount: true, canProbe: false });
  assert.deepEqual(contract.compareIdentity(ownerFingerprint, otherFingerprint), { sameAccount: false, canProbe: true });
  assert.equal(contract.compareIdentity(ownerFingerprint, '').canProbe, false);
});

test('only explicit storage permission codes count as denial; missing or unknown errors stay inconclusive', () => {
  assert.equal(contract.classifyStorageError({ errCode: 'STORAGE_EXCEED_AUTHORITY' }).kind, 'denied');
  assert.equal(contract.classifyStorageError({ code: 'PERMISSION_DENIED' }).kind, 'denied');
  assert.equal(contract.classifyStorageError({ errCode: 'STORAGE_FILE_NONEXIST' }).kind, 'inconclusive');
  assert.equal(contract.classifyStorageError({ errMsg: 'permission denied' }).kind, 'inconclusive');
  assert.equal(contract.classifyStorageError({ errCode: 'NETWORK_ERROR' }).kind, 'inconclusive');
});

test('identity call errors retain only a safe provider code and request ID for diagnosis', async () => {
  const workflow = createProbeWorkflow({
    getIdentity: async () => {
      throw Object.assign(new Error('cloud.callFunction:fail'), {
        errCode: '-501000',
        requestId: 'request-12345678',
        errMsg: 'secret-token=must-not-escape',
      });
    },
  });
  await assert.rejects(workflow.identify(nonce), (error) => {
    assert.equal(error.code, 'IDENTITY_CALL_FAILED');
    assert.equal(error.providerCode, '-501000');
    assert.equal(error.requestId, 'request-12345678');
    assert.equal(JSON.stringify(error).includes('secret-token'), false);
    assert.equal(JSON.stringify(error).includes('cloud.callFunction'), false);
    return true;
  });
});

test('identity diagnostics preserve nested numeric codes and known markers without exposing the error text', () => {
  const diagnostics = contract.identityCallDiagnostics({
    errCode: -1,
    errMsg: 'Error: cloud.callFunction:fail Error: errCode: -504002 functions execute fail | errMsg: MODULE_NOT_FOUND secret-token=private-token',
    message: 'IDENTITY_CONTEXT_MISSING raw-openid-private',
    requestID: 'request-12345678',
  });
  assert.equal(diagnostics.providerCode, '-1');
  assert.equal(diagnostics.requestId, 'request-12345678');
  assert.deepEqual(diagnostics.nestedCodes, ['-504002']);
  assert.ok(diagnostics.markers.includes('MODULE_NOT_FOUND'));
  assert.ok(diagnostics.markers.includes('IDENTITY_CONTEXT_MISSING'));
  assert.doesNotMatch(JSON.stringify(diagnostics), /private|secret-token|cloud\.callFunction|functions execute fail/);
});

test('identity diagnostics do not guess codes from arbitrary numbers or partial tokens', () => {
  for (const error of [null, {}, { errMsg: 123 }, { message: 'openid: 12345; errCode: -504002secret; XMODULE_NOT_FOUNDY' }]) {
    const diagnostics = contract.identityCallDiagnostics(error);
    assert.deepEqual(diagnostics.nestedCodes, []);
    assert.deepEqual(diagnostics.markers, []);
  }
  const diagnostics = contract.identityCallDiagnostics({
    errMsg: 'errCode: -504002 | errCode: -504002 | errCode: -501000',
    requestId: 'unsafe token with spaces',
  });
  assert.deepEqual(diagnostics.nestedCodes, ['-504002', '-501000']);
  assert.equal(diagnostics.requestId, null);
});

test('identity-only page action makes exactly one call and never creates a file or shares an identity', async () => {
  let calls = 0;
  let release;
  const wx = { cloud: { callFunction: async (options) => {
    calls += 1;
    assert.equal(options.name, 'sp01IdentityProbe');
    assert.equal(contract.validateNonce(options.data.nonce), true);
    await new Promise((resolve) => { release = resolve; });
    return { result: { success: true, fingerprint: ownerFingerprint, appMatchesTarget: true } };
  } } };
  // No file-system or storage APIs: any accidental access makes this test fail.
  const page = loadProbePage(wx);
  page.setData = (update) => Object.assign(page.data, update);
  const pending = page.checkIdentityOnly();
  await page.checkIdentityOnly();
  assert.equal(calls, 1);
  release();
  await pending;
  assert.match(page.data.report, /身份调用成功/);
  assert.doesNotMatch(page.data.report, new RegExp(ownerFingerprint));
  assert.equal(page.data.bundleText, '');
  assert.equal(page.data.busy, false);
});

test('identity-only page action reports nested failure safely, releases busy state, and does not retry', async () => {
  let calls = 0;
  const page = loadProbePage({ cloud: { callFunction: async () => {
    calls += 1;
    throw { errCode: -1, errMsg: 'errCode: -504002 | MODULE_NOT_FOUND private-token' };
  } } });
  page.setData = (update) => Object.assign(page.data, update);
  await page.checkIdentityOnly();
  assert.equal(calls, 1);
  assert.equal(page.data.busy, false);
  assert.equal(page.data.bundleText, '');
  assert.match(page.data.report, /-504002/);
  assert.match(page.data.report, /MODULE_NOT_FOUND/);
  assert.doesNotMatch(page.data.report, /private-token/);
});

test('standalone project targets the confirmed AppID and EnvID without sharing the QuickStart root', () => {
  const root = path.resolve(__dirname, '../tools/sp01-storage-probe');
  const config = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'));
  const app = fs.readFileSync(path.join(root, 'miniprogram/app.js'), 'utf8');
  const clientContract = require('../tools/sp01-storage-probe/miniprogram/utils/probe-contract');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'cloudfunctions/sp01IdentityProbe/package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'cloudfunctions/sp01IdentityProbe/package-lock.json'), 'utf8'));
  const functionDir = path.join(root, 'cloudfunctions/sp01IdentityProbe');
  const entry = fs.readFileSync(path.join(functionDir, 'index.js'), 'utf8');
  assert.equal(config.appid, 'wx2414399d423dfb65');
  assert.equal(identityContract.TARGET_APP_ID, config.appid);
  assert.equal(config.cloudfunctionRoot, 'cloudfunctions/');
  assert.match(app, /TARGET_ENV_ID/);
  assert.equal(clientContract.TARGET_ENV_ID, 'cloud1-d2gjahlq39bf141c7');
  assert.equal(identityContract.validateNonce(nonce), clientContract.validateNonce(nonce));
  const pageMarkup = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxml'), 'utf8');
  assert.doesNotMatch(pageMarkup, /bindinput="onNonceInput"/);
  assert.equal(packageJson.main, 'index.js');
  assert.equal(packageJson.dependencies['wx-server-sdk'], '4.0.2');
  assert.equal(lock.packages['node_modules/wx-server-sdk'].version, '4.0.2');
  assert.ok(Object.values(lock.packages).filter((item) => item.resolved).every((item) => item.resolved.startsWith('https://registry.npmjs.org/')));
  for (const [, relative] of entry.matchAll(/require\(['"](\.\/[^'"]+)['"]\)/g)) {
    assert.ok(fs.existsSync(path.resolve(functionDir, relative + (path.extname(relative) ? '' : '.js'))));
  }
  assert.doesNotMatch(entry, /\.\.\//);
});

test('probe README reflects the latest log-settings inspection instead of asking for a completed check', () => {
  const readme = fs.readFileSync(path.resolve(__dirname, '../tools/sp01-storage-probe/README.md'), 'utf8');
  assert.ok(readme.includes('投递到 CLS'));
  assert.ok(readme.includes('Nodejs16.13'));
  assert.ok(readme.includes('失败根因仍未确认'));
  assert.ok(!readme.includes('下一步先只读核对日志筛选与配置可见性'));
});

test('identity handler hashes only trusted per-request WX context and never returns raw identifiers', async () => {
  const trustedOpenId = 'raw-openid-must-never-escape';
  const handler = createIdentityHandler({
    getWXContext: () => ({ OPENID: trustedOpenId, APPID: 'wx2414399d423dfb65' }),
    expectedAppId: 'wx2414399d423dfb65',
    createHash: crypto.createHash,
  });
  const first = await handler({ nonce, OPENID: 'attacker-controlled-event-value' });
  const second = await handler({ nonce });
  assert.deepEqual(first, second);
  assert.equal(first.success, true);
  assert.match(first.fingerprint, /^[a-f0-9]{24}$/);
  assert.equal(first.appMatchesTarget, true);
  assert.equal(JSON.stringify(first).includes(trustedOpenId), false);
  assert.equal(JSON.stringify(first).includes('attacker-controlled-event-value'), false);
  assert.notEqual((await handler({ nonce: `${nonce}-different` })).fingerprint, first.fingerprint);
});

test('identity handler rejects invalid nonce and unavailable or mismatched WX context without leaking it', async () => {
  const noContext = createIdentityHandler({ getWXContext: () => ({}), expectedAppId: 'wx2414399d423dfb65', createHash: crypto.createHash });
  await assert.rejects(noContext({ nonce }), { code: 'IDENTITY_CONTEXT_MISSING' });
  await assert.rejects(noContext({ nonce: 'too-short' }), { code: 'INVALID_NONCE' });
  const wrongApp = createIdentityHandler({ getWXContext: () => ({ OPENID: 'private', APPID: 'wx0000000000000000' }), expectedAppId: 'wx2414399d423dfb65', createHash: crypto.createHash });
  assert.deepEqual(await wrongApp({ nonce }), { success: false, errorCode: 'APP_ID_MISMATCH' });
});

test('owner file creation uses a unique probe path and always removes its local temporary file', async () => {
  const calls = [];
  const api = {
    getIdentity: async () => ({ success: true, fingerprint: ownerFingerprint, appMatchesTarget: true }),
    createLocalTextFile: async (text) => { calls.push(['createLocalTextFile', text]); return '/tmp/probe.txt'; },
    uploadFile: async (path, localPath) => { calls.push(['uploadFile', path, localPath]); return { fileID }; },
    removeLocalFile: async (localPath) => calls.push(['removeLocalFile', localPath]),
    makeRunId: () => 'a7c31e',
  };
  const created = await createProbeWorkflow(api).createOwnerFile(nonce);
  assert.deepEqual(calls.map(([name]) => name), ['createLocalTextFile', 'uploadFile', 'removeLocalFile']);
  assert.equal(created.ownerFingerprint, ownerFingerprint);
  assert.equal(created.cloudPath, cloudPath);
  assert.equal(created.ownerContent, ownerContent);
  assert.equal(contract.validateOwnerBundle(created).valid, true);
});

test('failed owner upload still removes the local temporary file and does not return a share bundle', async () => {
  const calls = [];
  const workflow = createProbeWorkflow({
    getIdentity: async () => ({ success: true, fingerprint: ownerFingerprint, appMatchesTarget: true }),
    createLocalTextFile: async () => '/tmp/probe.txt',
    uploadFile: async () => { throw Object.assign(new Error('network down'), { errCode: 'NETWORK_ERROR' }); },
    removeLocalFile: async (path) => calls.push(path),
    makeRunId: () => 'a7c31e',
  });
  await assert.rejects(workflow.createOwnerFile(nonce), (error) => {
    assert.equal(error.code, 'OWNER_UPLOAD_FAILED');
    assert.equal(error.cloudPath, cloudPath);
    return true;
  });
  assert.deepEqual(calls, ['/tmp/probe.txt']);
});

test('local temporary file creation failure does not attempt an upload or claim a cloud orphan', async () => {
  let uploads = 0;
  const workflow = createProbeWorkflow({
    getIdentity: async () => ({ success: true, fingerprint: ownerFingerprint, appMatchesTarget: true }),
    createLocalTextFile: async () => { throw Object.assign(new Error('disk full'), { code: 'IO_ERROR' }); },
    uploadFile: async () => { uploads += 1; return { fileID }; },
    makeRunId: () => 'a7c31e',
  });
  await assert.rejects(workflow.createOwnerFile(nonce), { code: 'LOCAL_TEMP_CREATE_FAILED' });
  assert.equal(uploads, 0);
});

test('unknown upload outcome retains the exact path and local cleanup failure without broad deletion', async () => {
  const deleted = [];
  const workflow = createProbeWorkflow({
    getIdentity: async () => ({ success: true, fingerprint: ownerFingerprint, appMatchesTarget: true }),
    createLocalTextFile: async () => '/tmp/probe.txt',
    uploadFile: async () => { throw Object.assign(new Error('network lost after request'), { errCode: 'NETWORK_ERROR' }); },
    removeLocalFile: async () => { throw Object.assign(new Error('unlink failed'), { code: 'IO_ERROR' }); },
    deleteFile: async (id) => { deleted.push(id); return { fileList: [{ fileID: id, status: 0 }] }; },
    makeRunId: () => 'a7c31e',
  });
  await assert.rejects(workflow.createOwnerFile(nonce), (error) => {
    assert.equal(error.code, 'OWNER_UPLOAD_FAILED');
    assert.equal(error.cloudPath, cloudPath);
    assert.equal(error.localTempCleanup, 'cleanup-failed');
    return true;
  });
  assert.deepEqual(deleted, []);
});

test('owner creation aborts sharing and deletes only its uploaded cloud file when local scratch cleanup fails', async () => {
  const deleted = [];
  const workflow = createProbeWorkflow({
    getIdentity: async () => ({ success: true, fingerprint: ownerFingerprint, appMatchesTarget: true }),
    createLocalTextFile: async () => '/tmp/probe.txt',
    uploadFile: async () => ({ fileID }),
    removeLocalFile: async () => { throw Object.assign(new Error('unlink failed'), { code: 'IO_ERROR' }); },
    deleteFile: async (id) => { deleted.push(id); return { fileList: [{ fileID: id, status: 0 }] }; },
    makeRunId: () => 'a7c31e',
  });
  await assert.rejects(workflow.createOwnerFile(nonce), { code: 'LOCAL_TEMP_CLEANUP_FAILED' });
  assert.deepEqual(deleted, [fileID]);
});

test('owner creation reports the exact cloud path when local or cloud cleanup cannot be confirmed', async () => {
  const workflow = createProbeWorkflow({
    getIdentity: async () => ({ success: true, fingerprint: ownerFingerprint, appMatchesTarget: true }),
    createLocalTextFile: async () => '/tmp/probe.txt',
    uploadFile: async () => ({ fileID }),
    removeLocalFile: async () => { throw Object.assign(new Error('unlink failed'), { code: 'IO_ERROR' }); },
    deleteFile: async () => ({ fileList: [{ fileID, status: '0' }] }),
    makeRunId: () => 'a7c31e',
  });
  await assert.rejects(workflow.createOwnerFile(nonce), (error) => {
    assert.equal(error.code, 'OWNER_CLEANUP_PENDING');
    assert.equal(error.cloudPath, cloudPath);
    assert.equal(error.fileID, fileID);
    return true;
  });
});

test('owner page clears any stale share bundle and reports cleanup failure without allowing a stale copy', async () => {
  const wx = {
    env: { USER_DATA_PATH: '/user-data' },
    cloud: {
      callFunction: async () => ({ result: { success: true, fingerprint: ownerFingerprint, appMatchesTarget: true } }),
      uploadFile: async (options) => ({ fileID: `cloud://cloud1-d2gjahlq39bf141c7.636c-cloud1-d2gjahlq39bf141c7-1518394589/${options.cloudPath}` }),
      deleteFile: async (options) => ({ fileList: [{ fileID: options.fileList[0], status: 0 }] }),
    },
    getFileSystemManager: () => ({
      writeFile: (options) => options.success(),
      unlink: (options) => options.fail({ errMsg: 'synthetic unlink failure' }),
    }),
  };
  const page = loadProbePage(wx);
  page.data = { ...page.data, nonce, bundleText: JSON.stringify(bundle) };
  page.setData = (update) => Object.assign(page.data, update);
  page.generateNonce();
  assert.equal(page.data.bundleText, '');
  page.data.bundleText = JSON.stringify(bundle);
  await page.createOwnerFile();
  assert.equal(page.data.bundleText, '');
  assert.match(page.data.report, /本机临时文件清理失败/);
  assert.match(page.data.report, /云端测试文件已确认删除/);
});

test('owner page distinguishes local file creation failure and never attempts upload', async () => {
  let uploads = 0;
  const wx = {
    env: { USER_DATA_PATH: '/user-data' },
    cloud: {
      callFunction: async () => ({ result: { success: true, fingerprint: ownerFingerprint, appMatchesTarget: true } }),
      uploadFile: async () => { uploads += 1; return { fileID }; },
    },
    getFileSystemManager: () => ({
      writeFile: (options) => options.fail({ errMsg: 'synthetic disk full' }),
      unlink: () => { throw new Error('must not unlink a file that was not created'); },
    }),
  };
  const page = loadProbePage(wx);
  page.data = { ...page.data, nonce, bundleText: JSON.stringify(bundle) };
  page.setData = (update) => Object.assign(page.data, update);
  await page.createOwnerFile();
  assert.equal(uploads, 0);
  assert.equal(page.data.bundleText, '');
  assert.match(page.data.report, /未能创建本机合成临时文件，尚未尝试上传/);
  assert.doesNotMatch(page.data.report, new RegExp(cloudPath));
});

test('owner page reports safe identity call diagnostics without raw provider text', async () => {
  const wx = {
    env: { USER_DATA_PATH: '/user-data' },
    cloud: {
      callFunction: async () => {
        throw Object.assign(new Error('cloud.callFunction:fail'), {
          errCode: '-501000',
          requestId: 'request-12345678',
          errMsg: 'secret-token=must-not-escape',
        });
      },
    },
    getFileSystemManager: () => ({
      writeFile: () => { throw new Error('identity failure must happen before local file creation'); },
      unlink: () => { throw new Error('no local file should exist'); },
    }),
  };
  const page = loadProbePage(wx);
  page.data = { ...page.data, nonce };
  page.setData = (update) => Object.assign(page.data, update);
  await page.createOwnerFile();
  assert.match(page.data.report, /IDENTITY_CALL_FAILED/);
  assert.match(page.data.report, /-501000/);
  assert.match(page.data.report, /request-12345678/);
  assert.doesNotMatch(page.data.report, /secret-token|cloud\.callFunction/);
  assert.equal(page.data.bundleText, '');
});

test('other-account storage probe refuses same identity before read, link, download, or write', async () => {
  const calls = [];
  const workflow = createProbeWorkflow({
    getIdentity: async () => { calls.push('identity'); return { success: true, fingerprint: ownerFingerprint, appMatchesTarget: true }; },
    getTempFileURL: async () => calls.push('tempURL'),
    downloadFile: async () => calls.push('download'),
    uploadFile: async () => calls.push('overwrite'),
  });
  const result = await workflow.testAsOther(bundle);
  assert.equal(result.overall, 'same-account-stop');
  assert.equal(result.identity.sameAccount, true);
  assert.deepEqual(calls, ['identity']);
});

test('other-account probe checks link, direct read, and overwrite sequentially, hides URLs/content, and cleans successful overwrite', async () => {
  const calls = [];
  const workflow = createProbeWorkflow({
    getIdentity: async () => { calls.push('identity'); return { success: true, fingerprint: otherFingerprint, appMatchesTarget: true }; },
    getTempFileURL: async (id) => { calls.push(['tempURL', id]); return { fileList: [{ tempFileURL: 'https://temporary-secret.invalid/signed' }] }; },
    downloadFile: async (id) => { calls.push(['download', id]); return { tempFilePath: '/tmp/download.txt', statusCode: 200 }; },
    readDownloadedText: async () => ownerContent,
    createLocalTextFile: async (text) => { calls.push(['createLocalTextFile', text]); return '/tmp/other.txt'; },
    uploadFile: async (path, localPath) => { calls.push(['upload', path, localPath]); return { fileID }; },
    removeLocalFile: async (path) => calls.push(['removeLocalFile', path]),
    deleteFile: async (id) => { calls.push(['delete', id]); return { fileList: [{ fileID: id, status: 0 }] }; },
    makeRunId: () => 'b5e209',
  });
  const result = await workflow.testAsOther(bundle);
  assert.deepEqual(calls.map((entry) => Array.isArray(entry) ? entry[0] : entry), [
    'identity', 'tempURL', 'download', 'createLocalTextFile', 'upload', 'delete', 'removeLocalFile',
  ]);
  assert.equal(result.identity.sameAccount, false);
  assert.equal(result.read.tempLink.kind, 'accessible');
  assert.equal(result.read.direct.kind, 'accessible');
  assert.equal(result.read.direct.matchesOwnerProof, true);
  assert.equal(result.overwrite.kind, 'accessible');
  assert.equal(result.overwrite.cleanup.kind, 'deleted');
  assert.equal(JSON.stringify(result).includes('temporary-secret'), false);
  assert.equal(JSON.stringify(result).includes(ownerContent), false);
});

test('same-path overwrite errors are classified conservatively and unknown errors do not claim isolation', async () => {
  const workflow = createProbeWorkflow({
    getIdentity: async () => ({ success: true, fingerprint: otherFingerprint, appMatchesTarget: true }),
    getTempFileURL: async () => { throw { errCode: 'STORAGE_FILE_NONEXIST' }; },
    downloadFile: async () => { throw { errCode: 'NETWORK_ERROR' }; },
    createLocalTextFile: async () => '/tmp/other.txt',
    uploadFile: async () => { throw { errCode: 'NETWORK_ERROR' }; },
    removeLocalFile: async () => {},
    makeRunId: () => 'b5e209',
  });
  const result = await workflow.testAsOther(bundle);
  assert.equal(result.read.tempLink.kind, 'inconclusive');
  assert.equal(result.read.direct.kind, 'inconclusive');
  assert.equal(result.overwrite.kind, 'inconclusive');
  assert.equal(result.overall, 'inconclusive');
});

test('successful overwrite whose exact-file cleanup fails is surfaced as unresolved', async () => {
  const workflow = createProbeWorkflow({
    getIdentity: async () => ({ success: true, fingerprint: otherFingerprint, appMatchesTarget: true }),
    getTempFileURL: async () => ({ fileList: [{ status: 'PERMISSION_DENIED' }] }),
    downloadFile: async () => { throw { errCode: 'STORAGE_EXCEED_AUTHORITY' }; },
    createLocalTextFile: async () => '/tmp/other.txt',
    uploadFile: async () => ({ fileID }),
    removeLocalFile: async () => {},
    deleteFile: async () => { throw { errCode: 'NETWORK_ERROR' }; },
    makeRunId: () => 'b5e209',
  });
  const result = await workflow.testAsOther(bundle);
  assert.equal(result.overwrite.kind, 'accessible');
  assert.equal(result.overwrite.cleanup.kind, 'cleanup-pending');
  assert.equal(result.overall, 'failed-cleanup');
});

test('failed local scratch cleanup is surfaced and prevents a clean result', async () => {
  const workflow = createProbeWorkflow({
    getIdentity: async () => ({ success: true, fingerprint: otherFingerprint, appMatchesTarget: true }),
    getTempFileURL: async () => ({ fileList: [{ errCode: 'STORAGE_EXCEED_AUTHORITY' }] }),
    downloadFile: async () => { throw { errCode: 'PERMISSION_DENIED' }; },
    createLocalTextFile: async () => '/tmp/other.txt',
    uploadFile: async () => { throw { errCode: 'REQUEST_FORBIDDEN' }; },
    removeLocalFile: async () => { throw { errCode: 'LOCAL_DELETE_FAILED' }; },
    makeRunId: () => 'b5e209',
  });
  const result = await workflow.testAsOther(bundle);
  assert.equal(result.overwrite.kind, 'denied');
  assert.equal(result.overwrite.localTempCleanup, 'cleanup-pending');
  assert.equal(result.overall, 'failed-cleanup');
});

test('owner cleanup accepts only a valid bundle and deletes only its exact file ID', async () => {
  const calls = [];
  const workflow = createProbeWorkflow({
    getIdentity: async () => ({ success: true, fingerprint: ownerFingerprint, appMatchesTarget: true }),
    deleteFile: async (id) => { calls.push(id); return { fileList: [{ fileID: id, status: 0 }] }; },
  });
  const result = await workflow.cleanupOwnerFile(bundle);
  assert.equal(result.kind, 'deleted');
  assert.deepEqual(calls, [fileID]);
  await assert.rejects(workflow.cleanupOwnerFile({ ...bundle, cloudPath: 'sp01_permission_probe/other.txt' }), { code: 'INVALID_OWNER_BUNDLE' });
  assert.deepEqual(calls, [fileID]);
});

test('all three explicit denials are reported as isolated only for this disposable test', async () => {
  const workflow = createProbeWorkflow({
    getIdentity: async () => ({ success: true, fingerprint: otherFingerprint, appMatchesTarget: true }),
    getTempFileURL: async () => ({ fileList: [{ errCode: 'STORAGE_EXCEED_AUTHORITY' }] }),
    downloadFile: async () => { throw { errCode: 'PERMISSION_DENIED' }; },
    createLocalTextFile: async () => '/tmp/other.txt',
    uploadFile: async () => { throw { errCode: 'REQUEST_FORBIDDEN' }; },
    removeLocalFile: async () => {},
    makeRunId: () => 'b5e209',
  });
  const result = await workflow.testAsOther(bundle);
  assert.equal(result.overall, 'isolated-in-this-test');
});

test('owner verification and deletion require a fresh matching identity', async () => {
  const calls = [];
  const ownerWorkflow = createProbeWorkflow({
    getIdentity: async () => ({ success: true, fingerprint: ownerFingerprint, appMatchesTarget: true }),
    downloadFile: async (id) => { calls.push(['download', id]); return { tempFilePath: '/tmp/owner.txt', statusCode: 200 }; },
    readDownloadedText: async () => ownerContent,
    deleteFile: async (id) => { calls.push(['delete', id]); return { fileList: [{ fileID: id, status: 0 }] }; },
  });
  assert.deepEqual(await ownerWorkflow.verifyOwnerFile(bundle), { kind: 'accessible', matchesOwnerProof: true });
  assert.deepEqual(await ownerWorkflow.cleanupOwnerFile(bundle), { kind: 'deleted' });
  assert.deepEqual(calls, [['download', fileID], ['delete', fileID]]);

  const otherWorkflow = createProbeWorkflow({
    getIdentity: async () => ({ success: true, fingerprint: otherFingerprint, appMatchesTarget: true }),
    downloadFile: async () => { calls.push(['unexpected-download']); },
    deleteFile: async () => { calls.push(['unexpected-delete']); },
  });
  await assert.rejects(otherWorkflow.verifyOwnerFile(bundle), { code: 'NOT_OWNER_ACCOUNT' });
  await assert.rejects(otherWorkflow.cleanupOwnerFile(bundle), { code: 'NOT_OWNER_ACCOUNT' });
  assert.deepEqual(calls, [['download', fileID], ['delete', fileID]]);
});
