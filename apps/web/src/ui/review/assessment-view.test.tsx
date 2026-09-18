// apps/web/src/ui/review/assessment-view.test.tsx
//
// Hand-built fixture (AssessmentSchema.parse()), not the real engine — see
// this file's Plan 01 predecessor for why (jsdom's `window` would trip the
// server-only runtime guard if this imported anything from
// apps/web/src/server). Rendered with renderToStaticMarkup. Tagged
// ASSESSMENT-VIEW.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssessmentSchema, type Assessment, type Verdict } from "@dsar/schemas/assessment";
import type { Minor } from "@dsar/schemas/primitives";
import { AssessmentView, type AssessmentViewLineDetail } from "./assessment-view.tsx";
import { VERDICT_ORDER } from "../../domain/verdict-order.ts";

const CURRENCY = "SGD" as const;

// Deliberately NOT in sorted order — proves the render order comes from
// compareByVerdict, not from array position.
const LINE_SPECS: { id: string; verdict: Verdict; engineAmount: number; ruleId: string }[] = [
  { id: "line-disallow", verdict: "DISALLOW", engineAmount: 0, ruleId: "SG-PDPA.STAFF_TIME_ASSESS_EXEMPTIONS" },
  { id: "line-allow-1", verdict: "ALLOW", engineAmount: 16000, ruleId: "SG-PDPA.STAFF_TIME_SEARCH" },
  { id: "line-flag-1", verdict: "FLAG", engineAmount: 0, ruleId: "SG-PDPA.OTHER_UNCLASSIFIED" },
  { id: "line-capped", verdict: "ALLOW_CAPPED", engineAmount: 2640, ruleId: "SG-PDPA.PHOTOCOPY_PRINT" },
  { id: "line-flag-2", verdict: "FLAG", engineAmount: 0, ruleId: "SG-PDPA.VENDOR_PAYROLL" },
  { id: "line-allow-2", verdict: "ALLOW", engineAmount: 8000, ruleId: "SG-PDPA.STAFF_TIME_COLLATE" },
];

function buildAssessment(): Assessment {
  return AssessmentSchema.parse({
    id: "assessment-1",
    matterId: "matter-1",
    rulePackId: "SG-PDPA",
    rulePackVersion: "2026.09.1",
    engineVersion: "0.1.0",
    computedAt: "2026-09-18T00:00:00Z",
    lines: LINE_SPECS.map((spec) => ({
      id: spec.id,
      expenseLineId: `${spec.id}-expense`,
      verdict: spec.verdict,
      engineAmount: spec.engineAmount,
      appliedRuleId: spec.ruleId,
      appliedCap: null,
      basis: `Basis for ${spec.ruleId}.`,
      citation: { instrument: "Personal Data Protection Regulations 2021", provision: "reg.7" },
      flagReasons: spec.verdict === "FLAG" ? [{ code: "UNCATEGORISED", message: `Why ${spec.id} needs you.` }] : [],
      disposition: "PENDING",
      lawyerAmount: null,
      lawyerReason: null,
      dispositionedBy: null,
      dispositionedAt: null,
    })),
    matterLevelFlags: [
      {
        id: "SG.KNOWN_DISPUTE",
        code: "LITIGATION_POSTURE",
        message: "This requestor is in a known dispute with the company.",
        requiresAcknowledgement: true,
      },
    ],
    totals: {
      claimedTotal: 88800,
      draftBaseline: 26640,
      disallowedTotal: 12660,
      flaggedTotal: 49500,
      restingOnUnverifiedRules: 10640,
      finalAmount: null,
    },
    signOff: null,
  });
}

const LINE_DETAILS: AssessmentViewLineDetail[] = LINE_SPECS.map((spec, index) => ({
  assessmentLineId: spec.id,
  seq: index,
  categoryLabel: `Category for ${spec.id}`,
  description: `Description for ${spec.id}`,
  quantity: 1,
  unit: "FIXED",
  unitRate: 1000 as Minor,
  claimedAmount: 1000 as Minor,
  verificationStatus: "NEEDS_VERIFICATION",
}));

function renderView(): string {
  return renderToStaticMarkup(
    React.createElement(AssessmentView, {
      assessment: buildAssessment(),
      currency: CURRENCY,
      lineDetails: LINE_DETAILS,
      matterFlags: buildAssessment().matterLevelFlags,
      advisoryDeadline: { basis: "RESPONSE_DEADLINE_FALLBACK", dueDateIso: "2026-09-19", daysRemaining: 12 },
      matter: {
        reference: "DSAR-2026-0142",
        jurisdictionName: "Singapore",
        legalEntity: "Acme Asia Services",
        controllerType: "PRIVATE_ORGANISATION",
        requestReceivedOn: "2026-08-20",
        requestorClass: "FORMER_EMPLOYEE",
        identityVerified: true,
        identityVerifiedNote: "log 0142-A",
        scopeClarified: true,
      },
      pack: {
        packId: "SG-PDPA",
        version: "2026.09.1",
        status: "DRAFT",
        feePosture: "PERMITTED_REASONABLE",
        authoredByDisplayName: null,
        reviewedByDisplayName: null,
        reviewedOn: null,
        reviewDueOn: "2027-03-12",
        openQuestions: ["Is staff time costed at incremental cost, or at a loaded charge-out rate?"],
      },
    })
  );
}

describe("ASSESSMENT-VIEW", () => {
  it("ASSESSMENT-VIEW: six lines arriving in a different order render in verdict order — flagged, flagged, capped, disallowed, allowed, allowed", () => {
    const html = renderView();

    // Extract the actual rendered order by finding each card's
    // appliedRuleId text position (unique per line) rather than
    // data-verdict (which repeats across the two FLAG and two ALLOW
    // cards).
    const orderedVerdicts = [...LINE_SPECS]
      .map((spec) => ({ spec, position: html.indexOf(spec.ruleId) }))
      .sort((a, b) => a.position - b.position)
      .map((entry) => entry.spec.verdict);

    expect(orderedVerdicts).toEqual(["FLAG", "FLAG", "ALLOW_CAPPED", "DISALLOW", "ALLOW", "ALLOW"]);
  });

  it("ASSESSMENT-VIEW: the exported VERDICT_ORDER map itself produces flagged, capped, disallowed, allowed", () => {
    const orderedVerdicts = (Object.keys(VERDICT_ORDER) as Verdict[]).sort(
      (a, b) => VERDICT_ORDER[a] - VERDICT_ORDER[b]
    );
    expect(orderedVerdicts).toEqual(["FLAG", "ALLOW_CAPPED", "DISALLOW", "ALLOW"]);
  });

  it("ASSESSMENT-VIEW: renders every line's applied rule id, basis and citation with no disclosure element anywhere", () => {
    const html = renderView();

    for (const spec of LINE_SPECS) {
      expect(html).toContain(spec.ruleId);
      expect(html).toContain(`Basis for ${spec.ruleId}.`);
    }
    expect(html).toContain("Personal Data Protection Regulations 2021");
    expect(html).not.toContain("<details");
    expect(html).not.toContain("<summary");
  });

  it("ASSESSMENT-VIEW: with every line pending, the headline renders the hidden state and the six-line pending sentence with no currency figure in the headline region", () => {
    const html = renderView();

    expect(html).toContain('data-testid="headline-hidden"');
    expect(html).toContain("6 lines still need your decision");
    expect(html).not.toContain('data-testid="headline-value"');
  });

  it("ASSESSMENT-VIEW: renders the matter rail's flag prominently and the pack rail's open questions in full", () => {
    const html = renderView();

    expect(html).toContain("known dispute with the company");
    expect(html).toContain("Is staff time costed at incremental cost, or at a loaded charge-out rate?");
  });

  // No test here for absence of a language-model-provenance badge or a
  // category-suggestion block — see line-card.test.tsx's matching note:
  // the plan's own acceptance criterion greps this directory for Annex A's
  // exact marker strings, and quoting them in an assertion here would trip
  // that grep against this test file itself.
});
