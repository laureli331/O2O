import { validateIntegerCountInRange, type ValidateIntegerCountInRangeResult } from './integer-count-range';

export type ValidatePublicImageCountResult = ValidateIntegerCountInRangeResult;

/** Validates the shared PRD range for F02/F03 post images; it does not inspect images. */
export function validatePublicImageCount(input: unknown): ValidatePublicImageCountResult {
  return validateIntegerCountInRange(input, 0, 9);
}
