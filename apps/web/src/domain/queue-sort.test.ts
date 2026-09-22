// apps/web/src/domain/queue-sort.test.ts
//
// Pure comparator tests for /legal/queue's sort toggle (NAV-01). Tagged
// queue-sort (matching the plan's own -t filter).

import { describe, expect, it } from "vitest";
import { sortQueueRows, type QueueSortableRow } from "./queue-sort.ts";

function row(id: string, requestReceivedOn: string, daysRemaining: number | null): QueueSortableRow & { id: string } {
  return {
    id,
    requestReceivedOn,
    advisoryDeadline: daysRemaining === null ? null : { basis: "RESPONSE_DEADLINE_FALLBACK", dueDateIso: "2026-10-01", daysRemaining },
  };
}

describe("queue-sort: sortQueueRows", () => {
  it("queue-sort: DEADLINE_SOONEST orders resolvable rows by ascending daysRemaining, unresolvable rows after, by ascending requestReceivedOn", () => {
    const rows = [
      row("a", "2026-09-01", 10),
      row("b", "2026-08-01", null),
      row("c", "2026-09-05", 2),
      row("d", "2026-07-01", null),
    ];
    const sorted = sortQueueRows(rows, "DEADLINE_SOONEST");
    expect(sorted.map((r) => r.id)).toEqual(["c", "a", "d", "b"]);
  });

  it("queue-sort: OLDEST_FIRST orders every row by ascending requestReceivedOn regardless of advisoryDeadline", () => {
    const rows = [row("a", "2026-09-01", 10), row("b", "2026-08-01", null), row("c", "2026-07-01", 2)];
    const sorted = sortQueueRows(rows, "OLDEST_FIRST");
    expect(sorted.map((r) => r.id)).toEqual(["c", "b", "a"]);
  });

  it("queue-sort: never throws for a row with a null advisoryDeadline in either mode", () => {
    const rows = [row("a", "2026-09-01", null)];
    expect(() => sortQueueRows(rows, "DEADLINE_SOONEST")).not.toThrow();
    expect(() => sortQueueRows(rows, "OLDEST_FIRST")).not.toThrow();
  });

  it("queue-sort: is pure — does not mutate the caller's own input array", () => {
    const rows = [row("a", "2026-09-05", 10), row("b", "2026-09-01", 2)];
    const original = [...rows];
    sortQueueRows(rows, "DEADLINE_SOONEST");
    expect(rows).toEqual(original);
  });
});
