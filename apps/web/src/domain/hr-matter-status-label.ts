// apps/web/src/domain/hr-matter-status-label.ts
//
// AC-02/AC-04's leak-channel boundary means HR must never learn which of
// COMPUTING/LEGAL_REVIEW/INFO_REQUEST a matter is currently in — collapsing
// the seven-value MatterStatus lifecycle to a three-bucket label here is
// correct behavior, not a shortcut taken for convenience. Implemented as an
// exhaustive Record<MatterStatus, string> (no `default` branch) so
// TypeScript itself refuses to compile if MatterStatus's closed set ever
// grows without this map growing too — a future eighth status is a type
// error here before it is ever a UI bug.
//
// SUPERSEDED collapses into the same "Sent to Legal" bucket as the other
// three in-flight statuses: a correction raised after sign-off is, from
// HR's point of view, once again awaiting Legal's attention (even though
// PRD §5's guard table currently gives SUPERSEDED no outgoing transition —
// WINDOWS.md entry 9, a genuine unresolved spec gap, not invented here).

import type { MatterStatus } from "@dsar/schemas/matter-status";

const HR_MATTER_STATUS_LABELS: Record<MatterStatus, string> = {
  DRAFT: "Draft",
  COMPUTING: "Sent to Legal",
  LEGAL_REVIEW: "Sent to Legal",
  INFO_REQUEST: "Sent to Legal",
  SIGNED_OFF: "Assessed",
  CLOSED: "Assessed",
  SUPERSEDED: "Sent to Legal",
};

export function matterStatusLabelForHr(status: MatterStatus): string {
  return HR_MATTER_STATUS_LABELS[status];
}
