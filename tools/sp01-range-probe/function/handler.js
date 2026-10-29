'use strict';
const crypto = require('node:crypto');
const ENV = 'cloud1-d2gjahlq39bf141c7';
const BUCKET = '636c-cloud1-d2gjahlq39bf141c7-1518394589';
const DIRECTORY = 'sp01_range_probe/';
const SIZE = 5 * 1024 * 1024;

// Temporary console-operated synthetic transport test; no user identity/permission conclusion.
function createHandler({ app, readRange, randomId = () => crypto.randomBytes(16).toString('hex'), now = Date.now }) {
  return async (event = {}) => {
    if (event.action === 'inspect') return { success: true, version: 'range-probe-v1', nodeVersion: process.version, writes: false };
    if (event.action !== 'run') return { success: false, code: 'INVALID_ACTION' };
    const id = randomId();
    if (!/^[a-f0-9]{32}$/.test(id)) return { success: false, code: 'INVALID_RUN_ID' };
    const cloudPath = `${DIRECTORY}range-${id}.bin`;
    const fileID = `cloud://${ENV}.${BUCKET}/${cloudPath}`;
    const content = Buffer.alloc(SIZE);
    for (let i = 0; i < SIZE; i++) content[i] = i % 251;
    const etag = `"${crypto.createHash('md5').update(content).digest('hex')}"`;
    const report = { success: false, version: 'range-probe-v1', cloudPath, binaryBytes: SIZE, ranges: [], cleanupConfirmed: false };
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
      try {
        await readRange({ ...options, etag: '"sp01-invalid-etag"', start: 0, end: 0 });
        report.wrongEtagRejected = false;
      } catch (error) { report.wrongEtagRejected = error.statusCode === 412; }
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
module.exports = { createHandler, ENV, BUCKET, DIRECTORY, SIZE };
