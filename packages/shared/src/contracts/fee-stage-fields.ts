import { parseCnyFen, type ParseCnyFenResult } from './money';
import { validateIntegerCountInRange, type ValidateIntegerCountInRangeResult } from './integer-count-range';

export type ValidateFeeTextResult =
  | { readonly ok: true; readonly value: string; readonly characterCount: number }
  | { readonly ok: false; readonly reason: 'not-string' | 'empty' | 'too-long' };

export type ParseFeeItemAmountResult = ParseCnyFenResult | { readonly ok: false; readonly reason: 'required' };

const MAX_FEE_TEXT_CODE_POINTS = 300 as const;

function validateRequiredFeeText(input: unknown, maximumCodePoints: number): ValidateFeeTextResult {
  if (typeof input !== 'string') return { ok: false, reason: 'not-string' };

  const value = input.trim();
  const characterCount = Array.from(value).length;
  if (characterCount === 0) return { ok: false, reason: 'empty' };
  if (characterCount > maximumCodePoints) return { ok: false, reason: 'too-long' };

  return { ok: true, value, characterCount };
}

/** Validates only the PRD F20 stage label; duplicate labels remain allowed. */
export function validateFeeStageName(input: unknown): ValidateFeeTextResult {
  return validateRequiredFeeText(input, 30);
}

/** Validates only the PRD F20 fee-item label. */
export function validateFeeItemName(input: unknown): ValidateFeeTextResult {
  return validateRequiredFeeText(input, 30);
}

/** Validates the optional PRD F20 fee-item note using Unicode code points. */
export function validateFeeItemNote(input: unknown): ValidateFeeTextResult {
  if (input === undefined) return { ok: true, value: '', characterCount: 0 };
  if (typeof input !== 'string') return { ok: false, reason: 'not-string' };

  const value = input.trim();
  const characterCount = Array.from(value).length;
  if (characterCount > MAX_FEE_TEXT_CODE_POINTS) return { ok: false, reason: 'too-long' };

  return { ok: true, value, characterCount };
}

/** Validates the item count in one PRD F20 fee proposal. */
export function validateFeePlanItemCount(input: unknown): ValidateIntegerCountInRangeResult {
  return validateIntegerCountInRange(input, 1, 20);
}

/**
 * Parses a required, explicit CNY yuan decimal for a PRD F20 fee item.
 * The PRD permits a known zero amount; unknown amounts must not be submitted
 * as zero and are intentionally outside this scalar parser's scope. This does
 * not implement the fee proposal lifecycle.
 */
export function parseFeeItemAmount(input: unknown): ParseFeeItemAmountResult {
  if (input === undefined || input === null || input === '') return { ok: false, reason: 'required' };

  const parsed = parseCnyFen(input);
  if (!parsed.ok) return parsed;

  return { ok: true, value: parsed.value };
}

/** Validates the optional proof-image count for one actual-expense item only. */
export function validateActualExpenseProofCount(input: unknown): ValidateIntegerCountInRangeResult {
  return validateIntegerCountInRange(input, 0, 3);
}
