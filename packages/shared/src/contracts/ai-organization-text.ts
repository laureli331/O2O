export type AiOrganizationTextField = 'inputText' | 'candidateTitle' | 'candidateDescription';

export type ValidateAiOrganizationTextResult =
  | { readonly ok: true; readonly value: string; readonly characterCount: number }
  | { readonly ok: false; readonly reason: 'unknown-field' | 'not-string' | 'empty' | 'too-long' };

const AI_ORGANIZATION_TEXT_LIMITS = {
  inputText: { minimumCodePoints: 1, maximumCodePoints: 1_000 },
  candidateTitle: { minimumCodePoints: 1, maximumCodePoints: 30 },
  candidateDescription: { minimumCodePoints: 1, maximumCodePoints: 1_000 },
} as const;

/**
 * Trims edge whitespace and checks only the PRD F17 text-field lengths using
 * Unicode code points. This does not parse AI candidates or call a model.
 */
export function validateAiOrganizationText(
  field: string,
  input: unknown,
): ValidateAiOrganizationTextResult {
  if (field !== 'inputText' && field !== 'candidateTitle' && field !== 'candidateDescription') {
    return { ok: false, reason: 'unknown-field' };
  }

  if (typeof input !== 'string') {
    return { ok: false, reason: 'not-string' };
  }

  const value = input.trim();
  const characterCount = Array.from(value).length;
  const limits = AI_ORGANIZATION_TEXT_LIMITS[field];

  if (characterCount < limits.minimumCodePoints) {
    return { ok: false, reason: 'empty' };
  }
  if (characterCount > limits.maximumCodePoints) {
    return { ok: false, reason: 'too-long' };
  }

  return { ok: true, value, characterCount };
}
