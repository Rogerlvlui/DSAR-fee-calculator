// apps/web/src/ui/review/totals-rail.test.tsx
//
// Colocated, renderToStaticMarkup. Tagged TOTALS-RAIL. Uses PRD §14's own
// published figures for the reconciliation fixture (888.00 = 266.40 +
// 126.60 + 495.00) — not because this demo's real pack reproduces them
// (03.1-01 already proved it does not, by design), but because they are a
// convenient, independently-known-correct reconciling set for this
// component-level test, which only cares that TotalsRail renders whatever
// Totals it is given correctly and that the identity holds over the
// rendered text.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssessmentSchema, type Assessment } from "@dsar/schemas/assessment";
import { TotalsRail } from "./totals-rail.tsx";

const CURRENCY = "SGD" as const;

// Loosely typed on purpose: these values are only ever handed to
// AssessmentSchema.parse() below, whose input type is the pre-brand shape —
// a strict Assessment["totals"]/["lines"] parameter would reject the plain
// number literals pendingLine() and the totals fixtures below use for
// branded Minor fields.
function buildAssessment(overrides: { totals: Record<string, unknown>; lines: unknown[] }): Assessment {
  return AssessmentSchema.parse({
    id: "assessment-1",
    matterId: "matter-1",
    rulePackId: "SG-PDPA",
    rulePackVersion: "2026.09.1",
    engineVersion: "0.1.0",
    computedAt: "2026-09-18T00:00:00Z",
    lines: overrides.lines,
    matterLevelFlags: [],
    totals: overrides.totals,
    signOff: null,
  });
}

function pendingLine(id: string, verdict: "ALLOW" | "ALLOW_CAPPED" | "DISALLOW" | "FLAG", engineAmount: number) {
  return {
    id,
    expenseLineId: `${id}-expense`,
    verdict,
    engineAmount,
    appliedRuleId: `SG-PDPA.${id}`,
    appliedCap: null,
    basis: "Test basis.",
    citation: { instrument: "Test instrument", provision: "s.1" },
    flagReasons: verdict === "FLAG" ? [{ code: "UNCATEGORISED" as const, message: "Test reason." }] : [],
    disposition: "PENDING" as const,
    lawyerAmount: null,
    lawyerReason: null,
    dispositionedBy: null,
    dispositionedAt: null,
  };
}

const PENDING_ASSESSMENT = buildAssessment({
  lines: [
    pendingLine("line-1", "ALLOW", 26640),
    pendingLine("line-2", "DISALLOW", 0),
    pendingLine("line-3", "FLAG", 0),
    pendingLine("line-4", "FLAG", 0),
  ],
  totals: {
    claimedTotal: 88800,
    draftBaseline: 26640,
    disallowedTotal: 12660,
    flaggedTotal: 49500,
    restingOnUnverifiedRules: 10640,
    finalAmount: null,
  },
});

function extractMinor(html: string, testId: string): number {
  const marker = `data-testid="${testId}"`;
  const start = html.indexOf(marker);
  if (start === -1) throw new Error(`no element with ${marker} found`);
  const openTagEnd = html.indexOf(">", start);
  const closeStart = html.indexOf("<", openTagEnd + 1);
  const text = html.slice(openTagEnd + 1, closeStart);
  const match = /([\d,]+)\.(\d{2})/.exec(text);
  if (!match) throw new Error(`no money figure found in "${text}" (testId ${testId})`);
  return Number(match[1]!.replace(/,/g, "")) * 100 + Number(match[2]);
}

function render(assessment: Assessment): string {
  return renderToStaticMarkup(React.createElement(TotalsRail, { assessment, currency: CURRENCY }));
}

describe("TOTALS-RAIL", () => {
  it("TOTALS-RAIL: renders all seven UI-SPEC row labels verbatim", () => {
    const html = render(PENDING_ASSESSMENT);

    expect(html).toContain("Claimed by HR");
    expect(html).toContain("Supported by rules");
    expect(html).toContain("↳ resting on unverified rules");
    expect(html).toContain("Allowed by you, not by a rule");
    expect(html).toContain("Not supported");
    expect(html).toContain("Needs your decision");
    expect(html).toContain("↳ excluded from every total");
  });

  it("TOTALS-RAIL: the two sub-rows render with an indentation marker distinct from the five top-level rows", () => {
    const html = render(PENDING_ASSESSMENT);

    expect(html).toContain('data-testid="total-row-resting-unverified" data-indent="true"');
    expect(html).toContain('data-testid="total-row-excluded" data-indent="true"');
    expect(html).not.toContain('data-testid="total-row-claimed" data-indent="true"');
  });

  it("TOTALS-RAIL: both indented sub-rows carry an ink-3-toned className on their dt/dd pair, the five top-level rows do not", () => {
    const html = render(PENDING_ASSESSMENT);

    for (const testId of ["total-row-resting-unverified", "total-row-excluded"]) {
      const rowStart = html.indexOf(`data-testid="${testId}"`);
      expect(rowStart).toBeGreaterThan(-1);
      const rowEnd = html.indexOf("</div>", rowStart);
      const rowHtml = html.slice(rowStart, rowEnd);
      expect(rowHtml).toMatch(/class="[^"]*ink-3[^"]*"/);
    }

    for (const testId of [
      "total-row-claimed",
      "total-row-supported",
      "total-row-allowed-by-lawyer",
      "total-row-not-supported",
      "total-row-needs-decision",
    ]) {
      const rowStart = html.indexOf(`data-testid="${testId}"`);
      expect(rowStart).toBeGreaterThan(-1);
      const rowEnd = html.indexOf("</div>", rowStart);
      const rowHtml = html.slice(rowStart, rowEnd);
      expect(rowHtml).not.toMatch(/ink-3/);
    }
  });

  it("TOTALS-RAIL: the reconciliation identity holds over the rendered figures — supported + not-supported + needs-your-decision = claimed", () => {
    const html = render(PENDING_ASSESSMENT);

    const claimed = extractMinor(html, "total-claimed");
    const supported = extractMinor(html, "total-supported");
    const notSupported = extractMinor(html, "total-not-supported");
    const needsDecision = extractMinor(html, "total-needs-decision");

    expect(supported + notSupported + needsDecision).toBe(claimed);
  });

  it("TOTALS-RAIL: while any line is pending, the headline renders the hidden-state label and pending-count sentence with no currency figure", () => {
    const html = render(PENDING_ASSESSMENT);

    expect(html).toContain('data-testid="headline-hidden"');
    expect(html).toContain("4 lines still need your decision");
    expect(html).not.toContain('data-testid="headline-value"');
  });

  it("TOTALS-RAIL: once every line is decided, the headline renders the final figure and 'Not yet signed off'", () => {
    const decided = buildAssessment({
      lines: [{ ...pendingLine("line-1", "ALLOW", 26640), disposition: "ACCEPTED" as const }],
      totals: { ...PENDING_ASSESSMENT.totals, finalAmount: 26640 },
    });
    const html = render(decided);

    expect(html).toContain('data-testid="headline-value"');
    expect(html).toContain("Not yet signed off");
    expect(html).not.toContain('data-testid="headline-hidden"');
  });

  it("TOTALS-RAIL: a signed assessment no longer says it is awaiting sign-off", () => {
    const decided = buildAssessment({
      lines: [{ ...pendingLine("line-1", "ALLOW", 26640), disposition: "ACCEPTED" as const }],
      totals: { ...PENDING_ASSESSMENT.totals, finalAmount: 26640 },
    });
    const signed = {
      ...decided,
      signOff: { lawyerName: "Synthetic counsel" } as Assessment["signOff"],
    };
    const html = render(signed);
    expect(html).toContain("Signed off — released to HR");
    expect(html).not.toContain("Not yet signed off");
  });

  it("TOTALS-RAIL: 'Allowed by you, not by a rule' sums lawyerAmount over ALLOWED_BY_LAWYER lines only", () => {
    const withLawyerAllowed = buildAssessment({
      lines: [
        { ...pendingLine("line-1", "DISALLOW", 0), disposition: "ALLOWED_BY_LAWYER" as const, lawyerAmount: 5000 },
        { ...pendingLine("line-2", "ALLOW", 1000), disposition: "ACCEPTED" as const },
      ],
      totals: { ...PENDING_ASSESSMENT.totals, finalAmount: 6000 },
    });
    const html = render(withLawyerAllowed);

    expect(extractMinor(html, "total-allowed-by-lawyer")).toBe(5000);
  });
});
