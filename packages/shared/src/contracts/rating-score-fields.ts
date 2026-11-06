import { validateIntegerCountInRange } from './integer-count-range';

export type RatingScoreField = 'attitude' | 'efficiency' | 'communication';

export type ValidateRatingScoreResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly reason: 'unknown-field' | 'not-integer' | 'out-of-range' };

/** Validates one documented rating dimension without assigning an initial score. */
export function validateRatingScore(
  field: string,
  input: unknown,
): ValidateRatingScoreResult {
  if (field !== 'attitude' && field !== 'efficiency' && field !== 'communication') {
    return { ok: false, reason: 'unknown-field' };
  }

  return validateIntegerCountInRange(input, 1, 5);
}
