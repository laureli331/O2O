export type ValidateRatingTextResult =
  | { readonly ok: true; readonly value: string; readonly characterCount: number }
  | { readonly ok: false; readonly reason: 'not-string' | 'too-long' };

/** Validates optional PRD F15 text by trimmed Unicode code-point count only. */
export function validateRatingText(input: unknown): ValidateRatingTextResult {
  if (input === undefined) {
    return { ok: true, value: '', characterCount: 0 };
  }

  if (typeof input !== 'string') {
    return { ok: false, reason: 'not-string' };
  }

  const value = input.trim();
  const characterCount = Array.from(value).length;

  if (characterCount === 0) {
    return { ok: true, value: '', characterCount: 0 };
  }

  if (characterCount > 300) {
    return { ok: false, reason: 'too-long' };
  }

  return { ok: true, value, characterCount };
}
