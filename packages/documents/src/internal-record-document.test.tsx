// packages/documents/src/internal-record-document.test.tsx
//
// Thin smoke layer only — content assertions (every DOC-01 field, correctly
// sourced) belong to internal-record-view.test.ts, against the pure
// buildInternalRecordView() function (07-RESEARCH.md's "Don't Hand-Roll":
// adding a PDF-text-extraction dependency purely for testing is explicitly
// ruled out). This file proves the JSX layer renders a real PDF buffer
// without throwing, across the zero/one/many-line shapes, and that
// INTERNAL_RECORD_COLUMNS carries the Copywriting Contract's exact header
// list in order.
//
// Backstop, not proven here (07-UI-SPEC.md E4 "overflow", this plan's own
// <verification> section): whether the repeated column header and the
// disclosure footer are TEXTUALLY correct on page 2 and later of a
// paginating document. The 50-line case below proves such a document
// renders to a non-empty PDF buffer without throwing — it does not, and
// cannot without a PDF-text-extraction dependency this project has
// deliberately not added, prove what text appears on any specific physical
// page. That is left to the recorded backstop truth and to a human-observable
// check, not faked here.

import { describe, expect, it } from "vitest";
import { INTERNAL_RECORD_COLUMNS, renderInternalRecordPdf } from "./internal-record-document.tsx";
import type {
  InternalRecordLineRow,
  InternalRecordView,
} from "./internal-record-view.ts";

const PDF_MAGIC_HEADER = "%PDF-";

function buildFixtureLine(seq: number, overrides: Partial<InternalRecordLineRow> = {}): InternalRecordLineRow {
  return {
    seq,
    categoryLabel: "Staff time — locating and retrieving the data",
    verdict: "ALLOW",
    appliedRuleId: "SG-PDPA.STAFF_TIME_SEARCH",
    basis: "Staff search time is a permitted reasonable-cost item under this pack.",
    citation: "Personal Data Protection Act s.19",
    disposition: "ACCEPTED",
    claimedAmount: "$160.00",
    lawyerAmount: "—",
    lawyerReason: "—",
    ...overrides,
  };
}

const FIXTURE_MATTER_DETAILS: InternalRecordView["matter"] = {
  reference: "DSAR-0001",
  jurisdictionName: "Singapore",
  legalEntity: "Acme Pte Ltd",
  controllerType: "PRIVATE_ORGANISATION",
  requestReceivedOn: "2026-09-01",
  requestorClass: "FORMER_EMPLOYEE",
  identityVerified: true,
  scopeClarified: true,
};

const FIXTURE_PACK_DETAILS: InternalRecordView["pack"] = {
  packId: "SG-PDPA",
  packVersion: "2026.09.1",
  status: "ACTIVE",
  feePosture: "PERMITTED_REASONABLE",
  authoredByDisplayName: "Product Owner — Prototype Authoring Counsel",
  reviewedByDisplayName: "Product Owner — Prototype Authoring Counsel",
  reviewedOn: "2026-09-16",
  reviewDueOn: "2027-09-16",
  engineVersion: "0.1.0",
};

const FIXTURE_SIGN_OFF: InternalRecordView["signOff"] = {
  lawyerName: "Roger Lui",
  qualification: "Advocate & Solicitor, Singapore",
  signedAt: "2026-09-20T10:00:00Z",
  finalAmount: "$180.00",
  attestationText: "I am reviewing this fee assessment as a qualified lawyer for Singapore. ...",
};

function buildFixtureView(overrides: Partial<InternalRecordView> = {}): InternalRecordView {
  return {
    title: "Internal fee assessment record — DSAR-0001",
    matterReference: "DSAR-0001",
    matter: FIXTURE_MATTER_DETAILS,
    pack: FIXTURE_PACK_DETAILS,
    lines: [
      buildFixtureLine(0, { verdict: "ALLOW" }),
      buildFixtureLine(1, { verdict: "DISALLOW", appliedRuleId: "SG-PDPA.STAFF_TIME_ASSESS_EXEMPTIONS", disposition: "ACCEPTED", lawyerReason: "Reviewed and confirmed disallowed category." }),
      buildFixtureLine(2, { verdict: "ALLOW_CAPPED", disposition: "REDUCED", lawyerAmount: "$20.00", lawyerReason: "Reduced further to reflect an internal estimate error." }),
      buildFixtureLine(3, {
        verdict: "FLAG",
        basis: "Uncategorised items are always referred to Legal. ".repeat(3),
        disposition: "STRUCK",
        lawyerReason: "Struck — no supporting detail provided.",
      }),
    ],
    flags: {
      rows: [
        {
          code: "LITIGATION_POSTURE",
          message: "This matter is in a known dispute posture.",
          requiresAcknowledgement: true,
          acknowledgement: { lawyerName: "Roger Lui", acknowledgedAt: "2026-09-20T10:00:00Z" },
        },
        {
          code: "PACK_FLAG",
          message: "This pack carries an informational disclosure.",
          requiresAcknowledgement: false,
          acknowledgement: null,
        },
      ],
      noFlagsStatement: null,
      noAcknowledgementRequiredStatement: null,
    },
    signOff: FIXTURE_SIGN_OFF,
    footer: {
      packId: "SG-PDPA",
      packVersion: "2026.09.1",
      engineVersion: "0.1.0",
      lawyerName: "Roger Lui",
      qualification: "Advocate & Solicitor, Singapore",
      date: "2026-09-20T10:00:00Z",
    },
    ...overrides,
  };
}

describe("INTERNAL_RECORD_COLUMNS", () => {
  it("INTERNAL-RECORD-DOCUMENT: has exactly ten entries whose labels match the Copywriting Contract list, in order", () => {
    expect(INTERNAL_RECORD_COLUMNS.map((column) => column.label)).toEqual([
      "Seq",
      "Category",
      "Verdict",
      "Rule ID",
      "Basis",
      "Citation",
      "Disposition",
      "Claimed",
      "Lawyer amount",
      "Lawyer's reason",
    ]);
  });

  it("widths are all positive and sum to 100 (a single reviewable proportional scale)", () => {
    const total = INTERNAL_RECORD_COLUMNS.reduce((sum, column) => sum + column.width, 0);
    expect(total).toBe(100);
    for (const column of INTERNAL_RECORD_COLUMNS) {
      expect(column.width).toBeGreaterThan(0);
    }
  });
});

describe("renderInternalRecordPdf", () => {
  it("INTERNAL-RECORD-DOCUMENT: a mixed-verdict view renders a non-empty buffer starting with the PDF magic header", async () => {
    const buffer = await renderInternalRecordPdf(buildFixtureView());
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, PDF_MAGIC_HEADER.length).toString("ascii")).toBe(PDF_MAGIC_HEADER);
  });

  it("INTERNAL-RECORD-DOCUMENT: a one-line view renders without throwing", async () => {
    const view = buildFixtureView({ lines: [buildFixtureLine(0)] });
    const buffer = await renderInternalRecordPdf(view);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("INTERNAL-RECORD-DOCUMENT: a zero-line view renders without throwing — header row only", async () => {
    const view = buildFixtureView({
      lines: [],
      flags: { rows: [], noFlagsStatement: "No matter-level flags were raised on this matter.", noAcknowledgementRequiredStatement: null },
    });
    const buffer = await renderInternalRecordPdf(view);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("INTERNAL-RECORD-DOCUMENT: a fifty-line view renders without throwing", async () => {
    const lines = Array.from({ length: 50 }, (_, index) =>
      buildFixtureLine(index, {
        appliedRuleId: `SG-PDPA.RULE_${index}`,
        basis: `Basis text for line ${index}, long enough to exercise wrapping across the Basis column.`,
      })
    );
    const view = buildFixtureView({ lines });
    const buffer = await renderInternalRecordPdf(view);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, PDF_MAGIC_HEADER.length).toString("ascii")).toBe(PDF_MAGIC_HEADER);
  }, 20000);

  it("a fifty-line render produces a materially larger buffer than a one-line render of the same shape", async () => {
    const oneLineBuffer = await renderInternalRecordPdf(buildFixtureView({ lines: [buildFixtureLine(0)] }));
    const fiftyLines = Array.from({ length: 50 }, (_, index) => buildFixtureLine(index));
    const fiftyLineBuffer = await renderInternalRecordPdf(buildFixtureView({ lines: fiftyLines }));
    expect(fiftyLineBuffer.length).toBeGreaterThan(oneLineBuffer.length);
  }, 20000);
});
