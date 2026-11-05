export type ValidatePrivateAddressBookPhoneResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly reason: 'not-string' | 'not-eleven-digits' };

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
