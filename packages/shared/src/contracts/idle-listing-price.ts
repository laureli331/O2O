import { parseCnyFen, type CnyFen } from './money';

export type IdleListingPrice =
  | { readonly kind: 'negotiable' }
  | { readonly kind: 'fixed'; readonly amountFen: CnyFen };

export type ParseIdleListingPriceResult =
  | { readonly ok: true; readonly value: IdleListingPrice }
  | {
    readonly ok: false;
    readonly reason: 'not-string' | 'not-positive' | 'invalid-format' | 'too-precise' | 'out-of-range';
  };

/**
 * Validates the F03 price field only: the literal PRD option "面议", or a
 * positive yuan decimal accepted by the shared exact-to-fen money parser.
 * Whitespace is not normalized because the PRD does not specify that behavior.
 */
export function parseIdleListingPrice(input: unknown): ParseIdleListingPriceResult {
  if (typeof input !== 'string') return { ok: false, reason: 'not-string' };
  if (input === '面议') return { ok: true, value: { kind: 'negotiable' } };

  const parsed = parseCnyFen(input);
  if (!parsed.ok) {
    if (parsed.reason === 'not-decimal-string') return { ok: false, reason: 'not-string' };
    return { ok: false, reason: parsed.reason };
  }
  if (parsed.value === 0) return { ok: false, reason: 'not-positive' };

  return { ok: true, value: { kind: 'fixed', amountFen: parsed.value } };
}
