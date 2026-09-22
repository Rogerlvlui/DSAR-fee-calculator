// apps/web/src/server/data/audit.ts
//
// AUDIT-04: the DPO's whole-log export. One exported function, following
// the shape every other data-layer module already follows — the role check
// is its literal first statement, before anything is read, never placed in
// middleware and never only at the page level (auth.ts's own header note
// already gives the reason). Returns the matter-scoped export and the
// pack-lifecycle export together, in one call: the officer audits the
// whole system, and splitting this into two calls would invite a caller to
// fetch one and believe it was the log.
//
// No route and no screen exist for this yet — AUDIT-04 only requires the
// capability exist and be callable under the DPO_ADMIN role (04-RESEARCH.md
// Architectural Responsibility Map). A route/screen belongs to a later
// phase that owns screens.

import "../server-only.ts";
import { requireRole, type DemoActor } from "./auth.ts";
import { memoryAuditEventWriter } from "@dsar/audit/memory/audit-event-writer";
import { memoryPackLifecycleEventWriter } from "@dsar/audit/memory/pack-lifecycle-event-writer";
import type { AuditEvent } from "@dsar/schemas/audit-event";
import type { PackLifecycleEvent } from "@dsar/audit/interface";

export interface AuditLogExport {
  matterEvents: AuditEvent[];
  packLifecycleEvents: PackLifecycleEvent[];
}

export async function exportAuditLog(actor: DemoActor): Promise<AuditLogExport> {
  requireRole(actor, "DPO_ADMIN");

  const [matterEvents, packLifecycleEvents] = await Promise.all([
    memoryAuditEventWriter.exportAll(),
    memoryPackLifecycleEventWriter.exportAll(),
  ]);

  return { matterEvents, packLifecycleEvents };
}
