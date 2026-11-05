import { validatePublicImageCount, type ValidatePublicImageCountResult } from './public-image-count';

export type RepairOtherPublicTextField =
  | 'title'
  | 'description'
  | 'business'
  | 'community'
  | 'landmark';

export type RepairOtherPublicTextLengthField = 'title' | 'description' | 'landmark';

export type ValidateRepairOtherPublicTextResult =
  | { readonly ok: true; readonly value: string; readonly characterCount: number }
  | { readonly ok: false; readonly reason: 'unknown-field' | 'not-string' | 'empty' | 'too-long' };

export interface RepairOtherPublicTextProjection {
  readonly title: string;
  readonly description: string;
  readonly business: string;
  readonly community: string;
  readonly landmark?: string;
}

export type ValidateRepairOtherPublicImageCountResult = ValidatePublicImageCountResult;

export type ParseRepairOtherPublicTextProjectionResult =
  | { readonly ok: true; readonly value: RepairOtherPublicTextProjection }
  | {
    readonly ok: false;
    readonly reason:
      | { readonly code: 'not-object' }
      | { readonly code: 'missing-field'; readonly field: Exclude<RepairOtherPublicTextField, 'landmark'> }
      | {
        readonly code: 'invalid-field';
        readonly field: RepairOtherPublicTextField;
        readonly fieldReason: 'not-string' | 'empty';
      };
  };

const REQUIRED_FIELDS = ['title', 'description', 'business', 'community'] as const;

const PUBLIC_TEXT_LENGTH_LIMITS = {
  title: { minimumCodePoints: 1, maximumCodePoints: 30 },
  description: { minimumCodePoints: 1, maximumCodePoints: 1_000 },
  landmark: { minimumCodePoints: 0, maximumCodePoints: 50 },
} as const;

/**
 * Trims edge whitespace and validates the PRD F02 title, description, or
 * optional landmark. Counts Unicode code points, not UTF-16 code units or
 * grapheme clusters. This does not validate business/category or community.
 */
export function validateRepairOtherPublicText(
  field: string,
  input: unknown,
): ValidateRepairOtherPublicTextResult {
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
  const limits = PUBLIC_TEXT_LENGTH_LIMITS[field];

  if (characterCount < limits.minimumCodePoints) {
    return { ok: false, reason: 'empty' };
  }
  if (characterCount > limits.maximumCodePoints) {
    return { ok: false, reason: 'too-long' };
  }

  return { ok: true, value, characterCount };
}

/**
 * Copies only the F02 public text fields and trims edge whitespace. Extra source
 * fields (including private address/contact data) are intentionally discarded.
 * Field length limits are not checked here: call
 * validateRepairOtherPublicText for the F02 title, description, or landmark.
 */
export function parseRepairOtherPublicTextProjection(
  input: unknown,
): ParseRepairOtherPublicTextProjectionResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, reason: { code: 'not-object' } };
  }

  const source = input as Record<string, unknown>;
  const projection: {
    title: string;
    description: string;
    business: string;
    community: string;
    landmark?: string;
  } = {
    title: '',
    description: '',
    business: '',
    community: '',
  };

  for (const field of REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(source, field)) {
      return { ok: false, reason: { code: 'missing-field', field } };
    }

    const rawValue = source[field];
    if (typeof rawValue !== 'string') {
      return { ok: false, reason: { code: 'invalid-field', field, fieldReason: 'not-string' } };
    }

    const value = rawValue.trim();
    if (value.length === 0) {
      return { ok: false, reason: { code: 'invalid-field', field, fieldReason: 'empty' } };
    }

    projection[field] = value;
  }

  if (Object.prototype.hasOwnProperty.call(source, 'landmark')) {
    const rawLandmark = source.landmark;
    if (typeof rawLandmark !== 'string') {
      return { ok: false, reason: { code: 'invalid-field', field: 'landmark', fieldReason: 'not-string' } };
    }

    projection.landmark = rawLandmark.trim();
  }

  return { ok: true, value: projection };
}

/** Backward-compatible F02 name; delegates to the shared F02/F03 image-count rule. */
export function validateRepairOtherPublicImageCount(
  input: unknown,
): ValidateRepairOtherPublicImageCountResult {
  return validatePublicImageCount(input);
}
