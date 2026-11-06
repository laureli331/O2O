import { createHash } from 'node:crypto';

/** SHA-256 digest of the exact UTF-8 input, encoded as lowercase hexadecimal. */
export function sha256Utf8Hex(serializedInput: string): string {
  return createHash('sha256').update(serializedInput, 'utf8').digest('hex');
}
