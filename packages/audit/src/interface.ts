// packages/audit/src/interface.ts
//
// Both writer interfaces, declared now so no later plan reopens this file
// to add the second one. The matter-scoped AuditEventWriter appends an
// event, lists a matter's events and exports every event. The
// pack-lifecycle PackLifecycleEventWriter is the separate stream D-21
// already settled on (03-CONTEXT.md), keyed to a pack identifier and
// version rather than a matter, because the frozen AuditEvent.matterId is
// non-nullable and a PACK_ACTIVATED/PACK_EDITED event is about a
// RulePackVersion, which has no relationship to any Matter — reopening
// that non-nullability is a freeze escalation this phase does not take.
//
// The pack-lifecycle writer is declared here but NOT implemented this
// plan: implementing it, and the real write path from a real admin action,
// is plan 04-03's job (04-RESEARCH.md Pitfall 1). This phase must not be
// read as having discharged that half twice.

import type { AuditEvent } from "@dsar/schemas/audit-event";
import type { AuditEventType, Role, UserRef } from "@dsar/schemas/primitives";

export type NewAuditEvent = Omit<AuditEvent, "id">;

export interface AuditEventWriter {
  append(event: NewAuditEvent): Promise<AuditEvent>;
  listByMatter(matterId: string): Promise<AuditEvent[]>;
  // AUDIT-04 — every matter-scoped event, in write order, no matter filter.
  exportAll(): Promise<AuditEvent[]>;
}

// D-21: pack-lifecycle events cannot share AuditEvent's matter-scoped shape.
export interface PackLifecycleEvent {
  id: string;
  packId: string;
  packVersion: string;
  actor: UserRef;
  actorRole: Role;
  at: string;
  type: Extract<AuditEventType, "PACK_ACTIVATED" | "PACK_EDITED">;
  payload: AuditEvent["payload"];
}

export type NewPackLifecycleEvent = Omit<PackLifecycleEvent, "id">;

export interface PackLifecycleEventWriter {
  append(event: NewPackLifecycleEvent): Promise<PackLifecycleEvent>;
  listByPack(packId: string, version: string): Promise<PackLifecycleEvent[]>;
  exportAll(): Promise<PackLifecycleEvent[]>;
}
