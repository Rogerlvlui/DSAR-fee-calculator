// packages/audit/src/memory/pack-lifecycle-event-writer.ts
//
// The in-memory PackLifecycleEventWriter (D-21's separate stream — a
// PACK_ACTIVATED/PACK_EDITED event is about a RulePackVersion, which has no
// relationship to any Matter, and AuditEvent.matterId is frozen
// non-nullable). Mirrors memory/audit-event-writer.ts exactly: monotonic
// zero-padded identifiers so lexicographic order is write order, deep copy
// on every write and every read (list and export), and the payload parsed
// through the frozen AuditPayloadSchema on every append so an undeclared
// key is refused by name, not stripped. A failed append throws and stores
// nothing — never best-effort.
//
// There is no second payload schema here and none of the closed five-key
// set is widened — see interface.ts's header for why a stream with its own
// private key set would be a second, unpoliced audit channel.
//
// What this file does NOT discharge: this writer is built and proven by
// the direct unit tests beside it, with no admin screen to drive it from.
// The write path from a REAL pack-activation action — the /admin/rulepacks
// screen, the sole-authorship confirmation, the activation gate — belongs
// to the pack-administration requirement (PACK-07), relocated to Phase 3.2
// by D-20. A later reader must not conclude the activation flow itself is
// done because this writer exists and passes its own tests.

import { AuditPayloadSchema } from "@dsar/schemas/audit-event";
import type { PackLifecycleEvent, PackLifecycleEventWriter } from "../interface.ts";
import { auditStore } from "./store.ts";

const ID_WIDTH = 10;

function nextId(): string {
  const id = auditStore.nextPackLifecycleId++;
  return String(id).padStart(ID_WIDTH, "0");
}

export const memoryPackLifecycleEventWriter: PackLifecycleEventWriter = {
  async append(event) {
    // Validated directly against the frozen, already-declared payload
    // schema — not a second, stream-private schema (see module header).
    const payload = AuditPayloadSchema.parse(event.payload);
    const full: PackLifecycleEvent = { ...event, payload, id: nextId() };
    const copy = structuredClone(full);
    auditStore.packLifecycleEvents.set(copy.id, copy);
    return structuredClone(copy);
  },

  async listByPack(packId, version) {
    return [...auditStore.packLifecycleEvents.values()]
      .filter((event) => event.packId === packId && event.packVersion === version)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((event) => structuredClone(event));
  },

  async exportAll() {
    return [...auditStore.packLifecycleEvents.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((event) => structuredClone(event));
  },
};
