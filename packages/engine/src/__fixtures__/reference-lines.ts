// packages/engine/src/__fixtures__/reference-lines.ts
//
// PRD §14's six expense lines, in minor units, matched to
// reference-pack.ts's six worked category rules. Built via
// ExpenseLineSchema.parse() (the single sanctioned conversion point to the
// branded Minor type — see reference-matter.ts's own note on this), for
// REFERENCE_MATTER (SG / PRIVATE_ORGANISATION / SGD,
// isKnownDisputeOrLitigation: true).
//
// Two hidden dependencies on later plans in this phase, both noted here so
// a future reader does not "fix" them:
//   - The three staff-time lines carry incurredByGrade EXECUTIVE, whose
//     rateSanityCeiling (5000) sits above their 4000 unitRate. An ADMIN
//     grade would sit above ITS OWN 3000 ceiling at this rate and trip
//     plan 02-05's rate-sanity check, flipping those lines to FLAG and
//     moving every published total this golden test asserts.
//   - Every description below is distinct, so plan 02-05's duplicate-
//     category-plus-near-identical-description check has nothing to fire
//     on in this fixture.

import { ExpenseLineSchema, type ExpenseLine } from "@dsar/schemas/expense-line";
import { REFERENCE_MATTER } from "./reference-matter.ts";

export const REFERENCE_FIXTURE_LINES: ExpenseLine[] = [
  // #1 STAFF_TIME_SEARCH — 4 HOUR @ 4000 = 16000 (160.00). ALLOW, 16000.
  ExpenseLineSchema.parse({
    id: "ref-fixture-line-1",
    matterId: REFERENCE_MATTER.id,
    seq: 0,
    categoryCode: "STAFF_TIME_SEARCH",
    description: "Staff time locating and retrieving the requested personnel records",
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
  // #2 STAFF_TIME_COLLATE — 2 HOUR @ 4000 = 8000 (80.00). ALLOW
  // (NEEDS_VERIFICATION rule), 8000.
  ExpenseLineSchema.parse({
    id: "ref-fixture-line-2",
    matterId: REFERENCE_MATTER.id,
    seq: 1,
    categoryCode: "STAFF_TIME_COLLATE",
    description: "Staff time compiling and paginating the response bundle",
    quantity: 2,
    unit: "HOUR",
    unitRate: 4000,
    claimedAmount: 8000,
    incurredByGrade: "EXECUTIVE",
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  }),
  // #3 STAFF_TIME_ASSESS_EXEMPTIONS — 3 HOUR @ 4000 = 12000 (120.00).
  // DISALLOW, 0.
  ExpenseLineSchema.parse({
    id: "ref-fixture-line-3",
    matterId: REFERENCE_MATTER.id,
    seq: 2,
    categoryCode: "STAFF_TIME_ASSESS_EXEMPTIONS",
    description: "Staff time deciding which items may be withheld under an exemption",
    quantity: 3,
    unit: "HOUR",
    unitRate: 4000,
    claimedAmount: 12000,
    incurredByGrade: "EXECUTIVE",
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  }),
  // #4 PHOTOCOPY_PRINT — 220 PAGE @ 15 = 3300 (33.00). ALLOW_CAPPED
  // (cap 12/PAGE), 2640 (26.40).
  ExpenseLineSchema.parse({
    id: "ref-fixture-line-4",
    matterId: REFERENCE_MATTER.id,
    seq: 3,
    categoryCode: "PHOTOCOPY_PRINT",
    description: "Photocopying the paginated response for physical delivery",
    quantity: 220,
    unit: "PAGE",
    unitRate: 15,
    claimedAmount: 3300,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  }),
  // #5 VENDOR_PAYROLL — 3 ITEM @ 15000 = 45000 (450.00), NOT
  // third-party-invoiced, no evidence. FLAG — CONDITIONS_NOT_MET, 0.
  ExpenseLineSchema.parse({
    id: "ref-fixture-line-5",
    matterId: REFERENCE_MATTER.id,
    seq: 4,
    categoryCode: "VENDOR_PAYROLL",
    description: "Vendor extract of historical payroll and tax records from archive",
    quantity: 3,
    unit: "ITEM",
    unitRate: 15000,
    claimedAmount: 45000,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  }),
  // #6 OTHER_UNCLASSIFIED — 1 FIXED @ 4500 = 4500 (45.00). FLAG —
  // UNCATEGORISED, 0.
  ExpenseLineSchema.parse({
    id: "ref-fixture-line-6",
    matterId: REFERENCE_MATTER.id,
    seq: 5,
    categoryCode: "OTHER_UNCLASSIFIED",
    description: "Miscellaneous cost not covered by any other category",
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
