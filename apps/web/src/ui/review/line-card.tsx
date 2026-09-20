// apps/web/src/ui/review/line-card.tsx
//
// One card per assessment line, never a table row (PRD §10.3: "a table row
// cannot carry a citation, a reason field, and four controls legibly"). In
// order: the verdict badge carrying the verdict in words, the line number
// and category label; HR's own description quoted verbatim next to the
// category HR chose; the claimed arithmetic; for FLAG lines the
// why-this-needs-you block; then the provenance block — applied rule id,
// the unverified marker when the rule needs verification, the
// pack-authored basis and the citation. Basis and citation are always
// visible and never behind a disclosure control (no <details>/<summary>
// anywhere in this module).
//
// Deliberately does NOT render a language-model-provenance badge or a
// category-suggestion block: there is no LLM anywhere in this phase, so no
// text on this screen was generated that way, and rendering either label
// would overstate what this demo actually does (Phase 03.1 success
// criterion 5). Phase 8 is where both belong once packages/agent exists.
// (Their Annex A marker text is deliberately not quoted verbatim here or
// in this module's tests, so a grep for that marker across this directory
// stays a true negative rather than matching an explanatory comment.)
//
// Accepts `children` as an explicit composition slot for the per-verdict
// disposition controls (added in this same plan's Task 2, wired from
// assessment-view.tsx) — this component never imports
// disposition-controls.tsx itself, so its own tests can render it with no
// controls at all and assert purely on the read-only provenance content.

import type { ReactNode } from "react";
import type { AssessmentLine, Verdict } from "@dsar/schemas/assessment";
import type { ExpenseUnit } from "@dsar/schemas/expense-line";
import type { CurrencyCode, Minor } from "@dsar/schemas/primitives";
import type { VerificationStatus } from "@dsar/schemas/rule-pack";
import { formatMinor } from "@dsar/schemas/money";

// UI-SPEC Copywriting Contract, verbatim — the same table assessment-view.tsx
// used before this task; kept here too since LineCard is now the one place
// that actually renders the badge.
export const VERDICT_LABELS: Record<Verdict, string> = {
  FLAG: "Needs your decision",
  ALLOW: "Supported by rule",
  ALLOW_CAPPED: "Supported — reduced to cap",
  DISALLOW: "Not supported",
};

const UNIT_LABELS: Record<ExpenseUnit, string> = {
  HOUR: "hours",
  PAGE: "pages",
  ITEM: "items",
  GIGABYTE: "gigabytes",
  FIXED: "fixed",
};

export const UNVERIFIED_RULE_MARKER = "unverified rule";

function formatCitation(citation: AssessmentLine["citation"]): string {
  const parts = [`${citation.instrument} ${citation.provision}`.trim()];
  if (citation.guidance) parts.push(citation.guidance);
  if (citation.note) parts.push(citation.note);
  return parts.join(" — ");
}

export interface LineCardProps {
  line: AssessmentLine;
  seq: number;
  categoryLabel: string;
  description: string;
  quantity: number;
  unit: ExpenseUnit;
  unitRate: Minor;
  claimedAmount: Minor;
  currency: CurrencyCode;
  verificationStatus: VerificationStatus;
  /** The per-verdict disposition controls, composed by the caller. */
  children?: ReactNode;
}

export function LineCard({
  line,
  seq,
  categoryLabel,
  description,
  quantity,
  unit,
  unitRate,
  claimedAmount,
  currency,
  verificationStatus,
  children,
}: LineCardProps) {
  const categoryChosenByHr = line.verdict === "ALLOW" || line.verdict === "ALLOW_CAPPED";

  return (
    <article data-testid="line-card" data-verdict={line.verdict} data-disposition={line.disposition}>
      <div data-testid="card-head">
        <span data-testid="verdict-badge" aria-label={VERDICT_LABELS[line.verdict]}>
          {VERDICT_LABELS[line.verdict]}
        </span>
        <span data-testid="line-seq"> Line {seq}</span>
        <span data-testid="card-title"> {categoryLabel}</span>
      </div>

      <div data-testid="hr-description">
        <span>HR's description{categoryChosenByHr ? " · category chosen by HR" : ""}</span>
        <q>{description}</q>
      </div>

      <div data-testid="claimed-arithmetic">
        Claimed {quantity} {UNIT_LABELS[unit]} × {formatMinor(unitRate, currency)} ={" "}
        {formatMinor(claimedAmount, currency)}
        {line.verdict !== "FLAG" ? <> → {formatMinor(line.engineAmount, currency)}</> : null}
      </div>

      {line.verdict === "FLAG" && line.flagReasons.length > 0 ? (
        <div data-testid="why-this-needs-you">
          <h4>Why this needs you</h4>
          <ul>
            {line.flagReasons.map((reason, index) => (
              <li key={`${reason.code}-${index}`}>{reason.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div data-testid="provenance">
        <div data-testid="applied-rule-id">
          {line.appliedRuleId}
          {verificationStatus === "NEEDS_VERIFICATION" ? (
            <span data-testid="unverified-marker" className="border border-dashed border-warn text-warn">
              {" "}
              {UNVERIFIED_RULE_MARKER}
            </span>
          ) : null}
        </div>
        <div data-testid="basis">{line.basis}</div>
        <div data-testid="citation">
          <b>Citation:</b> {formatCitation(line.citation)}
        </div>
      </div>

      {children ? <div data-testid="line-card-controls">{children}</div> : null}
    </article>
  );
}
