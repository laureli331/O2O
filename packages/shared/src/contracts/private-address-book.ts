export type ValidatePrivateAddressBookPhoneResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly reason: 'not-string' | 'not-eleven-digits' };

export type PrivateAddressBookTextField = 'contact' | 'community' | 'detailAddress' | 'remark';

export type ValidatePrivateAddressBookTextResult =
  | { readonly ok: true; readonly value: string; readonly characterCount: number }
  | { readonly ok: false; readonly reason: 'unknown-field' | 'not-string' | 'empty' | 'too-long' };

const ADDRESS_BOOK_TEXT_LIMITS: Readonly<Record<PrivateAddressBookTextField, {
  readonly minimumCodePoints: number;
  readonly maximumCodePoints?: number;
}>> = {
  contact: { minimumCodePoints: 1, maximumCodePoints: 20 },
  community: { minimumCodePoints: 1 },
  detailAddress: { minimumCodePoints: 1, maximumCodePoints: 200 },
  remark: { minimumCodePoints: 0, maximumCodePoints: 100 },
};

/**
 * Enforces the PRD's 11-digit address-book phone field shape only.
 * It does not verify control of the number or establish contact consent.
 */
export function validatePrivateAddressBookPhone(input: unknown): ValidatePrivateAddressBookPhoneResult {
  if (typeof input !== 'string') {
    return { ok: false, reason: 'not-string' };
  }

  if (!/^[0-9]{11}$/.test(input)) {
    return { ok: false, reason: 'not-eleven-digits' };
  }

  return { ok: true, value: input };
}

/**
 * Trims edge whitespace, then validates the PRD F09 address-book text limits.
 * Counts Unicode code points (not UTF-16 code units); it does not validate
 * community membership or the collection-level single-default invariant.
 */
export function validatePrivateAddressBookText(
  field: PrivateAddressBookTextField,
  input: unknown,
): ValidatePrivateAddressBookTextResult {
  const limits = ADDRESS_BOOK_TEXT_LIMITS[field];
  if (!limits) {
    return { ok: false, reason: 'unknown-field' };
  }

  if (field === 'remark' && input === undefined) {
    return { ok: true, value: '', characterCount: 0 };
  }

  if (typeof input !== 'string') {
    return { ok: false, reason: 'not-string' };
  }

  const value = input.trim();
  const characterCount = Array.from(value).length;
  if (characterCount < limits.minimumCodePoints) {
    return { ok: false, reason: 'empty' };
  }
  if (limits.maximumCodePoints !== undefined && characterCount > limits.maximumCodePoints) {
    return { ok: false, reason: 'too-long' };
  }

  return { ok: true, value, characterCount };
}
