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

function summarizeSamples(samples) {
  if (!Array.isArray(samples) || samples.some(sample => !sample || typeof sample.ok !== 'boolean' ||
    !Number.isFinite(sample.elapsedMs) || sample.elapsedMs < 0)) {
    throw new TypeError('samples must contain nonnegative elapsedMs and boolean ok');
  }
  const successful = samples.filter(sample => sample.ok).map(sample => sample.elapsedMs);
  const sorted = [...successful].sort((a, b) => a - b);
  const rank = fraction => sorted.length ? sorted[Math.ceil(fraction * sorted.length) - 1] : null;
  const differences = successful.slice(1).map((value, index) => Math.abs(value - successful[index]));
  return {
    attempts: samples.length,
    succeeded: successful.length,
    failed: samples.length - successful.length,
    failureRate: samples.length ? (samples.length - successful.length) / samples.length : null,
    medianMs: rank(0.5),
    p95Ms: rank(0.95),
    maxMs: sorted.length ? sorted[sorted.length - 1] : null,
    meanConsecutiveDifferenceMs: differences.length
      ? differences.reduce((sum, value) => sum + value, 0) / differences.length : null,
  };
}

module.exports = { collectSequentialSamples, summarizeSamples };
