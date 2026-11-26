'use strict';
const fail = (code) => { throw new Error(code); };

async function readJson(url, token, deadline, { fetchImpl, now }) {
  const remaining = deadline - now();
  if (remaining <= 0) fail('await-source-deadline');
  const controller = new AbortController();
  let timer;
  const pending = Promise.resolve().then(async () => {
    const response = await fetchImpl(url, { method: 'GET', redirect: 'error', signal: controller.signal,
      headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28' } });
    if (!response || response.status !== 200 || response.url !== url || response.headers?.get('link')
      || !response.body?.getReader) fail('await-source-response-invalid');
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        size += item.value.byteLength;
        if (size > 65536) { controller.abort(); void reader.cancel().catch(() => {}); fail('await-source-response-too-large'); }
        chunks.push(Buffer.from(item.value));
      }
      if (now() >= deadline) fail('await-source-deadline');
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } finally { reader.releaseLock(); }
  });
  try {
    return await Promise.race([pending, new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('await-source-request-unknown')); }, Math.min(remaining, 10000));
    })]);
  } finally { clearTimeout(timer); }
}

module.exports = { readJson };
