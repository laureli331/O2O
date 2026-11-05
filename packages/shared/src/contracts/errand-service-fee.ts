import { parseCnyFen, type CnyFen } from './money';

export type ParseErrandServiceFeeResult =
  | { readonly ok: true; readonly valueFen: CnyFen }
  | {
    readonly ok: false;
    readonly reason: 'not-decimal-string' | 'not-positive' | 'invalid-format' | 'too-precise' | 'out-of-range';
  };

/** Validate only the F04 publisher-entered positive service-fee amount. */
export function parseErrandServiceFee(input: unknown): ParseErrandServiceFeeResult {
  const parsed = parseCnyFen(input);
  if (!parsed.ok) return parsed;
  if (parsed.value === 0) return { ok: false, reason: 'not-positive' };

  return { ok: true, valueFen: parsed.value };
}
