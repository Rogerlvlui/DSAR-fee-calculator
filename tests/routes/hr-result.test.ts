// tests/routes/hr-result.test.ts
//
// Route/data-layer tests for the HR result screen's server-side pipeline,
// tagged HR-RESULT. The full rendered-markup assertions (privilege
// boundary, struck-line basis, zero-fee headline treatment, notice
// watermark/boundary note) are covered by result-view.test.tsx and
// notice-block.test.tsx under the "web" project, where the component under
// test carries no next/headers or next/navigation dependency and can be
// rendered directly. This file proves the actual enforcement boundary:
// the HR-scoped status read never carries an assessment or a figure before
// sign-off, and the refusing read genuinely refuses — the property PRD §0
// non-negotiable #2 requires, tested where it is actually enforced.

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { POST as dispositionRoute } from "../../apps/web/app/api/assessment-lines/[id]/disposition/route.ts";
import { POST as signoffRoute } from "../../apps/web/app/api/assessments/[id]/signoff/route.ts";
import { POST as noticeSentRoute } from "../../apps/web/app/api/matters/[id]/notice-sent/route.ts";
import { DEMO_ROLE_COOKIE, DEMO_USERS } from "../../apps/web/src/server/data/auth.ts";
import { getExpenseLinesForHr, getHrMatterStatus } from "../../apps/web/src/server/data/matters.ts";
import { getSignedOffAssessmentForHr } from "../../apps/web/src/server/data/assessments.ts";

const MATTERS_URL = "http://localhost/api/matters";
const LEGAL_COOKIE = `${DEMO_ROLE_COOKIE}=LEGAL_REVIEWER`;
const HR_COOKIE = `${DEMO_ROLE_COOKIE}=HR_PREPARER`;

function jsonRequest(url: string, method: string, body: unknown, cookie: string): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

let matterCounter = 0;
function nextReference(): string {
  matterCounter += 1;
  return `DSAR-HRRESULT-${String(matterCounter).padStart(4, "0")}`;
}

const VALID_MATTER_INPUT_BASE = {
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
};

const LINE_INPUTS = [
  {
    categoryCode: "STAFF_TIME_SEARCH",
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
    categoryCode: "STAFF_TIME_ASSESS_EXEMPTIONS",
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
  {
    categoryCode: "OTHER_UNCLASSIFIED",
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

interface FixtureAssessment {
  id: string;
  matterId: string;
  lines: { id: string; verdict: string; engineAmount: number; disposition: string }[];
}

async function buildFixtureMatterAndAssessment(): Promise<FixtureAssessment> {
  const matterResponse = await createMatterRoute(
    jsonRequest(MATTERS_URL, "POST", { ...VALID_MATTER_INPUT_BASE, reference: nextReference() }, HR_COOKIE)
  );
  const matter = (await matterResponse.json()) as { id: string };

  for (const input of LINE_INPUTS) {
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

function findLine(assessment: FixtureAssessment, verdict: string) {
  const line = assessment.lines.find((candidate) => candidate.verdict === verdict);
  if (!line) throw new Error(`fixture has no ${verdict} line`);
  return line;
}

const GOOD_REASON = "Sighted the vendor invoice separately and it checks out.";

async function strikeLine(lineId: string): Promise<void> {
  const response = await dispositionRoute(
    jsonRequest(`http://localhost/api/assessment-lines/${lineId}/disposition`, "POST", {
      action: "STRIKE",
      reason: GOOD_REASON,
    }, LEGAL_COOKIE),
    { params: Promise.resolve({ id: lineId }) }
  );
  expect(response.status).toBe(200);
}

async function acceptLine(lineId: string): Promise<void> {
  const response = await dispositionRoute(
    jsonRequest(`http://localhost/api/assessment-lines/${lineId}/disposition`, "POST", {
      action: "ACCEPT",
      reason: GOOD_REASON,
    }, LEGAL_COOKIE),
    { params: Promise.resolve({ id: lineId }) }
  );
  expect(response.status).toBe(200);
}

async function signOffFixture(assessmentId: string): Promise<Response> {
  return signoffRoute(
    jsonRequest(`http://localhost/api/assessments/${assessmentId}/signoff`, "POST", {
      qualification: "Advocate & Solicitor, Singapore",
      acknowledgedFlags: [],
      attestation: true,
    }, LEGAL_COOKIE),
    { params: Promise.resolve({ id: assessmentId }) }
  );
}

describe("HR-RESULT", () => {
  it("HR-RESULT: an HR request for a matter that is not signed off carries no assessment field, no totals field, and no currency-formatted figure anywhere", async () => {
    const assessment = await buildFixtureMatterAndAssessment();

    const view = await getHrMatterStatus(DEMO_USERS.HR_PREPARER, assessment.matterId);

    expect(Object.keys(view)).not.toContain("assessment");
    expect(Object.keys(view)).not.toContain("totals");
    expect(JSON.stringify(view)).not.toMatch(/SGD\s*[\d,]+\.\d{2}/);
  });

  it("HR-RESULT: getSignedOffAssessmentForHr refuses before sign-off — HR gets nothing, not a hidden figure", async () => {
    const assessment = await buildFixtureMatterAndAssessment();

    await expect(getSignedOffAssessmentForHr(DEMO_USERS.HR_PREPARER, assessment.matterId)).rejects.toThrow();
  });

  // 04-REVIEW.md WR-02: the page previously read expense lines straight off
  // the repository, with no role check anywhere on that specific call — the
  // same class of gap 03.1-REVIEW.md's UNREG-1 already required a fix for on
  // the legal worklist page. getExpenseLinesForHr() closes it the same way
  // every other HR-facing read in this file does.
  it("HR-RESULT: getExpenseLinesForHr requires the HR-preparer role, same as every other HR-facing read", async () => {
    const assessment = await buildFixtureMatterAndAssessment();

    await expect(getExpenseLinesForHr(DEMO_USERS.LEGAL_REVIEWER, assessment.matterId)).rejects.toThrow();

    const lines = await getExpenseLinesForHr(DEMO_USERS.HR_PREPARER, assessment.matterId);
    expect(lines.length).toBeGreaterThan(0);
  });

  it("HR-RESULT: marking the notice sent is refused for a matter that is not signed off", async () => {
    const assessment = await buildFixtureMatterAndAssessment();

    const response = await noticeSentRoute(
      jsonRequest(`${MATTERS_URL}/${assessment.matterId}/notice-sent`, "POST", {}, HR_COOKIE),
      { params: Promise.resolve({ id: assessment.matterId }) }
    );
    expect(response.status).toBe(409);
  });

  it("HR-RESULT: marking the notice sent records the date once the matter is signed off, and HR can then read the figure", async () => {
    const assessment = await buildFixtureMatterAndAssessment();
    const allow = findLine(assessment, "ALLOW");
    const disallow = findLine(assessment, "DISALLOW");
    const capped = findLine(assessment, "ALLOW_CAPPED");
    const flag = findLine(assessment, "FLAG");
    await acceptLine(allow.id);
    await acceptLine(disallow.id);
    await acceptLine(capped.id);
    await strikeLine(flag.id);

    const signoffResponse = await signOffFixture(assessment.id);
    expect(signoffResponse.status).toBe(200);

    const noticeResponse = await noticeSentRoute(
      jsonRequest(`${MATTERS_URL}/${assessment.matterId}/notice-sent`, "POST", {}, HR_COOKIE),
      { params: Promise.resolve({ id: assessment.matterId }) }
    );
    expect(noticeResponse.status).toBe(200);
    const noticeBody = (await noticeResponse.json()) as { noticeSentAt: string };
    expect(noticeBody.noticeSentAt).toBeTruthy();

    const signedOffAssessment = await getSignedOffAssessmentForHr(DEMO_USERS.HR_PREPARER, assessment.matterId);
    expect(signedOffAssessment.totals.finalAmount).toBe(18640);
  });

  it("HR-RESULT: an assessment where nothing survives review (struck or DISALLOW-accepted) renders a zero fee as an ordinary, non-null final amount", async () => {
    const assessment = await buildFixtureMatterAndAssessment();
    const allow = findLine(assessment, "ALLOW");
    const disallow = findLine(assessment, "DISALLOW"); // STRIKE is not a permitted action for DISALLOW — ACCEPT already yields 0.
    const capped = findLine(assessment, "ALLOW_CAPPED");
    const flag = findLine(assessment, "FLAG");
    await strikeLine(allow.id);
    await acceptLine(disallow.id);
    await strikeLine(capped.id);
    await strikeLine(flag.id);

    const signoffResponse = await signOffFixture(assessment.id);
    expect(signoffResponse.status).toBe(200);

    const signedOffAssessment = await getSignedOffAssessmentForHr(DEMO_USERS.HR_PREPARER, assessment.matterId);
    expect(signedOffAssessment.totals.finalAmount).toBe(0);
  });
});
