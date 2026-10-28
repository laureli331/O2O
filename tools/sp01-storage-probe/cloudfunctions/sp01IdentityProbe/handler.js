'use strict';

const crypto = require('crypto');
const { TARGET_APP_ID, validateNonce } = require('./identity-contract');

function createIdentityHandler({ getWXContext, expectedAppId = TARGET_APP_ID, createHash = crypto.createHash }) {
  if (typeof getWXContext !== 'function') throw new TypeError('getWXContext is required');
  return async function main(event = {}) {
    if (!validateNonce(event?.nonce)) {
      const error = new Error('INVALID_NONCE');
      error.code = 'INVALID_NONCE';
      throw error;
    }
    const context = getWXContext();
    const openId = context?.OPENID;
    const appId = context?.APPID;
    if (typeof openId !== 'string' || openId.length === 0 || typeof appId !== 'string' || appId.length === 0) {
      const error = new Error('IDENTITY_CONTEXT_MISSING');
      error.code = 'IDENTITY_CONTEXT_MISSING';
      throw error;
    }
    if (appId !== expectedAppId) return { success: false, errorCode: 'APP_ID_MISMATCH' };
    const fingerprint = createHash('sha256')
      .update(`${appId}\u0000${openId}\u0000${event.nonce}`, 'utf8')
      .digest('hex')
      .slice(0, 24);
    return { success: true, fingerprint, appMatchesTarget: true };
  };
}

module.exports = { createIdentityHandler };
