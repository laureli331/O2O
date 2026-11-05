import { parseErrandServiceFee, type ParseErrandServiceFeeResult } from './errand-service-fee';
import type { CnyFen } from './money';

export type ErrandAdvanceTerms =
  | { readonly willingToAdvance: false; readonly advanceLimitFen: null }
  | { readonly willingToAdvance: true; readonly advanceLimitFen: CnyFen };

export type ParseErrandAdvanceTermsResult =
  | { readonly ok: true; readonly value: ErrandAdvanceTerms }
  | {
    readonly ok: false;
    readonly reason:
      | { readonly code: 'not-object' }
      | { readonly code: 'missing-field'; readonly field: 'willingToAdvance' | 'advanceLimitYuan' }
      | { readonly code: 'unexpected-field'; readonly field: string }
      | { readonly code: 'invalid-willingness' }
      | {
        readonly code: 'invalid-advance-limit';
        readonly reason: Extract<ParseErrandServiceFeeResult, { readonly ok: false }>['reason'];
      };
  };

/**
 * Parses the F05 applicant's willingness and conditional positive advance cap.
 * When the applicant is unwilling, a stale cap value is ignored and normalized
 * to null. This shared parser does not accept applications or enforce server rules.
 */
export function parseErrandAdvanceTerms(input: unknown): ParseErrandAdvanceTermsResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, reason: { code: 'not-object' } };
  }

  const record = input as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, 'willingToAdvance')) {
    return { ok: false, reason: { code: 'missing-field', field: 'willingToAdvance' } };
  }

  const unexpectedField = Object.keys(record).find(
    (field) => field !== 'willingToAdvance' && field !== 'advanceLimitYuan',
  );
  if (unexpectedField !== undefined) {
    return { ok: false, reason: { code: 'unexpected-field', field: unexpectedField } };
  }

  const willingToAdvance = record.willingToAdvance;
  if (typeof willingToAdvance !== 'boolean') {
    return { ok: false, reason: { code: 'invalid-willingness' } };
  }

  if (!willingToAdvance) {
    return { ok: true, value: { willingToAdvance: false, advanceLimitFen: null } };
  }

  if (!Object.prototype.hasOwnProperty.call(record, 'advanceLimitYuan')) {
    return { ok: false, reason: { code: 'missing-field', field: 'advanceLimitYuan' } };
  }

  const parsedLimit = parseErrandServiceFee(record.advanceLimitYuan);
  if (!parsedLimit.ok) {
    return { ok: false, reason: { code: 'invalid-advance-limit', reason: parsedLimit.reason } };
  }

  return {
    ok: true,
    value: { willingToAdvance: true, advanceLimitFen: parsedLimit.valueFen },
  };
}
