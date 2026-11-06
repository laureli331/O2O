import { validateIntegerCountInRange, type ValidateIntegerCountInRangeResult } from './integer-count-range';
import { validateTrimmedTextRange, type ValidateTrimmedTextRangeResult } from './trimmed-text-range';

export const REPORT_REASON_OPTIONS = [
  '疑似诈骗',
  '虚假信息',
  '违规内容',
  '骚扰/隐私泄露',
  '服务/费用争议',
  '其他',
] as const;

export type ReportReason = (typeof REPORT_REASON_OPTIONS)[number];

export type ValidateReportReasonResult =
  | { readonly ok: true; readonly value: ReportReason }
  | { readonly ok: false; readonly reason: 'not-string' | 'unknown-reason' };

export type ValidateReportTextResult = ValidateTrimmedTextRangeResult;

export type ValidateReportSupplementalTextResult =
  | { readonly ok: true; readonly value: string; readonly characterCount: number }
  | { readonly ok: false; readonly reason: 'invalid-report-reason' | 'not-string' | 'empty' | 'too-long' };

export type ValidateReportImageCountResult = ValidateIntegerCountInRangeResult;
export type ValidateAppealStatementResult = ValidateReportTextResult;
export type ValidateOperationsActionReasonResult = ValidateReportTextResult;

function isReportReason(input: unknown): input is ReportReason {
  return REPORT_REASON_OPTIONS.some((reason) => reason === input);
}

/** Validates only the F12 reason label; it does not define storage or wire codes. */
export function validateReportReason(input: unknown): ValidateReportReasonResult {
  if (typeof input !== 'string') {
    return { ok: false, reason: 'not-string' };
  }
  if (!isReportReason(input)) {
    return { ok: false, reason: 'unknown-reason' };
  }

  return { ok: true, value: input };
}

/** Validates the optional F12 supplemental text and requires it for the Other reason. */
export function validateReportSupplementalText(
  input: unknown,
  selectedReason: unknown,
): ValidateReportSupplementalTextResult {
  const reason = validateReportReason(selectedReason);
  if (!reason.ok) {
    return { ok: false, reason: 'invalid-report-reason' };
  }

  if (input === undefined && reason.value !== '其他') {
    return { ok: true, value: '', characterCount: 0 };
  }
  if (input === undefined) {
    return { ok: false, reason: 'empty' };
  }

  return validateTrimmedTextRange(input, reason.value === '其他' ? 1 : 0, 1000);
}

/** Validates only the number of F12 report images; file content and access are separate. */
export function validateReportImageCount(input: unknown): ValidateReportImageCountResult {
  return validateIntegerCountInRange(input, 0, 9);
}

/** Validates F12 appeal text after trimming edges and counting Unicode code points. */
export function validateAppealStatement(input: unknown): ValidateAppealStatementResult {
  return validateTrimmedTextRange(input, 1, 1000);
}

/** Validates F12 operator-action reason text only; it does not perform an action or transition. */
export function validateOperationsActionReason(input: unknown): ValidateOperationsActionReasonResult {
  return validateTrimmedTextRange(input, 1, 1000);
}
