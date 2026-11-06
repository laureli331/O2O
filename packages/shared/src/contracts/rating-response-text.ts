import { validateRatingText } from './rating-text';

export type ValidateRatingResponseTextResult =
  | { readonly ok: true; readonly value: string; readonly characterCount: number }
  | { readonly ok: false; readonly reason: 'required' | 'not-string' | 'too-long' };

/** Validates required PRD F16 response text using the F15 Unicode code-point rule. */
export function validateRatingResponseText(input: unknown): ValidateRatingResponseTextResult {
  const result = validateRatingText(input);

  if (!result.ok) {
    return result;
  }

  if (result.characterCount === 0) {
    return { ok: false, reason: 'required' };
  }

  return result;
}
