// apps/web/src/server/data/audit-trail.ts
//
// getAuditTrailView(actor) — the /admin/audit screen's one data-layer call
// (07.1-02-PLAN.md Task 1). Calls exportAuditLog(actor), inheriting its
// requireRole(actor, ["DPO_ADMIN", "LEGAL_REVIEWER"]) gate as the ONLY
// place this refusal can be forgotten from (T-07.1-02-02) — this file
// imports neither requireRole nor re-checks actor.role itself. Enriches
// each matter event with the
// human matter reference exportAuditLog's own AuditEvent shape does not
// carry (it only has matterId), falling back to the raw id when the
// matter cannot be found (e.g. a stale event referencing a since-deleted
// fixture matter in a test).

import "../server-only.ts";
import { exportAuditLog } from "./audit.ts";
import { memoryMatterRepository } from "../repositories/memory/matter-repository.ts";
import type { DemoActor } from "./auth.ts";
import type { AuditEvent } from "@dsar/schemas/audit-event";
import type { PackLifecycleEvent } from "@dsar/audit/interface";

export interface MatterAuditEventView extends AuditEvent {
  matterReference: string;
}

export interface AuditTrailData {
  matterEvents: MatterAuditEventView[];
  packLifecycleEvents: PackLifecycleEvent[];
}

export async function getAuditTrailView(actor: DemoActor): Promise<AuditTrailData> {
  const { matterEvents, packLifecycleEvents } = await exportAuditLog(actor);

  const matterEventViews = await Promise.all(
    matterEvents.map(async (event): Promise<MatterAuditEventView> => {
      const matter = await memoryMatterRepository.getMatter(event.matterId);
      return { ...event, matterReference: matter ? matter.reference : event.matterId };
    })
  );

  return { matterEvents: matterEventViews, packLifecycleEvents };
}
