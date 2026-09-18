// tests/routes/info-request.test.ts
//
// Route-level tests for the information-request branch and its in-place
// recompute, tagged INFO-REQUEST. Drives the real route handlers with real
// Request objects over a real four-line matter through the real engine and
// the real committed SG-PDPA pack, following tests/routes/disposition.test.ts's
// established technique.

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { POST as dispositionRoute } from "../../apps/web/app/api/assessment-lines/[id]/disposition/route.ts";
import { POST as bulkAcceptRoute } from "../../apps/web/app/api/assessments/[id]/bulk-accept/route.ts";
import { POST as signoffRoute } from "../../apps/web/app/api/assessments/[id]/signoff/route.ts";
import { POST as infoRequestRoute } from "../../apps/web/app/api/matters/[id]/info-request/route.ts";
import { POST as resubmitRoute } from "../../apps/web/app/api/matters/[id]/resubmit/route.ts";
import { DEMO_ROLE_COOKIE } from "../../apps/web/src/server/data/auth.ts";
import { memoryAssessmentRepository } from "../../apps/web/src/server/repositories/memory/assessment-repository.ts";
import { memoryMatterRepository } from "../../apps/web/src/server/repositories/memory/matter-repository.ts";

const MATTERS_URL = "http://localhost/api/matters";
const LEGAL_COOKIE = `${DEMO_ROLE_COOKIE}=LEGAL_REVIEWER`;
const HR_COOKIE = `${DEMO_ROLE_COOKIE}=HR_PREPARER`;

function jsonRequest(url: string, method: string, body: unknown, cookie: string = LEGAL_COOKIE): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

let matterCounter = 0;
function nextReference(): string {
  matterCounter += 1;
  return `DSAR-INFOREQ-${String(matterCounter).padStart(4, "0")}`;
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
    categoryCode: "STAFF_TIME_ASSESS_EXEMPTIONS", // -> DISALLOW
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
    categoryCode: "PHOTOCOPY_PRINT", // -> ALLOW_CAPPED
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
    categoryCode: "OTHER_UNCLASSIFIED", // -> FLAG
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
  rulePackId: string;
  rulePackVersion: string;
  engineVersion: string;
  lines: { id: string; verdict: string; engineAmount: number; disposition: string; expenseLineId: string }[];
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

async function storedAssessment(id: string) {
  return memoryAssessmentRepository.getAssessment(id);
}

const GOOD_QUERY = "Can you confirm which vendor invoiced this line item?";

describe("INFO-REQUEST", () => {
  it("INFO-REQUEST: asking HR records the lawyer's query against the named line, moves the matter to information requested, and leaves every disposition untouched", async () => {
    const assessment = await buildFixtureMatterAndAssessment();
    const flagLine = findLine(assessment, "FLAG");

    const response = await infoRequestRoute(
      jsonRequest(`${MATTERS_URL}/${assessment.matterId}/info-request`, "POST", {
        assessmentLineId: flagLine.id,
        query: GOOD_QUERY,
      }),
      { params: Promise.resolve({ id: assessment.matterId }) }
    );
    expect(response.status).toBe(201);

    const matter = await memoryMatterRepository.getMatter(assessment.matterId);
    expect(matter?.status).toBe("INFO_REQUEST");

    const stored = await storedAssessment(assessment.id);
    expect(stored?.lines.every((line) => line.disposition === "PENDING")).toBe(true);
  });

  it("INFO-REQUEST: asking HR with a query shorter than ten non-whitespace characters is refused and the matter stays in legal review", async () => {
    const assessment = await buildFixtureMatterAndAssessment();
    const flagLine = findLine(assessment, "FLAG");

    const response = await infoRequestRoute(
      jsonRequest(`${MATTERS_URL}/${assessment.matterId}/info-request`, "POST", {
        assessmentLineId: flagLine.id,
        query: "too short",
      }),
      { params: Promise.resolve({ id: assessment.matterId }) }
    );
    expect(response.status).toBe(400);

    const matter = await memoryMatterRepository.getMatter(assessment.matterId);
    expect(matter?.status).toBe("LEGAL_REVIEW");
  });

  it("INFO-REQUEST: sign-off is refused with a conflict status while the matter is in the information-requested state", async () => {
    const assessment = await buildFixtureMatterAndAssessment();
    const flagLine = findLine(assessment, "FLAG");
    await infoRequestRoute(
      jsonRequest(`${MATTERS_URL}/${assessment.matterId}/info-request`, "POST", {
        assessmentLineId: flagLine.id,
        query: GOOD_QUERY,
      }),
      { params: Promise.resolve({ id: assessment.matterId }) }
    );

    const response = await signoffRoute(
      jsonRequest(`http://localhost/api/assessments/${assessment.id}/signoff`, "POST", {
        qualification: "Advocate & Solicitor, Singapore",
        acknowledgedFlags: [],
        attestation: true,
      }),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(409);
  });

  it("INFO-REQUEST: a disposition is refused with a conflict status while the matter is in the information-requested state", async () => {
    const assessment = await buildFixtureMatterAndAssessment();
    const flagLine = findLine(assessment, "FLAG");
    const allowLine = findLine(assessment, "ALLOW");
    await infoRequestRoute(
      jsonRequest(`${MATTERS_URL}/${assessment.matterId}/info-request`, "POST", {
        assessmentLineId: flagLine.id,
        query: GOOD_QUERY,
      }),
      { params: Promise.resolve({ id: assessment.matterId }) }
    );

    const response = await dispositionRoute(
      jsonRequest(`http://localhost/api/assessment-lines/${allowLine.id}/disposition`, "POST", {
        action: "ACCEPT",
        reason: GOOD_QUERY,
      }),
      { params: Promise.resolve({ id: allowLine.id }) }
    );
    expect(response.status).toBe(409);

    const stored = await storedAssessment(assessment.id);
    const storedAllow = stored?.lines.find((line) => line.id === allowLine.id);
    expect(storedAllow?.disposition).toBe("PENDING");
  });

  it("INFO-REQUEST: bulk accept is refused with a conflict status while the matter is in the information-requested state", async () => {
    const assessment = await buildFixtureMatterAndAssessment();
    const flagLine = findLine(assessment, "FLAG");
    const allowLine = findLine(assessment, "ALLOW");
    await infoRequestRoute(
      jsonRequest(`${MATTERS_URL}/${assessment.matterId}/info-request`, "POST", {
        assessmentLineId: flagLine.id,
        query: GOOD_QUERY,
      }),
      { params: Promise.resolve({ id: assessment.matterId }) }
    );

    const response = await bulkAcceptRoute(
      jsonRequest(`http://localhost/api/assessments/${assessment.id}/bulk-accept`, "POST", {
        lineIds: [allowLine.id],
        reason: GOOD_QUERY,
      }),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(409);
  });

  it("INFO-REQUEST: HR re-submitting after answering recomputes the assessment, keeping its identity — exactly one assessment exists for the matter afterwards", async () => {
    const assessment = await buildFixtureMatterAndAssessment();
    const flagLine = findLine(assessment, "FLAG");
    await infoRequestRoute(
      jsonRequest(`${MATTERS_URL}/${assessment.matterId}/info-request`, "POST", {
        assessmentLineId: flagLine.id,
        query: GOOD_QUERY,
      }),
      { params: Promise.resolve({ id: assessment.matterId }) }
    );

    const response = await resubmitRoute(
      jsonRequest(`${MATTERS_URL}/${assessment.matterId}/resubmit`, "POST", {}, HR_COOKIE),
      { params: Promise.resolve({ id: assessment.matterId }) }
    );
    expect(response.status).toBe(200);
    const recomputed = (await response.json()) as FixtureAssessment;

    expect(recomputed.id).toBe(assessment.id);

    const allAssessments = await memoryAssessmentRepository.getAssessmentByMatterId(assessment.matterId);
    expect(allAssessments?.id).toBe(assessment.id);
  });

  it("INFO-REQUEST: after the recompute every line's disposition is pending again and no lawyer amount, reason, actor or timestamp survives from before", async () => {
    const assessment = await buildFixtureMatterAndAssessment();
    const flagLine = findLine(assessment, "FLAG");
    const allowLine = findLine(assessment, "ALLOW");

    // Disposition the ALLOW line before asking HR on the flagged one, so
    // there is a real disposition on file for the recompute to clear.
    const acceptResponse = await dispositionRoute(
      jsonRequest(`http://localhost/api/assessment-lines/${allowLine.id}/disposition`, "POST", {
        action: "ACCEPT",
        reason: "Sighted the underlying records and it checks out.",
      }),
      { params: Promise.resolve({ id: allowLine.id }) }
    );
    expect(acceptResponse.status).toBe(200);

    await infoRequestRoute(
      jsonRequest(`${MATTERS_URL}/${assessment.matterId}/info-request`, "POST", {
        assessmentLineId: flagLine.id,
        query: GOOD_QUERY,
      }),
      { params: Promise.resolve({ id: assessment.matterId }) }
    );

    await resubmitRoute(jsonRequest(`${MATTERS_URL}/${assessment.matterId}/resubmit`, "POST", {}, HR_COOKIE), {
      params: Promise.resolve({ id: assessment.matterId }),
    });

    const stored = await storedAssessment(assessment.id);
    for (const line of stored?.lines ?? []) {
      expect(line.disposition).toBe("PENDING");
      expect(line.lawyerAmount).toBeNull();
      expect(line.lawyerReason).toBeNull();
      expect(line.dispositionedBy).toBeNull();
      expect(line.dispositionedAt).toBeNull();
    }
  });

  it("INFO-REQUEST: after the recompute the matter is back in legal review and the pack id, pack version and engine version are re-stamped", async () => {
    const assessment = await buildFixtureMatterAndAssessment();
    const flagLine = findLine(assessment, "FLAG");
    await infoRequestRoute(
      jsonRequest(`${MATTERS_URL}/${assessment.matterId}/info-request`, "POST", {
        assessmentLineId: flagLine.id,
        query: GOOD_QUERY,
      }),
      { params: Promise.resolve({ id: assessment.matterId }) }
    );

    const response = await resubmitRoute(
      jsonRequest(`${MATTERS_URL}/${assessment.matterId}/resubmit`, "POST", {}, HR_COOKIE),
      { params: Promise.resolve({ id: assessment.matterId }) }
    );
    const recomputed = (await response.json()) as FixtureAssessment;

    expect(recomputed.rulePackId).toBe(assessment.rulePackId);
    expect(recomputed.rulePackVersion).toBe(assessment.rulePackVersion);
    expect(recomputed.engineVersion).toBe(assessment.engineVersion);

    const matter = await memoryMatterRepository.getMatter(assessment.matterId);
    expect(matter?.status).toBe("LEGAL_REVIEW");
  });

  it("INFO-REQUEST: re-submitting a matter that is not in the information-requested state is refused with a conflict status", async () => {
    const assessment = await buildFixtureMatterAndAssessment();

    const response = await resubmitRoute(
      jsonRequest(`${MATTERS_URL}/${assessment.matterId}/resubmit`, "POST", {}, HR_COOKIE),
      { params: Promise.resolve({ id: assessment.matterId }) }
    );
    expect(response.status).toBe(409);
  });
});
