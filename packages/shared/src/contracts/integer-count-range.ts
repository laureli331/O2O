export type ValidateIntegerCountInRangeResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly reason: 'not-integer' | 'out-of-range' };

/** Validates only an integer count against inclusive numeric bounds. */
export function validateIntegerCountInRange(
  input: unknown,
  minimum: number,
  maximum: number,
): ValidateIntegerCountInRangeResult {
  if (typeof input !== 'number' || !Number.isInteger(input)) {
    return { ok: false, reason: 'not-integer' };
  }

  if (input < minimum || input > maximum) {
    return { ok: false, reason: 'out-of-range' };
  }

  return { ok: true, value: input };
}
