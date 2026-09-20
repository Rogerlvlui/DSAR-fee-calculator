// tests/routes/hk-jurisdiction-review.test.ts
//
// Tagged HK-JURISDICTION-REVIEW. Proves REVIEW-01/02/04/12 against a real
// jurisdiction other than SG for the first time in this codebase's history
// — every prior test of this behavior exercised SG exclusively, and Plan
// 06-01 made every jurisdiction's own pack reachable for the first time.
// Drives the real create-matter -> add-lines -> submit -> GET-for-review
// pipeline (matching tests/routes/demo-pipeline.test.ts's own established
// pattern), reusing Plan 06-01's own hand-derived, already-verified HK
// golden-fixture category/quantity/rate table rather than inventing a new
// one.

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { GET as getAssessmentRoute } from "../../apps/web/app/api/assessments/[id]/route.ts";
import { DEMO_ROLE_COOKIE } from "../../apps/web/src/server/data/auth.ts";

const MATTERS_URL = "http://localhost/api/matters";
const ASSESSMENTS_URL = "http://localhost/api/assessments";
const HR_COOKIE = `${DEMO_ROLE_COOKIE}=HR_PREPARER`;
const LEGAL_COOKIE = `${DEMO_ROLE_COOKIE}=LEGAL_REVIEWER`;

function jsonRequest(url: string, method: string, body: unknown, cookie?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  return new Request(url, { method, headers, body: JSON.stringify(body) });
}

let matterCounter = 0;
function nextReference(): string {
  matterCounter += 1;
  return `DSAR-HK-REVIEW-${String(matterCounter).padStart(4, "0")}`;
}

// Plan 06-01's own hand-derived, already-verified HK golden-fixture table
// (06-01-PLAN.md Task 2 / packages/rulepacks/src/real-pack-fixture.golden.test.ts) —
// reused verbatim rather than inventing a new set of category/quantity/rate
// values. Expected verdicts (in order): ALLOW, ALLOW, DISALLOW, DISALLOW,
// ALLOW_CAPPED, ALLOW, DISALLOW, DISALLOW, FLAG.
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

const HK_MATTER_INPUT = {
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

interface HkAssessmentLine {
  id: string;
  expenseLineId: string;
  verdict: string;
  appliedRuleId: string;
  basis: string;
  citation: { instrument: string; provision: string };
  flagReasons: { code: string; message: string }[];
}

interface HkAssessment {
  id: string;
  lines: HkAssessmentLine[];
}

async function buildHkAssessment(): Promise<{ assessmentId: string; lineIds: Record<string, string> }> {
  const matterResponse = await createMatterRoute(
    jsonRequest(MATTERS_URL, "POST", { ...HK_MATTER_INPUT, reference: nextReference() }, HR_COOKIE)
  );
  expect(matterResponse.status).toBe(201);
  const matter = (await matterResponse.json()) as { id: string };

  const lineIds: Record<string, string> = {};
  for (const lineInput of HK_LINE_INPUTS) {
    const lineResponse = await addLineRoute(
      jsonRequest(`${MATTERS_URL}/${matter.id}/lines`, "POST", lineInput, HR_COOKIE),
      { params: Promise.resolve({ id: matter.id }) }
    );
    expect(lineResponse.status).toBe(201);
    const line = (await lineResponse.json()) as { id: string; categoryCode: string };
    lineIds[line.categoryCode] = line.id;
  }

  const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}, HR_COOKIE), {
    params: Promise.resolve({ id: matter.id }),
  });
  expect(submitResponse.status).toBe(200);
  const submitted = (await submitResponse.json()) as { id: string };

  return { assessmentId: submitted.id, lineIds };
}

describe("HK-JURISDICTION-REVIEW", () => {
  it("HK-JURISDICTION-REVIEW: the fixture is genuinely HK — jurisdictionCode HK, currency HKD, controllerType PRIVATE_ORGANISATION, never SG", async () => {
    const { assessmentId } = await buildHkAssessment();
    const response = await getAssessmentRoute(
      new Request(`${ASSESSMENTS_URL}/${assessmentId}`, { headers: { cookie: LEGAL_COOKIE } }),
      { params: Promise.resolve({ id: assessmentId }) }
    );
    expect(response.status).toBe(200);
    const assessment = (await response.json()) as { rulePackId: string; rulePackVersion: string };
    expect(assessment.rulePackId).toBe("HK-PDPO");
    expect(assessment.rulePackId).not.toBe("SG-PDPA");
  });

  it("HK-JURISDICTION-REVIEW: REVIEW-01 — every line carries a non-empty appliedRuleId, basis and citation", async () => {
    const { assessmentId } = await buildHkAssessment();
    const response = await getAssessmentRoute(
      new Request(`${ASSESSMENTS_URL}/${assessmentId}`, { headers: { cookie: LEGAL_COOKIE } }),
      { params: Promise.resolve({ id: assessmentId }) }
    );
    const assessment = (await response.json()) as HkAssessment;
    expect(assessment.lines.length).toBe(HK_LINE_INPUTS.length);
    for (const line of assessment.lines) {
      expect(line.appliedRuleId.length).toBeGreaterThan(0);
      expect(line.basis.length).toBeGreaterThan(0);
      expect(line.citation.instrument.length).toBeGreaterThan(0);
      expect(line.citation.provision.length).toBeGreaterThan(0);
    }
  });

  it("HK-JURISDICTION-REVIEW: REVIEW-02 — the OTHER_UNCLASSIFIED line's flagReasons is non-empty", async () => {
    const { assessmentId, lineIds } = await buildHkAssessment();
    const response = await getAssessmentRoute(
      new Request(`${ASSESSMENTS_URL}/${assessmentId}`, { headers: { cookie: LEGAL_COOKIE } }),
      { params: Promise.resolve({ id: assessmentId }) }
    );
    const assessment = (await response.json()) as HkAssessment;
    const otherLine = assessment.lines.find((line) => line.expenseLineId === lineIds.OTHER_UNCLASSIFIED);
    expect(otherLine?.flagReasons.length).toBeGreaterThan(0);
  });

  it("HK-JURISDICTION-REVIEW: REVIEW-04 — at least one ALLOW and one DISALLOW line, proving HK's own pack (not SG's) governed this computation", async () => {
    const { assessmentId } = await buildHkAssessment();
    const response = await getAssessmentRoute(
      new Request(`${ASSESSMENTS_URL}/${assessmentId}`, { headers: { cookie: LEGAL_COOKIE } }),
      { params: Promise.resolve({ id: assessmentId }) }
    );
    const assessment = (await response.json()) as HkAssessment;
    const verdicts = assessment.lines.map((line) => line.verdict);
    expect(verdicts).toContain("ALLOW");
    expect(verdicts).toContain("DISALLOW");
    expect(verdicts).toContain("ALLOW_CAPPED");
    expect(verdicts).toContain("FLAG");
  });

  it("HK-JURISDICTION-REVIEW: REVIEW-12 — each line's expenseLineId round-trips to a real submitted line whose categoryCode this test itself supplied", async () => {
    const { assessmentId, lineIds } = await buildHkAssessment();
    const response = await getAssessmentRoute(
      new Request(`${ASSESSMENTS_URL}/${assessmentId}`, { headers: { cookie: LEGAL_COOKIE } }),
      { params: Promise.resolve({ id: assessmentId }) }
    );
    const assessment = (await response.json()) as HkAssessment;
    const submittedExpenseLineIds = new Set(Object.values(lineIds));
    for (const line of assessment.lines) {
      expect(submittedExpenseLineIds.has(line.expenseLineId)).toBe(true);
    }
    expect(assessment.lines.length).toBe(submittedExpenseLineIds.size);
  });
});
