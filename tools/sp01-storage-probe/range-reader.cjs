'use strict';
const https = require('node:https');

// Diagnostic helper only. All parameters must come from trusted server-side metadata
// after authorization, never from a caller-supplied URL. No redirect or whole-file fallback.
async function readRange(options, transport = https) {
  const { url, expectedHost, start, end, totalBytes, etag, timeoutMs } = options;
  const invalid = () => new Error('INVALID_RANGE_REQUEST');
  let target;
  try { target = new URL(url); } catch (_) { throw invalid(); }
  if (typeof expectedHost !== 'string' || !expectedHost
    || target.protocol !== 'https:' || target.hostname !== expectedHost
    || target.port || target.username || target.password || target.hash
    || ![start, end, totalBytes, timeoutMs].every(Number.isSafeInteger)
    || start < 0 || end < start || end >= totalBytes || timeoutMs <= 0
    || typeof etag !== 'string' || !/^"[A-Za-z0-9-]+"$/.test(etag)) throw invalid();
  const expectedBytes = end - start + 1;
  return new Promise((resolve, reject) => {
    let settled = false;
    let request;
    const fail = (statusCode) => {
      if (settled) return;
      settled = true;
      const error = new Error('RANGE_RESPONSE_REJECTED');
      if (Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599) error.statusCode = statusCode;
      reject(error);
      request?.destroy();
    };
    try {
      request = transport.get(target, {
        headers: { Range: `bytes=${start}-${end}`, 'If-Match': etag, 'Accept-Encoding': 'identity' },
      }, (response) => {
        response.on('error', fail);
        response.on('aborted', fail);
        if (response.statusCode !== 206
          || response.headers['content-range'] !== `bytes ${start}-${end}/${totalBytes}`
          || response.headers.etag !== etag
          || (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity')) {
          fail(response.statusCode); response.destroy(); return;
        }
        const parts = [];
        let received = 0;
        response.on('data', (part) => {
          if (settled) return;
          if (!Buffer.isBuffer(part)) { fail(); response.destroy(); return; }
          received += part.length;
          if (received > expectedBytes) { fail(); response.destroy(); return; }
          parts.push(part);
        });
        response.on('end', () => {
          if (settled) return;
          if (received !== expectedBytes) { fail(); return; }
          settled = true;
          resolve(Buffer.concat(parts, received));
        });
        response.on('close', () => { if (!settled) fail(); });
      });
      request.on('error', fail);
      request.setTimeout(timeoutMs, fail);
    } catch (_) { fail(); }
  });
}
module.exports = { readRange };
