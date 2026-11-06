import { validateTrimmedTextRange, type ValidateTrimmedTextRangeResult } from './trimmed-text-range';

export type ValidateCommissionBasisReductionReasonResult = ValidateTrimmedTextRangeResult;
export type ValidateBillingDisputeReasonResult = ValidateTrimmedTextRangeResult;

// Complete F21 workflows remain owned by SP17, SP29, and SP30.

/** Validates only the required F21 commission-base reduction application reason. */
export function validateCommissionBasisReductionReason(
  input: unknown,
): ValidateCommissionBasisReductionReasonResult {
  return validateTrimmedTextRange(input, 1, 500);
}

/** Validates only the required F21 billing dispute reason. */
export function validateBillingDisputeReason(input: unknown): ValidateBillingDisputeReasonResult {
  return validateTrimmedTextRange(input, 1, 500);
}
