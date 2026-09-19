// packages/audit/src/memory/store.ts
//
// The audit store, anchored to globalThis behind a uniquely named optional
// property, exactly as apps/web/src/server/repositories/memory/store.ts's
// demoStore is and for the same reason — a plain module map is reset by
// Next's Fast Refresh and can duplicate across bundler chunks, which during
// a live walkthrough looks like the audit trail losing an event that just
// happened. The monotonic id counter lives in the SAME anchored object as
// the events, so a refresh cannot reset the counter while keeping the
// events.

import type { AuditEvent } from "@dsar/schemas/audit-event";

interface AuditStore {
  events: Map<string, AuditEvent>;
  nextId: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __dsarAuditStore: AuditStore | undefined;
}

export const auditStore: AuditStore =
  globalThis.__dsarAuditStore ??
  (globalThis.__dsarAuditStore = {
    events: new Map(),
    nextId: 1,
  });
