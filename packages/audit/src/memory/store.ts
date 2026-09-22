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
//
// The pack-lifecycle collection (plan 04-03) lives inside this SAME
// globalThis-anchored object, alongside the matter-scoped one, for the
// identical reason — a refresh must not be able to reset one stream's
// counter while leaving the other's events in place. It is a genuinely
// separate Map with its own monotonic counter (D-21: a pack-lifecycle event
// has no matter to key from), never merged into `events`.

import type { AuditEvent } from "@dsar/schemas/audit-event";
import type { PackLifecycleEvent } from "../interface.ts";

interface AuditStore {
  events: Map<string, AuditEvent>;
  nextId: number;
  packLifecycleEvents: Map<string, PackLifecycleEvent>;
  nextPackLifecycleId: number;
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
    packLifecycleEvents: new Map(),
    nextPackLifecycleId: 1,
  });
