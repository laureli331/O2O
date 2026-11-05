import { validateIntegerCountInRange, type ValidateIntegerCountInRangeResult } from './integer-count-range';

export type ValidateProviderLicenseImageCountResult = ValidateIntegerCountInRangeResult;

/** Validates only the optional provider-license image count from PRD F01/F07. */
export function validateProviderLicenseImageCount(
  input: unknown,
): ValidateProviderLicenseImageCountResult {
  return validateIntegerCountInRange(input, 0, 1);
}
