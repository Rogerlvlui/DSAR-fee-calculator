// packages/engine/src/calendar-math.ts
//
// Date-free proleptic-Gregorian day counting — the only calendar arithmetic
// packages/engine ever does (PRD §8.1 steps 1 and 7: is `now` past
// `reviewDueOn`, and is it within 30 days of it). No reference to the
// `Date` global, no date library, and no locale API — 02-RESEARCH.md
// Pattern 4 chose hand-rolled integer arithmetic over an ESLint-exempted
// module deliberately: an exempted file would weaken the determinism gate
// to "no clock outside one reviewed file", and this arithmetic is short.
//
// Because neither ISO string is ever parsed through the environment-
// dependent `Date` constructor, the result is invariant under `TZ`/locale
// by construction — the property plan 02-07's timezone test exists to
// prove, not merely assume.

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29;
  return DAYS_IN_MONTH[month - 1] ?? 31;
}

export interface CivilDateParts {
  year: number;
  month: number;
  day: number;
}

// Strict, anchored parse of either a bare "YYYY-MM-DD" calendar date or a
// "YYYY-MM-DDTHH:MM:SS(.sss)?Z" UTC datetime — taking only the calendar
// portion of the latter. Anything else throws; there is no permissive
// fallback. Range-checks month (1-12) and day (1-(days in that month,
// leap-aware)).
export function parseIsoCalendarParts(value: string): CivilDateParts {
  const match = DATE_ONLY_RE.exec(value) ?? DATE_TIME_RE.exec(value);
  if (!match) {
    throw new Error(
      `calendar-math: '${value}' is not a valid ISO calendar date (YYYY-MM-DD) or UTC date-time (YYYY-MM-DDTHH:MM:SSZ)`
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12) {
    throw new Error(`calendar-math: '${value}' has an invalid month (${month}); must be 1-12`);
  }

  const maxDay = daysInMonth(year, month);
  if (day < 1 || day > maxDay) {
    throw new Error(
      `calendar-math: '${value}' has an invalid day (${day}) for ${year}-${String(month).padStart(2, "0")}; must be 1-${maxDay}`
    );
  }

  return { year, month, day };
}

// The standard "days from civil" algorithm (proleptic Gregorian, pure
// integer arithmetic) — returns the day number relative to the Unix epoch
// (1970-01-01 is day 0). Exact for the full year range this product needs;
// no `Date` reference anywhere in this function.
export function civilToDayNumber(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor((y >= 0 ? y : y - 399) / 400);
  const yoe = y - era * 400; // [0, 399]
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1; // [0, 365]
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy; // [0, 146096]
  return era * 146097 + doe - 719468;
}

// The only two calendar comparisons the engine ever makes read this one
// function: is `targetIsoDate` in the future, today, or in the past
// relative to `nowIsoDateTime`? Positive => future, zero => today, negative
// => past. Both the staleness precondition (task 3) and the 30-day warning
// (plan 02-06) share this exact day-boundary semantics.
export function daysUntil(nowIsoDateTime: string, targetIsoDate: string): number {
  const now = parseIsoCalendarParts(nowIsoDateTime);
  const target = parseIsoCalendarParts(targetIsoDate);
  return civilToDayNumber(target.year, target.month, target.day) - civilToDayNumber(now.year, now.month, now.day);
}
