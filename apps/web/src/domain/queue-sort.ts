// apps/web/src/domain/queue-sort.ts
//
// /legal/queue's sort toggle (NAV-01) — pure, no SLA colour or escalation
// concept anywhere here (NS-5's own explicit bound): this module computes
// an ORDERING only, never a tone/urgency classification.
//
// DEADLINE_SOONEST partitions rows into resolvable (a real advisoryDeadline)
// and unresolvable (null — the UI-SPEC's own "Queue has no pack-derivable
// sort key for a matter" backstop row), sorts resolvable rows by ascending
// daysRemaining, sorts unresolvable rows by ascending requestReceivedOn,
// and places every unresolvable row AFTER every resolvable one — never at
// an undefined position, never throwing.
//
// OLDEST_FIRST ignores advisoryDeadline entirely: a single ascending sort
// by requestReceivedOn.
//
// [...rows].sort(...) throughout — the caller's own array is never mutated.

import type { AdvisoryDeadlineView } from "./advisory-deadline.ts";

export type QueueSortMode = "DEADLINE_SOONEST" | "OLDEST_FIRST";

export interface QueueSortableRow {
  requestReceivedOn: string;
  advisoryDeadline: AdvisoryDeadlineView | null;
}

function byAscendingRequestReceivedOn<T extends QueueSortableRow>(a: T, b: T): number {
  return a.requestReceivedOn < b.requestReceivedOn ? -1 : a.requestReceivedOn > b.requestReceivedOn ? 1 : 0;
}

export function sortQueueRows<T extends QueueSortableRow>(rows: readonly T[], mode: QueueSortMode): T[] {
  if (mode === "OLDEST_FIRST") {
    return [...rows].sort(byAscendingRequestReceivedOn);
  }

  // DEADLINE_SOONEST
  const resolvable = rows.filter((row) => row.advisoryDeadline !== null);
  const unresolvable = rows.filter((row) => row.advisoryDeadline === null);

  resolvable.sort((a, b) => a.advisoryDeadline!.daysRemaining - b.advisoryDeadline!.daysRemaining);
  unresolvable.sort(byAscendingRequestReceivedOn);

  return [...resolvable, ...unresolvable];
}
