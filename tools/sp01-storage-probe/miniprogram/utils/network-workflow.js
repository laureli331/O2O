'use strict';

const { validateFingerprint } = require('./probe-contract');
const { collectSequentialSamples, summarizeSamples } = require('./network-samples');

async function runReadOnlyNetworkProbe({ count = 30, callFunction, clock, makeNonce }) {
  if (typeof callFunction !== 'function') throw new TypeError('callFunction is required');
  const samples = await collectSequentialSamples({ count, clock, makeNonce, call: async nonce => {
    const response = await callFunction({ name: 'sp01IdentityProbe', data: { nonce } });
    const result = response?.result;
    if (result?.success !== true || result.appMatchesTarget !== true ||
      !validateFingerprint(result.fingerprint)) throw new Error('INVALID_READ_ONLY_RESPONSE');
  } });
  return { samples, summary: summarizeSamples(samples) };
}

module.exports = { runReadOnlyNetworkProbe };
