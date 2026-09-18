// apps/web/src/ui/review/matter-rail.tsx
//
// The left rail's matter-context card (PRD §10.3): reference, jurisdiction,
// entity, controller type, received date, requestor class, the two HR
// attestations, every matter-level flag rendered prominently (the
// litigation flag among them, when the matter records a known dispute —
// PRD §0 non-negotiable framing means this box must not be easy to miss),
// and the advisory deadline line. The advisory qualifier lives inside the
// SAME container as the date it qualifies, so it cannot scroll away from
// it (this task's own design requirement).

import type { ControllerType } from "@dsar/schemas/primitives";
import type { RequestorClass } from "@dsar/schemas/matter";
import type { MatterFlag } from "@dsar/schemas/primitives";

// Structurally identical to apps/web/src/server/review-view.ts's
// AdvisoryDeadlineView — deliberately re-declared here rather than
// imported, matching apps/web/src/ui/intake/intake-form.tsx's existing
// precedent, so this module (under apps/web/src/ui) never imports
// apps/web/src/server, even for a type-only import (dependency-cruiser
// tracks those too).
export interface MatterRailAdvisoryDeadline {
  basis: "FEE_NOTIFICATION" | "RESPONSE_DEADLINE_FALLBACK";
  dueDateIso: string;
  daysRemaining: number;
}

const CONTROLLER_TYPE_LABELS: Record<ControllerType, string> = {
  PRIVATE_ORGANISATION: "Private org.",
  PUBLIC_AGENCY: "Public agency",
};

const REQUESTOR_CLASS_LABELS: Record<RequestorClass, string> = {
  FORMER_EMPLOYEE: "Former employee",
  CURRENT_EMPLOYEE: "Current employee",
  OTHER: "Other",
};

export const ADVISORY_QUALIFIER =
  "Advisory only. This tool is not the deadline system of record.";

function formatAdvisoryDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const monthLabel = MONTHS[Number(month) - 1] ?? month;
  return `${Number(day)} ${monthLabel} ${year}`;
}

export interface MatterRailProps {
  reference: string;
  jurisdictionName: string;
  legalEntity: string;
  controllerType: ControllerType;
  requestReceivedOn: string;
  requestorClass: RequestorClass;
  identityVerified: boolean;
  identityVerifiedNote: string | null;
  scopeClarified: boolean;
  matterFlags: readonly MatterFlag[];
  advisoryDeadline: MatterRailAdvisoryDeadline | null;
}

export function MatterRail({
  reference,
  jurisdictionName,
  legalEntity,
  controllerType,
  requestReceivedOn,
  requestorClass,
  identityVerified,
  identityVerifiedNote,
  scopeClarified,
  matterFlags,
  advisoryDeadline,
}: MatterRailProps) {
  return (
    <aside data-testid="matter-rail">
      <div>Matter</div>
      <dl>
        <div>
          <dt>Reference</dt>
          <dd>{reference}</dd>
        </div>
        <div>
          <dt>Jurisdiction</dt>
          <dd>{jurisdictionName}</dd>
        </div>
        <div>
          <dt>Entity</dt>
          <dd>{legalEntity}</dd>
        </div>
        <div>
          <dt>Controller</dt>
          <dd>{CONTROLLER_TYPE_LABELS[controllerType]}</dd>
        </div>
        <div>
          <dt>Received</dt>
          <dd>{requestReceivedOn}</dd>
        </div>
        <div>
          <dt>Requestor</dt>
          <dd>{REQUESTOR_CLASS_LABELS[requestorClass]}</dd>
        </div>
        <div>
          <dt>Identity verified</dt>
          <dd>
            {identityVerified ? "Yes" : "No"}
            {identityVerifiedNote ? ` — ${identityVerifiedNote}` : ""}
          </dd>
        </div>
        <div>
          <dt>Scope clarified</dt>
          <dd>{scopeClarified ? "Yes" : "No"}</dd>
        </div>
      </dl>

      {matterFlags.map((flag) => (
        <div key={flag.id} data-testid="matter-flag" data-code={flag.code}>
          <div>{flag.requiresAcknowledgement ? "Acknowledge to sign off" : "Notice"}</div>
          <p>{flag.message}</p>
        </div>
      ))}

      {advisoryDeadline ? (
        <div data-testid="advisory-deadline">
          {advisoryDeadline.basis === "FEE_NOTIFICATION" ? "Fee notification due " : "Response due "}
          <b>
            {formatAdvisoryDate(advisoryDeadline.dueDateIso)} — {advisoryDeadline.daysRemaining} days
          </b>
          . <b>Advisory only.</b> This tool is not the deadline system of record.
        </div>
      ) : null}
    </aside>
  );
}
