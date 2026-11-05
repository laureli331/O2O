export type CommandErrorCategory =
  | 'invalid-input'
  | 'unauthenticated'
  | 'forbidden'
  | 'version-conflict'
  | 'business-rejected'
  | 'dependency-failure'
  | 'internal-failure';

export interface CommandError {
  readonly category: CommandErrorCategory;
  /** Stable, non-sensitive identifier defined by the owning module. */
  readonly code: string;
  readonly requestId: string;
}

export type CommandResult<TValue> =
  | { readonly status: 'succeeded'; readonly requestId: string; readonly value: TValue }
  | { readonly status: 'rejected'; readonly requestId: string; readonly error: CommandError }
  | { readonly status: 'failed'; readonly requestId: string; readonly error: CommandError }
  | { readonly status: 'processing'; readonly requestId: string }
  | { readonly status: 'unknown'; readonly requestId: string };

export type CommandResultValidationReason =
  | { readonly code: 'not-object' }
  | { readonly code: 'missing-field'; readonly field: string }
  | { readonly code: 'unexpected-field'; readonly field: string }
  | { readonly code: 'invalid-status' }
  | { readonly code: 'invalid-field-type'; readonly field: string }
  | { readonly code: 'invalid-error-category' }
  | { readonly code: 'request-id-mismatch' };

export type ParseCommandResultResult =
  | { readonly ok: true; readonly value: CommandResult<unknown> }
  | { readonly ok: false; readonly reason: CommandResultValidationReason };

const COMMAND_ERROR_CATEGORIES = new Set<string>([
  'invalid-input',
  'unauthenticated',
  'forbidden',
  'version-conflict',
  'business-rejected',
  'dependency-failure',
  'internal-failure',
]);

function isCommandErrorCategory(value: string): value is CommandErrorCategory {
  return COMMAND_ERROR_CATEGORIES.has(value);
}

/**
 * Parse the documented result union and copy only its declared fields.
 * This validates response shape only; it does not establish that a business
 * operation actually succeeded or authorize a retry for processing/unknown.
 */
export function parseCommandResult(input: unknown): ParseCommandResultResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, reason: { code: 'not-object' } };
  }

  const record = input as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, 'status')) {
    return { ok: false, reason: { code: 'missing-field', field: 'status' } };
  }
  const candidateStatus = record.status;
  if (
    candidateStatus !== 'succeeded' &&
    candidateStatus !== 'rejected' &&
    candidateStatus !== 'failed' &&
    candidateStatus !== 'processing' &&
    candidateStatus !== 'unknown'
  ) {
    return { ok: false, reason: { code: 'invalid-status' } };
  }
  if (!Object.prototype.hasOwnProperty.call(record, 'requestId')) {
    return { ok: false, reason: { code: 'missing-field', field: 'requestId' } };
  }
  if (typeof record.requestId !== 'string') {
    return { ok: false, reason: { code: 'invalid-field-type', field: 'requestId' } };
  }

  const status = candidateStatus;
  const requestId = record.requestId;
  const expectedFields = status === 'succeeded'
    ? ['status', 'requestId', 'value']
    : status === 'rejected' || status === 'failed'
      ? ['status', 'requestId', 'error']
      : ['status', 'requestId'];

  for (const field of Object.keys(record)) {
    if (!expectedFields.includes(field)) {
      return { ok: false, reason: { code: 'unexpected-field', field } };
    }
  }
  for (const field of expectedFields) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) {
      return { ok: false, reason: { code: 'missing-field', field } };
    }
  }

  if (status === 'succeeded') {
    return {
      ok: true,
      value: { status, requestId, value: record.value },
    };
  }

  if (status === 'processing' || status === 'unknown') {
    return { ok: true, value: { status, requestId } };
  }

  const error = record.error;
  if (typeof error !== 'object' || error === null || Array.isArray(error)) {
    return { ok: false, reason: { code: 'invalid-field-type', field: 'error' } };
  }

  const errorRecord = error as Record<string, unknown>;
  for (const field of Object.keys(errorRecord)) {
    if (field !== 'category' && field !== 'code' && field !== 'requestId') {
      return { ok: false, reason: { code: 'unexpected-field', field: `error.${field}` } };
    }
  }
  for (const field of ['category', 'code', 'requestId']) {
    if (!Object.prototype.hasOwnProperty.call(errorRecord, field)) {
      return { ok: false, reason: { code: 'missing-field', field: `error.${field}` } };
    }
  }
  if (typeof errorRecord.category !== 'string' || !isCommandErrorCategory(errorRecord.category)) {
    return { ok: false, reason: { code: 'invalid-error-category' } };
  }
  if (typeof errorRecord.code !== 'string') {
    return { ok: false, reason: { code: 'invalid-field-type', field: 'error.code' } };
  }
  if (typeof errorRecord.requestId !== 'string') {
    return { ok: false, reason: { code: 'invalid-field-type', field: 'error.requestId' } };
  }
  if (errorRecord.requestId !== requestId) {
    return { ok: false, reason: { code: 'request-id-mismatch' } };
  }

  return {
    ok: true,
    value: {
      status,
      requestId,
      error: {
        category: errorRecord.category as CommandErrorCategory,
        code: errorRecord.code,
        requestId: errorRecord.requestId,
      },
    },
  };
}
