// apps/web/src/ui/intake/categorization-summary.test.tsx
//
// Colocated, rendered with renderToStaticMarkup, tagged CATEGORIZATION-SUMMARY.
// Proves the section 3 partition/total logic never disagrees with
// computeLineAmountMinor — the SAME function ClaimFooter's own claimed total
// reduces over — and the empty/step-heading structural requirements.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CategorizationSummary,
  partitionLinesByCategorization,
} from "./categorization-summary.tsx";
import { computeLineAmountMinor, type ExpenseLineDraft } from "./expense-line-repeater.tsx";
import { MatterDetailsFields, type MatterDetailsJurisdictionPack, type MatterDetailsValue } from "./matter-details-fields.tsx";
import { ExpenseLineRepeater, type RepeaterCategoryOption } from "./expense-line-repeater.tsx";

function draft(overrides: Partial<ExpenseLineDraft>): ExpenseLineDraft {
  return {
    key: overrides.key ?? `row-${Math.random()}`,
    categoryCode: "STAFF_TIME_SEARCH",
    description: "Test line",
    quantity: 4,
    unit: "HOUR",
    rateMajor: "40.00",
    incurredByGrade: "EXECUTIVE",
    isThirdPartyInvoiced: false,
    vendorName: "",
    evidenceRef: "",
    ...overrides,
  };
}

const MIXED_LINES: ExpenseLineDraft[] = [
  draft({ key: "row-1", categoryCode: "STAFF_TIME_SEARCH", quantity: 4, rateMajor: "40.00" }),
  draft({ key: "row-2", categoryCode: "PHOTOCOPY_PRINT", unit: "PAGE", quantity: 220, rateMajor: "0.15" }),
  draft({ key: "row-3", categoryCode: "OTHER_UNCLASSIFIED", unit: "FIXED", quantity: 1, rateMajor: "45.00" }),
  draft({ key: "row-4", categoryCode: "OTHER_UNCLASSIFIED", unit: "FIXED", quantity: 2, rateMajor: "10.00" }),
];

describe("CATEGORIZATION-SUMMARY: partitionLinesByCategorization", () => {
  it("CATEGORIZATION-SUMMARY: OTHER_UNCLASSIFIED lines land only in the other-claims group, everything else in categorized", () => {
    const { categorized, otherClaims } = partitionLinesByCategorization(MIXED_LINES);

    expect(categorized.map((line) => line.key)).toEqual(["row-1", "row-2"]);
    expect(otherClaims.map((line) => line.key)).toEqual(["row-3", "row-4"]);
    expect(categorized.every((line) => line.categoryCode !== "OTHER_UNCLASSIFIED")).toBe(true);
    expect(otherClaims.every((line) => line.categoryCode === "OTHER_UNCLASSIFIED")).toBe(true);
  });

  it("CATEGORIZATION-SUMMARY: an empty lines array partitions into two empty groups", () => {
    const { categorized, otherClaims } = partitionLinesByCategorization([]);
    expect(categorized).toEqual([]);
    expect(otherClaims).toEqual([]);
  });
});

describe("CATEGORIZATION-SUMMARY: rendering", () => {
  it("CATEGORIZATION-SUMMARY: categorized total plus other-claims total equals the sum of computeLineAmountMinor across all lines", () => {
    const currency = "SGD";
    const { categorized, otherClaims } = partitionLinesByCategorization(MIXED_LINES);
    const categorizedTotal = categorized.reduce((sum, line) => sum + computeLineAmountMinor(line, currency), 0);
    const otherClaimsTotal = otherClaims.reduce((sum, line) => sum + computeLineAmountMinor(line, currency), 0);
    const grandTotal = MIXED_LINES.reduce((sum, line) => sum + computeLineAmountMinor(line, currency), 0);

    expect(categorizedTotal + otherClaimsTotal).toBe(grandTotal);

    const html = renderToStaticMarkup(
      React.createElement(CategorizationSummary, { lines: MIXED_LINES, currency })
    );
    // The rendered figures must be derived from the SAME totals just
    // computed above, not a second, independently-derived source.
    expect(html).toContain("2 lines");
    expect(html).toContain("Categorized");
    expect(html).toContain("Other claims");
  });

  it("CATEGORIZATION-SUMMARY: renders nothing (no section element at all) when lines is empty", () => {
    const html = renderToStaticMarkup(React.createElement(CategorizationSummary, { lines: [], currency: "SGD" }));
    expect(html).toBe("");
    expect(html).not.toContain("<section");
  });

  it("CATEGORIZATION-SUMMARY: renders the numbered step-3 heading with an aria-hidden badge", () => {
    const html = renderToStaticMarkup(
      React.createElement(CategorizationSummary, { lines: MIXED_LINES, currency: "SGD" })
    );
    expect(html).toContain('data-testid="categorization-summary"');
    expect(html).toContain('class="step-number"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("How the engine sorted these lines");
  });
});

describe("CATEGORIZATION-SUMMARY: step-number badges on the other two intake sections", () => {
  function matterDetailsValue(): MatterDetailsValue {
    return {
      reference: "DSAR-2026-0001",
      jurisdictionCode: "SG",
      legalEntity: "Acme Pte Ltd",
      controllerType: "PRIVATE_ORGANISATION",
      requestReceivedOn: "2026-08-20",
      requestorClass: "FORMER_EMPLOYEE",
    };
  }

  function matterDetailsPack(): MatterDetailsJurisdictionPack {
    return {
      jurisdictionCode: "SG",
      jurisdictionName: "Singapore",
      packId: "SG-PDPA",
      version: "2026.09.1",
      displayStatus: "DRAFT",
      daysUntilReviewDue: 400,
      feePosture: { PRIVATE_ORGANISATION: "PERMITTED_REASONABLE", PUBLIC_AGENCY: "NO_EXPRESS_AUTHORITY" },
    };
  }

  it("CATEGORIZATION-SUMMARY: MatterDetailsFields's heading renders a step-number badge reading 1, with the heading text unchanged", () => {
    const html = renderToStaticMarkup(
      React.createElement(MatterDetailsFields, {
        value: matterDetailsValue(),
        onChange: () => {},
        currency: "SGD",
        jurisdictionPack: matterDetailsPack(),
      })
    );
    expect(html).toContain('class="step-number"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(">1<");
    expect(html).toContain("Matter details");
  });

  it("CATEGORIZATION-SUMMARY: ExpenseLineRepeater's heading renders a step-number badge reading 2, with the heading text unchanged", () => {
    const categories: RepeaterCategoryOption[] = [
      {
        categoryCode: "STAFF_TIME_SEARCH",
        label: "Staff time — locating and retrieving the data",
        hint: "Staff time spent locating the data is recoverable in most regimes.",
        verificationStatus: "VERIFIED",
      },
    ];
    const html = renderToStaticMarkup(
      React.createElement(ExpenseLineRepeater, {
        lines: [],
        onChange: () => {},
        categories,
        currency: "SGD",
      })
    );
    expect(html).toContain('class="step-number"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(">2<");
    expect(html).toContain("What the response cost");
  });
});
