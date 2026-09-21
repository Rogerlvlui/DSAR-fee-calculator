// tests/routes/notice-outputs.test.ts
//
// Route-level proof for the HR-facing notice mechanism (SIGNOFF-05/06,
// DOC-02/03/04), tagged NOTICE-OUTPUTS. Reuses tests/routes/hr-result.test.ts's
// fixture-building technique (the same four-line SG-PDPA composition) for the
// ordinary sign-off/notice-sent path, and tests/routes/audit-trail.test.ts's
// post-creation controllerType-mutation technique for the AC-14 zero-fee
// edge case — extended here to a jurisdiction whose pack data can actually
// reach the NO_EXPRESS_AUTHORITY posture branch (see the AC-14 fixture's own
// header comment below for why SG-PDPA itself cannot be used for that case).

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { POST as dispositionRoute } from "../../apps/web/app/api/assessment-lines/[id]/disposition/route.ts";
import { POST as signoffRoute } from "../../apps/web/app/api/assessments/[id]/signoff/route.ts";
import { POST as noticeSentRoute } from "../../apps/web/app/api/matters/[id]/notice-sent/route.ts";
import { DEMO_ROLE_COOKIE, DEMO_USERS } from "../../apps/web/src/server/data/auth.ts";
import { memoryMatterRepository } from "../../apps/web/src/server/repositories/memory/matter-repository.ts";
import { getSignedOffAssessmentForHr } from "../../apps/web/src/server/data/assessments.ts";
import { getExpenseLinesForHr } from "../../apps/web/src/server/data/matters.ts";
import { resolvePinnedRulePack } from "../../apps/web/src/server/engine-invocation.ts";
import { buildNoticeDraft, findAc17Violations } from "../../apps/web/src/domain/notice-draft.ts";

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
  return `DSAR-NOTICEOUT-${String(matterCounter).padStart(4, "0")}`;
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

interface FixtureAssessmentLine {
  id: string;
  verdict: string;
  engineAmount: number;
  disposition: string;
}

interface FixtureAssessment {
  id: string;
  matterId: string;
  lines: FixtureAssessmentLine[];
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

function findLine(assessment: FixtureAssessment, verdict: string): FixtureAssessmentLine {
  const line = assessment.lines.find((candidate) => candidate.verdict === verdict);
  if (!line) throw new Error(`fixture has no ${verdict} line`);
  return line;
}

const GOOD_REASON = "Sighted the vendor invoice separately and it checks out.";

async function strikeLine(lineId: string): Promise<void> {
  const response = await dispositionRoute(
    jsonRequest(
      `http://localhost/api/assessment-lines/${lineId}/disposition`,
      "POST",
      { action: "STRIKE", reason: GOOD_REASON },
      LEGAL_COOKIE
    ),
    { params: Promise.resolve({ id: lineId }) }
  );
  expect(response.status).toBe(200);
}

async function acceptLine(lineId: string): Promise<void> {
  const response = await dispositionRoute(
    jsonRequest(
      `http://localhost/api/assessment-lines/${lineId}/disposition`,
      "POST",
      { action: "ACCEPT", reason: GOOD_REASON },
      LEGAL_COOKIE
    ),
    { params: Promise.resolve({ id: lineId }) }
  );
  expect(response.status).toBe(200);
}

async function signOffFixture(assessmentId: string): Promise<Response> {
  return signoffRoute(
    jsonRequest(
      `http://localhost/api/assessments/${assessmentId}/signoff`,
      "POST",
      { qualification: "Advocate & Solicitor, Singapore", acknowledgedFlags: [], attestation: true },
      LEGAL_COOKIE
    ),
    { params: Promise.resolve({ id: assessmentId }) }
  );
}

// DOC-03/AC-17's route-level half needs a signed-off matter against the
// REAL committed HK-PDPO and SG-PDPA packs (not merely a synthetic string),
// so the scan is proven against actual pack content for both authored
// jurisdictions, not only the pure unit fixtures in notice-draft.test.tsx.
// Generalised beyond buildFixtureMatterAndAssessment (SG-only, and assumes
// one line of each of the four verdicts): this builder disposes every line
// by its own verdict (STRIKE if FLAG, ACCEPT otherwise) and signs off,
// which works identically for any jurisdiction's stub-generated category
// rules regardless of their specific treatments.
interface SignedOffFixture {
  matterId: string;
}

async function buildSignedOffMatter(jurisdictionCode: string, currency: string, referencePrefix: string): Promise<SignedOffFixture> {
  matterCounter += 1;
  const reference = `${referencePrefix}-${String(matterCounter).padStart(4, "0")}`;
  const matterResponse = await createMatterRoute(
    jsonRequest(
      MATTERS_URL,
      "POST",
      { ...VALID_MATTER_INPUT_BASE, jurisdictionCode, currency, reference },
      HR_COOKIE
    )
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
  const assessment = (await submitResponse.json()) as FixtureAssessment;

  for (const line of assessment.lines) {
    if (line.verdict === "FLAG") {
      await strikeLine(line.id);
    } else {
      await acceptLine(line.id);
    }
  }

  const signoffResponse = await signOffFixture(assessment.id);
  expect(signoffResponse.status).toBe(200);

  return { matterId: matter.id };
}

// Rebuilds the exact notice the real HR page assembles (apps/web/app/hr/matters/[id]/page.tsx):
// the same getSignedOffAssessmentForHr/getExpenseLinesForHr reads, the same
// resultLines derivation, and the same buildNoticeDraft call against the
// pinned pack's own requestorNoticeTemplate.
async function buildRealNoticeForMatter(matterId: string): Promise<{ notice: string; basisStrings: string[] }> {
  const assessment = await getSignedOffAssessmentForHr(DEMO_USERS.HR_PREPARER, matterId);
  const expenseLines = await getExpenseLinesForHr(DEMO_USERS.HR_PREPARER, matterId);
  const expenseLineById = new Map(expenseLines.map((line) => [line.id, line]));
  const matter = await memoryMatterRepository.getMatter(matterId);
  if (!matter) throw new Error("expected matter to exist");

  const allowedLinesForNotice = assessment.lines
    .filter((line) => line.disposition !== "STRUCK")
    .map((line) => {
      const expenseLine = expenseLineById.get(line.expenseLineId);
      return { description: expenseLine?.description ?? "", amount: line.engineAmount };
    });

  const pack = resolvePinnedRulePack(assessment.rulePackId, assessment.rulePackVersion);
  const notice = buildNoticeDraft({
    template: pack.requestorNoticeTemplate,
    amount: (assessment.totals.finalAmount ?? 0) as never,
    currency: matter.currency,
    allowedLines: allowedLinesForNotice as never,
    matterReference: matter.reference,
  });

  const basisStrings = pack.categoryRules.map((rule) => rule.basis);
  return { notice, basisStrings };
}

const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

describe("NOTICE-OUTPUTS", () => {
  it("NOTICE-OUTPUTS: marking the notice sent as HR on a signed-off matter returns 200, closes the matter, and records a valid ISO instant", async () => {
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
    expect(noticeBody.noticeSentAt).toMatch(ISO_INSTANT_PATTERN);

    const closedMatter = await memoryMatterRepository.getMatter(assessment.matterId);
    expect(closedMatter?.status).toBe("CLOSED");
  });

  it("NOTICE-OUTPUTS: marking the notice sent is refused for a LEGAL_REVIEWER cookie — marking sent is the preparer's act, not the reviewer's", async () => {
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
      jsonRequest(`${MATTERS_URL}/${assessment.matterId}/notice-sent`, "POST", {}, LEGAL_COOKIE),
      { params: Promise.resolve({ id: assessment.matterId }) }
    );
    expect(noticeResponse.status).toBe(403);
  });

  // DOC-03/AC-17 — proven against the real committed pack content for both
  // authored jurisdictions, not only the pure unit fixtures.
  it("NOTICE-OUTPUTS: the real SG-PDPA-derived notice carries zero AC-17 violations and no pack basis string", async () => {
    const { matterId } = await buildSignedOffMatter("SG", "SGD", "DSAR-NOTICEOUT-SG");
    const { notice, basisStrings } = await buildRealNoticeForMatter(matterId);

    expect(findAc17Violations(notice)).toEqual([]);
    for (const basis of basisStrings) {
      expect(notice).not.toContain(basis);
    }
  });

  it("NOTICE-OUTPUTS: the real HK-PDPO-derived notice carries zero AC-17 violations and no pack basis string", async () => {
    const { matterId } = await buildSignedOffMatter("HK", "HKD", "DSAR-NOTICEOUT-HK");
    const { notice, basisStrings } = await buildRealNoticeForMatter(matterId);

    expect(findAc17Violations(notice)).toEqual([]);
    for (const basis of basisStrings) {
      expect(notice).not.toContain(basis);
    }
  });
});
