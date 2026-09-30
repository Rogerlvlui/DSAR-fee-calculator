// apps/web/src/domain/display-date.ts
//
// "25 Sep 2026" — the same day-month-year style the review screen already
// uses for its advisory deadline. Month names come from a fixed table rather
// than Intl's own short month, which varies by ICU version ("Sep" vs "Sept").

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Formats an ISO timestamp as a calendar date in `timeZone` (default: the server's own). */
export function formatDisplayDate(isoTimestamp: string, timeZone?: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone,
  }).formatToParts(date);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return `${part("day")} ${MONTHS[part("month") - 1]} ${part("year")}`;
}

/** Formats an ISO calendar date ("2026-09-25") as "25 Sep 2026". Read straight from the string,
 * never through a Date, so no time zone can move it by a day. */
export function formatIsoCalendarDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return "";
  const [, year, month, day] = match;
  const monthName = MONTHS[Number(month) - 1];
  return monthName ? `${Number(day)} ${monthName} ${year}` : "";
}
