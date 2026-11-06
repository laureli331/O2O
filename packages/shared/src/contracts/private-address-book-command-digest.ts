import { serializeCanonicalJson } from './canonical-json';
import { parsePrivateAddressBookEntryDraft } from './private-address-book';
import type { PrivateAddressBookEntryDraft } from './private-address-book';

export type PrivateAddressBookCommandOperation = 'create' | 'update' | 'delete';

export type PrivateAddressBookCommand =
  | {
    readonly operation: 'create';
    readonly payload: {
      readonly draft: PrivateAddressBookEntryDraft;
      readonly makeDefault: boolean;
    };
  }
  | {
    readonly operation: 'update';
    readonly expectedVersion: number;
    readonly payload: {
      readonly addressId: string;
      readonly draft: PrivateAddressBookEntryDraft;
      readonly makeDefault: boolean;
    };
  }
  | {
    readonly operation: 'delete';
    readonly expectedVersion: number;
    readonly payload: { readonly addressId: string };
  };

export type ParsePrivateAddressBookCommandResult =
  | { readonly ok: true; readonly value: PrivateAddressBookCommand }
  | {
    readonly ok: false;
    readonly reason:
      | { readonly code: 'not-object' }
      | {
        readonly code: 'missing-field';
        readonly field:
          | 'operation'
          | 'payload'
          | 'expectedVersion'
          | 'payload.addressId'
          | 'payload.draft'
          | 'payload.makeDefault';
      }
      | { readonly code: 'unexpected-field'; readonly field: string }
      | { readonly code: 'unknown-operation' }
      | { readonly code: 'invalid-expected-version' }
      | { readonly code: 'invalid-address-id' }
      | { readonly code: 'invalid-make-default' }
      | { readonly code: 'invalid-draft' };
  };

export type PrivateAddressBookCommandSha256Utf8Hex = (serializedInput: string) => string;

export type PrivateAddressBookCommandPayloadDigestResult =
  | { readonly ok: true; readonly digest: string }
  | {
    readonly ok: false;
    readonly reason: 'invalid-command' | 'serialization-failed' | 'invalid-sha256-output';
  };

const PRIVATE_ADDRESS_BOOK_COMMAND_DIGEST_DOMAIN = 'o2o.f09.private-address-book-command';
const PRIVATE_ADDRESS_BOOK_COMMAND_DIGEST_VERSION = 1;

const ROOT_FIELDS = ['operation', 'expectedVersion', 'payload'] as const;

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function hasUnexpectedField(record: Record<string, unknown>, allowed: readonly string[]): string | undefined {
  return Object.keys(record).find((field) => !allowed.includes(field));
}

function readAddressId(input: unknown): string | undefined {
  return typeof input === 'string' && input.trim().length > 0 ? input : undefined;
}

function readExpectedVersion(input: unknown): number | undefined {
  return typeof input === 'number' && Number.isFinite(input) ? input : undefined;
}

/**
 * Parses the F09 operation-specific portion of a command after the generic
 * command envelope has been checked. Create has no expected version; update
 * and delete require one. The version is preserved exactly and must still be
 * compared with the current server record before writing.
 *
 * `makeDefault` records the V09 form toggle intent on create/update. The
 * caller must use the trusted owner pointer and commit the pointer with the
 * entry change in the same proven server transaction.
 */
export function parsePrivateAddressBookCommand(
  input: unknown,
): ParsePrivateAddressBookCommandResult {
  if (!isRecord(input)) {
    return { ok: false, reason: { code: 'not-object' } };
  }

  const operation = input.operation;
  if (operation !== 'create' && operation !== 'update' && operation !== 'delete') {
    return Object.prototype.hasOwnProperty.call(input, 'operation')
      ? { ok: false, reason: { code: 'unknown-operation' } }
      : { ok: false, reason: { code: 'missing-field', field: 'operation' } };
  }
  if (!Object.prototype.hasOwnProperty.call(input, 'payload')) {
    return { ok: false, reason: { code: 'missing-field', field: 'payload' } };
  }

  const hasExpectedVersion = Object.prototype.hasOwnProperty.call(input, 'expectedVersion');
  if (operation === 'create' && hasExpectedVersion) {
    return { ok: false, reason: { code: 'unexpected-field', field: 'expectedVersion' } };
  }
  if ((operation === 'update' || operation === 'delete') && !hasExpectedVersion) {
    return { ok: false, reason: { code: 'missing-field', field: 'expectedVersion' } };
  }

  const unexpectedRootField = hasUnexpectedField(input, ROOT_FIELDS);
  if (unexpectedRootField !== undefined) {
    return { ok: false, reason: { code: 'unexpected-field', field: unexpectedRootField } };
  }

  const expectedVersion = hasExpectedVersion ? readExpectedVersion(input.expectedVersion) : undefined;
  if (hasExpectedVersion && expectedVersion === undefined) {
    return { ok: false, reason: { code: 'invalid-expected-version' } };
  }

  if (!isRecord(input.payload)) {
    return { ok: false, reason: { code: 'invalid-draft' } };
  }

  if (operation === 'delete') {
    const unexpectedPayloadField = hasUnexpectedField(input.payload, ['addressId']);
    if (unexpectedPayloadField !== undefined) {
      return { ok: false, reason: { code: 'unexpected-field', field: unexpectedPayloadField } };
    }
    if (!Object.prototype.hasOwnProperty.call(input.payload, 'addressId')) {
      return { ok: false, reason: { code: 'missing-field', field: 'payload.addressId' } };
    }
    const addressId = readAddressId(input.payload.addressId);
    if (addressId === undefined) {
      return { ok: false, reason: { code: 'invalid-address-id' } };
    }
    return { ok: true, value: { operation, expectedVersion: expectedVersion!, payload: { addressId } } };
  }

  const unexpectedPayloadField = hasUnexpectedField(input.payload, operation === 'create'
    ? ['draft', 'makeDefault']
    : ['addressId', 'draft', 'makeDefault']);
  if (unexpectedPayloadField !== undefined) {
    return { ok: false, reason: { code: 'unexpected-field', field: unexpectedPayloadField } };
  }
  if (!Object.prototype.hasOwnProperty.call(input.payload, 'draft')) {
    return { ok: false, reason: { code: 'missing-field', field: 'payload.draft' } };
  }
  if (!Object.prototype.hasOwnProperty.call(input.payload, 'makeDefault')) {
    return { ok: false, reason: { code: 'missing-field', field: 'payload.makeDefault' } };
  }
  if (typeof input.payload.makeDefault !== 'boolean') {
    return { ok: false, reason: { code: 'invalid-make-default' } };
  }

  const draft = parsePrivateAddressBookEntryDraft(input.payload.draft);
  if (!draft.ok) {
    return { ok: false, reason: { code: 'invalid-draft' } };
  }

  if (operation === 'create') {
    return {
      ok: true,
      value: { operation, payload: { draft: draft.value, makeDefault: input.payload.makeDefault } },
    };
  }

  if (!Object.prototype.hasOwnProperty.call(input.payload, 'addressId')) {
    return { ok: false, reason: { code: 'missing-field', field: 'payload.addressId' } };
  }
  const addressId = readAddressId(input.payload.addressId);
  if (addressId === undefined) {
    return { ok: false, reason: { code: 'invalid-address-id' } };
  }
  return {
    ok: true,
    value: {
      operation,
      expectedVersion: expectedVersion!,
      payload: { addressId, draft: draft.value, makeDefault: input.payload.makeDefault },
    },
  };
}

/**
 * Hashes the strict, normalized F09 command payload for same-key replay checks.
 * Expected version, target address and default-toggle intent are part of the
 * digest; request key and trusted owner scope belong in the idempotency record
 * ID. No personal address fields are returned by this helper. This digest is
 * not an access-control or confidentiality mechanism.
 */
export function createPrivateAddressBookCommandPayloadDigest(
  input: unknown,
  sha256Utf8Hex: PrivateAddressBookCommandSha256Utf8Hex,
): PrivateAddressBookCommandPayloadDigestResult {
  const parsed = parsePrivateAddressBookCommand(input);
  if (!parsed.ok) {
    return { ok: false, reason: 'invalid-command' };
  }

  const serialized = serializeCanonicalJson([
    PRIVATE_ADDRESS_BOOK_COMMAND_DIGEST_DOMAIN,
    PRIVATE_ADDRESS_BOOK_COMMAND_DIGEST_VERSION,
    parsed.value,
  ]);
  if (!serialized.ok) {
    return { ok: false, reason: 'serialization-failed' };
  }

  const digest = sha256Utf8Hex(serialized.json);
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    return { ok: false, reason: 'invalid-sha256-output' };
  }

  return { ok: true, digest };
}
