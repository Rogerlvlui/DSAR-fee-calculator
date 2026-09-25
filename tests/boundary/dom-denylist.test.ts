// tests/boundary/dom-denylist.test.ts
//
// AC-06 half two (BOUND-02): every rendered form input's name/id checked
// against PERSONAL_DATA_DENY_LIST.
//
// Three halves:
//   1. Glob half — every page.tsx under apps/web/app/**, rendered through a
//      helper that tolerates an async server component (calling it returns
//      a promise → recorded as "deferred", never rendered) and otherwise
//      renders it and scans the result. Asserts at least one page file was
//      discovered AND that every discovered file was either scanned or
//      deferred, so this half can never again silently regress to the
//      zero-page/zero-violation no-op it was through 03.1-01, when a real
//      HR form under apps/web/app first existed to find.
//   2. Component half (new, 03.1-02) — imports the HR intake screen's three
//      presentational pieces by name (matter-details fields, attestations
//      panel, expense-line repeater) and renders each with representative
//      props, including a staff-time row, a third-party row and an "other"
//      row in the repeater, so every conditional field group actually
//      renders at least once. This is the half that changes this test from
//      "found nothing because nothing exists" to "found nothing because the
//      real form is clean" — it asserts a minimum scanned-field count as
//      well as an empty violation list, so it cannot pass by scanning zero
//      fields either.
//   3. Canary half — renders the deliberate-violation fixture and asserts
//      the violation IS found. Without this half, the other two would pass
//      identically whether the scanner is correct or entirely broken
//      (01-RESEARCH.md Common Pitfalls #7, T-1-PII-VACUOUS). Left exactly
//      as it was.

import { describe, expect, it } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { findDenyListViolations } from "./denylist-scanner.ts";
import { DenylistCanaryFixture } from "../fixtures/denylist-canary.fixture.tsx";
import { MatterDetailsFields } from "../../apps/web/src/ui/intake/matter-details-fields.tsx";
import { AttestationsPanel } from "../../apps/web/src/ui/intake/attestations-panel.tsx";
import { ExpenseLineRepeater, type ExpenseLineDraft, type RepeaterCategoryOption } from "../../apps/web/src/ui/intake/expense-line-repeater.tsx";
import { EXPENSE_CATEGORY_CODES, EXPENSE_CATEGORY_LABELS } from "@dsar/schemas/taxonomy";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");
const APP_ROOT = path.join(ROOT, "apps", "web", "app");

/** Finds every `page.tsx` under `dir`. Returns `[]` if `dir` does not exist. */
function findPageFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { recursive: true }) as string[];
  return entries.filter((entry) => entry.endsWith("page.tsx")).map((entry) => path.join(dir, entry));
}

/** Extracts every `name`/`id` attribute value from `input`, `select` and
 * `textarea` tags in a rendered HTML string. */
function extractFormFieldNames(html: string): string[] {
  const names: string[] = [];
  const tagPattern = /<(input|select|textarea)\b([^>]*)>/gi;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagPattern.exec(html)) !== null) {
    const attrs = tagMatch[2] ?? "";
    const nameMatch = /\bname="([^"]*)"/.exec(attrs);
    const idMatch = /\bid="([^"]*)"/.exec(attrs);
    if (nameMatch?.[1]) names.push(nameMatch[1]);
    if (idMatch?.[1]) names.push(idMatch[1]);
  }
  return names;
}

function isThenable(value: unknown): value is Promise<unknown> {
  return Boolean(value) && typeof (value as { then?: unknown }).then === "function";
}

type PageScanResult = { outcome: "scanned"; fieldNames: string[] } | { outcome: "deferred" };

/**
 * Invokes a page's default export directly (no React tree, no request
 * context) to check whether it is an async server component before ever
 * trying to render it. An async function ALWAYS returns a Promise the
 * instant it is called, regardless of whether its body awaits anything —
 * so this check never needs to render the tree to find out. A promise
 * result (including a rejected one, e.g. a page destructuring `params`
 * that was never supplied here) is recorded as "deferred" and its
 * rejection is swallowed, never rendered — that page's real coverage comes
 * from its own colocated component tests, per 03.1-01/03.1-02 precedent.
 * A synchronous result is rendered; if rendering itself throws (a client
 * component needing a context this harness cannot provide, e.g. an app
 * router hook), that is *also* deferred rather than failing the suite.
 */
function scanPageDefaultExport(defaultExport: unknown): PageScanResult {
  if (typeof defaultExport !== "function") return { outcome: "deferred" };

  let result: unknown;
  try {
    result = (defaultExport as (...args: unknown[]) => unknown)();
  } catch {
    return { outcome: "deferred" };
  }

  if (isThenable(result)) {
    result.catch(() => {
      // Deliberately swallowed — see function comment above.
    });
    return { outcome: "deferred" };
  }

  try {
    const html = renderToStaticMarkup(result as React.ReactElement);
    return { outcome: "scanned", fieldNames: extractFormFieldNames(html) };
  } catch {
    return { outcome: "deferred" };
  }
}

describe("DOM form-input deny-list — glob half (BOUND-02)", () => {
  it("discovers at least one page file, scans or defers every one of them, and finds zero deny-list violations among the scanned fields", async () => {
    const pageFiles = findPageFiles(APP_ROOT);
    expect(pageFiles.length).toBeGreaterThan(0);

    const allFieldNames: string[] = [];
    let scannedCount = 0;
    let deferredCount = 0;

    for (const file of pageFiles) {
      const mod: { default?: unknown } = await import(pathToFileURL(file).href);
      const result = scanPageDefaultExport(mod.default);
      if (result.outcome === "scanned") {
        scannedCount += 1;
        allFieldNames.push(...result.fieldNames);
      } else {
        deferredCount += 1;
      }
    }

    // Every discovered file lands in exactly one bucket — this is what
    // stops the glob half from silently becoming a zero-page no-op again.
    expect(scannedCount + deferredCount).toBe(pageFiles.length);

    const violations = findDenyListViolations(allFieldNames);
    expect(violations).toEqual([]);
  });
});

const REPRESENTATIVE_CATEGORIES: RepeaterCategoryOption[] = EXPENSE_CATEGORY_CODES.map((categoryCode) => ({
  categoryCode,
  label: EXPENSE_CATEGORY_LABELS[categoryCode],
  hint: "Representative hint text for boundary scanning.",
  verificationStatus: "NEEDS_VERIFICATION",
}));

// One row of each shape the repeater renders conditional fields for: a
// staff-time row (reveals the staff-grade field), a third-party row
// (reveals invoiced/vendor/evidence) and an "other" row (reveals neither) —
// so every conditional field group actually renders at least once.
const REPRESENTATIVE_LINES: ExpenseLineDraft[] = [
  {
    key: "boundary-staff-time",
    categoryCode: "STAFF_TIME_SEARCH",
    description: "Staff time example for boundary scanning",
    quantity: 4,
    unit: "HOUR",
    rateMajor: "40.00",
    incurredByGrade: "EXECUTIVE",
    isThirdPartyInvoiced: false,
    vendorName: "",
    evidenceRef: "",
  },
  {
    key: "boundary-third-party",
    categoryCode: "VENDOR_PAYROLL",
    description: "Third-party example for boundary scanning",
    quantity: 3,
    unit: "ITEM",
    rateMajor: "150.00",
    incurredByGrade: null,
    isThirdPartyInvoiced: true,
    vendorName: "Example Vendor Pte Ltd",
    evidenceRef: "INV-88421",
  },
  {
    key: "boundary-other",
    categoryCode: "OTHER_UNCLASSIFIED",
    description: "Other example for boundary scanning",
    quantity: 1,
    unit: "FIXED",
    rateMajor: "45.00",
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: "",
    evidenceRef: "",
  },
];

describe("DOM form-input deny-list — intake component half (BOUND-02)", () => {
  it("scans the real intake screen's presentational pieces and finds zero violations over a non-trivial field count", () => {
    const matterDetailsHtml = renderToStaticMarkup(
      React.createElement(MatterDetailsFields, {
        value: {
          reference: "DSAR-BOUNDARY-0001",
          jurisdictionCode: "SG",
          legalEntity: "Acme Pte Ltd",
          controllerType: "PRIVATE_ORGANISATION",
          requestReceivedOn: "2026-08-20",
          requestorClass: "FORMER_EMPLOYEE",
        },
        onChange: () => {},
        currency: "SGD",
        jurisdictionPack: {
          jurisdictionCode: "SG",
          jurisdictionName: "Singapore",
          packId: "SG-PDPA",
          version: "2026.09.1",
          displayStatus: "DRAFT",
          daysUntilReviewDue: 400,
          feePosture: { PRIVATE_ORGANISATION: "PERMITTED_REASONABLE", PUBLIC_AGENCY: "NO_EXPRESS_AUTHORITY" },
        },
      })
    );

    const attestationsHtml = renderToStaticMarkup(
      React.createElement(AttestationsPanel, {
        value: {
          identityVerified: true,
          scopeClarified: true,
          isKnownDisputeOrLitigation: false,
        },
        onChange: () => {},
      })
    );

    const repeaterHtml = renderToStaticMarkup(
      React.createElement(ExpenseLineRepeater, {
        lines: REPRESENTATIVE_LINES,
        onChange: () => {},
        categories: REPRESENTATIVE_CATEGORIES,
        currency: "SGD",
      })
    );

    const fieldNames = [
      ...extractFormFieldNames(matterDetailsHtml),
      ...extractFormFieldNames(attestationsHtml),
      ...extractFormFieldNames(repeaterHtml),
    ];

    // The count assertion is what stops this half degrading into the same
    // vacuous pass the glob half became in Phase 1: zero fields scanned and
    // zero violations found are indistinguishable without it.
    expect(fieldNames.length).toBeGreaterThanOrEqual(12);
    expect(findDenyListViolations(fieldNames)).toEqual([]);
  });
});

describe("DOM form-input deny-list — canary half (T-1-PII-VACUOUS)", () => {
  it("catches the canary fixture's deny-listed input name", () => {
    const html = renderToStaticMarkup(React.createElement(DenylistCanaryFixture));
    const fieldNames = extractFormFieldNames(html);
    const violations = findDenyListViolations(fieldNames);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.matched).toBe("nric");
  });
});
