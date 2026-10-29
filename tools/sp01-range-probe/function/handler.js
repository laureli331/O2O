'use strict';
const crypto = require('node:crypto');
const ENV = 'cloud1-d2gjahlq39bf141c7';
const BUCKET = '636c-cloud1-d2gjahlq39bf141c7-1518394589';
const DIRECTORY = 'sp01_range_probe/';
const SIZE = 5 * 1024 * 1024;

// Isolated diagnostic authorization seam. resolveGrant must use trusted server metadata.
function createGuardedReader({ chunkBytes, responseLimitBytes, resolveGrant, readRange }) {
  if (![chunkBytes, responseLimitBytes].every((n) => Number.isSafeInteger(n) && n > 0)) throw RangeError('INVALID_LIMITS');
  const fields = ['fileKey', 'version', 'authorizationVersion', 'url', 'expectedHost', 'etag'];
  const valid = (g) => g?.allowed === true && fields.every((key) => typeof g[key] === 'string' && g[key].length > 0)
    && Number.isSafeInteger(g.totalBytes) && g.totalBytes > 0;
  const fail = (code) => ({ success: false, code });
  return async (trustedActor, input) => {
    if (!trustedActor || typeof trustedActor.id !== 'string' || !trustedActor.id) return fail('UNAUTHENTICATED');
    if (!input || typeof input.objectId !== 'string' || !input.objectId || typeof input.version !== 'string' || !input.version
      || !Number.isSafeInteger(input.index) || input.index < 0) return fail('INVALID_INPUT');
    const actor = Object.freeze({ id: trustedActor.id });
    const request = Object.freeze({ objectId: input.objectId, version: input.version, index: input.index });
    try {
      const resolved = await resolveGrant(actor, request.objectId);
      if (!valid(resolved)) return fail('FORBIDDEN');
      const grant = Object.freeze({ ...resolved });
      if (grant.version !== request.version) return fail('VERSION_CONFLICT');
      const start = request.index * chunkBytes;
      if (!Number.isSafeInteger(start) || start >= grant.totalBytes) return fail('INVALID_RANGE');
      const end = Math.min(start + chunkBytes - 1, grant.totalBytes - 1);
      const bytes = await readRange({ url: grant.url, expectedHost: grant.expectedHost, totalBytes: grant.totalBytes,
        etag: grant.etag, start, end, timeoutMs: 10000 });
      if (!Buffer.isBuffer(bytes) || bytes.length !== end - start + 1) return fail('READ_UNCONFIRMED');
      const current = await resolveGrant(actor, request.objectId);
      if (!valid(current)) return fail('FORBIDDEN');
      if ([...fields, 'totalBytes'].some((key) => current[key] !== grant[key])) return fail('VERSION_CONFLICT');
      const response = { success: true, version: grant.version, index: request.index,
        totalBytes: grant.totalBytes, data: bytes.toString('base64') };
      if (Buffer.byteLength(JSON.stringify(response)) > responseLimitBytes) return fail('RESPONSE_TOO_LARGE');
      return response;
    } catch (error) {
      return fail(error?.statusCode === 206 && error?.reason === 'ETAG_MISMATCH' ? 'VERSION_CONFLICT' : 'UNCONFIRMED');
    }
  };
}

async function runGuardedCases({ fileID, url, expectedHost, etag, content, readRange }) {
  const chunkBytes = 256 * 1024;
  const responseLimitBytes = 512 * 1024; // Diagnostic envelope limit, not a product performance budget.
  const base = { allowed: true, fileKey: fileID, version: 'v1', authorizationVersion: 'a1', url, expectedHost, etag, totalBytes: content.length };
  const input = { objectId: 'synthetic-object', version: 'v1', index: 0 };
  const setup = (mode = 'normal') => {
    const state = { ...base };
    if (mode === 'wrong-response-version') state.etag = '"synthetic-wrong-version"';
    let reads = 0;
    let sourceBytes = 0;
    const reader = createGuardedReader({ chunkBytes, responseLimitBytes,
      resolveGrant: async (actor, objectId) => actor.id === 'synthetic-A' && objectId === input.objectId ? state : null,
      readRange: async (options) => {
        reads++;
        const bytes = await readRange(options);
        sourceBytes += bytes.length;
        if (mode === 'revoke-during-read') state.allowed = false;
        if (mode === 'version-during-read') state.version = 'v2';
        return bytes;
      },
    });
    return { reader, reads: () => reads, sourceBytes: () => sourceBytes };
  };
  const actor = { id: 'synthetic-A' };
  const normal = setup();
  const digest = crypto.createHash('sha256');
  let fullContentMatch = true;
  let maxResponseBytes = 0;
  const chunkCount = Math.ceil(content.length / chunkBytes);
  for (let index = 0; index < chunkCount; index++) {
    const result = await normal.reader(actor, { ...input, index });
    if (!result.success) throw Error('GUARDED_NORMAL_FAILED');
    const bytes = Buffer.from(result.data, 'base64');
    fullContentMatch = fullContentMatch && bytes.equals(content.subarray(index * chunkBytes, (index + 1) * chunkBytes));
    digest.update(bytes);
    maxResponseBytes = Math.max(maxResponseBytes, Buffer.byteLength(JSON.stringify(result)));
  }
  fullContentMatch = fullContentMatch && digest.digest('hex') === crypto.createHash('sha256').update(content).digest('hex');
  const cases = [];
  for (const [name, identity, request, code, reads] of [
    ['unauthorized-B', { id: 'synthetic-B' }, { ...input, actor: 'synthetic-A', role: 'admin', fileKey: fileID }, 'FORBIDDEN', 0],
    ['stale-request-version', actor, { ...input, version: 'old' }, 'VERSION_CONFLICT', 0],
    ['revoke-during-read', actor, input, 'FORBIDDEN', 1],
    ['version-during-read', actor, input, 'VERSION_CONFLICT', 1],
    ['wrong-response-version', actor, input, 'VERSION_CONFLICT', 1],
  ]) {
    const f = setup(name);
    const result = await f.reader(identity, request);
    const noContent = !Object.hasOwn(result, 'data');
    cases.push({ name, code: result.code || 'UNEXPECTED_SUCCESS', sourceRequests: f.reads(), noContent,
      passed: result.success === false && result.code === code && noContent && f.reads() === reads });
  }
  const repeated = setup();
  const first = await repeated.reader(actor, input);
  const again = await repeated.reader(actor, input);
  cases.push({ name: 'repeat-read', passed: first.success === true && again.success === true && first.data === again.data });
  const simultaneous = setup();
  const [a, b] = await Promise.all([simultaneous.reader(actor, input), simultaneous.reader({ id: 'synthetic-B' }, input)]);
  cases.push({ name: 'concurrent-A-B', passed: a.success === true && b.code === 'FORBIDDEN'
    && !Object.hasOwn(b, 'data') && simultaneous.reads() === 1 });
  return { fullContentMatch, chunkCount, normalSourceRequests: normal.reads(), normalSourceBytes: normal.sourceBytes(),
    maxResponseBytes, responseLimitBytes, cases };
}

// Temporary console-operated synthetic transport test; no user identity/permission conclusion.
function createHandler({ app, readRange, randomId = () => crypto.randomBytes(16).toString('hex'), now = Date.now }) {
  return async (event = {}) => {
    if (event.action === 'inspect') return { success: true, version: 'range-probe-v2', nodeVersion: process.version, writes: false };
    if (event.action !== 'run') return { success: false, code: 'INVALID_ACTION' };
    const id = randomId();
    if (!/^[a-f0-9]{32}$/.test(id)) return { success: false, code: 'INVALID_RUN_ID' };
    const cloudPath = `${DIRECTORY}range-${id}.bin`;
    const fileID = `cloud://${ENV}.${BUCKET}/${cloudPath}`;
    const content = Buffer.alloc(SIZE);
    for (let i = 0; i < SIZE; i++) content[i] = i % 251;
    const etag = `"${crypto.createHash('md5').update(content).digest('hex')}"`;
    const report = { success: false, version: 'range-probe-v2', cloudPath, binaryBytes: SIZE, ranges: [], cleanupConfirmed: false };
    let uploadAttempted = false;
    let phase = 'upload';
    try {
      uploadAttempted = true;
      const upload = await app.uploadFile({ cloudPath, fileContent: content });
      if (upload?.fileID !== fileID) throw Error('UPLOAD_UNCONFIRMED');
      phase = 'url';
      const urls = await app.getTempFileURL({ fileList: [{ fileID, maxAge: 600 }] });
      const item = urls?.fileList?.find((entry) => entry.fileID === fileID);
      if (item?.code !== 'SUCCESS' || typeof item.tempFileURL !== 'string') throw Error('URL_UNCONFIRMED');
      const parsed = new URL(item.tempFileURL);
      // Fixed environment binding; never accept a URL supplied by the event.
      if (parsed.protocol !== 'https:' || !parsed.hostname.startsWith(`${BUCKET}.`)
        || !['.tcb.qcloud.la', '.myqcloud.com'].some((suffix) => parsed.hostname.endsWith(suffix))) throw Error('URL_HOST_UNCONFIRMED');
      const options = { url: item.tempFileURL, expectedHost: parsed.hostname, totalBytes: SIZE, etag, timeoutMs: 10000 };
      if (event.mode === 'guarded') {
        phase = 'guarded-ranges';
        report.version = 'guarded-range-v1';
        report.evidenceScope = 'real-storage/synthetic-grants';
        report.guarded = await runGuardedCases({ fileID, url: item.tempFileURL, expectedHost: parsed.hostname, etag, content, readRange });
        report.success = report.guarded.fullContentMatch && report.guarded.normalSourceBytes === SIZE
          && report.guarded.cases.every((entry) => entry.passed);
        return report;
      }
      phase = 'ranges';
      for (const start of [0, 2 * 1024 * 1024, SIZE - 256 * 1024]) {
        const end = start + 256 * 1024 - 1;
        const began = now();
        const actual = await readRange({ ...options, start, end });
        const matches = actual.equals(content.subarray(start, end + 1));
        report.ranges.push({ start, end, bytes: actual.length, matches, elapsedMs: now() - began });
        if (!matches) throw Error('CONTENT_MISMATCH');
      }
      phase = 'etag';
      report.wrongEtagHttpStatus = null;
      try {
        await readRange({ ...options, etag: '"sp01-invalid-etag"', start: 0, end: 0 });
        report.wrongEtagRejected = false;
        report.wrongEtagOutcome = 'unexpected-success';
      } catch (error) {
        const status = error?.statusCode;
        report.wrongEtagHttpStatus = Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
        report.wrongEtagOutcome = report.wrongEtagHttpStatus === null ? 'unknown-error' : 'http-error';
        report.wrongEtagRejected = report.wrongEtagHttpStatus === 412;
      }
      report.success = report.wrongEtagRejected === true;
    } catch (_) { report.failurePhase = phase; }
    finally {
      if (uploadAttempted) {
        try {
          const deletion = await app.deleteFile({ fileList: [fileID] });
          report.cleanupConfirmed = deletion?.fileList?.some((entry) => entry.fileID === fileID && entry.code === 'SUCCESS') === true;
        } catch (_) { report.cleanupConfirmed = false; }
      }
      if (!report.cleanupConfirmed) report.success = false;
    }
    return report;
  };
}
module.exports = { createHandler, createGuardedReader, ENV, BUCKET, DIRECTORY, SIZE };
