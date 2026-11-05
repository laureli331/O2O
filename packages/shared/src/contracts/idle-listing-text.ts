export type IdleListingTextField = 'title' | 'description' | 'landmark';
export type IdleListingRequiredTextField = 'category' | 'community';

export type ValidateIdleListingTextResult =
  | { readonly ok: true; readonly value: string; readonly characterCount: number }
  | { readonly ok: false; readonly reason: 'unknown-field' | 'not-string' | 'empty' | 'too-long' };

export type ValidateIdleListingRequiredTextResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly reason: 'unknown-field' | 'not-string' | 'empty' };

const IDLE_LISTING_TEXT_LIMITS = {
  title: { minimumCodePoints: 1, maximumCodePoints: 30 },
  description: { minimumCodePoints: 1, maximumCodePoints: 1_000 },
  landmark: { minimumCodePoints: 0, maximumCodePoints: 50 },
} as const;

/**
 * Validates only the required nonblank shape of the F03 category and
 * community text. It does not define allowed categories, service-area
 * membership, or a maximum length because the PRD provides none here.
 */
export function validateIdleListingRequiredText(
  field: string,
  input: unknown,
): ValidateIdleListingRequiredTextResult {
  if (field !== 'category' && field !== 'community') {
    return { ok: false, reason: 'unknown-field' };
  }
  if (typeof input !== 'string') return { ok: false, reason: 'not-string' };

  const value = input.trim();
  if (value.length === 0) return { ok: false, reason: 'empty' };
  return { ok: true, value };
}

/**
 * Trims edge whitespace and validates the PRD F03 title, description, or
 * optional landmark length. Counts Unicode code points, not UTF-16 code units
 * or grapheme clusters. This does not validate category, location, or listing
 * eligibility and does not define persistence or platform behavior.
 */
export function validateIdleListingText(
  field: string,
  input: unknown,
): ValidateIdleListingTextResult {
  if (field !== 'title' && field !== 'description' && field !== 'landmark') {
    return { ok: false, reason: 'unknown-field' };
  }

  if (field === 'landmark' && input === undefined) {
    return { ok: true, value: '', characterCount: 0 };
  }

  if (typeof input !== 'string') {
    return { ok: false, reason: 'not-string' };
  }

  const value = input.trim();
  const characterCount = Array.from(value).length;
  const limits = IDLE_LISTING_TEXT_LIMITS[field];

  if (characterCount < limits.minimumCodePoints) {
    return { ok: false, reason: 'empty' };
  }
  if (characterCount > limits.maximumCodePoints) {
    return { ok: false, reason: 'too-long' };
  }

  return { ok: true, value, characterCount };
}
