// apps/web/src/ui/review/assessment-view.test.tsx
//
// Hand-built fixture (AssessmentSchema.parse()/ExpenseLineSchema.parse()),
// not the real engine: this "web" project runs under jsdom, which defines
// `window` — importing anything from the app's server-side module tree
// (including the engine-invocation boundary) here would trip the
// server-only runtime guard every one of those modules carries. Rendered
// with renderToStaticMarkup, per this repo's existing
// tests/boundary/dom-denylist.test.ts technique.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssessmentView } from "./assessment-view.tsx";
import { AssessmentSchema, type Assessment } from "@dsar/schemas/assessment";
import { ExpenseLineSchema, type ExpenseLine } from "@dsar/schemas/expense-line";
import { formatMinor } from "@dsar/schemas/money";

const CURRENCY = "SGD" as const;

const EXPENSE_LINES: ExpenseLine[] = [
  ExpenseLineSchema.parse({
    id: "line-1",
    matterId: "matter-1",
    seq: 0,
    categoryCode: "STAFF_TIME_SEARCH",
    description: "Staff time locating and retrieving the requested records",
    quantity: 4,
    unit: "HOUR",
    unitRate: 4000,
    claimedAmount: 16000,
    incurredByGrade: "EXECUTIVE",
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  }),
  ExpenseLineSchema.parse({
    id: "line-2",
    matterId: "matter-1",
    seq: 1,
    categoryCode: "OTHER_UNCLASSIFIED",
    description: "Meeting room and refreshments for the internal review session",
    quantity: 1,
    unit: "FIXED",
    unitRate: 4500,
    claimedAmount: 4500,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  }),
];

const ASSESSMENT: Assessment = AssessmentSchema.parse({
  id: "assessment-1",
  matterId: "matter-1",
  rulePackId: "SG-PDPA",
  rulePackVersion: "2026.09.1",
  engineVersion: "0.1.0",
  computedAt: "2026-09-18T00:00:00Z",
  lines: [
    {
      id: "assessment-line-1",
      expenseLineId: "line-1",
      verdict: "ALLOW",
      engineAmount: 16000,
      appliedRuleId: "SG-PDPA.STAFF_TIME_SEARCH",
      appliedCap: null,
      basis:
        "Locating and retrieving the requested data is a service provided to the applicant to enable the organisation to respond.",
      citation: { instrument: "Personal Data Protection Regulations 2021", provision: "reg.7" },
      flagReasons: [],
      disposition: "PENDING",
      lawyerAmount: null,
      lawyerReason: null,
      dispositionedBy: null,
      dispositionedAt: null,
    },
    {
      id: "assessment-line-2",
      expenseLineId: "line-2",
      verdict: "FLAG",
      engineAmount: 0,
      appliedRuleId: "SG-PDPA.OTHER_UNCLASSIFIED",
      appliedCap: null,
      basis:
        "Uncategorised cost. Counsel to determine whether it is a service provided to the applicant to enable the organisation to respond.",
      citation: { instrument: "Personal Data Protection Regulations 2021", provision: "reg.7" },
      flagReasons: [
        {
          code: "UNCATEGORISED",
          message: "This line's category is Other / Unclassified and is always referred to Legal.",
        },
      ],
      disposition: "PENDING",
      lawyerAmount: null,
      lawyerReason: null,
      dispositionedBy: null,
      dispositionedAt: null,
    },
  ],
  matterLevelFlags: [],
  totals: {
    claimedTotal: 20500,
    draftBaseline: 16000,
    disallowedTotal: 0,
    flaggedTotal: 4500,
    restingOnUnverifiedRules: 0,
    finalAmount: null,
  },
  signOff: null,
});

function renderView(): string {
  return renderToStaticMarkup(
    React.createElement(AssessmentView, { assessment: ASSESSMENT, expenseLines: EXPENSE_LINES, currency: CURRENCY })
  );
}

describe("ASSESSMENT-VIEW", () => {
  it("ASSESSMENT-VIEW: renders every line's applied rule id, basis and citation with no disclosure element wrapping them", () => {
    const html = renderView();

    for (const line of ASSESSMENT.lines) {
      expect(html).toContain(line.appliedRuleId);
      expect(html).toContain(line.basis);
    }
    expect(html).toContain("Personal Data Protection Regulations 2021");
    expect(html).not.toContain("<details");
    expect(html).not.toContain("disclosure");
  });

  it("ASSESSMENT-VIEW: renders each verdict as a text label, never as colour alone", () => {
    const html = renderView();

    expect(html).toContain("Supported by rule");
    expect(html).toContain("Needs your decision");
  });

  it("ASSESSMENT-VIEW: given an assessment whose lines are all PENDING, renders the hidden headline and pending-count sentence with no formatted currency figure in the headline region", () => {
    const html = renderView();

    expect(html).toContain('data-testid="headline-hidden"');
    expect(html).toContain("2 lines still need your decision");
    expect(html).not.toContain('data-testid="headline-value"');
  });

  it("ASSESSMENT-VIEW: every money figure equals what formatMinor returns for that value and currency", () => {
    const html = renderView();

    expect(html).toContain(formatMinor(ASSESSMENT.totals.claimedTotal, CURRENCY));
    expect(html).toContain(formatMinor(ASSESSMENT.totals.draftBaseline, CURRENCY));
    expect(html).toContain(formatMinor(ASSESSMENT.totals.disallowedTotal, CURRENCY));
    expect(html).toContain(formatMinor(ASSESSMENT.totals.flaggedTotal, CURRENCY));
    expect(html).toContain(formatMinor(ASSESSMENT.totals.restingOnUnverifiedRules, CURRENCY));
    expect(html).toContain(formatMinor(EXPENSE_LINES[0]!.claimedAmount, CURRENCY));
  });
});
