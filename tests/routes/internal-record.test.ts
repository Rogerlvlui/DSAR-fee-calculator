// tests/routes/internal-record.test.ts
//
// Route-level tests for the internal-record PDF endpoint, tagged
// INTERNAL-RECORD. Drives the real GET handler with a real Request over a
// real signed-off four-line matter, built the same way
// tests/routes/signoff.test.ts already builds one: create matter, add
// lines, submit, disposition every line (a genuine mix of accept, reduce
// and strike, so the lawyer-amount/lawyer-reason columns are populated, not
// just accepted), and sign off.
//
// 07-04 extends the tracer's 200/403/409 route-level proof with DOC-01's
// field-completeness assertions — against the pure buildInternalRecordView()
// function, called with the SAME real inputs the route itself resolves
// (07-RESEARCH.md's own "Don't Hand-Roll": content assertions belong to the
// pure view, never to parsing the rendered PDF binary).
//
// Backstop, not proven here (07-04-PLAN.md's own <verification> section):
// whether the repeated table header and the disclosure footer are
// textually correct on page 2 and later of a paginating document. The
// pagination-size test below proves a 60-line view renders to a materially
// larger buffer than a 1-line view of the same shape — evidence that
// pagination actually occurred — not that any specific page's text is
// correct, which stays a recorded backstop truth.

import { describe, expect, it } from "vitest";
import { deriveEffectiveStatus } from "@dsar/rulepacks/stale";
import { renderInternalRecordPdf } from "@dsar/documents/internal-record-document";
import { buildInternalRecordView } from "@dsar/documents/internal-record-view";
import { formatMinor } from "@dsar/schemas/money";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { POST as dispositionRoute } from "../../apps/web/app/api/assessment-lines/[id]/disposition/route.ts";
import { POST as signoffRoute } from "../../apps/web/app/api/assessments/[id]/signoff/route.ts";
import {
  GET as internalRecordRoute,
  buildInternalRecordContentDisposition,
} from "../../apps/web/app/api/assessments/[id]/internal-record/route.ts";
import { ATTESTATION_TEMPLATE_VERSION, renderAttestation } from "../../apps/web/src/domain/attestation.ts";
import { DEMO_ROLE_COOKIE, resolveActorFromCookieHeader } from "../../apps/web/src/server/data/auth.ts";
import { getAssessmentForLegalReview } from "../../apps/web/src/server/data/assessments.ts";
import { getExpenseLinesForLegalReview, getMatterForLegalReview } from "../../apps/web/src/server/data/matters.ts";
import { resolvePinnedRulePack } from "../../apps/web/src/server/engine-invocation.ts";

const MATTERS_URL = "http://localhost/api/matters";
const ASSESSMENTS_URL = "http://localhost/api/assessments";
const LEGAL_COOKIE = `${DEMO_ROLE_COOKIE}=LEGAL_REVIEWER`;
const HR_COOKIE = `${DEMO_ROLE_COOKIE}=HR_PREPARER`;

// The literal five-byte PDF signature every well-formed PDF body opens
// with — asserted as raw bytes, not merely "the file is non-empty".
const PDF_MAGIC_HEADER = "%PDF-";

function jsonRequest(url: string, method: string, body: unknown, cookie: string = LEGAL_COOKIE): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

function getRequest(url: string, cookie: string): Request {
  return new Request(url, { method: "GET", headers: { cookie } });
}

let matterCounter = 0;

function nextReference(): string {
  matterCounter += 1;
  return `DSAR-INTREC-${String(matterCounter).padStart(4, "0")}`;
}

const SG_LINE_INPUTS = [
  {
    categoryCode: "STAFF_TIME_SEARCH", // -> ALLOW, 16000
    description: "Staff time locating and retrieving the requested records",
    quantity: 4,
    unit: "HOUR",
    unitRate: 4000,
    incurredByGrade: "EXECUTIVE",
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
  {
    categoryCode: "STAFF_TIME_ASSESS_EXEMPTIONS", // -> DISALLOW, engine 0
    description: "Staff time deciding which items may be withheld under an exemption",
    quantity: 60,
    unit: "HOUR",
    unitRate: 1000,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
  {
    categoryCode: "PHOTOCOPY_PRINT", // -> ALLOW_CAPPED, claimed 3300, cap 2640
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
  {
    categoryCode: "OTHER_UNCLASSIFIED", // -> FLAG, 4500
    description: "Meeting room and refreshments for the internal review session",
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

// Plan 06-01's own hand-derived, already-verified HK golden-fixture table
// (tests/routes/hk-jurisdiction-review.test.ts), reused verbatim here so
// the footer-provenance assertion is proven against a second real pack,
// not SG-PDPA alone — rather than inventing a second, independent HK
// category/quantity/rate set.
// The full nine-line golden fixture, reused verbatim (not trimmed) — the
// PHOTOCOPY_PRINT line's ALLOW_CAPPED verdict is only proven against this
// exact set; a subset risks silently changing which cap type applies
// (e.g. a percent-of-claim cap depends on the total claim across every
// line, not just this one). Expected verdicts, in order: ALLOW, ALLOW,
// DISALLOW, DISALLOW, ALLOW_CAPPED, ALLOW, DISALLOW, DISALLOW, FLAG.
const HK_LINE_INPUTS = [
  {
    categoryCode: "STAFF_TIME_SEARCH",
    description: "Staff time locating and retrieving the requested data",
    quantity: 4,
    unit: "HOUR",
    unitRate: 2000,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
  {
    categoryCode: "STAFF_TIME_REDACT_THIRD_PARTY",
    description: "Staff time redacting third-party identifying particulars",
    quantity: 3,
    unit: "HOUR",
    unitRate: 2000,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
  {
    categoryCode: "STAFF_TIME_REDACT_EXEMPT",
    description: "Staff time severing exempt data",
    quantity: 2,
    unit: "HOUR",
    unitRate: 2000,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
  {
    categoryCode: "STAFF_TIME_LEGAL_REVIEW",
    description: "Time spent obtaining advice from counsel",
    quantity: 1,
    unit: "HOUR",
    unitRate: 3000,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
  {
    categoryCode: "PHOTOCOPY_PRINT",
    description: "Photocopying the paginated response for physical delivery",
    quantity: 100,
    unit: "PAGE",
    unitRate: 200,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
  {
    categoryCode: "VENDOR_PAYROLL",
    description: "Vendor extract of historical payroll records from archive",
    quantity: 1,
    unit: "FIXED",
    unitRate: 5000,
    incurredByGrade: null,
    isThirdPartyInvoiced: true,
    vendorName: "Example Vendor Ltd",
    evidenceRef: "INV-2026-HK-01",
    hrNote: null,
  },
  {
    categoryCode: "ADMIN_OVERHEAD",
    description: "General administrative overhead",
    quantity: 2,
    unit: "HOUR",
    unitRate: 1500,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
  {
    categoryCode: "RECORDS_REMEDIATION",
    description: "Correcting the entity's own record-keeping deficiencies",
    quantity: 1,
    unit: "HOUR",
    unitRate: 2500,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
  {
    categoryCode: "OTHER_UNCLASSIFIED",
    description: "Miscellaneous cost not covered by any other category",
    quantity: 1,
    unit: "FIXED",
    unitRate: 1000,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
];

interface FixtureAssessment {
  id: string;
  matterId: string;
  lines: { id: string; verdict: string; disposition: string; engineAmount: number }[];
}

async function buildFixtureAssessment(
  jurisdiction: "SG" | "HK" = "SG"
): Promise<FixtureAssessment> {
  const matterInput =
    jurisdiction === "SG"
      ? {
          reference: nextReference(),
          jurisdictionCode: "SG",
          legalEntity: "Acme Pte Ltd",
          controllerType: "PRIVATE_ORGANISATION",
          requestReceivedOn: "2026-09-01",
          requestorClass: "FORMER_EMPLOYEE",
          currency: "SGD",
          identityVerified: true,
          identityVerifiedNote: null,
          scopeClarified: true,
          isRepeatRequestWithin12Months: false,
          isKnownDisputeOrLitigation: false,
        }
      : {
          reference: nextReference(),
          jurisdictionCode: "HK",
          legalEntity: "Acme HK Ltd",
          controllerType: "PRIVATE_ORGANISATION",
          requestReceivedOn: "2026-09-01",
          requestorClass: "FORMER_EMPLOYEE",
          currency: "HKD",
          identityVerified: true,
          identityVerifiedNote: null,
          scopeClarified: true,
          isRepeatRequestWithin12Months: false,
          isKnownDisputeOrLitigation: false,
        };

  const matterResponse = await createMatterRoute(jsonRequest(MATTERS_URL, "POST", matterInput, HR_COOKIE));
  const matter = (await matterResponse.json()) as { id: string };

  const lineInputs = jurisdiction === "SG" ? SG_LINE_INPUTS : HK_LINE_INPUTS;
  for (const input of lineInputs) {
    const response = await addLineRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/lines`, "POST", input, HR_COOKIE), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(response.status).toBe(201);
  }

  const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}, HR_COOKIE), {
    params: Promise.resolve({ id: matter.id }),
  });
  expect(submitResponse.status).toBe(200);
  return (await submitResponse.json()) as FixtureAssessment;
}

const GOOD_REASON = "Sighted the vendor invoice separately and it checks out.";
const REDUCED_REASON = "Reduced further to reflect an internal estimate error.";

// Every line gets a real disposition (never left PENDING, which would
// refuse sign-off with 409) — a genuine mix of accept, reduce and strike
// per the line's own verdict, so the lawyer-amount and lawyer-reason
// columns in the internal record are actually populated, never just the
// ACCEPT-everywhere shape the tracer's own fixture used. ALLOW_CAPPED is
// REDUCEd to half its own engineAmount (never a fixed literal — the real
// committed packs' caps differ by jurisdiction and category), which stays
// within REDUCE's own bounds (must not exceed engineAmount or the line's
// claimedAmount).
async function dispositionAllLines(assessment: FixtureAssessment): Promise<void> {
  for (const line of assessment.lines) {
    const body =
      line.verdict === "FLAG"
        ? { action: "STRIKE", reason: GOOD_REASON }
        : line.verdict === "ALLOW_CAPPED"
          ? { action: "REDUCE", amountMinor: Math.floor(line.engineAmount / 2), reason: REDUCED_REASON }
          : { action: "ACCEPT", reason: GOOD_REASON };

    const response = await dispositionRoute(
      jsonRequest(`http://localhost/api/assessment-lines/${line.id}/disposition`, "POST", body),
      { params: Promise.resolve({ id: line.id }) }
    );
    expect(response.status).toBe(200);
  }
}

const VALID_SIGNOFF_INPUT = {
  qualification: "Advocate & Solicitor, Singapore",
  acknowledgedFlags: [],
  attestation: true,
};

async function signOffFixture(assessment: FixtureAssessment): Promise<void> {
  const response = await signoffRoute(
    jsonRequest(`${ASSESSMENTS_URL}/${assessment.id}/signoff`, "POST", VALID_SIGNOFF_INPUT),
    { params: Promise.resolve({ id: assessment.id }) }
  );
  expect(response.status).toBe(200);
}

// Rebuilds the exact InternalRecordView the route itself would build for a
// signed-off assessment — same functions, same inputs, same order — so
// content assertions run against the pure view, never against the rendered
// binary (07-RESEARCH.md's Don't-Hand-Roll guidance).
async function buildRealViewForAssessment(assessmentId: string) {
  const actor = resolveActorFromCookieHeader(LEGAL_COOKIE);
  const assessment = await getAssessmentForLegalReview(actor, assessmentId);
  if (!assessment.signOff) throw new Error(`assessment '${assessmentId}' has no sign-off record`);
  const matter = await getMatterForLegalReview(actor, assessment.matterId);
  const expenseLines = await getExpenseLinesForLegalReview(actor, assessment.matterId);
  const pack = resolvePinnedRulePack(assessment.rulePackId, assessment.rulePackVersion);

  const packIsStale = deriveEffectiveStatus(pack, assessment.signOff.signedAt) === "STALE";
  const attestationText = renderAttestation({
    jurisdiction: pack.jurisdiction.name,
    packId: assessment.rulePackId,
    packVersion: assessment.rulePackVersion,
    reviewedOn: pack.reviewedOn,
    packIsStale,
  });

  const view = buildInternalRecordView({
    assessment,
    matter,
    pack,
    expenseLines,
    attestation: { text: attestationText, version: ATTESTATION_TEMPLATE_VERSION },
  });

  return { view, assessment, matter, pack, attestationText };
}

describe("INTERNAL-RECORD", () => {
  it("INTERNAL-RECORD: a signed-off assessment requested by LEGAL_REVIEWER returns 200, the PDF content type, and a body starting with the PDF magic header", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);
    await signOffFixture(assessment);

    const response = await internalRecordRoute(
      getRequest(`${ASSESSMENTS_URL}/${assessment.id}/internal-record`, LEGAL_COOKIE),
      { params: Promise.resolve({ id: assessment.id }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");

    const buffer = Buffer.from(await response.arrayBuffer());
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, PDF_MAGIC_HEADER.length).toString("ascii")).toBe(PDF_MAGIC_HEADER);
  });

  it("INTERNAL-RECORD: the same request carrying the HR_PREPARER cookie returns 403 with a JSON error body and no PDF bytes", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);
    await signOffFixture(assessment);

    const response = await internalRecordRoute(
      getRequest(`${ASSESSMENTS_URL}/${assessment.id}/internal-record`, HR_COOKIE),
      { params: Promise.resolve({ id: assessment.id }) }
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).not.toBe("application/pdf");
    const body = (await response.json()) as { error: string };
    expect(body.error).toBeTruthy();
  });

  it("INTERNAL-RECORD: an assessment whose signOff field is null returns 409 and produces no document at all", async () => {
    const assessment = await buildFixtureAssessment();
    // Deliberately not dispositioned or signed off — every line is still
    // PENDING and assessment.signOff is null.

    const response = await internalRecordRoute(
      getRequest(`${ASSESSMENTS_URL}/${assessment.id}/internal-record`, LEGAL_COOKIE),
      { params: Promise.resolve({ id: assessment.id }) }
    );

    expect(response.status).toBe(409);
    expect(response.headers.get("content-type")).not.toBe("application/pdf");
  });

  it("INTERNAL-RECORD: DOC-01 — one view row per assessment line, and each row's rule id/basis equal the assessment line's own values", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);
    await signOffFixture(assessment);

    const { view, assessment: realAssessment } = await buildRealViewForAssessment(assessment.id);

    expect(view.lines.length).toBe(realAssessment.lines.length);
    const expectedPairs = realAssessment.lines.map((line) => `${line.appliedRuleId}::${line.basis}`).sort();
    const actualPairs = view.lines.map((row) => `${row.appliedRuleId}::${row.basis}`).sort();
    expect(actualPairs).toEqual(expectedPairs);
  });

  it("INTERNAL-RECORD: DOC-01 — the reduced line's lawyer amount and lawyer reason are both non-empty in the view", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);
    await signOffFixture(assessment);

    const { view } = await buildRealViewForAssessment(assessment.id);
    const reducedRow = view.lines.find((row) => row.disposition === "REDUCED");
    expect(reducedRow).toBeDefined();
    expect(reducedRow!.lawyerAmount).not.toBe("—");
    expect(reducedRow!.lawyerAmount.length).toBeGreaterThan(0);
    expect(reducedRow!.lawyerReason).not.toBe("—");
    expect(reducedRow!.lawyerReason).toBe("Reduced further to reflect an internal estimate error.");

    // Every real disposition requires and stores a reason server-side
    // (assertSufficientReason, apps/web/src/server/data/assessments.ts) —
    // so the null-lawyerReason em-dash path is genuinely unreachable
    // through this real route for ANY disposition, accepted-non-FLAG
    // included. That path is proven instead at the pure-view level
    // (packages/documents/src/internal-record-view.test.ts), which can
    // construct the otherwise-unreachable null case directly.
    for (const row of view.lines) {
      expect(row.lawyerReason).not.toBe("");
    }
  });

  it("INTERNAL-RECORD: DOC-05 — the footer's pack id, pack version and engine version equal the assessment's own stored values (SG-PDPA)", async () => {
    const assessment = await buildFixtureAssessment("SG");
    await dispositionAllLines(assessment);
    await signOffFixture(assessment);

    const { view, assessment: realAssessment } = await buildRealViewForAssessment(assessment.id);
    expect(view.footer.packId).toBe(realAssessment.rulePackId);
    expect(view.footer.packId).toBe("SG-PDPA");
    expect(view.footer.packVersion).toBe(realAssessment.rulePackVersion);
    expect(view.footer.engineVersion).toBe(realAssessment.engineVersion);
  });

  it("INTERNAL-RECORD: DOC-05 — the footer's provenance is proven against a second real pack (HK-PDPO), not SG-PDPA alone", async () => {
    const assessment = await buildFixtureAssessment("HK");
    await dispositionAllLines(assessment);
    await signOffFixture(assessment);

    const { view, assessment: realAssessment } = await buildRealViewForAssessment(assessment.id);
    expect(view.footer.packId).toBe(realAssessment.rulePackId);
    expect(view.footer.packId).toBe("HK-PDPO");
    expect(view.footer.packVersion).toBe(realAssessment.rulePackVersion);
    expect(view.footer.engineVersion).toBe(realAssessment.engineVersion);
  });

  it("INTERNAL-RECORD: the sign-off block's final amount equals the stored signOff.finalAmount", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);
    await signOffFixture(assessment);

    const { view, assessment: realAssessment, matter } = await buildRealViewForAssessment(assessment.id);
    expect(view.signOff.finalAmount).toBe(formatMinor(realAssessment.signOff!.finalAmount, matter.currency));
  });

  it("INTERNAL-RECORD: the sign-off block's attestation text is strictly equal to renderAttestation's output for the same inputs", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);
    await signOffFixture(assessment);

    const { view, attestationText } = await buildRealViewForAssessment(assessment.id);
    expect(view.signOff.attestationText).toBe(attestationText);
  });

  it("INTERNAL-RECORD: DOC-01/DOC-05 — a paginating view renders to a buffer materially larger than a short view of the same shape (proves pagination occurred; page-2 text correctness stays a recorded backstop)", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);
    await signOffFixture(assessment);

    const { view } = await buildRealViewForAssessment(assessment.id);
    const manyLines = Array.from({ length: 60 }, (_, index) => ({
      ...view.lines[index % view.lines.length]!,
      seq: index,
    }));
    const shortView = { ...view, lines: view.lines.slice(0, 1) };
    const longView = { ...view, lines: manyLines };

    const shortBuffer = await renderInternalRecordPdf(shortView);
    const longBuffer = await renderInternalRecordPdf(longView);
    expect(longBuffer.length).toBeGreaterThan(shortBuffer.length);
  }, 20000);

  // CR-01 (07-REVIEW.md) — matter.reference is HR-controlled free text with
  // no length limit and no character restriction. A `"` in reference must
  // never be able to break out of the quoted `filename` Content-Disposition
  // parameter and inject a `filename*` (or any other) parameter of an
  // HR_PREPARER's choosing that a LEGAL_REVIEWER's browser would honor.
  it("INTERNAL-RECORD: CR-01 — a quote-and-semicolon-bearing reference cannot inject a filename* parameter into Content-Disposition", () => {
    const malicious = 'weird"; filename*=UTF-8\'\'evil.pdf; x="';
    const header = buildInternalRecordContentDisposition(malicious);

    // Parsed the same way the browser/runtime Headers implementation would
    // parse it — there must be exactly one filename* parameter, and it must
    // be the percent-encoded real reference, never the attacker's literal.
    const filenameStarMatches = [...header.matchAll(/filename\*=UTF-8''([^;]*)/g)];
    expect(filenameStarMatches).toHaveLength(1);
    expect(filenameStarMatches[0]![1]).toBe(encodeURIComponent(malicious) + "-internal-record.pdf");

    // The quoted ASCII fallback filename carries no raw quote, semicolon or
    // other character that could terminate the parameter early — nothing
    // beyond the two parameters this function itself sets ever appears.
    const fallbackMatch = header.match(/filename="([^"]*)"/);
    expect(fallbackMatch).not.toBeNull();
    expect(fallbackMatch![1]).not.toContain('"');
    expect(fallbackMatch![1]).not.toContain(";");
    expect(header).not.toMatch(/x=/);

    // Round-tripped through the real Headers implementation: still a single,
    // well-formed content-disposition value — not split into extra headers
    // or parameters beyond the two this function itself sets.
    const headers = new Headers();
    headers.set("content-disposition", header);
    expect(headers.get("content-disposition")).toBe(header);
  });

  it("INTERNAL-RECORD: CR-01 — a matter created with a quote-bearing reference downloads a record whose Content-Disposition carries no attacker-controlled filename* value", async () => {
    const malicious = `${nextReference()}" evil`;
    const matterResponse = await createMatterRoute(
      jsonRequest(MATTERS_URL, "POST", {
        reference: malicious,
        jurisdictionCode: "SG",
        legalEntity: "Acme Pte Ltd",
        controllerType: "PRIVATE_ORGANISATION",
        requestReceivedOn: "2026-09-01",
        requestorClass: "FORMER_EMPLOYEE",
        currency: "SGD",
        identityVerified: true,
        identityVerifiedNote: null,
        scopeClarified: true,
        isRepeatRequestWithin12Months: false,
        isKnownDisputeOrLitigation: false,
      }, HR_COOKIE)
    );
    expect(matterResponse.status).toBe(201);
    const matter = (await matterResponse.json()) as { id: string };

    for (const input of SG_LINE_INPUTS) {
      const response = await addLineRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/lines`, "POST", input, HR_COOKIE), {
        params: Promise.resolve({ id: matter.id }),
      });
      expect(response.status).toBe(201);
    }
    const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}, HR_COOKIE), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(submitResponse.status).toBe(200);
    const maliciousAssessment = (await submitResponse.json()) as FixtureAssessment;

    await dispositionAllLines(maliciousAssessment);
    await signOffFixture(maliciousAssessment);

    const response = await internalRecordRoute(
      getRequest(`${ASSESSMENTS_URL}/${maliciousAssessment.id}/internal-record`, LEGAL_COOKIE),
      { params: Promise.resolve({ id: maliciousAssessment.id }) }
    );

    expect(response.status).toBe(200);
    const disposition = response.headers.get("content-disposition")!;
    expect(disposition).toBeTruthy();
    // Exactly one filename* parameter — the malicious `"` never breaks out
    // of the fallback filename's quotes to append a second, attacker-chosen
    // filename* of its own; the one that exists is the full percent-encoded
    // real reference, not a truncated "evil.pdf".
    const filenameStarMatches = [...disposition.matchAll(/filename\*=UTF-8''([^;]*)/g)];
    expect(filenameStarMatches).toHaveLength(1);
    expect(filenameStarMatches[0]![1]).toBe(encodeURIComponent(malicious) + "-internal-record.pdf");
  });
});
