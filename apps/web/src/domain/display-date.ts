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
