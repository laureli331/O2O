export type ProviderProfileTextField = 'displayName' | 'serviceIntroduction';

export type ValidateProviderProfileTextResult =
  | { readonly ok: true; readonly value: string; readonly characterCount: number }
  | { readonly ok: false; readonly reason: 'unknown-field' | 'not-string' | 'empty' | 'too-long' };

const PROVIDER_PROFILE_TEXT_LIMITS = {
  displayName: { minimumCodePoints: 1, maximumCodePoints: 30 },
  serviceIntroduction: { minimumCodePoints: 1, maximumCodePoints: 500 },
} as const;

/**
 * Trims edge whitespace and validates PRD F07 display-name and service-intro
 * lengths using Unicode code points, not UTF-16 code units or grapheme clusters.
 * This only validates shared text fields; it does not validate profile access,
 * service categories, communities, qualifications, or contact details.
 */
export function validateProviderProfileText(
  field: string,
  input: unknown,
): ValidateProviderProfileTextResult {
  if (field !== 'displayName' && field !== 'serviceIntroduction') {
    return { ok: false, reason: 'unknown-field' };
  }

  if (typeof input !== 'string') {
    return { ok: false, reason: 'not-string' };
  }

  const value = input.trim();
  const characterCount = Array.from(value).length;
  const limits = PROVIDER_PROFILE_TEXT_LIMITS[field];

  if (characterCount < limits.minimumCodePoints) {
    return { ok: false, reason: 'empty' };
  }
  if (characterCount > limits.maximumCodePoints) {
    return { ok: false, reason: 'too-long' };
  }

  return { ok: true, value, characterCount };
}
