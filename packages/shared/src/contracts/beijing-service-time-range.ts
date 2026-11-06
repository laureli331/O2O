export type BeijingServiceTimeRangeError =
  | 'not-object'
  | 'unexpected-field'
  | 'invalid-start-date-time'
  | 'invalid-end-date-time'
  | 'start-not-before-end';

export type BeijingServiceTimeRangeValidation =
  | { ok: true; startDateTime: string; endDateTime: string }
  | { ok: false; reason: BeijingServiceTimeRangeError };

function isValidBeijingCivilDateTime(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59) {
    return false;
  }

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

/**
 * Validates the F19 start and expiry fields as canonical Beijing civil time.
 * The accepted value is a local wall-clock string; no host timezone conversion occurs.
 */
export function validateBeijingServiceTimeRange(input: unknown): BeijingServiceTimeRangeValidation {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, reason: 'not-object' };
  }

  const fields = Object.keys(input);
  if (fields.some((field) => field !== 'startDateTime' && field !== 'endDateTime')) {
    return { ok: false, reason: 'unexpected-field' };
  }

  const record = input as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, 'startDateTime') || !isValidBeijingCivilDateTime(record.startDateTime)) {
    return { ok: false, reason: 'invalid-start-date-time' };
  }
  if (!Object.prototype.hasOwnProperty.call(record, 'endDateTime') || !isValidBeijingCivilDateTime(record.endDateTime)) {
    return { ok: false, reason: 'invalid-end-date-time' };
  }
  if (record.startDateTime >= record.endDateTime) {
    return { ok: false, reason: 'start-not-before-end' };
  }

  return {
    ok: true,
    startDateTime: record.startDateTime,
    endDateTime: record.endDateTime,
  };
}
