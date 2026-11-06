import type { CommandResult } from './result';

export const IDEMPOTENCY_DOCUMENT_ID_PREFIX = 'idem_v1_' as const;
export const IDEMPOTENCY_DOCUMENT_ID_VERSION = 1 as const;

export interface IdempotencyDocumentIdInput {
  /** A server-derived scope that includes the trusted actor/ownership boundary. */
  readonly trustedScope: string;
  /** A server-allowlisted operation name. */
  readonly operation: string;
  /** The exact validated command key; surrounding whitespace is preserved. */
  readonly operationKey: string;
}

export type IdempotencySha256Utf8Hex = (serializedInput: string) => string;

export type IdempotencyDocumentIdResult =
  | { readonly ok: true; readonly documentId: string }
  | {
      readonly ok: false;
      readonly reason:
        | 'empty-trusted-scope'
        | 'empty-operation'
        | 'empty-operation-key'
        | 'serialization-failed'
        | 'invalid-sha256-output';
    };

/**
 * Build the versioned CloudBase claim ID for a server-side idempotency record.
 * The injected digest keeps this shared contract platform-neutral; the server adapter
 * must hash the supplied UTF-8 string with SHA-256. The payload is intentionally absent:
 * reusing one key with a different payload must collide on the same claim and be rejected.
 * This ID is neither authorization nor a secret; the server must derive the trusted scope
 * and must never accept a client-supplied claim ID as proof of ownership.
 */
export function createIdempotencyDocumentId(
  input: IdempotencyDocumentIdInput,
  sha256Utf8Hex: IdempotencySha256Utf8Hex,
): IdempotencyDocumentIdResult {
  if (input.trustedScope.trim().length === 0) {
    return { ok: false, reason: 'empty-trusted-scope' };
  }
  if (input.operation.trim().length === 0) {
    return { ok: false, reason: 'empty-operation' };
  }
  if (input.operationKey.trim().length === 0) {
    return { ok: false, reason: 'empty-operation-key' };
  }

  const serializedInput = JSON.stringify([
    'o2o.idempotency',
    IDEMPOTENCY_DOCUMENT_ID_VERSION,
    input.trustedScope,
    input.operation,
    input.operationKey,
  ]);
  if (typeof serializedInput !== 'string') {
    return { ok: false, reason: 'serialization-failed' };
  }

  const digest = sha256Utf8Hex(serializedInput);
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    return { ok: false, reason: 'invalid-sha256-output' };
  }

  return {
    ok: true,
    documentId: `${IDEMPOTENCY_DOCUMENT_ID_PREFIX}${digest}`,
  };
}

/**
 * Result of a server-side comparison against the already validated operation payload.
 * The comparison/canonicalization rule is owned by each operation and is not defined here.
 */
export type IdempotencyPayloadComparison = 'same' | 'different';

export type IdempotencyReuseDecision<TValue> =
  | { readonly outcome: 'replay'; readonly originalResult: CommandResult<TValue> }
  | { readonly outcome: 'reject'; readonly reason: 'payload-mismatch' };

/**
 * Applies only the reuse decision after the receiving server has matched the trusted
 * actor/ownership, operation, and operation key. It performs no lookup, persistence,
 * payload comparison, transaction, or side effect. A replay preserves the original
 * processing, unknown, rejection, failure, or success result without resubmission.
 */
export function resolveIdempotencyReuse<TValue>(
  payloadComparison: IdempotencyPayloadComparison,
  originalResult: CommandResult<TValue>,
): IdempotencyReuseDecision<TValue> {
  if (payloadComparison === 'same') {
    return { outcome: 'replay', originalResult };
  }

  return { outcome: 'reject', reason: 'payload-mismatch' };
}
