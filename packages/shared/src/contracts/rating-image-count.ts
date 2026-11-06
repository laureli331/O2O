import { validateIntegerCountInRange, type ValidateIntegerCountInRangeResult } from './integer-count-range';

export type ValidateRatingImageCountResult = ValidateIntegerCountInRangeResult;

/** Validates only the PRD F15 rating image count; it does not inspect or authorize images. */
export function validateRatingImageCount(input: unknown): ValidateRatingImageCountResult {
  return validateIntegerCountInRange(input, 0, 3);
}
