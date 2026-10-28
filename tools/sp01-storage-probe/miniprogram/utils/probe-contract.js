'use strict';

const TARGET_APP_ID = 'wx2414399d423dfb65';
const TARGET_ENV_ID = 'cloud1-d2gjahlq39bf141c7';
const PROBE_DIRECTORY = 'sp01_permission_probe';
const FINGERPRINT_PATTERN = /^[a-f0-9]{24}$/;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const RUN_ID_PATTERN = /^[a-f0-9]{6,32}$/;
const DENIAL_CODES = new Set([
  'STORAGE_EXCEED_AUTHORITY',
  'PERMISSION_DENIED',
  'REQUEST_FORBIDDEN',
  'EXCEED_AUTHORITY',
]);

function validateNonce(value) {
  return typeof value === 'string' && NONCE_PATTERN.test(value);
}

function validateRunId(value) {
  return typeof value === 'string' && RUN_ID_PATTERN.test(value);
}

function validateCloudPath(value) {
  return typeof value === 'string'
    && new RegExp(`^${PROBE_DIRECTORY}/owner-probe-${RUN_ID_PATTERN.source.slice(1, -1)}\\.txt$`).test(value);
}

function validateFileID(value, expectedPath) {
  if (typeof value !== 'string' || !value.startsWith(`cloud://${TARGET_ENV_ID}.`)) return false;
  const slash = value.indexOf('/', 'cloud://'.length);
  if (slash < 0) return false;
  const path = value.slice(slash + 1);
  return validateCloudPath(path) && (!expectedPath || path === expectedPath);
}

function validateFingerprint(value) {
  return typeof value === 'string' && FINGERPRINT_PATTERN.test(value);
}

function validateOwnerBundle(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { valid: false, reason: 'invalid-shape' };
  const pathMatch = typeof value.cloudPath === 'string'
    ? value.cloudPath.match(new RegExp(`^${PROBE_DIRECTORY}/owner-probe-(${RUN_ID_PATTERN.source.slice(1, -1)})\\.txt$`))
    : null;
  const valid = value.version === 1
    && validateNonce(value.nonce)
    && validateFingerprint(value.ownerFingerprint)
    && pathMatch !== null
    && validateFileID(value.fileID, value.cloudPath)
    && value.ownerContent === `SP01-SYNTHETIC-OWNER:${pathMatch?.[1]}`;
  return { valid, reason: valid ? null : 'invalid-probe-bundle' };
}

function compareIdentity(ownerFingerprint, currentFingerprint) {
  const bothKnown = validateFingerprint(ownerFingerprint) && validateFingerprint(currentFingerprint);
  const sameAccount = bothKnown && ownerFingerprint === currentFingerprint;
  return { sameAccount, canProbe: bothKnown && !sameAccount };
}

function safeCode(error) {
  const raw = error?.errCode ?? error?.code ?? error?.status ?? error?.errorCode;
  if (typeof raw === 'string' && /^[A-Za-z0-9_:-]{1,60}$/.test(raw)) return raw.toUpperCase();
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  return 'UNKNOWN';
}

function identityCallDiagnostics(error) {
  const providerCode = safeCode(error);
  const rawRequestId = error?.requestId ?? error?.requestID;
  const requestId = typeof rawRequestId === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(rawRequestId)
    ? rawRequestId
    : null;
  return { providerCode, requestId };
}

function classifyStorageError(error) {
  const code = safeCode(error);
  return { kind: DENIAL_CODES.has(code) ? 'denied' : 'inconclusive', code };
}

function makeProbeError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

module.exports = {
  TARGET_APP_ID,
  TARGET_ENV_ID,
  PROBE_DIRECTORY,
  validateNonce,
  validateRunId,
  validateCloudPath,
  validateFileID,
  validateFingerprint,
  validateOwnerBundle,
  compareIdentity,
  safeCode,
  identityCallDiagnostics,
  classifyStorageError,
  makeProbeError,
};
