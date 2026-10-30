'use strict';

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

module.exports = { summarizeSamples };
