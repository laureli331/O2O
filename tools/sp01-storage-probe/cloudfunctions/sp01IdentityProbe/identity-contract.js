'use strict';

const TARGET_APP_ID = 'wx2414399d423dfb65';
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

function validateNonce(value) {
  return typeof value === 'string' && NONCE_PATTERN.test(value);
}

module.exports = { TARGET_APP_ID, validateNonce };
