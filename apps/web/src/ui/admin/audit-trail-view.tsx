// apps/web/src/ui/admin/audit-trail-view.tsx
//
// The Audit trail screen's whole-log render (D-2, 07.1-UI-SPEC.md
// Screen-by-Screen Structural Notes: Audit trail). Plain, server-
// renderable — no "use client", no interaction of any kind — matching
// stale-pack-notice.tsx's own precedent for a read-only, banner-shaped
// component; the caller (apps/web/app/admin/audit/page.tsx) is a Server
// Component and this file must stay directly callable from it.
//
// Two independent tables (matter events / pack lifecycle events), each
// rendering the Copywriting Contract's exact empty-state heading/body on
// its own when its own array is empty — a real log could plausibly have
// one stream populated and the other empty (07.1-UI-SPEC.md UI
// Considerations, "empty" row).
//
// The design export's rightmost "Hash" column is deliberately absent
// (D-3) — no hash-chaining exists in packages/audit today. Replaced by
// Pack (rulePackVersion) and Engine (engineVersion), two real fields
// already captured on AuditEvent, rendered as an em dash when null.
//
// v1 renders the full list under horizontal scroll only, per
// 07.1-UI-SPEC.md's own stated v1 scope — pagination is a v2 follow-up,
// not a requirement of this phase's success criteria (07.1-02-PLAN.md
// Task 2).

import type { AuditEvent } from "@dsar/schemas/audit-event";
import type { PackLifecycleEvent } from "@dsar/audit/interface";
import { composeAuditEventDetail } from "../../domain/audit-detail.ts";

export const AUDIT_TRAIL_EMPTY_HEADING = "No audit events yet.";
export const AUDIT_TRAIL_EMPTY_BODY =
  "Once a matter moves through intake, review or sign-off, every action taken against it is written here automatically — nothing here can be edited or removed.";

// 07.1-02-PLAN.md Task 3 fix: this constant originally lived in
// apps/web/app/admin/audit/page.tsx, but Next's page-export type checker
// (`next build`'s generated .next/types/app/**/page.ts`) only permits a
// page.tsx to export the framework's own known names (default, metadata,
// config, ...) — any other named export fails `next build`'s TypeScript
// pass with TS2344. Colocated here instead, alongside this file's other
// Copywriting Contract constants, and imported by page.tsx.
export const AUDIT_TRAIL_RESTRICTED_MESSAGE = "This screen is restricted to the DPO / audit role.";

// The design's own "{{ auditCount }} · newest last" pattern (07.1-UI-SPEC.md
// UI Considerations, "zero-one-many" row), reworded to plain English —
// covers the combined total across both streams.
function composeCountLine(total: number): string {
  if (total === 0) return "No audit events recorded yet.";
  if (total === 1) return "1 audit event recorded, newest last.";
  return `${total} audit events recorded, newest last.`;
}

function emDashIfNull(value: string | null): string {
  return value ?? "—";
}

export interface MatterAuditEventRow extends AuditEvent {
  matterReference: string;
}

export interface AuditTrailViewProps {
  matterEvents: MatterAuditEventRow[];
  packLifecycleEvents: PackLifecycleEvent[];
}

function EmptyTableState() {
  return (
    <div data-testid="audit-trail-empty" className="hint">
      <p className="eyebrow">{AUDIT_TRAIL_EMPTY_HEADING}</p>
      <p>{AUDIT_TRAIL_EMPTY_BODY}</p>
    </div>
  );
}

export function AuditTrailView({ matterEvents, packLifecycleEvents }: AuditTrailViewProps) {
  const total = matterEvents.length + packLifecycleEvents.length;

  return (
    <div className="flex flex-col gap-xl">
      <div>
        <h1 className="screen">Audit trail</h1>
        <p className="caption" data-testid="audit-trail-count">
          {composeCountLine(total)}
        </p>
      </div>

      <section aria-labelledby="audit-matter-events-heading" className="data-table-card">
        <h2 id="audit-matter-events-heading" className="eyebrow">
          Matter events
        </h2>
        {matterEvents.length === 0 ? (
          <EmptyTableState />
        ) : (
          // v1 scroll-only overflow, no pagination (07.1-02-PLAN.md Task 2's
          // recorded assumption resolution) — see this file's header note.
          <div className="overflow-x-auto">
            <table className="data-table min-w-[900px]" data-testid="audit-matter-events-table">
              <thead>
                <tr>
                  <th>Seq</th>
                  <th>Timestamp</th>
                  <th>Matter</th>
                  <th>Actor</th>
                  <th>Event</th>
                  <th>Detail</th>
                  <th>Pack</th>
                  <th>Engine</th>
                </tr>
              </thead>
              <tbody>
                {matterEvents.map((event, index) => (
                  <tr key={event.id}>
                    <td className="fig">{index + 1}</td>
                    <td className="fig">{event.at}</td>
                    <td>{event.matterReference}</td>
                    <td>{event.actor.displayName}</td>
                    <td>{event.type}</td>
                    <td>{composeAuditEventDetail(event.payload)}</td>
                    <td className="fig">{emDashIfNull(event.rulePackVersion)}</td>
                    <td className="fig">{emDashIfNull(event.engineVersion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="audit-pack-lifecycle-heading" className="data-table-card">
        <h2 id="audit-pack-lifecycle-heading" className="eyebrow">
          Pack lifecycle events
        </h2>
        {packLifecycleEvents.length === 0 ? (
          <EmptyTableState />
        ) : (
          // v1 scroll-only overflow, no pagination — same recorded
          // assumption as the matter-events table above.
          <div className="overflow-x-auto">
            <table className="data-table min-w-[900px]" data-testid="audit-pack-lifecycle-table">
              <thead>
                <tr>
                  <th>Seq</th>
                  <th>Timestamp</th>
                  <th>Pack</th>
                  <th>Actor</th>
                  <th>Event</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {packLifecycleEvents.map((event, index) => (
                  <tr key={event.id}>
                    <td className="fig">{index + 1}</td>
                    <td className="fig">{event.at}</td>
                    <td className="fig">
                      {event.packId} {event.packVersion}
                    </td>
                    <td>{event.actor.displayName}</td>
                    <td>{event.type}</td>
                    <td>{composeAuditEventDetail(event.payload)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
