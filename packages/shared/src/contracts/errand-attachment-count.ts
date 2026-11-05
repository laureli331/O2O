import { validateIntegerCountInRange, type ValidateIntegerCountInRangeResult } from './integer-count-range';

export type ValidateErrandAttachmentCountResult = ValidateIntegerCountInRangeResult;

/** Validates the PRD F04 attachment count only; it does not infer media or access rules. */
export function validateErrandAttachmentCount(input: unknown): ValidateErrandAttachmentCountResult {
  return validateIntegerCountInRange(input, 0, 9);
}
