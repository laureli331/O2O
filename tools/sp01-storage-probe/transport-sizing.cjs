'use strict';

// Local diagnostic arithmetic only. No file access, network, identity or storage operations.
function encodedResponseBytes(binaryBytes) {
  if (!Number.isSafeInteger(binaryBytes) || binaryBytes < 0) throw new RangeError('Invalid byte count');
  const bytes = 4 * Math.ceil(binaryBytes / 3) + Buffer.byteLength('{"data":""}');
  if (!Number.isSafeInteger(bytes)) throw new RangeError('Unsafe encoded byte count');
  return bytes;
}

function compareTransport(binaryBytes, responseLimitBytes, experimentChunkBytes) {
  for (const value of [responseLimitBytes, experimentChunkBytes]) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError('Invalid experiment parameter');
  }
  const wholeResponseBytes = encodedResponseBytes(binaryBytes);
  const largestChunkBytes = Math.min(binaryBytes, experimentChunkBytes);
  return {
    binaryBytes, responseLimitBytes, wholeResponseBytes,
    wholeFitsMinimalEnvelope: wholeResponseBytes <= responseLimitBytes,
    experimentChunkBytes,
    chunkCount: Math.ceil(binaryBytes / experimentChunkBytes),
    largestChunkResponseBytes: encodedResponseBytes(largestChunkBytes),
    chunkFitsMinimalEnvelope: encodedResponseBytes(largestChunkBytes) <= responseLimitBytes,
    limitation: 'Sizing only; actual platform limits, response envelope, authorization, revocation and latency remain unverified.',
  };
}

module.exports = { encodedResponseBytes, compareTransport };
if (require.main === module) {
  console.log(JSON.stringify(compareTransport(5 * 1024 * 1024, 6 * 1024 * 1024, 256 * 1024), null, 2));
}
