// packages/documents/src/internal-record-view.test.ts
//
// Pure-module tests — no @react-pdf/renderer instantiated anywhere in this
// file. Also carries a source-scan assertion (matching this codebase's own
// established technique, e.g. tests/boundary/rsc-payload-leak.test.ts) that
// internal-record-view.ts itself imports neither the renderer package nor
// anything resolving under apps/web (this plan's must_haves).
//
// Content assertions for the dense line-item table, the matter-flags
// section and the sign-off block all live here, against the pure
// buildInternalRecordView() function — per 07-RESEARCH.md's own "Don't
// Hand-Roll" guidance, never against a rendered PDF binary
// (internal-record-document.test.tsx stays a thin smoke layer only).
//
// Cases tagged INTERNAL-RECORD-VIEW so `pnpm vitest run --project documents
// -t "INTERNAL-RECORD-VIEW"` (this plan's Task 1 <verify>) collects them.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AssessmentLineSchema, AssessmentSchema, type Assessment, type AssessmentLine } from "@dsar/schemas/assessment";
import { ExpenseLineSchema, type ExpenseLine } from "@dsar/schemas/expense-line";
import { MatterSchema, type Matter } from "@dsar/schemas/matter";
import { formatMinorWithCode } from "@dsar/schemas/money";
import type { Minor } from "@dsar/schemas/primitives";
import { LoadableRulePackSchema, type LoadableRulePack } from "@dsar/schemas/rule-pack";
import { EXPENSE_CATEGORY_LABELS } from "@dsar/schemas/taxonomy";
import {
  ATTESTATION_VERSION_MISMATCH_STATEMENT,
  buildInternalRecordView,
  DISPOSITION_LABELS,
  formatCitation,
  INTERNAL_RECORD_FOOTER_TEMPLATE,
  NO_ACKNOWLEDGEMENT_REQUIRED_STATEMENT,
  NO_LAWYER_REASON_PLACEHOLDER,
  NO_MATTER_FLAGS_STATEMENT,
  renderInternalRecordFooter,
  VERDICT_LABELS,
  type InternalRecordFooter,
} from "./internal-record-view.ts";

const SOURCE_PATH = fileURLToPath(new URL("./internal-record-view.ts", import.meta.url));
const SOURCE_TEXT = readFileSync(SOURCE_PATH, "utf8");

// Only actual `import ... from "..."` statement lines are scanned — the
// module's own prose comments legitimately discuss "apps/web" and
// "@react-pdf/renderer" by name (explaining why neither is imported), and a
// whole-file substring match would false-positive on that prose.
const IMPORT_LINES = SOURCE_TEXT.split("\n").filter((line) => /^\s*import\b.*\bfrom\b/.test(line));

describe("DOC-05 internal-record-view purity", () => {
  it("imports no renderer package and nothing resolving under apps/web", () => {
    expect(IMPORT_LINES.length).toBeGreaterThan(0);
    for (const line of IMPORT_LINES) {
      expect(line).not.toContain("@react-pdf/renderer");
      expect(line).not.toContain("apps/web");
    }
  });

  it("reads no clock — no Date.now( and no new Date( anywhere in the module", () => {
    expect(SOURCE_TEXT).not.toContain("Date.now(");
    expect(SOURCE_TEXT).not.toContain("new Date(");
  });
});

const FOOTER: InternalRecordFooter = {
  packId: "SG-PDPA",
  packVersion: "2026.09.1",
  engineVersion: "0.1.0",
  lawyerName: "Roger Lui",
  qualification: "Advocate & Solicitor, Singapore",
  date: "2026-09-20T10:00:00.000Z",
};

describe("renderInternalRecordFooter", () => {
  it("substitutes every placeholder — no unsubstituted token remains", () => {
    const rendered = renderInternalRecordFooter(FOOTER);
    expect(rendered).not.toMatch(/\{[a-zA-Z]+\}/);
    expect(rendered).toContain("SG-PDPA");
    expect(rendered).toContain("2026.09.1");
    expect(rendered).toContain("0.1.0");
    expect(rendered).toContain("Roger Lui");
    expect(rendered).toContain("Advocate & Solicitor, Singapore");
    expect(rendered).toContain("2026-09-20T10:00:00.000Z");
  });

  it("carries PRD §10.5(a)'s own not-legal-advice sentence, verbatim", () => {
    expect(INTERNAL_RECORD_FOOTER_TEMPLATE).toContain("Not legal advice to any third party.");
  });

  // WR-01 (07-REVIEW.md): String.prototype.replace's special replacement
  // patterns ($&, $$, etc.) must never be interpreted when substituting a
  // lawyer-typed qualification value into the footer template.
  it("WR-01: a qualification containing '$&' is inserted literally, not interpreted as a replacement pattern", () => {
    const footer: InternalRecordFooter = {
      ...FOOTER,
      qualification: "Advocate & Solicitor $& test",
    };
    const rendered = renderInternalRecordFooter(footer);
    expect(rendered).toContain("Advocate & Solicitor $& test");
    expect(rendered).not.toContain("{qualification}");
  });

  it("WR-01: a qualification containing '$$' renders a literal double dollar sign, not a single collapsed one", () => {
    const footer: InternalRecordFooter = {
      ...FOOTER,
      qualification: "Senior Counsel $$ Grade",
    };
    const rendered = renderInternalRecordFooter(footer);
    expect(rendered).toContain("Senior Counsel $$ Grade");
  });

  it("WR-01: a lawyerName containing a '$'-bearing value does not corrupt neighboring placeholders", () => {
    const footer: InternalRecordFooter = {
      ...FOOTER,
      lawyerName: "M. Tan $` test",
    };
    const rendered = renderInternalRecordFooter(footer);
    expect(rendered).toContain("M. Tan $` test");
    expect(rendered).toContain(FOOTER.qualification);
    expect(rendered).not.toMatch(/\{[a-zA-Z]+\}/);
  });
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CURRENCY = "SGD";
const ATTESTATION_VERSION = "SIGNOFF-ATTESTATION-2026.09";

function buildFixtureExpenseLine(overrides: Partial<ReturnType<typeof ExpenseLineSchema.parse>> = {}): ExpenseLine {
  return ExpenseLineSchema.parse({
    id: "el-1",
    matterId: "matter-1",
    seq: 0,
    categoryCode: "STAFF_TIME_SEARCH",
    description: "Staff time locating and retrieving the requested records",
    quantity: 4,
    unit: "HOUR",
    unitRate: 4000,
    claimedAmount: 16000,
    incurredByGrade: "EXECUTIVE",
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
    ...overrides,
  });
}

function buildFixtureAssessmentLine(overrides: Partial<ReturnType<typeof AssessmentLineSchema.parse>> = {}): AssessmentLine {
  return AssessmentLineSchema.parse({
    id: "line-1",
    expenseLineId: "el-1",
    verdict: "ALLOW",
    engineAmount: 16000,
    appliedRuleId: "SG-PDPA.STAFF_TIME_SEARCH",
    appliedCap: null,
    basis: "Staff search time is a permitted reasonable-cost item under this pack.",
    citation: { instrument: "Personal Data Protection Act", provision: "s.19" },
    flagReasons: [],
    disposition: "ACCEPTED",
    lawyerAmount: null,
    lawyerReason: null,
    dispositionedBy: null,
    dispositionedAt: null,
    ...overrides,
  });
}

const FIXTURE_MATTER: Matter = MatterSchema.parse({
  id: "01K5GSD0MATTERXQX2RZB4FDK1",
  reference: "DSAR-0001",
  jurisdictionCode: "SG",
  legalEntity: "Acme Pte Ltd",
  controllerType: "PRIVATE_ORGANISATION",
  requestReceivedOn: "2026-09-01",
  requestorClass: "FORMER_EMPLOYEE",
  currency: CURRENCY,
  identityVerified: true,
  identityVerifiedNote: null,
  scopeClarified: true,
  isRepeatRequestWithin12Months: false,
  isKnownDisputeOrLitigation: false,
  status: "SIGNED_OFF",
  createdBy: {
    id: "01K5GSD0HRPREPXQX2RZB4FDKV",
    displayName: "Priya Nair — HR Shared Services",
    email: "priya.nair@example.invalid",
  },
  createdAt: "2026-09-01T00:00:00Z",
});

const COUNSEL = {
  id: "01K5GSD0PRT0TYPECNSE000001",
  displayName: "Product Owner — Prototype Authoring Counsel",
  email: "product-owner@example.invalid",
};

const FIXTURE_PACK: LoadableRulePack = LoadableRulePackSchema.parse({
  packId: "SG-PDPA",
  jurisdiction: { code: "SG", name: "Singapore" },
  version: "2026.09.1",
  status: "ACTIVE",
  authoredBy: COUNSEL,
  reviewedBy: COUNSEL,
  reviewedOn: "2026-09-16",
  reviewDueOn: "2027-09-16",
  instruments: [{ title: "Personal Data Protection Act", provisions: ["s.19", "s.20", "s.21", "s.22"] }],
  feePosture: { PRIVATE_ORGANISATION: "PERMITTED_REASONABLE", PUBLIC_AGENCY: "PERMITTED_REASONABLE" },
  appliesTo: ["PRIVATE_ORGANISATION", "PUBLIC_AGENCY"],
  rateSanityCeiling: {},
  constraints: {
    noChargeForMakingRequest: true,
    estimateRequiredBeforeCharging: true,
    feeNotificationDeadlineDays: null,
    deadlineBasis: "CALENDAR_DAYS",
    responseDeadlineDays: 30,
    advancePaymentPermitted: false,
    mayWithholdDataUntilPaid: false,
    profitElementPermitted: false,
    deterrentUsePermitted: false,
    regulatorMayReviewFee: true,
    aggregateCap: null,
  },
  categoryRules: [],
  matterFlagRules: [],
  requestorNoticeTemplate: "UNAUTHORED",
  openQuestions: [],
});

// One row per Verdict (ALLOW, DISALLOW, ALLOW_CAPPED, FLAG) — sized against
// a realistic mixed-disposition assessment, not the six-line reference
// fixture alone (07-UI-SPEC.md E4 "populated" resolution).
const EL_ALLOW = buildFixtureExpenseLine({ id: "el-allow", seq: 0, categoryCode: "STAFF_TIME_SEARCH", quantity: 4, unit: "HOUR", unitRate: 4000 as Minor, claimedAmount: 16000 as Minor });
const EL_DISALLOW = buildFixtureExpenseLine({ id: "el-disallow", seq: 1, categoryCode: "STAFF_TIME_ASSESS_EXEMPTIONS", quantity: 60, unit: "HOUR", unitRate: 1000 as Minor, claimedAmount: 60000 as Minor });
const EL_CAPPED = buildFixtureExpenseLine({ id: "el-capped", seq: 2, categoryCode: "PHOTOCOPY_PRINT", quantity: 220, unit: "PAGE", unitRate: 15 as Minor, claimedAmount: 3300 as Minor });
const EL_FLAG = buildFixtureExpenseLine({ id: "el-flag", seq: 3, categoryCode: "OTHER_UNCLASSIFIED", quantity: 1, unit: "FIXED", unitRate: 4500 as Minor, claimedAmount: 4500 as Minor });

const LINE_ALLOW = buildFixtureAssessmentLine({
  id: "line-allow",
  expenseLineId: "el-allow",
  verdict: "ALLOW",
  engineAmount: 16000 as Minor,
  appliedRuleId: "SG-PDPA.STAFF_TIME_SEARCH",
  basis: "Staff search time is a permitted reasonable-cost item under this pack.",
  citation: { instrument: "Personal Data Protection Act", provision: "s.19" },
  disposition: "ACCEPTED",
  lawyerAmount: null,
  lawyerReason: null, // plain ACCEPTED non-FLAG line — em dash expected
});

const LINE_DISALLOW = buildFixtureAssessmentLine({
  id: "line-disallow",
  expenseLineId: "el-disallow",
  verdict: "DISALLOW",
  engineAmount: 0 as Minor,
  appliedRuleId: "SG-PDPA.STAFF_TIME_ASSESS_EXEMPTIONS",
  basis: "Assessing exemptions is not itself a chargeable item under this pack.",
  citation: { instrument: "Personal Data Protection Act", provision: "s.20", guidance: "See guidance note 4" },
  disposition: "ACCEPTED",
  lawyerAmount: null,
  lawyerReason: "Reviewed and confirmed disallowed category.",
});

const LINE_CAPPED = buildFixtureAssessmentLine({
  id: "line-capped",
  expenseLineId: "el-capped",
  verdict: "ALLOW_CAPPED",
  engineAmount: 2640 as Minor,
  appliedCap: { type: "PER_UNIT", amount: 12 as Minor, unit: "PAGE" },
  appliedRuleId: "SG-PDPA.PHOTOCOPY_PRINT",
  basis: "Photocopying is capped at 12 cents per page under this pack.",
  citation: { instrument: "Personal Data Protection Act", provision: "s.21" },
  disposition: "REDUCED",
  lawyerAmount: 2000 as Minor,
  lawyerReason: "Reduced further to reflect an internal estimate error.",
});

const LINE_FLAG = buildFixtureAssessmentLine({
  id: "line-flag",
  expenseLineId: "el-flag",
  verdict: "FLAG",
  engineAmount: 0 as Minor,
  appliedRuleId: "SG-PDPA.OTHER_UNCLASSIFIED",
  basis: "Uncategorised items are always referred to Legal.",
  citation: { instrument: "Personal Data Protection Act", provision: "s.22", note: "See internal note 7" },
  flagReasons: [{ code: "UNCATEGORISED", message: "Category requires legal classification." }],
  disposition: "STRUCK",
  lawyerAmount: null,
  lawyerReason: "Struck — no supporting detail provided.",
});

const MIXED_LINES = [LINE_ALLOW, LINE_DISALLOW, LINE_CAPPED, LINE_FLAG];
const MIXED_EXPENSE_LINES = [EL_ALLOW, EL_DISALLOW, EL_CAPPED, EL_FLAG];

const FIXTURE_SIGN_OFF = {
  lawyer: { id: "01K5GSD0RVWRPBKRDPTJTHDN93", displayName: "Roger Lui — Legal, Singapore", email: "roger.lui@example.invalid" },
  lawyerName: "Roger Lui",
  qualification: "Advocate & Solicitor, Singapore",
  signedAt: "2026-09-20T10:00:00Z",
  finalAmount: 18000 as Minor,
  acknowledgedFlags: [] as string[],
  attestation: true as const,
  attestationVersion: ATTESTATION_VERSION,
};

function buildFixtureAssessment(overrides: Partial<ReturnType<typeof AssessmentSchema.parse>> = {}): Assessment {
  return AssessmentSchema.parse({
    id: "assessment-1",
    matterId: "matter-1",
    rulePackId: "SG-PDPA",
    rulePackVersion: "2026.09.1",
    engineVersion: "0.1.0",
    computedAt: "2026-09-20T09:00:00Z",
    lines: MIXED_LINES,
    matterLevelFlags: [],
    totals: {
      claimedTotal: 83800,
      draftBaseline: 18640,
      disallowedTotal: 60000,
      flaggedTotal: 4500,
      restingOnUnverifiedRules: 18640,
      finalAmount: 18000,
    },
    signOff: FIXTURE_SIGN_OFF,
    ...overrides,
  });
}

const VALID_ATTESTATION = { text: "I am reviewing this fee assessment...", version: ATTESTATION_VERSION };

// ---------------------------------------------------------------------------
// formatCitation
// ---------------------------------------------------------------------------

describe("formatCitation", () => {
  it("INTERNAL-RECORD-VIEW: renders instrument + provision with no guidance/note", () => {
    expect(formatCitation({ instrument: "Personal Data Protection Act", provision: "s.19" })).toBe(
      "Personal Data Protection Act s.19"
    );
  });

  it("INTERNAL-RECORD-VIEW: appends guidance and note after an em dash so neither is silently dropped", () => {
    const rendered = formatCitation({
      instrument: "Personal Data Protection Act",
      provision: "s.20",
      guidance: "See guidance note 4",
      note: "Internal note 7",
    });
    expect(rendered).toBe("Personal Data Protection Act s.20 — See guidance note 4 — Internal note 7");
  });
});

// ---------------------------------------------------------------------------
// buildInternalRecordView — line items
// ---------------------------------------------------------------------------

describe("buildInternalRecordView — line items", () => {
  it("INTERNAL-RECORD-VIEW: all ten columns are populated and correctly sourced for a mixed-verdict fixture, one row per verdict", () => {
    const assessment = buildFixtureAssessment();
    const view = buildInternalRecordView({
      assessment,
      matter: FIXTURE_MATTER,
      pack: FIXTURE_PACK,
      expenseLines: MIXED_EXPENSE_LINES,
      attestation: VALID_ATTESTATION,
    });

    expect(view.lines).toHaveLength(4);
    const verdicts = view.lines.map((row) => row.verdict);
    expect(new Set(verdicts)).toEqual(new Set(["ALLOW", "DISALLOW", "ALLOW_CAPPED", "FLAG"]));

    const capped = view.lines.find((row) => row.verdict === "ALLOW_CAPPED");
    expect(capped).toBeDefined();
    expect(capped!.seq).toBe(2);
    expect(capped!.categoryLabel).toBe(EXPENSE_CATEGORY_LABELS.PHOTOCOPY_PRINT);
    expect(capped!.appliedRuleId).toBe("SG-PDPA.PHOTOCOPY_PRINT");
    expect(capped!.basis).toBe(LINE_CAPPED.basis);
    expect(capped!.citation).toBe(formatCitation(LINE_CAPPED.citation));
    expect(capped!.disposition).toBe("REDUCED");
    expect(capped!.claimedAmount).toBe(formatMinorWithCode(3300 as Minor, CURRENCY));
    expect(capped!.lawyerAmount).toBe(formatMinorWithCode(2000 as Minor, CURRENCY));
    expect(capped!.lawyerReason).toBe(LINE_CAPPED.lawyerReason);
  });

  it("INTERNAL-RECORD-VIEW: two lines sharing an applied rule id and a basis produce two distinct rows, never merged", () => {
    const el1 = buildFixtureExpenseLine({ id: "el-a", seq: 0 });
    const el2 = buildFixtureExpenseLine({ id: "el-b", seq: 1 });
    const shared = { appliedRuleId: "SG-PDPA.STAFF_TIME_SEARCH", basis: "Identical basis text for both lines." };
    const lineA = buildFixtureAssessmentLine({ id: "line-a", expenseLineId: "el-a", ...shared });
    const lineB = buildFixtureAssessmentLine({ id: "line-b", expenseLineId: "el-b", ...shared });

    const assessment = buildFixtureAssessment({ lines: [lineA, lineB] });
    const view = buildInternalRecordView({
      assessment,
      matter: FIXTURE_MATTER,
      pack: FIXTURE_PACK,
      expenseLines: [el1, el2],
      attestation: VALID_ATTESTATION,
    });

    expect(view.lines).toHaveLength(2);
    expect(view.lines[0]!.appliedRuleId).toBe(view.lines[1]!.appliedRuleId);
    expect(view.lines[0]!.basis).toBe(view.lines[1]!.basis);
    expect(view.lines[0]!.seq).not.toBe(view.lines[1]!.seq);
  });

  it("INTERNAL-RECORD-VIEW: equal seq values keep assessment.lines input order, identically across repeated builds", () => {
    const elTied1 = buildFixtureExpenseLine({ id: "el-tied-1", seq: 5 });
    const elTied2 = buildFixtureExpenseLine({ id: "el-tied-2", seq: 5 });
    const lineFirst = buildFixtureAssessmentLine({ id: "line-first", expenseLineId: "el-tied-1", appliedRuleId: "SG-PDPA.RULE_A" });
    const lineSecond = buildFixtureAssessmentLine({ id: "line-second", expenseLineId: "el-tied-2", appliedRuleId: "SG-PDPA.RULE_B" });

    const assessment = buildFixtureAssessment({ lines: [lineFirst, lineSecond] });
    const buildArgs = {
      assessment,
      matter: FIXTURE_MATTER,
      pack: FIXTURE_PACK,
      expenseLines: [elTied1, elTied2],
      attestation: VALID_ATTESTATION,
    };

    const viewOnce = buildInternalRecordView(buildArgs);
    const viewTwice = buildInternalRecordView(buildArgs);

    expect(viewOnce.lines.map((row) => row.appliedRuleId)).toEqual(["SG-PDPA.RULE_A", "SG-PDPA.RULE_B"]);
    expect(viewOnce.lines.map((row) => row.appliedRuleId)).toEqual(viewTwice.lines.map((row) => row.appliedRuleId));
  });

  it("INTERNAL-RECORD-VIEW: a null lawyer reason renders the em dash, never an empty string", () => {
    const assessment = buildFixtureAssessment();
    const view = buildInternalRecordView({
      assessment,
      matter: FIXTURE_MATTER,
      pack: FIXTURE_PACK,
      expenseLines: MIXED_EXPENSE_LINES,
      attestation: VALID_ATTESTATION,
    });
    const allowRow = view.lines.find((row) => row.verdict === "ALLOW")!;
    expect(allowRow.lawyerReason).toBe(NO_LAWYER_REASON_PLACEHOLDER);
    expect(allowRow.lawyerReason).not.toBe("");
  });

  it("INTERNAL-RECORD-VIEW: a null lawyer amount renders the em dash, never an empty string", () => {
    const assessment = buildFixtureAssessment();
    const view = buildInternalRecordView({
      assessment,
      matter: FIXTURE_MATTER,
      pack: FIXTURE_PACK,
      expenseLines: MIXED_EXPENSE_LINES,
      attestation: VALID_ATTESTATION,
    });
    const disallowRow = view.lines.find((row) => row.verdict === "DISALLOW")!;
    expect(disallowRow.lawyerAmount).toBe(NO_LAWYER_REASON_PLACEHOLDER);
    expect(disallowRow.lawyerAmount).not.toBe("");
  });

  it("INTERNAL-RECORD-VIEW: a one-line assessment produces one row with the same shape as any other", () => {
    const assessment = buildFixtureAssessment({ lines: [LINE_ALLOW] });
    const view = buildInternalRecordView({
      assessment,
      matter: FIXTURE_MATTER,
      pack: FIXTURE_PACK,
      expenseLines: [EL_ALLOW],
      attestation: VALID_ATTESTATION,
    });
    expect(view.lines).toHaveLength(1);
    expect(Object.keys(view.lines[0]!).sort()).toEqual(
      ["appliedRuleId", "basis", "categoryLabel", "citation", "claimedAmount", "disposition", "lawyerAmount", "lawyerReason", "seq", "verdict"].sort()
    );
  });

  it("INTERNAL-RECORD-VIEW: a zero-line assessment yields an empty rows array without throwing", () => {
    const assessment = buildFixtureAssessment({
      lines: [],
      totals: {
        claimedTotal: 0 as Minor,
        draftBaseline: 0 as Minor,
        disallowedTotal: 0 as Minor,
        flaggedTotal: 0 as Minor,
        restingOnUnverifiedRules: 0 as Minor,
        finalAmount: 0 as Minor,
      },
      signOff: { ...FIXTURE_SIGN_OFF, finalAmount: 0 as Minor },
    });
    const buildArgs = {
      assessment,
      matter: FIXTURE_MATTER,
      pack: FIXTURE_PACK,
      expenseLines: [],
      attestation: VALID_ATTESTATION,
    };
    expect(() => buildInternalRecordView(buildArgs)).not.toThrow();
    expect(buildInternalRecordView(buildArgs).lines).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildInternalRecordView — matter flags and acknowledgements
// ---------------------------------------------------------------------------

describe("buildInternalRecordView — matter flags", () => {
  it("INTERNAL-RECORD-VIEW: zero flags selects the no-flags sentence, not the no-acknowledgement one", () => {
    const assessment = buildFixtureAssessment({ matterLevelFlags: [] });
    const view = buildInternalRecordView({
      assessment,
      matter: FIXTURE_MATTER,
      pack: FIXTURE_PACK,
      expenseLines: MIXED_EXPENSE_LINES,
      attestation: VALID_ATTESTATION,
    });
    expect(view.flags.rows).toEqual([]);
    expect(view.flags.noFlagsStatement).toBe(NO_MATTER_FLAGS_STATEMENT);
    expect(view.flags.noAcknowledgementRequiredStatement).toBeNull();
  });

  it("INTERNAL-RECORD-VIEW: flags present but none requiring acknowledgement selects the distinct sentence", () => {
    const assessment = buildFixtureAssessment({
      matterLevelFlags: [{ id: "SG.PACK_DISCLOSURE", code: "PACK_FLAG", message: "This pack carries an informational disclosure.", requiresAcknowledgement: false }],
    });
    const view = buildInternalRecordView({
      assessment,
      matter: FIXTURE_MATTER,
      pack: FIXTURE_PACK,
      expenseLines: MIXED_EXPENSE_LINES,
      attestation: VALID_ATTESTATION,
    });
    expect(view.flags.rows).toHaveLength(1);
    expect(view.flags.noFlagsStatement).toBeNull();
    expect(view.flags.noAcknowledgementRequiredStatement).toBe(NO_ACKNOWLEDGEMENT_REQUIRED_STATEMENT);
  });

  it("INTERNAL-RECORD-VIEW: an acknowledged flag carries the signing lawyer and instant; an informational flag carries a null entry", () => {
    const assessment = buildFixtureAssessment({
      matterLevelFlags: [
        { id: "SG.LITIGATION_POSTURE", code: "LITIGATION_POSTURE", message: "This matter is in a known dispute posture.", requiresAcknowledgement: true },
        { id: "SG.PACK_DISCLOSURE", code: "PACK_FLAG", message: "This pack carries an informational disclosure.", requiresAcknowledgement: false },
      ],
      signOff: { ...FIXTURE_SIGN_OFF, acknowledgedFlags: ["SG.LITIGATION_POSTURE"] },
    });
    const view = buildInternalRecordView({
      assessment,
      matter: FIXTURE_MATTER,
      pack: FIXTURE_PACK,
      expenseLines: MIXED_EXPENSE_LINES,
      attestation: VALID_ATTESTATION,
    });

    expect(view.flags.rows).toHaveLength(2);
    const ackRow = view.flags.rows.find((row) => row.code === "LITIGATION_POSTURE")!;
    const infoRow = view.flags.rows.find((row) => row.code === "PACK_FLAG")!;
    expect(ackRow.acknowledgement).toEqual({ lawyerName: assessment.signOff!.lawyerName, acknowledgedAt: assessment.signOff!.signedAt });
    expect(infoRow.acknowledgement).toBeNull();
    // At least one row requires acknowledgement, so the "none required" sentence must not apply here.
    expect(view.flags.noAcknowledgementRequiredStatement).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildInternalRecordView — sign-off block
// ---------------------------------------------------------------------------

describe("buildInternalRecordView — sign-off block", () => {
  it("INTERNAL-RECORD-VIEW: the final amount is read from the sign-off record and formatted through the shared money module", () => {
    const assessment = buildFixtureAssessment();
    const view = buildInternalRecordView({
      assessment,
      matter: FIXTURE_MATTER,
      pack: FIXTURE_PACK,
      expenseLines: MIXED_EXPENSE_LINES,
      attestation: VALID_ATTESTATION,
    });
    expect(view.signOff.finalAmount).toBe(formatMinorWithCode(assessment.signOff!.finalAmount, CURRENCY));
  });

  it("INTERNAL-RECORD-VIEW: a matching attestation version renders the caller's supplied text verbatim", () => {
    const assessment = buildFixtureAssessment();
    const view = buildInternalRecordView({
      assessment,
      matter: FIXTURE_MATTER,
      pack: FIXTURE_PACK,
      expenseLines: MIXED_EXPENSE_LINES,
      attestation: VALID_ATTESTATION,
    });
    expect(view.signOff.attestationText).toBe(VALID_ATTESTATION.text);
  });

  it("INTERNAL-RECORD-VIEW: an attestation-version mismatch yields the mismatch statement, never the supplied text", () => {
    const assessment = buildFixtureAssessment();
    const view = buildInternalRecordView({
      assessment,
      matter: FIXTURE_MATTER,
      pack: FIXTURE_PACK,
      expenseLines: MIXED_EXPENSE_LINES,
      attestation: { text: "A different build's wording of the attestation.", version: "SOME-OTHER-VERSION" },
    });
    expect(view.signOff.attestationText).toBe(ATTESTATION_VERSION_MISMATCH_STATEMENT(ATTESTATION_VERSION));
    expect(view.signOff.attestationText).not.toBe("A different build's wording of the attestation.");
    expect(view.signOff.attestationText).toContain(ATTESTATION_VERSION);
  });
});

// ---------------------------------------------------------------------------
// VERDICT_LABELS / DISPOSITION_LABELS — complete records
// ---------------------------------------------------------------------------

describe("VERDICT_LABELS / DISPOSITION_LABELS", () => {
  it("INTERNAL-RECORD-VIEW: VERDICT_LABELS covers all four verdicts", () => {
    expect(Object.keys(VERDICT_LABELS).sort()).toEqual(["ALLOW", "ALLOW_CAPPED", "DISALLOW", "FLAG"].sort());
  });

  it("INTERNAL-RECORD-VIEW: DISPOSITION_LABELS covers all five dispositions", () => {
    expect(Object.keys(DISPOSITION_LABELS).sort()).toEqual(
      ["PENDING", "ACCEPTED", "REDUCED", "STRUCK", "ALLOWED_BY_LAWYER"].sort()
    );
  });
});

// ---------------------------------------------------------------------------
// buildInternalRecordView — throws before building anything with no sign-off
// ---------------------------------------------------------------------------

describe("buildInternalRecordView — no sign-off record", () => {
  it("throws before building anything when the assessment carries no sign-off record", () => {
    const assessment = buildFixtureAssessment({ signOff: null });
    expect(() =>
      buildInternalRecordView({
        assessment,
        matter: FIXTURE_MATTER,
        pack: FIXTURE_PACK,
        expenseLines: MIXED_EXPENSE_LINES,
        attestation: VALID_ATTESTATION,
      })
    ).toThrow();
  });
});
