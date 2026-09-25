// apps/web/src/ui/intake/expense-line-repeater.tsx
//
// Section 3 of the HR intake screen (PRD §10.2): a repeater of rows, never
// a grid — a grid invites paste-bombing and hides validation. Each row
// picks from the closed 21-code taxonomy (never free text), offers only
// the units valid for the chosen category, computes its amount read-only
// through formatMinor, and shows staff-time/third-party fields only where
// the category calls for them. The category-contextual hint comes from the
// categories prop (the pack's own view model, apps/web/src/server/pack-
// view.ts) — never a sentence hard-coded here. Imports nothing from
// apps/web/src/server.

"use client";

import { toMinor, type CurrencyCode, type StaffGrade } from "@dsar/schemas/primitives";
import { formatMinorWithCode, MINOR_UNIT_DECIMALS } from "@dsar/schemas/money";
import type { ExpenseUnit } from "@dsar/schemas/expense-line";
import type { ExpenseCategoryCode } from "@dsar/schemas/taxonomy";
import type { VerificationStatus } from "@dsar/schemas/rule-pack";
import { FREE_TEXT_LIMITS } from "@dsar/schemas/constants";
import { detectLikelyPersonalData } from "@dsar/schemas/personal-data-pattern";
import { countNonWhitespaceChars } from "../../domain/disposition-actions.ts";
import {
  MIN_OTHER_DESCRIPTION_NON_WHITESPACE_CHARS,
  OTHER_UNCLASSIFIED_DESCRIPTION_HINT,
  hasSufficientDescriptionForCategory,
} from "../../domain/expense-description.ts";

export interface RepeaterCategoryOption {
  categoryCode: ExpenseCategoryCode;
  label: string;
  hint: string;
  verificationStatus: VerificationStatus;
}

export interface ExpenseLineDraft {
  /** Client-local key only — never sent to the server. */
  key: string;
  categoryCode: ExpenseCategoryCode;
  description: string;
  quantity: number;
  unit: ExpenseUnit;
  /** What HR typed, in major currency units (e.g. "40.00") — converted to
   * Minor at submit time via MINOR_UNIT_DECIMALS[currency]. */
  rateMajor: string;
  incurredByGrade: StaffGrade | null;
  isThirdPartyInvoiced: boolean;
  vendorName: string;
  evidenceRef: string;
}

export interface ExpenseLineRepeaterProps {
  lines: ExpenseLineDraft[];
  onChange: (lines: ExpenseLineDraft[]) => void;
  categories: RepeaterCategoryOption[];
  currency: CurrencyCode;
}

// PRD §10.2's four category groups. Grouping is a presentation choice, not
// a scoring one — the closed EXPENSE_CATEGORY_CODES list is what the
// server accepts, unaffected by which group a code is displayed under.
const CATEGORY_GROUPS: { label: string; codes: readonly ExpenseCategoryCode[] }[] = [
  {
    label: "Staff time",
    codes: [
      "STAFF_TIME_SEARCH",
      "STAFF_TIME_COLLATE",
      "STAFF_TIME_REDACT_THIRD_PARTY",
      "STAFF_TIME_REDACT_EXEMPT",
      "STAFF_TIME_ASSESS_EXEMPTIONS",
      "STAFF_TIME_LEGAL_REVIEW",
      "PROFESSIONAL_REVIEW",
    ],
  },
  {
    label: "Materials & delivery",
    codes: [
      "PHOTOCOPY_PRINT",
      "MEDIA_MATERIALS",
      "POSTAGE_COURIER",
      "SECURE_TRANSFER",
      "IT_EXTRACTION",
      "TRANSLATION",
      "TRANSCRIPTION_CONVERSION",
    ],
  },
  {
    label: "Third-party charges",
    codes: ["VENDOR_PAYROLL", "VENDOR_ARCHIVE", "VENDOR_OTHER"],
  },
  {
    label: "Other",
    codes: ["IDENTITY_VERIFICATION", "ADMIN_OVERHEAD", "RECORDS_REMEDIATION", "OTHER_UNCLASSIFIED"],
  },
];

// PRD §10.2: "Unit ... constrained by category — hours for staff time,
// pages for photocopying." Exhaustive Record — a missing/added category
// code is a compile error.
const ALLOWED_UNITS_BY_CATEGORY: Record<ExpenseCategoryCode, readonly ExpenseUnit[]> = {
  STAFF_TIME_SEARCH: ["HOUR"],
  STAFF_TIME_COLLATE: ["HOUR"],
  STAFF_TIME_REDACT_THIRD_PARTY: ["HOUR"],
  STAFF_TIME_REDACT_EXEMPT: ["HOUR"],
  STAFF_TIME_ASSESS_EXEMPTIONS: ["HOUR"],
  STAFF_TIME_LEGAL_REVIEW: ["HOUR"],
  PROFESSIONAL_REVIEW: ["HOUR"],
  PHOTOCOPY_PRINT: ["PAGE"],
  MEDIA_MATERIALS: ["ITEM"],
  POSTAGE_COURIER: ["ITEM"],
  SECURE_TRANSFER: ["FIXED"],
  IT_EXTRACTION: ["HOUR", "GIGABYTE"],
  VENDOR_PAYROLL: ["ITEM"],
  VENDOR_ARCHIVE: ["ITEM"],
  VENDOR_OTHER: ["ITEM", "FIXED"],
  TRANSLATION: ["ITEM"],
  TRANSCRIPTION_CONVERSION: ["HOUR", "ITEM"],
  IDENTITY_VERIFICATION: ["FIXED"],
  ADMIN_OVERHEAD: ["HOUR"],
  RECORDS_REMEDIATION: ["HOUR"],
  OTHER_UNCLASSIFIED: ["FIXED"],
};

const UNIT_LABELS: Record<ExpenseUnit, string> = {
  HOUR: "Hours",
  PAGE: "Pages",
  ITEM: "Items",
  GIGABYTE: "Gigabytes",
  FIXED: "Fixed",
};

const STAFF_GRADE_LABELS: Record<StaffGrade, string> = {
  ADMIN: "Admin",
  EXECUTIVE: "Executive",
  MANAGER: "Manager",
  SENIOR_MANAGER: "Senior manager",
  SPECIALIST: "Specialist",
};

const STAFF_GRADE_CATEGORIES = new Set<ExpenseCategoryCode>([
  "STAFF_TIME_SEARCH",
  "STAFF_TIME_COLLATE",
  "STAFF_TIME_REDACT_THIRD_PARTY",
  "STAFF_TIME_REDACT_EXEMPT",
  "STAFF_TIME_ASSESS_EXEMPTIONS",
  "STAFF_TIME_LEGAL_REVIEW",
]);

const THIRD_PARTY_CATEGORIES = new Set<ExpenseCategoryCode>(["VENDOR_PAYROLL", "VENDOR_ARCHIVE", "VENDOR_OTHER"]);

// Which of the four PRD §10.2 groups each category code belongs to, derived
// once from CATEGORY_GROUPS above so the two never drift apart.
const GROUP_LABEL_BY_CATEGORY = new Map<ExpenseCategoryCode, string>(
  CATEGORY_GROUPS.flatMap((group) => group.codes.map((code) => [code, group.label] as const))
);

export function allowedUnitsForCategory(categoryCode: ExpenseCategoryCode): readonly ExpenseUnit[] {
  return ALLOWED_UNITS_BY_CATEGORY[categoryCode];
}

export function isStaffGradeCategory(categoryCode: ExpenseCategoryCode): boolean {
  return STAFF_GRADE_CATEGORIES.has(categoryCode);
}

export function isThirdPartyCategory(categoryCode: ExpenseCategoryCode): boolean {
  return THIRD_PARTY_CATEGORIES.has(categoryCode);
}

/** Converts a major-unit rate string (e.g. "40.00") into Minor units for
 * `currency`, using MINOR_UNIT_DECIMALS — never a hard-coded 100. */
export function rateMajorToMinor(rateMajor: string, currency: CurrencyCode): number {
  const decimals = MINOR_UNIT_DECIMALS[currency];
  const parsed = Number.parseFloat(rateMajor);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 10 ** decimals);
}

export function computeLineAmountMinor(line: ExpenseLineDraft, currency: CurrencyCode): number {
  return line.quantity * rateMajorToMinor(line.rateMajor, currency);
}

let nextRowKey = 0;
export function newRowKey(): string {
  nextRowKey += 1;
  return `row-${nextRowKey}`;
}

function blankLine(categoryCode: ExpenseCategoryCode): ExpenseLineDraft {
  return {
    key: newRowKey(),
    categoryCode,
    description: "",
    quantity: 1,
    unit: allowedUnitsForCategory(categoryCode)[0] ?? "FIXED",
    rateMajor: "",
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: "",
    evidenceRef: "",
  };
}

// PRD §14's six reference lines, in submission order — populates form
// inputs only, computes nothing. Rate strings are the same major-unit
// figures Annex A itself shows (SGD 40.00/40.00/40.00/0.15/150.00/45.00),
// which convert to the exact Minor values
// packages/engine/src/__fixtures__/reference-lines.ts and
// apps/web/src/server/__fixtures__/reference-fixture.ts already prove
// end to end (03.1-01). Deliberately not imported from that server
// fixture: this module must import nothing from apps/web/src/server.
function buildExampleLines(): ExpenseLineDraft[] {
  const rows: [ExpenseCategoryCode, string, number, ExpenseUnit, string, StaffGrade | null][] = [
    [
      "STAFF_TIME_SEARCH",
      "Staff time locating and retrieving the requested personnel records",
      4,
      "HOUR",
      "40.00",
      "EXECUTIVE",
    ],
    [
      "STAFF_TIME_COLLATE",
      "Staff time compiling and paginating the response bundle",
      2,
      "HOUR",
      "40.00",
      "EXECUTIVE",
    ],
    [
      "STAFF_TIME_ASSESS_EXEMPTIONS",
      "Staff time deciding which items may be withheld under an exemption",
      3,
      "HOUR",
      "40.00",
      "EXECUTIVE",
    ],
    ["PHOTOCOPY_PRINT", "Photocopying the paginated response for physical delivery", 220, "PAGE", "0.15", null],
    [
      "VENDOR_PAYROLL",
      "Vendor extract of historical payroll and tax records from archive",
      3,
      "ITEM",
      "150.00",
      null,
    ],
    ["OTHER_UNCLASSIFIED", "Miscellaneous cost not covered by any other category", 1, "FIXED", "45.00", null],
  ];

  return rows.map(([categoryCode, description, quantity, unit, rateMajor, incurredByGrade]) => ({
    key: newRowKey(),
    categoryCode,
    description,
    quantity,
    unit,
    rateMajor,
    incurredByGrade,
    isThirdPartyInvoiced: false,
    vendorName: "",
    evidenceRef: "",
  }));
}

export const EMPTY_STATE_HEADING = "No cost lines yet";
export const EMPTY_STATE_BODY =
  "Add the first line below — nothing is submitted to Legal until at least one cost line exists.";

function lineCountLabel(count: number): string {
  return `${count} line${count === 1 ? "" : "s"}`;
}

export function ExpenseLineRepeater({ lines, onChange, categories, currency }: ExpenseLineRepeaterProps) {
  const hintByCategory = new Map(categories.map((category) => [category.categoryCode, category.hint]));
  const firstCategory = categories[0]?.categoryCode ?? "OTHER_UNCLASSIFIED";

  function updateLine(key: string, patch: Partial<ExpenseLineDraft>) {
    onChange(
      lines.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...patch };
        // Changing category resets unit to a value the new category allows,
        // and clears fields the new category doesn't call for.
        if (patch.categoryCode && patch.categoryCode !== line.categoryCode) {
          const allowedUnits = allowedUnitsForCategory(patch.categoryCode);
          if (!allowedUnits.includes(next.unit)) {
            next.unit = allowedUnits[0] ?? next.unit;
          }
          if (!isStaffGradeCategory(patch.categoryCode)) next.incurredByGrade = null;
          if (!isThirdPartyCategory(patch.categoryCode)) {
            next.isThirdPartyInvoiced = false;
            next.vendorName = "";
            next.evidenceRef = "";
          }
        }
        return next;
      })
    );
  }

  function addLine() {
    onChange([...lines, blankLine(firstCategory)]);
  }

  function duplicateLine(key: string) {
    const index = lines.findIndex((line) => line.key === key);
    if (index === -1) return;
    const copy = { ...lines[index]!, key: newRowKey() };
    onChange([...lines.slice(0, index + 1), copy, ...lines.slice(index + 1)]);
  }

  function deleteLine(key: string) {
    onChange(lines.filter((line) => line.key !== key));
  }

  function fillExampleRows() {
    onChange(buildExampleLines());
  }

  return (
    <section data-testid="expense-line-repeater" className="card">
      <h2 className="eyebrow">
        <span className="step-heading">
          <span className="step-number" aria-hidden="true">
            2
          </span>
          What the response cost <span data-testid="line-count">{lineCountLabel(lines.length)}</span>
        </span>
      </h2>

      {lines.length === 0 ? (
        <div data-testid="repeater-empty-state" className="card">
          <p className="eyebrow">{EMPTY_STATE_HEADING}</p>
          <p className="hint">{EMPTY_STATE_BODY}</p>
        </div>
      ) : (
        <div data-testid="expense-line-rows" className="expense-line-list">
          {lines.map((line, index) => {
            const amountMinor = computeLineAmountMinor(line, currency);
            const hint = hintByCategory.get(line.categoryCode);
            const staffGrade = isStaffGradeCategory(line.categoryCode);
            const thirdParty = isThirdPartyCategory(line.categoryCode);
            const isOther = line.categoryCode === "OTHER_UNCLASSIFIED";
            const otherUndescribed = !hasSufficientDescriptionForCategory(line.categoryCode, line.description);

            return (
              <div key={line.key} data-testid="expense-line-row" className="card expense-line-row">
                <div className="expense-line-heading">Cost line {index + 1}</div>
                <label className="field expense-category">
                  <span>Category</span>
                  <select
                    name="categoryCode"
                    value={line.categoryCode}
                    onChange={(event) => updateLine(line.key, { categoryCode: event.target.value as ExpenseCategoryCode })}
                  >
                    {CATEGORY_GROUPS.map((group) => {
                      const entries = categories.filter(
                        (category) => GROUP_LABEL_BY_CATEGORY.get(category.categoryCode) === group.label
                      );
                      if (entries.length === 0) return null;
                      return (
                        <optgroup key={group.label} label={group.label}>
                          {entries.map((category) => (
                            <option key={category.categoryCode} value={category.categoryCode}>
                              {category.label}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </label>

                {hint ? (
                  <p data-testid="category-hint" className="hint">
                    {hint}
                  </p>
                ) : null}
                {isOther ? (
                  <p data-testid="other-description-hint" className="hint expense-full">
                    {OTHER_UNCLASSIFIED_DESCRIPTION_HINT}
                  </p>
                ) : null}

                <label className="field expense-description">
                  <span>What this cost was for</span>
                  <input
                    name="description"
                    value={line.description}
                    maxLength={FREE_TEXT_LIMITS.description}
                    required={isOther}
                    aria-invalid={otherUndescribed || undefined}
                    onChange={(event) => updateLine(line.key, { description: event.target.value })}
                  />
                </label>
                {otherUndescribed ? (
                  <p data-testid="other-description-required" className="hint stern expense-full">
                    Required for “Something else”: at least {MIN_OTHER_DESCRIPTION_NON_WHITESPACE_CHARS} characters
                    describing the cost ({countNonWhitespaceChars(line.description)} so far).
                  </p>
                ) : null}
                {(() => {
                  const patternMatch = detectLikelyPersonalData(line.description);
                  return patternMatch.matched ? (
                    <p data-testid="description-pattern-warning" className="hint stern expense-full">
                      This looks like it might contain personal data — {patternMatch.reason}. Personal data does
                      not belong in this field.
                    </p>
                  ) : null;
                })()}
                {line.description.length > 0 ? (
                  <p data-testid="description-counter" className="hint expense-full">
                    {line.description.length} / {FREE_TEXT_LIMITS.description} characters
                  </p>
                ) : null}

                <label className="field expense-metric">
                  <span>Quantity</span>
                  <input
                    name="quantity"
                    type="number"
                    min={1}
                    max={1_000_000}
                    value={line.quantity}
                    onChange={(event) => updateLine(line.key, { quantity: Number(event.target.value) || 0 })}
                  />
                </label>

                <label className="field expense-metric">
                  <span>Unit</span>
                  <select
                    name="unit"
                    value={line.unit}
                    onChange={(event) => updateLine(line.key, { unit: event.target.value as ExpenseUnit })}
                  >
                    {allowedUnitsForCategory(line.categoryCode).map((unit) => (
                      <option key={unit} value={unit}>
                        {UNIT_LABELS[unit]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field expense-metric">
                  <span>Rate ({currency})</span>
                  <input
                    name="unitRate"
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.rateMajor}
                    className="font-mono"
                    onChange={(event) => updateLine(line.key, { rateMajor: event.target.value })}
                  />
                </label>

                <div className="expense-amount">
                  <span>Amount</span>
                  <div data-testid="line-amount" className="fig">
                    {formatMinorWithCode(toMinor(amountMinor), currency)}
                  </div>
                </div>

                {staffGrade ? (
                  <label data-testid="staff-grade-field" className="field expense-staff">
                    <span>Staff grade</span>
                    <select
                      name="incurredByGrade"
                      value={line.incurredByGrade ?? ""}
                      onChange={(event) =>
                        updateLine(line.key, { incurredByGrade: (event.target.value || null) as StaffGrade | null })
                      }
                    >
                      <option value="">Select a grade</option>
                      {Object.entries(STAFF_GRADE_LABELS).map(([grade, label]) => (
                        <option key={grade} value={grade}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {thirdParty ? (
                  <div data-testid="third-party-fields" className="third-party-fields">
                    <label>
                      <input
                        type="checkbox"
                        name="isThirdPartyInvoiced"
                        checked={line.isThirdPartyInvoiced}
                        onChange={(event) => updateLine(line.key, { isThirdPartyInvoiced: event.target.checked })}
                      />
                      <span>Third-party invoiced?</span>
                    </label>
                    <label>
                      <span>Vendor</span>
                      <input
                        name="vendorName"
                        value={line.vendorName}
                        onChange={(event) => updateLine(line.key, { vendorName: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Invoice / DMS reference</span>
                      <input
                        name="evidenceRef"
                        value={line.evidenceRef}
                        onChange={(event) => updateLine(line.key, { evidenceRef: event.target.value })}
                      />
                    </label>
                  </div>
                ) : null}

                <div className="expense-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => duplicateLine(line.key)}>
                    Duplicate
                  </button>
                  <button type="button" className="btn btn-tertiary" onClick={() => deleteLine(line.key)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="expense-add-actions">
        <button type="button" className="btn btn-secondary" onClick={addLine}>
          + Add a cost line
        </button>
        <button type="button" className="btn btn-tertiary" onClick={fillExampleRows}>
          Fill in the example rows
        </button>
        <p className="hint">Example rows use synthetic costs. The engine assesses them after submission.</p>
      </div>
    </section>
  );
}
