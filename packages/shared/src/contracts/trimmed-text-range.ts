export type ValidateTrimmedTextRangeResult =
  | { readonly ok: true; readonly value: string; readonly characterCount: number }
  | { readonly ok: false; readonly reason: 'not-string' | 'empty' | 'too-long' };

/** Trims edge whitespace and validates Unicode code point count for a required text value. */
export function validateTrimmedTextRange(
  input: unknown,
  minimumCodePoints: number,
  maximumCodePoints: number,
): ValidateTrimmedTextRangeResult {
  if (typeof input !== 'string') {
    return { ok: false, reason: 'not-string' };
  }

  const value = input.trim();
  const characterCount = Array.from(value).length;

  if (characterCount < minimumCodePoints) {
    return { ok: false, reason: 'empty' };
  }
  if (characterCount > maximumCodePoints) {
    return { ok: false, reason: 'too-long' };
  }

  return { ok: true, value, characterCount };
}
