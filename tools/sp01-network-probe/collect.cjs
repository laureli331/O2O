'use strict';

async function collectSequentialSamples({ count, clock, makeNonce, call }) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 90) {
    throw new RangeError('count must be between 1 and 90');
  }
  if (typeof clock !== 'function' || typeof makeNonce !== 'function' || typeof call !== 'function') {
    throw new TypeError('clock, makeNonce and call are required');
  }
  const samples = [];
  for (let index = 0; index < count; index += 1) {
    const nonce = makeNonce(index);
    const started = clock();
    let ok = false;
    try {
      await call(nonce);
      ok = true;
    } catch {
      // The provider error can contain identity data or temporary credentials.
    }
    const elapsedMs = clock() - started;
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new RangeError('invalid clock sample');
    samples.push({ ok, elapsedMs });
  }
  return samples;
}

module.exports = { collectSequentialSamples };
