'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { verifySourceMaterials, requireVerifiedSourceMaterials, buildSdkClients, awaitVerifiedCallerRun } = require('./tencentcloud-a303-api.cjs');
const { waitForReturnRun } = require('./csr-handoff.cjs');
const { runOperatorFlow } = require('./operator-flow.cjs');
const { validateTarget } = require('./tencentcloud-a303-api.cjs');
const { validateLifecycleTargets } = require('./server-lifecycle.cjs');
const localA = require('./a-segment-local.cjs');

const fail = (code) => { throw new Error(code); };
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const CONFIG_KEYS = 'actorId|actorLogin|caFingerprint256|expectedInput|journalPath|lifecycleTargets|notAfterMs|notBeforeMs|pwshPath|repository|repositoryId|securityTarget|serverInput|sourceRunId|target|trustedHeadSha|workflowPath|workflowRef';

function validateEntryConfig(config) {
  if (!record(config) || Object.keys(config).sort().join('|') !== CONFIG_KEYS) fail('operator-entry-config-fields-invalid');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repository)
    || !/^[0-9]+$/.test(config.repositoryId) || !/^[0-9]+$/.test(config.actorId)
    || typeof config.actorLogin !== 'string' || !/^[A-Za-z0-9-]+$/.test(config.actorLogin)
    || !/^[1-9][0-9]{0,19}$/.test(config.sourceRunId)
    || !/^\.github\/workflows\/[A-Za-z0-9_.-]+\.yml$/.test(config.workflowPath)
    || typeof config.workflowRef !== 'string' || !config.workflowRef.startsWith(`${config.repository}/${config.workflowPath}@refs/heads/`)
    || !/^refs\/heads\/[A-Za-z0-9_.\/-]{1,180}$/.test(config.workflowRef.slice(`${config.repository}/${config.workflowPath}@`.length))
    || !/^[a-f0-9]{40,64}$/.test(config.trustedHeadSha)
    || !/^[a-f0-9]{64}$/i.test(config.caFingerprint256)
    || !Number.isSafeInteger(config.notBeforeMs) || !Number.isSafeInteger(config.notAfterMs) || config.notAfterMs < config.notBeforeMs
    || typeof config.journalPath !== 'string' || !path.isAbsolute(config.journalPath)
    || typeof config.pwshPath !== 'string' || !path.isAbsolute(config.pwshPath)
    || typeof config.serverInput !== 'string' || !record(config.expectedInput)) fail('operator-entry-config-invalid');
  validateTarget(config.target); validateTarget(config.securityTarget); validateLifecycleTargets(config.lifecycleTargets);
  return config;
}

function checkOnly(config) {
  validateEntryConfig(config);
  let server;
  try { server = JSON.parse(config.serverInput); } catch { fail('operator-entry-server-input-invalid'); }
  const checkNow = Date.now();
  if (!record(server) || Object.keys(server).sort().join('|') !== 'authorization|authorizedUntil|bindIPv4|interfaceName|mode|policy|port'
    || server.mode !== 'start-approved' || typeof server.bindIPv4 !== 'string' || !localA.isPrivateIPv4(server.bindIPv4)
    || server.authorization !== 'explicit-temporary' || !Number.isSafeInteger(server.authorizedUntil)
    || server.authorizedUntil <= checkNow || server.authorizedUntil > checkNow + 15 * 60 * 1000 || server.port !== 8443
    || typeof server.interfaceName !== 'string' || !server.interfaceName || !record(server.policy)
    || !record(server.policy.expectedClaims) || !record(server.policy.expectedRequest)) fail('operator-entry-server-input-invalid');
  if (config.expectedInput.clbIPv4 !== server.policy.serverIPv4 || typeof config.expectedInput.clbIPv4 !== 'string') fail('operator-entry-public-target-mismatch');
  return Object.freeze({ state: 'check-only', readyToDispatch: false,
    message: '静态字段格式有效；check-only 不读取凭据、不构造 SDK 客户端、不联网，可信材料和运行时前置条件尚未验证。' });
}

async function runOperatorEntry(config, secrets, { enableExternalDispatch, fetchImpl = globalThis.fetch, callerFetchImpl = fetchImpl, now = Date.now, sleep, buildClients = buildSdkClients } = {}) {
  if (enableExternalDispatch !== true) fail('operator-entry-explicit-enable-required');
  validateEntryConfig(config);
  if (!record(secrets) || Object.keys(secrets).sort().join('|') !== 'credential|token'
    || !record(secrets.credential) || typeof secrets.credential.secretId !== 'string' || !secrets.credential.secretId
    || typeof secrets.credential.secretKey !== 'string' || !secrets.credential.secretKey
    || typeof secrets.token !== 'string' || secrets.token.length < 1 || secrets.token.length > 4096) fail('operator-entry-explicit-secrets-required');
  if (typeof fetchImpl !== 'function' || typeof buildClients !== 'function') fail('operator-entry-runtime-dependency-invalid');
  const expected = { repositoryId: config.repositoryId, actorId: config.actorId, actorLogin: config.actorLogin,
    workflowPath: config.workflowPath, workflowRef: config.workflowRef, trustedHeadSha: config.trustedHeadSha,
    sourceRunId: config.sourceRunId, notBeforeMs: config.notBeforeMs, notAfterMs: config.notAfterMs,
    caFingerprint256: config.caFingerprint256 };
  const materials = await verifySourceMaterials({ expected, token: secrets.token, repository: config.repository, fetchImpl, now, pwshPath: config.pwshPath });
  const verified = requireVerifiedSourceMaterials(materials);
  const branch = verified.workflowRef.slice(`${verified.repository}/${verified.workflowPath}@refs/heads/`.length);
  const clients = buildClients({ region: config.target.region, credential: secrets.credential });
  const deadline = Math.min(verified.sourceDeadline, verified.egressDeadline, verified.callerJobDeadline);
  return runOperatorFlow({ enableExternalDispatch: true, clients, target: config.target, lifecycleTargets: config.lifecycleTargets,
    securityTarget: config.securityTarget, verifiedMaterials: materials, serverInput: config.serverInput, expectedInput: config.expectedInput,
    journalPath: config.journalPath, token: secrets.token, fetchImpl, now, ...(sleep ? { sleep } : {}),
    awaitVerifiedReturnRun: async ({ deadline: callbackDeadline }) => {
      const boundedDeadline = Math.min(callbackDeadline, deadline, verified.sourceStartedAt + 300000);
      const budgetMs = boundedDeadline - now();
      if (!Number.isSafeInteger(budgetMs) || budgetMs <= 0) fail('operator-return-poll-deadline-expired');
      return waitForReturnRun({ token: secrets.token, repository: config.repository, workflowId: 'sp08-a3-03-csr-return.yml',
        expected: { workflowPath: '.github/workflows/sp08-a3-03-csr-return.yml', trustedHeadSha: verified.workflowSha,
          actorId: verified.actorId, actorLogin: verified.actorLogin, headBranch: branch,
          notBeforeMs: verified.sourceStartedAt, notAfterMs: boundedDeadline },
        budget: { maxPolls: 4, maxPages: 1, maxCandidates: 100, maxArtifactBytes: 65536, maxWaitMs: Math.min(300000, budgetMs),
          requestTimeoutMs: Math.min(30000, budgetMs), pollDelaysMs: [0, 90000, 90000, 90000].map((delay) => Math.min(delay, Math.floor(budgetMs / 3))) }, fetchImpl,
        deadline: boundedDeadline, now, ...(sleep ? { sleep } : {}) });
    },
    awaitCallerTlsCompletion: async ({ deadline: callbackDeadline }) => {
      const tlsDeadline = Math.min(callbackDeadline, verified.callerJobDeadline);
      if (now() >= tlsDeadline) fail('operator-caller-tls-deadline-expired');
      return awaitVerifiedCallerRun({ verifiedMaterials: materials, token: secrets.token, fetchImpl: callerFetchImpl, deadline: tlsDeadline, now, ...(sleep ? { sleep } : {}) });
    } });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--check-only') {
    process.stderr.write('仅支持：node operator-entry.cjs --check-only <公开JSON配置路径>\n'); process.exitCode = 2;
  } else {
    try { process.stdout.write(`${JSON.stringify(checkOnly(JSON.parse(fs.readFileSync(args[1], 'utf8'))))}\n`); }
    catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
  }
}

module.exports = { checkOnly, runOperatorEntry, validateEntryConfig };
