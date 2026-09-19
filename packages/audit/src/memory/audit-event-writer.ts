// packages/audit/src/memory/audit-event-writer.ts
//
// The in-memory AuditEventWriter. Identifiers are monotonic and zero-padded
// to a fixed width so lexicographic order is chronological order even for
// two events written inside the same millisecond — listing and exporting
// both order by identifier, never by timestamp alone. Every append parses
// the complete event through the frozen AuditEventSchema, which is where an
// undeclared payload key is refused; a refusal throws and stores nothing.
// Deep-copy on write and on every read with structuredClone, the same
// isolation apps/web/src/server/repositories/memory/matter-repository.ts
// already gives, so a caller mutating a returned event cannot reach into a
// record that is supposed to be append-only. The write is never
// best-effort: a failure propagates to the caller rather than being logged
// and swallowed.
//
// AUDIT-03's elapsedReviewMs requirement on LINE_DISPOSITIONED and
// SIGNED_OFF events is enforced here in full by plan 04-01 Task 2 — this
// task (Task 1) only proves append/deep-copy/undeclared-key-refusal, since
// no LINE_DISPOSITIONED or SIGNED_OFF event exists yet for this plan's one
// converted call site (SUBMITTED).

import { AuditEventSchema } from "@dsar/schemas/audit-event";
import type { AuditEventWriter } from "../interface.ts";
import { auditStore } from "./store.ts";

const ID_WIDTH = 10;

// AUDIT-03: the two event types that must carry an elapsedReviewMs figure
// in their payload. Enforced at the writer, not at a call site, so the
// requirement cannot be forgotten by a future caller (04-RESEARCH.md
// Pitfall 3; completed by Task 2 of this plan).
const EVENT_TYPES_REQUIRING_ELAPSED: ReadonlySet<string> = new Set(["LINE_DISPOSITIONED", "SIGNED_OFF"]);

function nextId(): string {
  const id = auditStore.nextId++;
  return String(id).padStart(ID_WIDTH, "0");
}

export const memoryAuditEventWriter: AuditEventWriter = {
  async append(event) {
    if (EVENT_TYPES_REQUIRING_ELAPSED.has(event.type) && event.payload.elapsedReviewMs === undefined) {
      throw new Error(`${event.type} events must carry an elapsedReviewMs figure in their payload`);
    }
    const full = AuditEventSchema.parse({ ...event, id: nextId() });
    const copy = structuredClone(full);
    auditStore.events.set(copy.id, copy);
    return structuredClone(copy);
  },

  async listByMatter(matterId) {
    return [...auditStore.events.values()]
      .filter((event) => event.matterId === matterId)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((event) => structuredClone(event));
  },

  async exportAll() {
    return [...auditStore.events.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((event) => structuredClone(event));
  },
};
