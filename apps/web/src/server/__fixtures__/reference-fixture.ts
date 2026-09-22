// apps/web/src/server/__fixtures__/reference-fixture.ts
//
// PRD §14's reference matter and six-line fixture, in the shape the HTTP API
// accepts (CreateMatterInput / AddExpenseLineInput) — transcribed from
// packages/engine/src/__fixtures__/reference-matter.ts and reference-lines.ts,
// not imported from them: neither module is on @dsar/engine's exports map
// (only "." and "./calendar-math" are), and the engine's own fixture objects
// are already-parsed ExpenseLine/Matter domain values, not the raw HTTP
// request shapes this app's routes accept (no id/matterId/seq/claimedAmount
// — those are server-derived).
//
// This module intentionally does NOT import server-only.ts: it exports
// plain data, imported by both the route test (Node) and, if a future plan
// needs it, a component test (jsdom) — neither should trip the server-only
// runtime guard for a fixture with no side effects of its own.

import type { CreateMatterInput, AddExpenseLineInput } from "../data/matters.ts";

export const REFERENCE_MATTER_INPUT: CreateMatterInput = {
  reference: "DSAR-2026-0001",
  jurisdictionCode: "SG",
  legalEntity: "Acme Pte Ltd",
  controllerType: "PRIVATE_ORGANISATION",
  requestReceivedOn: "2026-08-20",
  requestorClass: "FORMER_EMPLOYEE",
  currency: "SGD",
  identityVerified: true,
  identityVerifiedNote: null,
  scopeClarified: true,
  isRepeatRequestWithin12Months: false,
  isKnownDisputeOrLitigation: true,
};

// PRD §14's six lines, in submission order (seq 0-5).
export const REFERENCE_FIXTURE_LINE_INPUTS: AddExpenseLineInput[] = [
  // #1 STAFF_TIME_SEARCH — 4 HOUR @ 4000 = 16000. ALLOW.
  {
    categoryCode: "STAFF_TIME_SEARCH",
    description: "Staff time locating and retrieving the requested personnel records",
    quantity: 4,
    unit: "HOUR",
    unitRate: 4000,
    incurredByGrade: "EXECUTIVE",
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
  // #2 STAFF_TIME_COLLATE — 2 HOUR @ 4000 = 8000. ALLOW.
  {
    categoryCode: "STAFF_TIME_COLLATE",
    description: "Staff time compiling and paginating the response bundle",
    quantity: 2,
    unit: "HOUR",
    unitRate: 4000,
    incurredByGrade: "EXECUTIVE",
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
  // #3 STAFF_TIME_ASSESS_EXEMPTIONS — 3 HOUR @ 4000 = 12000. DISALLOW.
  {
    categoryCode: "STAFF_TIME_ASSESS_EXEMPTIONS",
    description: "Staff time deciding which items may be withheld under an exemption",
    quantity: 3,
    unit: "HOUR",
    unitRate: 4000,
    incurredByGrade: "EXECUTIVE",
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
  // #4 PHOTOCOPY_PRINT — 220 PAGE @ 15 = 3300. ALLOW_CAPPED (cap 12/PAGE) = 2640.
  {
    categoryCode: "PHOTOCOPY_PRINT",
    description: "Photocopying the paginated response for physical delivery",
    quantity: 220,
    unit: "PAGE",
    unitRate: 15,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
  // #5 VENDOR_PAYROLL — 3 ITEM @ 15000 = 45000, NOT third-party-invoiced, no
  // evidence. FLAG — CONDITIONS_NOT_MET, then MATERIALITY (51%+ of claim).
  {
    categoryCode: "VENDOR_PAYROLL",
    description: "Vendor extract of historical payroll and tax records from archive",
    quantity: 3,
    unit: "ITEM",
    unitRate: 15000,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
  // #6 OTHER_UNCLASSIFIED — 1 FIXED @ 4500 = 4500. FLAG — UNCATEGORISED.
  {
    categoryCode: "OTHER_UNCLASSIFIED",
    description: "Miscellaneous cost not covered by any other category",
    quantity: 1,
    unit: "FIXED",
    unitRate: 4500,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
];
