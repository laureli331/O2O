export type AccountProfileTextField = 'nickname' | 'wechatId';

export type ValidateAccountProfileTextResult =
  | { readonly ok: true; readonly value: string; readonly characterCount: number }
  | { readonly ok: false; readonly reason: 'unknown-field' | 'not-string' | 'empty' | 'too-long' };

const ACCOUNT_PROFILE_TEXT_LIMITS = {
  nickname: { minimumCodePoints: 1, maximumCodePoints: 20 },
  wechatId: { minimumCodePoints: 1, maximumCodePoints: 50 },
} as const;

/**
 * Trims edge whitespace and validates only PRD F01 nickname/WeChat ID text
 * lengths by Unicode code point. An omitted or blank optional WeChat ID is
 * normalized to an empty value. This does not verify ID format or identity.
 */
export function validateAccountProfileText(
  field: string,
  input: unknown,
): ValidateAccountProfileTextResult {
  if (field !== 'nickname' && field !== 'wechatId') {
    return { ok: false, reason: 'unknown-field' };
  }

  if (field === 'wechatId' && input === undefined) {
    return { ok: true, value: '', characterCount: 0 };
  }

  if (typeof input !== 'string') {
    return { ok: false, reason: 'not-string' };
  }

  const value = input.trim();
  const characterCount = Array.from(value).length;

  if (field === 'wechatId' && characterCount === 0) {
    return { ok: true, value: '', characterCount: 0 };
  }

  const limits = ACCOUNT_PROFILE_TEXT_LIMITS[field];
  if (characterCount < limits.minimumCodePoints) {
    return { ok: false, reason: 'empty' };
  }
  if (characterCount > limits.maximumCodePoints) {
    return { ok: false, reason: 'too-long' };
  }

  return { ok: true, value, characterCount };
}
