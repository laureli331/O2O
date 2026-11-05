import { validatePublicImageCount, type ValidatePublicImageCountResult } from './public-image-count';

export type RepairOtherPublicTextField =
  | 'title'
  | 'description'
  | 'business'
  | 'community'
  | 'landmark';

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

/**
 * Copies only the F02 public text fields and trims edge whitespace. Extra source
 * fields (including private address/contact data) are intentionally discarded.
 * Field length limits are not checked here: this is a projection boundary, not
 * the F02 form validator, and the F02 text-count rule has not been resolved.
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
