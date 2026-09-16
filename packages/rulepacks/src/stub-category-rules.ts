// packages/rulepacks/src/stub-category-rules.ts
//
// D-19 (03-CONTEXT.md) — the generator whose in-memory output the seven
// unauthored jurisdictions' committed `categoryRules` are literal copies of.
// PRD §7.3: "the repository is the source of truth; the database copy is a
// cache" — the same reasoning applies to this generator's output. It is run
// once by a human to produce the committed JSON, and again by
// stub-category-rules.test.ts's drift test to prove the two still agree.
// Rules are never generated at load time (that would make the repository
// stop being the literal source of truth PRD §7.3 describes).
//
// CONTEXT.md's Claude's Discretion item 1 scopes both the drift test and
// the ACTIVE gate by the SAME `UNAUTHORED_TOKEN` marker (D-15) — there is
// no second list of "which rules are still generated" to keep in sync with
// the token.

import type { ControllerType, Instrument, JurisdictionCode } from "@dsar/schemas/primitives";
import type { CategoryRule, FeePosture, LoadableRulePack } from "@dsar/schemas/rule-pack";
import { UNAUTHORED_TOKEN } from "@dsar/schemas/constants";
import { EXPENSE_CATEGORY_CODES } from "@dsar/schemas/taxonomy";
import { STUB_CONSTRAINTS } from "./stub-constraints.ts";

// One fixed string for every generated rule's `basis`. It asserts nothing —
// it is not a legal position, just a placeholder pointing a reader at the
// jurisdiction's `openQuestions` entry for what actually needs authoring.
export const UNAUTHORED_BASIS =
  "No treatment has been authored for this category in this jurisdiction.";

// `packKind` exists from the outset (not added later) because plan 03-05
// adds HK-PDPO and SG-PDPA rows to this SAME table — those packs are partly
// authored but still need generated placeholder rules for their unwritten
// categories. A second, parallel table for "authored" packs would be
// exactly the two-lists-that-must-agree failure mode D-19/CONTEXT.md warns
// against.
export interface PackJurisdiction {
  packId: string;
  jurisdictionCode: JurisdictionCode;
  jurisdictionName: string;
  instruments: Instrument[];
  feePosture: { PRIVATE_ORGANISATION: FeePosture; PUBLIC_AGENCY: FeePosture };
  appliesTo: ControllerType[];
  authoringNote: string;
  packKind: "stub" | "authored";
}

// Exactly one entry for now (VN-PDPL, this plan). Later plans append rows
// for the remaining jurisdictions — this table is not pre-populated here.
export const PACK_JURISDICTIONS: readonly PackJurisdiction[] = [
  {
    packId: "VN-PDPL",
    jurisdictionCode: "VN",
    jurisdictionName: "Vietnam",
    instruments: [
      { title: "Law on Personal Data Protection No. 91/2025/QH15", provisions: [] },
      { title: "Decree 356/2025/ND-CP", provisions: [] },
    ],
    // PRD §7.4 Vietnam row: feePosture NO_EXPRESS_AUTHORITY for both
    // controller types. `appliesTo` is derived (RulePackSchema's own
    // comment): the controller types whose posture is not PROHIBITED —
    // NO_EXPRESS_AUTHORITY is not PROHIBITED, so both controller types
    // apply.
    feePosture: { PRIVATE_ORGANISATION: "NO_EXPRESS_AUTHORITY", PUBLIC_AGENCY: "NO_EXPRESS_AUTHORITY" },
    appliesTo: ["PRIVATE_ORGANISATION", "PUBLIC_AGENCY"],
    // PRD §7.4 Vietnam note, transcribed verbatim with markdown emphasis
    // markers (**...**) removed — D-14 forbids extrapolating anything the
    // PRD does not itself state.
    authoringNote:
      "Regime changed on 1 Jan 2026. Response timing under the new law must be confirmed by counsel and not carried over from Decree 13/2023, whose 72-hour rule no longer applies of its own force.",
    packKind: "stub",
  },
];

export class UnknownPackJurisdictionError extends Error {
  constructor(packId: string) {
    super(`No PACK_JURISDICTIONS entry found for packId "${packId}"`);
    this.name = "UnknownPackJurisdictionError";
  }
}

export class NotAStubPackError extends Error {
  constructor(packId: string) {
    super(`generateStubPack called for packId "${packId}", whose packKind is not "stub"`);
    this.name = "NotAStubPackError";
  }
}

function findPackJurisdiction(packId: string): PackJurisdiction {
  const row = PACK_JURISDICTIONS.find((entry) => entry.packId === packId);
  if (!row) throw new UnknownPackJurisdictionError(packId);
  return row;
}

// Valid for any `packKind` — an authored pack's unwritten categories take
// exactly the same placeholder shape as a wholly-unauthored stub pack's.
export function generateStubCategoryRules(packId: string): CategoryRule[] {
  const { instruments, authoringNote } = findPackJurisdiction(packId);
  const [firstInstrument] = instruments;
  const citation = {
    instrument: firstInstrument?.title ?? "",
    // D-14/CONTEXT.md's Specific Ideas: `citation.provision` is the empty
    // string for a jurisdiction whose §7.4 row names no provision —
    // inventing one would be exactly the extrapolation D-14 forbids.
    provision: firstInstrument?.provisions[0] ?? "",
  };

  return EXPENSE_CATEGORY_CODES.map((categoryCode): CategoryRule => ({
    ruleId: `${packId}.${categoryCode}`,
    categoryCode,
    treatment: "FLAG",
    cap: null,
    conditions: [],
    basis: UNAUTHORED_BASIS,
    citation,
    verificationStatus: "NEEDS_VERIFICATION",
    verificationNote: `${UNAUTHORED_TOKEN} — ${authoringNote}`,
  }));
}

// Assembles a whole stub pack. A partly-authored pack (HK-PDPO, SG-PDPA in
// plan 03-05) is assembled by hand from the PRD, never generated wholesale
// by this function — it throws rather than silently producing a fully
// generated pack for a `packKind: "authored"` row.
export function generateStubPack(packId: string): LoadableRulePack {
  const row = findPackJurisdiction(packId);
  if (row.packKind !== "stub") throw new NotAStubPackError(packId);

  return {
    packId: row.packId,
    jurisdiction: { code: row.jurisdictionCode, name: row.jurisdictionName },
    version: "2026.09.1",
    status: "DRAFT",
    authoredBy: null,
    reviewedBy: null,
    reviewedOn: null,
    // Twelve months from this phase's authoring date (PRD §7.3's default) —
    // a scheduling value, not a legal position. Every stub is DRAFT and
    // unusable regardless of this date.
    reviewDueOn: "2027-09-16",
    instruments: row.instruments,
    feePosture: row.feePosture,
    appliesTo: row.appliesTo,
    rateSanityCeiling: {},
    constraints: STUB_CONSTRAINTS,
    categoryRules: generateStubCategoryRules(packId),
    matterFlagRules: [],
    // Carries the UNAUTHORED_TOKEN because no counsel has drafted the
    // requestor-facing notice for this jurisdiction; the template can never
    // be selected for a real matter while the pack is DRAFT.
    requestorNoticeTemplate: `${UNAUTHORED_TOKEN} — counsel must author the requestor-facing fee notice for this jurisdiction before this pack can reach ACTIVE.`,
    openQuestions: [row.authoringNote],
    // No `flatFee` key — omitted entirely, per RulePackSchema's `.optional()`.
  };
}
