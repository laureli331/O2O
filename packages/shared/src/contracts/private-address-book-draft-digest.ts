import { serializeCanonicalJson } from './canonical-json';
import { parsePrivateAddressBookEntryDraft } from './private-address-book';

export type PrivateAddressBookDraftSha256Utf8Hex = (serializedInput: string) => string;

export type PrivateAddressBookDraftPayloadDigestResult =
  | { readonly ok: true; readonly digest: string }
  | { readonly ok: false; readonly reason: 'invalid-draft' | 'serialization-failed' | 'invalid-sha256-output' };

const PRIVATE_ADDRESS_BOOK_DRAFT_DIGEST_DOMAIN = 'o2o.f09.private-address-book-entry-draft';
const PRIVATE_ADDRESS_BOOK_DRAFT_DIGEST_VERSION = 1;

/**
 * Hashes the validated, normalized five-field F09 address draft with a
 * versioned domain marker. This is only a payload building block: callers must
 * compose operation-specific identity, address IDs, expected versions, default
 * state, authorization and transaction behavior outside this helper.
 *
 * The injected adapter must return lowercase SHA-256 hex. Adapter exceptions
 * are allowed to propagate as infrastructure failures. The digest is not an
 * anonymization or confidentiality mechanism for personal address data.
 */
export function createPrivateAddressBookDraftPayloadDigest(
  input: unknown,
  sha256Utf8Hex: PrivateAddressBookDraftSha256Utf8Hex,
): PrivateAddressBookDraftPayloadDigestResult {
  const parsed = parsePrivateAddressBookEntryDraft(input);
  if (!parsed.ok) {
    return { ok: false, reason: 'invalid-draft' };
  }

  const encoded = serializeCanonicalJson([
    PRIVATE_ADDRESS_BOOK_DRAFT_DIGEST_DOMAIN,
    PRIVATE_ADDRESS_BOOK_DRAFT_DIGEST_VERSION,
    parsed.value,
  ]);
  if (!encoded.ok) {
    return { ok: false, reason: 'serialization-failed' };
  }

  const digest = sha256Utf8Hex(encoded.json);
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    return { ok: false, reason: 'invalid-sha256-output' };
  }

  return { ok: true, digest };
}
