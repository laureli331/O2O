'use strict';

// Isolated SP01 experiment, not a deployed function or a product authorization API.
function createChunkExperiment({ chunkBytes, responseLimitBytes, resolveGrant, readVersion }) {
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes <= 0
    || !Number.isSafeInteger(responseLimitBytes) || responseLimitBytes <= 0) throw new RangeError('Invalid experiment limits');
  const fail = (code) => ({ success: false, code });
  const validGrant = (grant) => grant && grant.allowed === true
    && typeof grant.fileKey === 'string' && grant.fileKey.length > 0
    && typeof grant.version === 'string' && grant.version.length > 0
    && typeof grant.authorizationVersion === 'string' && grant.authorizationVersion.length > 0;
  return async function readChunk(trustedActor, input) {
    if (!trustedActor || typeof trustedActor.id !== 'string' || !trustedActor.id) return fail('UNAUTHENTICATED');
    if (!input || typeof input.objectId !== 'string' || !input.objectId
      || typeof input.version !== 'string' || !input.version
      || !Number.isSafeInteger(input.index) || input.index < 0) return fail('INVALID_INPUT');
    // Actor and object binding are resolved server-side; ignore input actor/fileKey/role.
    const actor = Object.freeze({ id: trustedActor.id });
    const request = { objectId: input.objectId, version: input.version, index: input.index };
    try {
      const resolved = await resolveGrant(actor, request.objectId);
      if (!validGrant(resolved)) return fail('FORBIDDEN');
      const grant = Object.freeze({ ...resolved });
      if (grant.version !== request.version) return fail('VERSION_CONFLICT');
      const bytes = await readVersion(grant.fileKey, grant.version);
      if (!Buffer.isBuffer(bytes)) return fail('READ_UNCONFIRMED');
      const start = request.index * chunkBytes;
      if (!Number.isSafeInteger(start) || start >= bytes.length) return fail('INVALID_RANGE');
      // Re-check after I/O; a revocation/version change during the read must not release bytes.
      const current = await resolveGrant(actor, request.objectId);
      if (!validGrant(current)) return fail('FORBIDDEN');
      if (current.fileKey !== grant.fileKey || current.version !== grant.version
        || current.authorizationVersion !== grant.authorizationVersion) return fail('VERSION_CONFLICT');
      const response = {
        success: true, version: grant.version, index: request.index,
        totalBytes: bytes.length, data: bytes.subarray(start, start + chunkBytes).toString('base64'),
      };
      if (Buffer.byteLength(JSON.stringify(response)) > responseLimitBytes) return fail('RESPONSE_TOO_LARGE');
      return response;
    } catch (_) { return fail('UNCONFIRMED'); }
  };
}

module.exports = { createChunkExperiment };
