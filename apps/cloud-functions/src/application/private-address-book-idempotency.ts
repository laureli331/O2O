import {
  createIdempotencyDocumentId,
  resolveIdempotencyReuse,
} from '../../../../packages/shared/src/contracts/idempotency';
import type { IdempotencySha256Utf8Hex } from '../../../../packages/shared/src/contracts/idempotency';
import {
  createPrivateAddressBookCommandPayloadDigest,
  parsePrivateAddressBookCommand,
} from '../../../../packages/shared/src/contracts/private-address-book-command-digest';
import { compareExpectedVersion } from '../../../../packages/shared/src/contracts/private-address-book';
import { parseCommandResult } from '../../../../packages/shared/src/contracts/result';
import type { CommandResult } from '../../../../packages/shared/src/contracts/result';

/**
 * Semantic values projected from an already owner-scoped server-side lookup.
 * This is not a CloudBase document schema. The physical mapping belongs to SP08.
 */
export interface ExistingPrivateAddressBookIdempotencyOutcome {
  readonly payloadDigest: unknown;
  readonly originalResult: unknown;
}

export interface PreparePrivateAddressBookIdempotencyDecisionInput {
  /** Must be derived from authenticated server context and the ownership boundary. */
  readonly trustedScope: string;
  /** Must be the exact key accepted by the generic command-envelope parser. */
  readonly operationKey: string;
  /** F09 operation-specific command payload; still validated here at runtime. */
  readonly command: unknown;
  /** Null means the owner-scoped lookup found no record; other values are validated. */
  readonly existingOutcome: ExistingPrivateAddressBookIdempotencyOutcome | null;
  /** For a new update/delete only: version projected from the owner-scoped target-address lookup. */
  readonly currentAddressVersion?: unknown;
  readonly sha256Utf8Hex: IdempotencySha256Utf8Hex;
}

export type PrivateAddressBookIdempotencyDecision =
  | {
    readonly kind: 'new-claim-candidate';
    readonly documentId: string;
    readonly payloadDigest: string;
  }
  | {
    readonly kind: 'replay';
    readonly documentId: string;
    readonly originalResult: CommandResult<unknown>;
  }
  | {
    readonly kind: 'reject';
    readonly documentId: string;
    readonly reason: 'payload-mismatch' | 'version-conflict';
  }
  | {
    readonly kind: 'invalid';
    readonly reason:
      | 'invalid-command'
      | 'invalid-claim-input'
      | 'invalid-existing-outcome'
      | 'invalid-current-version';
  };

/**
 * Compose existing local contracts for an F09 reuse decision only.
 *
 * The caller must authenticate the actor, derive the scope, parse the generic
 * command envelope, and perform an owner-scoped lookup using the resulting ID.
 * This function does not look up or persist records, execute the business write,
 * authorize a replay, or provide a transaction/concurrency guarantee. For a
 * new update/delete, the caller must supply the target address's current version
 * from its owner-scoped lookup; an existing same-key replay is resolved first
 * and does not fail merely because the address version advanced afterward. A
 * replay validates the result envelope, not the business meaning of its unknown
 * `value`. A candidate still requires the SP08 atomic add/write transaction and
 * version-conditional write before any business side effect may run.
 */
export function preparePrivateAddressBookIdempotencyDecision(
  input: PreparePrivateAddressBookIdempotencyDecisionInput,
): PrivateAddressBookIdempotencyDecision {
  const parsedCommand = parsePrivateAddressBookCommand(input.command);
  if (!parsedCommand.ok) {
    return { kind: 'invalid', reason: 'invalid-command' };
  }

  const idResult = createIdempotencyDocumentId({
    trustedScope: input.trustedScope,
    operation: parsedCommand.value.operation,
    operationKey: input.operationKey,
  }, input.sha256Utf8Hex);
  if (!idResult.ok) {
    return { kind: 'invalid', reason: 'invalid-claim-input' };
  }

  const digestResult = createPrivateAddressBookCommandPayloadDigest(
    parsedCommand.value,
    input.sha256Utf8Hex,
  );
  if (!digestResult.ok) {
    return { kind: 'invalid', reason: 'invalid-command' };
  }

  if (input.existingOutcome === null) {
    if (parsedCommand.value.operation !== 'create') {
      const versionComparison = compareExpectedVersion(
        parsedCommand.value.expectedVersion,
        input.currentAddressVersion,
      );
      if (versionComparison.kind === 'conflict') {
        return {
          kind: 'reject',
          documentId: idResult.documentId,
          reason: 'version-conflict',
        };
      }
      if (versionComparison.kind === 'invalid-current-version') {
        return { kind: 'invalid', reason: 'invalid-current-version' };
      }
      if (versionComparison.kind === 'invalid-expected-version') {
        return { kind: 'invalid', reason: 'invalid-command' };
      }
    }

    return {
      kind: 'new-claim-candidate',
      documentId: idResult.documentId,
      payloadDigest: digestResult.digest,
    };
  }

  if (
    typeof input.existingOutcome.payloadDigest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(input.existingOutcome.payloadDigest)
  ) {
    return { kind: 'invalid', reason: 'invalid-existing-outcome' };
  }
  const parsedOriginalResult = parseCommandResult(input.existingOutcome.originalResult);
  if (!parsedOriginalResult.ok) {
    return { kind: 'invalid', reason: 'invalid-existing-outcome' };
  }

  const reuse = resolveIdempotencyReuse(
    input.existingOutcome.payloadDigest === digestResult.digest ? 'same' : 'different',
    parsedOriginalResult.value,
  );
  if (reuse.outcome === 'replay') {
    return {
      kind: 'replay',
      documentId: idResult.documentId,
      originalResult: reuse.originalResult,
    };
  }

  return {
    kind: 'reject',
    documentId: idResult.documentId,
    reason: reuse.reason,
  };
}
