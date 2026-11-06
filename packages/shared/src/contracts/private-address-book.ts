export type ValidatePrivateAddressBookPhoneResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly reason: 'not-string' | 'not-eleven-digits' };

export type PrivateAddressBookTextField = 'contact' | 'community' | 'detailAddress' | 'remark';

export type ValidatePrivateAddressBookTextResult =
  | { readonly ok: true; readonly value: string; readonly characterCount: number }
  | { readonly ok: false; readonly reason: 'unknown-field' | 'not-string' | 'empty' | 'too-long' };

export interface PrivateAddressBookEntryDraft {
  readonly contact: string;
  readonly phone: string;
  readonly community: string;
  readonly detailAddress: string;
  readonly remark: string;
}

export type PrivateAddressBookEntryDraftField =
  | 'contact'
  | 'phone'
  | 'community'
  | 'detailAddress'
  | 'remark';

export type ParsePrivateAddressBookEntryDraftResult =
  | { readonly ok: true; readonly value: PrivateAddressBookEntryDraft }
  | {
    readonly ok: false;
    readonly reason:
      | { readonly code: 'not-object' }
      | { readonly code: 'missing-field'; readonly field: Exclude<PrivateAddressBookEntryDraftField, 'remark'> }
      | { readonly code: 'unexpected-field'; readonly field: string }
      | {
        readonly code: 'invalid-field';
        readonly field: PrivateAddressBookEntryDraftField;
        readonly fieldReason: 'not-string' | 'not-eleven-digits' | 'empty' | 'too-long' | 'unknown-field';
      };
  };

/** Logical per-owner pointer; this does not define a physical collection or field layout. */
export interface PrivateAddressBookDefaultPointer {
  readonly defaultAddressId: string | null;
}

export type ParsePrivateAddressBookDefaultPointerResult =
  | { readonly ok: true; readonly value: PrivateAddressBookDefaultPointer }
  | {
    readonly ok: false;
    readonly reason:
      | { readonly code: 'not-object' }
      | { readonly code: 'missing-field' }
      | { readonly code: 'invalid-address-id' }
      | { readonly code: 'unexpected-field'; readonly field: string };
  };

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
 * Narrows a logical per-owner default pointer to zero or one nonblank address ID.
 * It does not establish that the selected address exists or belongs to that owner.
 */
export function parsePrivateAddressBookDefaultPointer(
  input: unknown,
): ParsePrivateAddressBookDefaultPointerResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, reason: { code: 'not-object' } };
  }

  if (!Object.prototype.hasOwnProperty.call(input, 'defaultAddressId')) {
    return { ok: false, reason: { code: 'missing-field' } };
  }

  const fields = Object.keys(input);
  const unexpectedField = fields.find((field) => field !== 'defaultAddressId');
  if (unexpectedField !== undefined) {
    return { ok: false, reason: { code: 'unexpected-field', field: unexpectedField } };
  }

  const defaultAddressId = (input as Record<string, unknown>).defaultAddressId;
  if (defaultAddressId === null) {
    return { ok: true, value: { defaultAddressId: null } };
  }

  if (typeof defaultAddressId !== 'string' || defaultAddressId.trim().length === 0) {
    return { ok: false, reason: { code: 'invalid-address-id' } };
  }

  return { ok: true, value: { defaultAddressId } };
}

/**
 * Applies the confirmed delete transition: deleting the current default clears
 * the pointer, and no other address is promoted automatically. Callers must
 * verify address ownership and atomic deletion in the server transaction; this
 * pure helper does not verify address ownership or atomic deletion.
 */
export function clearPrivateAddressBookDefaultOnDelete(
  pointer: PrivateAddressBookDefaultPointer,
  deletedAddressId: string,
): PrivateAddressBookDefaultPointer {
  if (pointer.defaultAddressId !== deletedAddressId) {
    return pointer;
  }

  return { defaultAddressId: null };
}

/**
 * Applies the V09 save-toggle intent to the logical default pointer. Enabling
 * the toggle replaces the previous default; disabling it clears the pointer
 * only when the saved address is currently default. Callers must establish
 * ownership and perform the address/pointer writes atomically on the server.
 */
export function applyPrivateAddressBookDefaultOnSave(
  pointer: PrivateAddressBookDefaultPointer,
  savedAddressId: string,
  makeDefault: boolean,
): PrivateAddressBookDefaultPointer {
  if (makeDefault) {
    return { defaultAddressId: savedAddressId };
  }

  return pointer.defaultAddressId === savedAddressId
    ? { defaultAddressId: null }
    : pointer;
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

/**
 * Parses only the resident-provided F09 address-book draft fields and returns
 * normalized text. The server must attach owner identity and enforce address
 * ownership/default uniqueness; this parser does not define a physical schema.
 */
export function parsePrivateAddressBookEntryDraft(
  input: unknown,
): ParsePrivateAddressBookEntryDraftResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, reason: { code: 'not-object' } };
  }

  const record = input as Record<string, unknown>;
  const requiredFields = ['contact', 'phone', 'community', 'detailAddress'] as const;
  for (const field of requiredFields) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) {
      return { ok: false, reason: { code: 'missing-field', field } };
    }
  }

  const allowedFields: readonly string[] = [
    'contact',
    'phone',
    'community',
    'detailAddress',
    'remark',
  ];
  const unexpectedField = Object.keys(record).find((field) => !allowedFields.includes(field));
  if (unexpectedField !== undefined) {
    return { ok: false, reason: { code: 'unexpected-field', field: unexpectedField } };
  }

  const contact = validatePrivateAddressBookText('contact', record.contact);
  if (!contact.ok) {
    return { ok: false, reason: { code: 'invalid-field', field: 'contact', fieldReason: contact.reason } };
  }

  const phone = validatePrivateAddressBookPhone(record.phone);
  if (!phone.ok) {
    return { ok: false, reason: { code: 'invalid-field', field: 'phone', fieldReason: phone.reason } };
  }

  const community = validatePrivateAddressBookText('community', record.community);
  if (!community.ok) {
    return { ok: false, reason: { code: 'invalid-field', field: 'community', fieldReason: community.reason } };
  }

  const detailAddress = validatePrivateAddressBookText('detailAddress', record.detailAddress);
  if (!detailAddress.ok) {
    return { ok: false, reason: { code: 'invalid-field', field: 'detailAddress', fieldReason: detailAddress.reason } };
  }

  const remark = validatePrivateAddressBookText('remark', record.remark);
  if (!remark.ok) {
    return { ok: false, reason: { code: 'invalid-field', field: 'remark', fieldReason: remark.reason } };
  }

  return {
    ok: true,
    value: {
      contact: contact.value,
      phone: phone.value,
      community: community.value,
      detailAddress: detailAddress.value,
      remark: remark.value,
    },
  };
}

/**
 * Copies a previously validated address-book value into a detached task value.
 * Only the five F09 address fields are copied; identifiers, owner metadata and
 * default-address state are intentionally outside the task snapshot. This is
 * an in-memory value copy only: it does not persist the snapshot or enforce
 * authorization, ownership, privacy, or transaction boundaries.
 */
export function createPrivateAddressBookTaskSnapshot(
  entry: PrivateAddressBookEntryDraft,
): PrivateAddressBookEntryDraft {
  return {
    contact: entry.contact,
    phone: entry.phone,
    community: entry.community,
    detailAddress: entry.detailAddress,
    remark: entry.remark,
  };
}
