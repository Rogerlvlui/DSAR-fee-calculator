// apps/web/app/admin/audit/page.tsx
//
// /admin/audit — the DPO_ADMIN-gated whole-log Audit trail screen (D-2,
// 07.1-02-PLAN.md Task 1). Resolves the actor via getCurrentActor() (the
// same path every other page in this app uses), calls getAuditTrailView
// inside a try/catch — that call inherits exportAuditLog's own
// requireRole(actor, "DPO_ADMIN") gate; this file never re-checks the role
// itself — and renders AuditTrailView on success. On a caught
// ForbiddenError, renders the Copywriting Contract's restricted-access
// paragraph with no table element of any kind; any other error type is
// re-thrown so it is never silently swallowed as a role refusal.
//
// No loading.tsx and no client-side spinner for this route (07.1-02-PLAN.md
// Task 2's recorded assumption resolution): this matches every other page
// in this app (none has a loading.tsx today) and the design export's own
// instant-render assumption. A real loading state is a candidate follow-up
// only if a future phase adds enough data volume to need one.

import { getCurrentActor } from "../../../src/server/current-actor.ts";
import { getAuditTrailView } from "../../../src/server/data/audit-trail.ts";
import { AuditTrailView, AUDIT_TRAIL_RESTRICTED_MESSAGE } from "../../../src/ui/admin/audit-trail-view.tsx";
import { ForbiddenError } from "../../../src/server/errors.ts";

export default async function AdminAuditPage() {
  const actor = await getCurrentActor();

  try {
    const { matterEvents, packLifecycleEvents } = await getAuditTrailView(actor);
    return (
      <main>
        <AuditTrailView matterEvents={matterEvents} packLifecycleEvents={packLifecycleEvents} />
      </main>
    );
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <main>
          <h1 className="screen">Audit trail</h1>
          <p data-testid="audit-trail-restricted">{AUDIT_TRAIL_RESTRICTED_MESSAGE}</p>
        </main>
      );
    }
    throw error;
  }
}
