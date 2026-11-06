export type DashboardDateRangeError =
  | 'not-object'
  | 'unexpected-field'
  | 'invalid-date'
  | 'invalid-today'
  | 'end-date-not-before-today'
  | 'start-after-end';

export type DashboardDateRangeValidation =
  | { ok: true; startDate: string; endDate: string }
  | { ok: false; reason: DashboardDateRangeError };

function isValidCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12) {
    return false;
  }

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

export function validateDashboardDateRange(
  input: unknown,
  todayInShanghai: unknown,
): DashboardDateRangeValidation {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, reason: 'not-object' };
  }

  const fields = Object.keys(input);
  if (fields.some((field) => field !== 'startDate' && field !== 'endDate')) {
    return { ok: false, reason: 'unexpected-field' };
  }
  if (
    fields.length !== 2 ||
    !Object.prototype.hasOwnProperty.call(input, 'startDate') ||
    !Object.prototype.hasOwnProperty.call(input, 'endDate')
  ) {
    return { ok: false, reason: 'invalid-date' };
  }

  const { startDate, endDate } = input as { startDate: unknown; endDate: unknown };
  if (!isValidCalendarDate(startDate) || !isValidCalendarDate(endDate)) {
    return { ok: false, reason: 'invalid-date' };
  }
  if (!isValidCalendarDate(todayInShanghai)) {
    return { ok: false, reason: 'invalid-today' };
  }
  if (endDate >= todayInShanghai) {
    return { ok: false, reason: 'end-date-not-before-today' };
  }
  if (startDate > endDate) {
    return { ok: false, reason: 'start-after-end' };
  }

  return { ok: true, startDate, endDate };
}
