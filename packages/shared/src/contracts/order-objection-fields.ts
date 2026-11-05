import { validateIntegerCountInRange, type ValidateIntegerCountInRangeResult } from './integer-count-range';

export type CancellationOrDeliveryDisputeTextField =
  | 'cancellationOrDeliveryDisputeDescription'
  | 'idleCancellationDisagreementReason'
  | 'deferOrReleaseDisagreementReason';

export type ValidateCancellationOrDeliveryDisputeTextResult =
  | { readonly ok: true; readonly value: string; readonly characterCount: number }
  | { readonly ok: false; readonly reason: 'unknown-field' | 'not-string' | 'empty' | 'too-long' };

export type ValidateCancellationOrDeliveryDisputeImageCountResult = ValidateIntegerCountInRangeResult;

const TEXT_LIMITS = {
  cancellationOrDeliveryDisputeDescription: { minimumCodePoints: 1, maximumCodePoints: 500 },
  idleCancellationDisagreementReason: { minimumCodePoints: 1, maximumCodePoints: 300 },
  deferOrReleaseDisagreementReason: { minimumCodePoints: 0, maximumCodePoints: 300 },
} as const;

/**
 * Validates only PRD F06 objection/reason text ranges after trimming edge
 * whitespace. Counts Unicode code points, consistent with the confirmed F02
 * and F03 text-field policy; this does not implement an order-state transition.
 */
export function validateCancellationOrDeliveryDisputeText(
  field: string,
  input: unknown,
): ValidateCancellationOrDeliveryDisputeTextResult {
  if (!Object.prototype.hasOwnProperty.call(TEXT_LIMITS, field)) {
    return { ok: false, reason: 'unknown-field' };
  }

  if (field === 'deferOrReleaseDisagreementReason' && input === undefined) {
    return { ok: true, value: '', characterCount: 0 };
  }
  if (typeof input !== 'string') {
    return { ok: false, reason: 'not-string' };
  }

  const value = input.trim();
  const characterCount = Array.from(value).length;
  const limits = TEXT_LIMITS[field as CancellationOrDeliveryDisputeTextField];

  if (characterCount < limits.minimumCodePoints) {
    return { ok: false, reason: 'empty' };
  }
  if (characterCount > limits.maximumCodePoints) {
    return { ok: false, reason: 'too-long' };
  }

  return { ok: true, value, characterCount };
}

/** Validates the PRD F06 cancellation/delivery-dispute image count only. */
export function validateCancellationOrDeliveryDisputeImageCount(
  input: unknown,
): ValidateCancellationOrDeliveryDisputeImageCountResult {
  return validateIntegerCountInRange(input, 0, 9);
}
