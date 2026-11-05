export type ValidatePublicImageCountResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly reason: 'not-integer' | 'out-of-range' };

/** Validates the shared PRD range for F02/F03 post images; it does not inspect images. */
export function validatePublicImageCount(input: unknown): ValidatePublicImageCountResult {
  if (typeof input !== 'number' || !Number.isInteger(input)) {
    return { ok: false, reason: 'not-integer' };
  }

  if (input < 0 || input > 9) {
    return { ok: false, reason: 'out-of-range' };
  }

  return { ok: true, value: input };
}
