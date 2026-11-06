import { validateIntegerCountInRange, type ValidateIntegerCountInRangeResult } from './integer-count-range';
import { validateTrimmedTextRange, type ValidateTrimmedTextRangeResult } from './trimmed-text-range';

export type MerchantPostTextField = 'title' | 'body';

export type ValidateMerchantPostTextResult = ValidateTrimmedTextRangeResult
  | { readonly ok: false; readonly reason: 'unknown-field' };

export type ValidateMerchantPostImageCountResult = ValidateIntegerCountInRangeResult;

// F22's BM17 content lifecycle, permissions, moderation, and publication remain owned by SP24.
const TEXT_LIMITS = {
  title: { minimumCodePoints: 1, maximumCodePoints: 20 },
  body: { minimumCodePoints: 1, maximumCodePoints: 1_000 },
} as const;

/** Trims edge whitespace and validates F22 required title/body by Unicode code points. */
export function validateMerchantPostText(
  field: string,
  input: unknown,
): ValidateMerchantPostTextResult {
  if (field !== 'title' && field !== 'body') {
    return { ok: false, reason: 'unknown-field' };
  }

  const limits = TEXT_LIMITS[field];
  return validateTrimmedTextRange(input, limits.minimumCodePoints, limits.maximumCodePoints);
}

/** Validates only the PRD F22 reviewed-image count (1–9); it does not inspect image data. */
export function validateMerchantPostImageCount(
  input: unknown,
): ValidateMerchantPostImageCountResult {
  return validateIntegerCountInRange(input, 1, 9);
}
