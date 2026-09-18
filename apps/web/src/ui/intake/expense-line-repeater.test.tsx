// apps/web/src/ui/intake/expense-line-repeater.test.tsx
//
// Colocated, rendered with renderToStaticMarkup, tagged REPEATER. State-
// driven behaviour (unit constraints, conditional fields, hints) is tested
// by rendering with the corresponding props, not by simulating typing.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ExpenseLineRepeater,
  EMPTY_STATE_HEADING,
  EMPTY_STATE_BODY,
  type ExpenseLineDraft,
  type RepeaterCategoryOption,
} from "./expense-line-repeater.tsx";

const CATEGORIES: RepeaterCategoryOption[] = [
  {
    categoryCode: "STAFF_TIME_SEARCH",
    label: "Staff time — locating and retrieving the data",
    hint: "Staff time spent locating the data is recoverable in most regimes.",
    verificationStatus: "VERIFIED",
  },
  {
    categoryCode: "PHOTOCOPY_PRINT",
    label: "Photocopying and printing",
    hint: "Photocopying is capped at the pack per-page rate, view-model supplied.",
    verificationStatus: "NEEDS_VERIFICATION",
  },
  {
    categoryCode: "VENDOR_PAYROLL",
    label: "Third-party payroll or tax-records vendor charge",
    hint: "Third-party charges need an invoice reference.",
    verificationStatus: "NEEDS_VERIFICATION",
  },
  {
    categoryCode: "OTHER_UNCLASSIFIED",
    label: "Something else (always referred to Legal)",
    hint: "Always referred to Legal — never scored automatically.",
    verificationStatus: "NEEDS_VERIFICATION",
  },
];

function draft(overrides: Partial<ExpenseLineDraft>): ExpenseLineDraft {
  return {
    key: "row-test",
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

/** Extracts the option `value`s inside the `<select name="unit">` block —
 * scoped to that select specifically (the row also renders a category
 * select and, conditionally, a staff-grade select, both of which have
 * their own options). Tolerant of React SSR's `selected=""` attribute
 * landing between `value="X"` and the closing `>`. */
function unitOptionValues(html: string): string[] {
  const start = html.indexOf('<select name="unit"');
  const end = html.indexOf("</select>", start);
  const block = html.slice(start, end);
  return [...block.matchAll(/<option value="([A-Z]+)"/g)].map((match) => match[1]!);
}

function renderRepeater(lines: ExpenseLineDraft[]): string {
  return renderToStaticMarkup(
    React.createElement(ExpenseLineRepeater, {
      lines,
      onChange: () => {},
      categories: CATEGORIES,
      currency: "SGD",
    })
  );
}

describe("REPEATER: empty state and line count", () => {
  it("REPEATER: renders the UI-SPEC empty-state heading and body at zero rows", () => {
    const html = renderRepeater([]);
    expect(html).toContain(EMPTY_STATE_HEADING);
    expect(html).toContain(EMPTY_STATE_BODY);
  });

  it("REPEATER: line-count badge reads singular for one row", () => {
    const html = renderRepeater([draft({})]);
    expect(html).toContain("1 line<");
  });

  it("REPEATER: line-count badge reads plural for six rows", () => {
    const html = renderRepeater(
      Array.from({ length: 6 }, (_, index) => draft({ key: `row-${index}` }))
    );
    expect(html).toContain("6 lines<");
  });
});

describe("REPEATER: computed amount", () => {
  it("REPEATER: amount is computed via formatMinor from quantity times rate, and changes when either input changes", () => {
    const htmlOne = renderRepeater([draft({ quantity: 4, rateMajor: "40.00" })]);
    const htmlTwo = renderRepeater([draft({ quantity: 2, rateMajor: "40.00" })]);
    const htmlThree = renderRepeater([draft({ quantity: 4, rateMajor: "10.00" })]);

    // 4 * 40.00 = 160.00
    expect(htmlOne).toContain("160.00");
    // 2 * 40.00 = 80.00
    expect(htmlTwo).toContain("80.00");
    // 4 * 10.00 = 40.00
    expect(htmlThree).toContain("40.00");
    expect(htmlOne).not.toBe(htmlTwo);
    expect(htmlOne).not.toBe(htmlThree);
  });
});

describe("REPEATER: unit constrained by category", () => {
  it("REPEATER: a staff-time category offers only the Hours unit and reveals the staff-grade field", () => {
    const html = renderRepeater([draft({ categoryCode: "STAFF_TIME_SEARCH", unit: "HOUR" })]);

    expect(unitOptionValues(html)).toEqual(["HOUR"]);
    expect(html).toContain('data-testid="staff-grade-field"');
  });

  it("REPEATER: the photocopying category offers only the Pages unit and hides the staff-grade field", () => {
    const html = renderRepeater([
      draft({ categoryCode: "PHOTOCOPY_PRINT", unit: "PAGE", incurredByGrade: null }),
    ]);

    expect(unitOptionValues(html)).toEqual(["PAGE"]);
    expect(html).not.toContain('data-testid="staff-grade-field"');
  });
});

describe("REPEATER: third-party fields", () => {
  it("REPEATER: a third-party category reveals the invoiced flag, vendor and evidence-reference fields", () => {
    const html = renderRepeater([
      draft({ categoryCode: "VENDOR_PAYROLL", unit: "ITEM", incurredByGrade: null }),
    ]);
    expect(html).toContain('data-testid="third-party-fields"');
    expect(html).toContain('name="vendorName"');
    expect(html).toContain('name="evidenceRef"');
  });

  it("REPEATER: a non-third-party category hides the invoiced flag, vendor and evidence-reference fields", () => {
    const html = renderRepeater([draft({ categoryCode: "STAFF_TIME_SEARCH" })]);
    expect(html).not.toContain('data-testid="third-party-fields"');
  });
});

describe("REPEATER: category-contextual hint", () => {
  it("REPEATER: renders the hint supplied by the category's view-model entry, not a hard-coded sentence", () => {
    const html = renderRepeater([draft({ categoryCode: "PHOTOCOPY_PRINT", unit: "PAGE", incurredByGrade: null })]);
    expect(html).toContain("Photocopying is capped at the pack per-page rate, view-model supplied.");
  });
});
