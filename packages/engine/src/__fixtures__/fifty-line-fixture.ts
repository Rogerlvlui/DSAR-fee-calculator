// packages/engine/src/__fixtures__/fifty-line-fixture.ts
//
// ENGINE-17 (PRD §11) — fifty expense lines against the same reference pack
// reference-pack.ts already builds (REFERENCE_FIXTURE_PACK), reused rather
// than a second hand-built pack. Spread across the pack's six worked
// categories (WORKED_REFERENCE_CATEGORY_CODES) so the timed path exercises
// ALLOW, ALLOW_CAPPED, ALLOW_IF and the two FLAG shapes — not fifty copies
// of one line, and not fifty DISALLOW-filler lines that would skip most of
// step 3's dispatch entirely.
//
// Two deliberate constraints, both because a violation would turn this into
// a fixture that measures something other than the ordinary per-line/cap
// path perf.test.ts is trying to time (reference-lines.ts's own module note
// documents the same two hazards for the six-line fixture):
//   - Every STAFF_TIME_* line's unitRate stays under EXECUTIVE's
//     rateSanityCeiling (5000, reference-pack.ts) — an over-ceiling rate
//     would flip that line to FLAG via the rate-sanity cross-line check,
//     same as reference-lines.ts warns against.
//   - Every description is distinct (the index is baked into the text), so
//     the duplicate-detection cross-line check has nothing to fire on —
//     fifty identical descriptions in the same category would flag all
//     fifty as possible duplicates and the timed run would measure the
//     FLAG path exclusively, not the mix the budget is meant to cover.
//
// Also kept well clear of the 40% materiality threshold: fifty roughly
// equal-sized lines each sit at about 2% of the claimed total.

import { ExpenseLineSchema, type ExpenseLine } from "@dsar/schemas/expense-line";
import { REFERENCE_MATTER } from "./reference-matter.ts";
import { WORKED_REFERENCE_CATEGORY_CODES } from "./reference-pack.ts";

export const FIFTY_LINE_FIXTURE_LENGTH = 50;

function buildLine(index: number): ExpenseLine {
  const category = WORKED_REFERENCE_CATEGORY_CODES[index % WORKED_REFERENCE_CATEGORY_CODES.length]!;
  const base = {
    id: `fifty-line-fixture-${index}`,
    matterId: REFERENCE_MATTER.id,
    seq: index,
    hrNote: null,
  };

  switch (category) {
    case "STAFF_TIME_SEARCH":
    case "STAFF_TIME_COLLATE":
    case "STAFF_TIME_ASSESS_EXEMPTIONS": {
      const quantity = 1 + (index % 5); // 1-5 hours
      const unitRate = 2000 + ((index * 37) % 2000); // 2000-3999, under the 5000 EXECUTIVE ceiling
      return ExpenseLineSchema.parse({
        ...base,
        categoryCode: category,
        description: `Fifty-line perf fixture — line ${index + 1} (${category}, staff time)`,
        quantity,
        unit: "HOUR",
        unitRate,
        claimedAmount: quantity * unitRate,
        incurredByGrade: "EXECUTIVE",
        isThirdPartyInvoiced: false,
        vendorName: null,
        evidenceRef: null,
      });
    }
    case "PHOTOCOPY_PRINT": {
      const quantity = 50 + ((index * 7) % 300); // 50-349 pages, exercises the PER_UNIT cap
      const unitRate = 15;
      return ExpenseLineSchema.parse({
        ...base,
        categoryCode: category,
        description: `Fifty-line perf fixture — line ${index + 1} (photocopying)`,
        quantity,
        unit: "PAGE",
        unitRate,
        claimedAmount: quantity * unitRate,
        incurredByGrade: null,
        isThirdPartyInvoiced: false,
        vendorName: null,
        evidenceRef: null,
      });
    }
    case "VENDOR_PAYROLL": {
      const quantity = 1 + (index % 4);
      const unitRate = 5000 + ((index * 123) % 10_000);
      return ExpenseLineSchema.parse({
        ...base,
        categoryCode: category,
        description: `Fifty-line perf fixture — line ${index + 1} (vendor payroll extract)`,
        quantity,
        unit: "ITEM",
        unitRate,
        claimedAmount: quantity * unitRate,
        incurredByGrade: null,
        // Marked invoiced with evidence, matching the ALLOW_IF rule's own
        // conditions — reaches ALLOW rather than CONDITIONS_NOT_MET, and the
        // vendor-evidence cross-line check stands down because the rule
        // already tests this same field (cross-line-checks.ts).
        isThirdPartyInvoiced: true,
        vendorName: `Fixture Vendor ${index + 1}`,
        evidenceRef: `INV-FIFTY-${index + 1}`,
      });
    }
    case "OTHER_UNCLASSIFIED": {
      const unitRate = 1000 + ((index * 211) % 5000);
      return ExpenseLineSchema.parse({
        ...base,
        categoryCode: category,
        description: `Fifty-line perf fixture — line ${index + 1} (uncategorised)`,
        quantity: 1,
        unit: "FIXED",
        unitRate,
        claimedAmount: unitRate,
        incurredByGrade: null,
        isThirdPartyInvoiced: false,
        vendorName: null,
        evidenceRef: null,
      });
    }
    default: {
      // WORKED_REFERENCE_CATEGORY_CODES is exactly the six-element array
      // above — this branch is unreachable, and TypeScript proves it via
      // the exhaustive switch (no fallthrough default value is ever used).
      throw new Error(`fifty-line-fixture: unexpected worked category '${category}'`);
    }
  }
}

export function buildFiftyLineFixture(): ExpenseLine[] {
  return Array.from({ length: FIFTY_LINE_FIXTURE_LENGTH }, (_, index) => buildLine(index));
}

export const FIFTY_LINE_FIXTURE_LINES: ExpenseLine[] = buildFiftyLineFixture();
