// apps/web/src/ui/review/line-card.test.tsx
//
// Colocated, rendered with renderToStaticMarkup — the same technique
// assessment-view.test.tsx (03.1-01) and expense-line-repeater.test.tsx
// (03.1-02) already use. Tagged LINE-CARD.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssessmentLineSchema, type AssessmentLine } from "@dsar/schemas/assessment";
import type { Minor } from "@dsar/schemas/primitives";
import { LineCard, VERDICT_LABELS } from "./line-card.tsx";

// This project has no @testing-library/react / @testing-library/jest-dom
// dependency (a new package install needs its own legitimacy checkpoint,
// per this project's deviation rules) — real-DOM rendering below follows
// apps/web/src/ui/intake/intake-form.test.tsx's own established precedent
// (react-dom/client's createRoot into a jsdom container) rather than
// pulling in a new test-only dependency for one assertion.
//
// computeAriaLabelAccessibleName implements exactly ONE step of the W3C
// Accessible Name and Description Computation algorithm
// (https://www.w3.org/TR/accname-1.2/#step2B): step 2C, "aria-label",
// returns the element's trimmed aria-label value if present and non-empty.
// That step is checked BEFORE name-from-content and applies regardless of
// the element's role — so for a plain <span> (whose default `generic` role
// does not support name-from-content at all), a non-empty aria-label IS
// the accessible name, full stop. This is not an approximation of the
// broader algorithm; it is a narrow, spec-accurate implementation of the
// one step this test exercises.
function computeAriaLabelAccessibleName(element: Element): string | null {
  const label = element.getAttribute("aria-label");
  if (label === null) return null;
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const CURRENCY = "SGD" as const;

// Loosely typed on purpose: these values are only ever handed to
// AssessmentLineSchema.parse() below, whose input type is the pre-brand
// shape — a Partial<AssessmentLine> parameter would reject a plain
// `engineAmount: 0` literal for the branded `Minor` field it overrides.
function line(overrides: Record<string, unknown>): AssessmentLine {
  return AssessmentLineSchema.parse({
    id: "assessment-line-1",
    expenseLineId: "line-1",
    verdict: "ALLOW",
    engineAmount: 16000,
    appliedRuleId: "SG-PDPA.STAFF_TIME_SEARCH",
    appliedCap: null,
    basis: "Locating and retrieving the requested data is a service provided to enable the response.",
    citation: { instrument: "Personal Data Protection Regulations 2021", provision: "reg.7" },
    flagReasons: [],
    disposition: "PENDING",
    lawyerAmount: null,
    lawyerReason: null,
    dispositionedBy: null,
    dispositionedAt: null,
    ...overrides,
  });
}

function renderCard(props: Partial<React.ComponentProps<typeof LineCard>> = {}, assessmentLine?: AssessmentLine) {
  return renderToStaticMarkup(
    React.createElement(LineCard, {
      line: assessmentLine ?? line({}),
      seq: 1,
      categoryLabel: "Staff time — locating and retrieving the data",
      description: "Searching HRIS, shared drives and archived mail",
      quantity: 4,
      unit: "HOUR",
      unitRate: 4000 as Minor,
      claimedAmount: 16000 as Minor,
      currency: CURRENCY,
      verificationStatus: "NEEDS_VERIFICATION",
      ...props,
    })
  );
}

describe("LINE-CARD", () => {
  it("LINE-CARD: renders the applied rule id, basis and citation as plain visible text with no disclosure element", () => {
    const html = renderCard();

    expect(html).toContain("SG-PDPA.STAFF_TIME_SEARCH");
    expect(html).toContain("Locating and retrieving the requested data");
    expect(html).toContain("Personal Data Protection Regulations 2021");
    expect(html).not.toContain("<details");
    expect(html).not.toContain("<summary");
  });

  it("LINE-CARD: renders the unverified-rule marker when the applied rule needs verification", () => {
    const html = renderCard({ verificationStatus: "NEEDS_VERIFICATION" });
    expect(html).toContain("unverified rule");
  });

  it("LINE-CARD: does not render the unverified-rule marker when the applied rule is verified", () => {
    const html = renderCard({ verificationStatus: "VERIFIED" });
    expect(html).not.toContain("unverified rule");
  });

  it("LINE-CARD: renders each flag reason as a list item under Why this needs you, in the engine's own order", () => {
    const flagged = line({
      verdict: "FLAG",
      engineAmount: 0,
      flagReasons: [
        { code: "CONDITIONS_NOT_MET", message: "Conditions not met — no invoice evidence reference supplied." },
        { code: "MATERIALITY", message: "Materiality — this line is 51% of the total claim." },
      ],
    });
    const html = renderCard({}, flagged);

    expect(html).toContain("Why this needs you");
    const conditionsIndex = html.indexOf("Conditions not met");
    const materialityIndex = html.indexOf("Materiality");
    expect(conditionsIndex).toBeGreaterThan(-1);
    expect(materialityIndex).toBeGreaterThan(conditionsIndex);
  });

  it("LINE-CARD: renders every verdict's UI-SPEC label in words", () => {
    for (const verdict of ["FLAG", "ALLOW", "ALLOW_CAPPED", "DISALLOW"] as const) {
      const html = renderCard(
        {},
        line({
          verdict,
          engineAmount: verdict === "FLAG" || verdict === "DISALLOW" ? 0 : 16000,
          flagReasons: verdict === "FLAG" ? [{ code: "UNCATEGORISED", message: "Test reason." }] : [],
        })
      );
      expect(html).toContain(VERDICT_LABELS[verdict]);
    }
  });

  it("LINE-CARD: quotes HR's description verbatim, with the chosen-by-HR suffix only for ALLOW/ALLOW_CAPPED", () => {
    const allowHtml = renderCard({}, line({ verdict: "ALLOW" }));
    expect(allowHtml).toContain("category chosen by HR");

    const disallowHtml = renderCard({}, line({ verdict: "DISALLOW", engineAmount: 0 }));
    expect(disallowHtml).not.toContain("category chosen by HR");
  });

  it("LINE-CARD: every verdict's badge has a real accessible name (aria-label) equal to its visible label, not merely visible text content", async () => {
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");

    for (const verdict of ["FLAG", "ALLOW", "ALLOW_CAPPED", "DISALLOW"] as const) {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      act(() => {
        root.render(
          React.createElement(LineCard, {
            line: line({
              verdict,
              engineAmount: verdict === "FLAG" || verdict === "DISALLOW" ? 0 : 16000,
              flagReasons: verdict === "FLAG" ? [{ code: "UNCATEGORISED", message: "Test reason." }] : [],
            }),
            seq: 1,
            categoryLabel: "Staff time — locating and retrieving the data",
            description: "Searching HRIS, shared drives and archived mail",
            quantity: 4,
            unit: "HOUR",
            unitRate: 4000 as Minor,
            claimedAmount: 16000 as Minor,
            currency: CURRENCY,
            verificationStatus: "NEEDS_VERIFICATION",
          })
        );
      });

      const badge = container.querySelector('[data-testid="verdict-badge"]');
      expect(badge).not.toBeNull();
      // The accessible name (via aria-label) must equal the label exactly —
      // a bare generic <span> with only text content computes an EMPTY
      // accessible name under the real algorithm, which is exactly the gap
      // this assertion (not a toHaveTextContent-style check) catches.
      expect(computeAriaLabelAccessibleName(badge as Element)).toBe(VERDICT_LABELS[verdict]);
      // The visible text content is unchanged — this adds an accessible
      // name, it does not replace or hide the visible label.
      expect(badge?.textContent).toBe(VERDICT_LABELS[verdict]);

      act(() => {
        root.unmount();
      });
      container.remove();
    }
  });

  // No test here for absence of a language-model-provenance badge or a
  // category-suggestion block: the plan's own acceptance criterion checks
  // that via a directory-wide grep for Annex A's exact marker strings, and
  // a redundant assertion quoting those same strings in this test file
  // would make that grep a false positive against its own test file.
});
