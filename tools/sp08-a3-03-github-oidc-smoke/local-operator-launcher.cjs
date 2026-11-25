'use strict';

const fs = require('node:fs');
const { runOperatorEntry, checkOnly } = require('./operator-entry.cjs');

const MAX_INPUT_BYTES = 32768;
const MAX_SECRET_CHARS = 8192;
const INPUT_TIMEOUT_MS = 30000;
const fail = (code) => { throw new Error(code); };

function validateSecretEnvelope(value, now = Date.now()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join('|') !== 'credential|expiration|token'
    || !value.credential || typeof value.credential !== 'object' || Array.isArray(value.credential)
    || Object.keys(value.credential).sort().join('|') !== 'secretId|secretKey|token'
    || typeof value.credential.secretId !== 'string' || !value.credential.secretId
    || typeof value.credential.secretKey !== 'string' || !value.credential.secretKey
    || typeof value.credential.token !== 'string' || !value.credential.token
    || typeof value.token !== 'string' || !value.token
    || typeof value.expiration !== 'string') fail('local-launcher-secret-fields-invalid');
  for (const secret of [value.credential.secretId, value.credential.secretKey, value.credential.token, value.token]) {
    if (secret.length > MAX_SECRET_CHARS || /[\r\n\0]/.test(secret)) fail('local-launcher-secret-value-invalid');
  }
  const expiration = Date.parse(value.expiration);
  if (!Number.isFinite(expiration) || expiration <= now) fail('local-launcher-credential-expired-or-invalid');
  return Object.freeze({ token: value.token, credential: Object.freeze({ secretId: value.credential.secretId, secretKey: value.credential.secretKey, token: value.credential.token }) });
}

async function readEnvelope(input, limit = MAX_INPUT_BYTES, timeoutMs = INPUT_TIMEOUT_MS) {
  const chunks = [];
  let size = 0;
  const iterator = input[Symbol.asyncIterator]();
  const deadline = Date.now() + timeoutMs;
  try {
    while (true) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) fail('local-launcher-input-timeout');
      let timer;
      const next = await Promise.race([iterator.next(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('local-launcher-input-timeout')), remaining); })]).finally(() => clearTimeout(timer));
      if (next.done) break;
      const chunk = Buffer.isBuffer(next.value) ? next.value : Buffer.from(next.value);
      size += chunk.length;
      if (size > limit) { input.destroy(); fail('local-launcher-input-too-large'); }
      chunks.push(chunk);
    }
  } catch (error) {
    input.destroy();
    if (error && typeof error.message === 'string' && /^local-launcher-input-(?:timeout|too-large)$/.test(error.message)) fail(error.message);
    fail('local-launcher-input-invalid');
  }
  let text;
  const bytes = Buffer.concat(chunks);
  try { text = bytes.toString('utf8'); return JSON.parse(text); } catch { fail('local-launcher-input-invalid'); }
  finally { bytes.fill(0); for (const chunk of chunks) chunk.fill(0); }
}

async function executeOnce({ config, envelope, now = Date.now, run = runOperatorEntry, check = checkOnly }) {
  check(config);
  const secrets = validateSecretEnvelope(envelope, now());
  return run(config, secrets, { enableExternalDispatch: true, now });
}

async function main(args, stdin = process.stdin, stdout = process.stdout, stderr = process.stderr, dependencies = {}) {
  if (args.length === 2 && args[0] === '--check-only' && require('node:path').isAbsolute(args[1])) {
    try { stdout.write(`${JSON.stringify((dependencies.check || checkOnly)(JSON.parse(fs.readFileSync(args[1], 'utf8'))))}\n`); return 0; }
    catch { stderr.write('公开配置检查失败。\n'); return 1; }
  }
  if (args.length !== 2 || args[0] !== '--run-once' || !require('node:path').isAbsolute(args[1])) {
    stderr.write('仅支持：node local-operator-launcher.cjs --run-once <绝对公开配置路径>\n'); return 2;
  }
  let envelope;
  try {
    const config = JSON.parse(fs.readFileSync(args[1], 'utf8'));
    envelope = await readEnvelope(stdin);
    const result = await executeOnce({ config, envelope, run: dependencies.run || runOperatorEntry, check: dependencies.check || checkOnly });
    if (!result || result.state !== 'tls-complete' || !/^[1-9][0-9]{0,19}$/.test(result.sourceRunId)) fail('local-launcher-result-invalid');
    stdout.write(`${JSON.stringify({ state: result.state, sourceRunId: result.sourceRunId })}\n`);
    return 0;
  } catch {
    stderr.write('本地启动失败；未输出异常详情或输入内容。\n'); return 1;
  } finally {
    if (envelope && envelope.credential) { envelope.credential.secretKey = ''; envelope.credential.secretId = ''; }
    if (envelope) envelope.token = '';
  }
}

if (require.main === module) main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, () => { process.stderr.write('本地启动失败。\n'); process.exitCode = 1; });

module.exports = { MAX_INPUT_BYTES, executeOnce, main, readEnvelope, validateSecretEnvelope };
