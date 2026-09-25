import { describe, expect, it } from "vitest";
import { formatDisplayDate } from "./display-date.ts";

describe("DISPLAY-DATE: formatDisplayDate", () => {
  it("DISPLAY-DATE: formats an ISO timestamp as day, short month, year — no time, no raw ISO", () => {
    expect(formatDisplayDate("2026-09-25T06:58:28.126Z", "Asia/Singapore")).toBe("25 Sep 2026");
  });

  it("DISPLAY-DATE: uses the calendar date in the given time zone, not UTC's", () => {
    // 23:30 UTC on 25 Sep is already 26 Sep in Singapore.
    expect(formatDisplayDate("2026-09-25T23:30:00.000Z", "Asia/Singapore")).toBe("26 Sep 2026");
    expect(formatDisplayDate("2026-09-25T23:30:00.000Z", "UTC")).toBe("25 Sep 2026");
  });

  it("DISPLAY-DATE: returns an empty string for a missing or unreadable timestamp", () => {
    expect(formatDisplayDate("")).toBe("");
    expect(formatDisplayDate("not a date")).toBe("");
  });
});
