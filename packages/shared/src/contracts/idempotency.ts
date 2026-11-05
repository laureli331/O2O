import type { CommandResult } from './result';

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
