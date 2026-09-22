// apps/web/src/ui/review/pack-rail.tsx
//
// The left rail's rule-pack card (PRD §10.3): pack id and version, posture,
// authored/reviewed by, review-due date, the new "Pack status" cell
// (03.1-UI-SPEC.md — real, uncoerced status, always the warn treatment,
// never mistaken for the engine-invocation boundary's ACTIVE-coerced
// copy), and the pack's own open questions listed IN FULL — not collapsed,
// not truncated. "If a lawyer sees the pack's own open questions on every
// review, the pack improves over time" (PRD §10.3).

import type { FeePosture } from "@dsar/schemas/rule-pack";

// Human-readable labels for the seven FeePosture values — no label map for
// this exists elsewhere in apps/web/src/ui (the intake screen only ever
// checks membership in the two "heads-up" postures, never renders a label).
const FEE_POSTURE_LABELS: Record<FeePosture, string> = {
  PERMITTED_REASONABLE: "Reasonable fee",
  PERMITTED_NOT_EXCESSIVE: "Fee not excessive",
  PERMITTED_ACTUAL_COST: "Actual cost only",
  PERMITTED_PRESCRIBED_CAP: "Prescribed cap",
  PERMITTED_NARROW_EXCEPTION: "Narrow exception only",
  NO_EXPRESS_AUTHORITY: "No express authority",
  PROHIBITED: "Prohibited",
};

export const PACK_STATUS_DISCLOSURE =
  "Real status. The engine computes against an in-memory copy coerced to Active for this demo only.";

export interface PackRailProps {
  packId: string;
  version: string;
  /** The pack's real, uncoerced status (e.g. "DRAFT") — never the
   * engine-invocation boundary's in-memory ACTIVE copy. */
  status: string;
  feePosture: FeePosture;
  authoredByDisplayName: string | null;
  reviewedByDisplayName: string | null;
  reviewedOn: string | null;
  reviewDueOn: string;
  openQuestions: readonly string[];
}

export function PackRail({
  packId,
  version,
  status,
  feePosture,
  authoredByDisplayName,
  reviewedByDisplayName,
  reviewedOn,
  reviewDueOn,
  openQuestions,
}: PackRailProps) {
  return (
    <aside data-testid="pack-rail">
      <div>Rule pack</div>
      <dl>
        <div>
          <dt>Pack</dt>
          <dd>
            {packId} {version}
          </dd>
        </div>
        <div data-testid="pack-status-cell">
          <dt>Pack status</dt>
          <dd className="text-warn">{status}</dd>
          <p className="text-ink-3">{PACK_STATUS_DISCLOSURE}</p>
        </div>
        <div>
          <dt>Posture</dt>
          <dd>{FEE_POSTURE_LABELS[feePosture]}</dd>
        </div>
        <div>
          <dt>Authored</dt>
          <dd>{authoredByDisplayName ?? "Not yet authored"}</dd>
        </div>
        <div>
          <dt>Reviewed</dt>
          <dd>{reviewedByDisplayName ? `${reviewedByDisplayName} — ${reviewedOn}` : "Not yet reviewed"}</dd>
        </div>
        <div>
          <dt>Review due</dt>
          <dd>{reviewDueOn}</dd>
        </div>
      </dl>

      <div data-testid="pack-open-questions">
        <h3>This pack's open questions</h3>
        <ul>
          {openQuestions.map((question, index) => (
            <li key={index}>{question}</li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
