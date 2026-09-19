// tests/routes/recompute.test.ts
//
// Route-level tests for the lawyer-initiated recompute endpoint (STATE-03),
// tagged RECOMPUTE. Drives the real route handlers with real Request
// objects over a real four-line matter through the real engine and the
// real committed SG-PDPA pack, following tests/routes/signoff.test.ts's
// established technique. The identity assertion is the important one:
// the stored assessment identifier never changes, and exactly one
// assessment is ever held for the matter.

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { POST as dispositionRoute } from "../../apps/web/app/api/assessment-lines/[id]/disposition/route.ts";
import { POST as recomputeRoute } from "../../apps/web/app/api/assessments/[id]/recompute/route.ts";
import { POST as infoRequestRoute } from "../../apps/web/app/api/matters/[id]/info-request/route.ts";
import { DEMO_ROLE_COOKIE } from "../../apps/web/src/server/data/auth.ts";
import { memoryAssessmentRepository } from "../../apps/web/src/server/repositories/memory/assessment-repository.ts";
import { memoryMatterRepository } from "../../apps/web/src/server/repositories/memory/matter-repository.ts";
import { memoryAuditEventWriter } from "@dsar/audit/memory/audit-event-writer";
import { recordAssessmentOpened, elapsedReviewMs } from "@dsar/audit/review-session";
import { demoStore } from "../../apps/web/src/server/repositories/memory/store.ts";

const MATTERS_URL = "http://localhost/api/matters";
const ASSESSMENTS_URL = "http://localhost/api/assessments";
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
  return `DSAR-RECOMPUTE-${String(matterCounter).padStart(4, "0")}`;
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
  computedAt: string;
  lines: { id: string; verdict: string; engineAmount: number; disposition: string }[];
}

async function buildFixtureAssessment(): Promise<FixtureAssessment> {
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

function countAssessmentsForMatter(matterId: string): number {
  return [...demoStore.assessments.values()].filter((assessment) => assessment.matterId === matterId).length;
}

describe("RECOMPUTE", () => {
  it("RECOMPUTE: keeps the assessment's identity, and exactly one assessment is held for the matter afterwards", async () => {
    const assessment = await buildFixtureAssessment();

    const response = await recomputeRoute(jsonRequest(`${ASSESSMENTS_URL}/${assessment.id}/recompute`, "POST", {}), {
      params: Promise.resolve({ id: assessment.id }),
    });
    expect(response.status).toBe(200);
    const recomputed = (await response.json()) as FixtureAssessment;

    expect(recomputed.id).toBe(assessment.id);
    expect(countAssessmentsForMatter(assessment.matterId)).toBe(1);
  });

  it("RECOMPUTE: clears every line's disposition, lawyer amount, reason, actor and timestamp", async () => {
    const assessment = await buildFixtureAssessment();
    const allowLine = findLine(assessment, "ALLOW");

    const dispositionResponse = await dispositionRoute(
      jsonRequest(`http://localhost/api/assessment-lines/${allowLine.id}/disposition`, "POST", {
        action: "ACCEPT",
        reason: GOOD_REASON,
      }),
      { params: Promise.resolve({ id: allowLine.id }) }
    );
    expect(dispositionResponse.status).toBe(200);

    const response = await recomputeRoute(jsonRequest(`${ASSESSMENTS_URL}/${assessment.id}/recompute`, "POST", {}), {
      params: Promise.resolve({ id: assessment.id }),
    });
    expect(response.status).toBe(200);

    const stored = await memoryAssessmentRepository.getAssessment(assessment.id);
    for (const line of stored?.lines ?? []) {
      expect(line.disposition).toBe("PENDING");
      expect(line.lawyerAmount).toBeNull();
      expect(line.lawyerReason).toBeNull();
      expect(line.dispositionedBy).toBeNull();
      expect(line.dispositionedAt).toBeNull();
    }
  });

  it("RECOMPUTE: re-stamps the pack version, engine version and computation time, distinguishing a genuine recompute from a no-op", async () => {
    const assessment = await buildFixtureAssessment();

    const response = await recomputeRoute(jsonRequest(`${ASSESSMENTS_URL}/${assessment.id}/recompute`, "POST", {}), {
      params: Promise.resolve({ id: assessment.id }),
    });
    expect(response.status).toBe(200);
    const recomputed = (await response.json()) as FixtureAssessment;

    expect(recomputed.rulePackId).toBe(assessment.rulePackId);
    expect(recomputed.rulePackVersion).toBe(assessment.rulePackVersion);
    expect(recomputed.engineVersion).toBe(assessment.engineVersion);
    // computedAt is freshly derived by the engine on every call — a genuine
    // recompute, not a preserved value from the original assessment.
    expect(recomputed.computedAt).not.toBe(assessment.computedAt);
    expect(new Date(recomputed.computedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(assessment.computedAt).getTime()
    );
  });

  it("RECOMPUTE: requested by a preparer is refused with 403 and changes nothing", async () => {
    const assessment = await buildFixtureAssessment();

    const response = await recomputeRoute(
      jsonRequest(`${ASSESSMENTS_URL}/${assessment.id}/recompute`, "POST", {}, HR_COOKIE),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(403);

    const matter = await memoryMatterRepository.getMatter(assessment.matterId);
    expect(matter?.status).toBe("LEGAL_REVIEW");
  });

  it("RECOMPUTE: requested from a status other than legal review is refused with a conflict", async () => {
    const assessment = await buildFixtureAssessment();
    const flagLine = findLine(assessment, "FLAG");
    await infoRequestRoute(
      jsonRequest(`${MATTERS_URL}/${assessment.matterId}/info-request`, "POST", {
        assessmentLineId: flagLine.id,
        query: "Can you confirm the vendor invoiced this line?",
      }),
      { params: Promise.resolve({ id: assessment.matterId }) }
    );
    const matter = await memoryMatterRepository.getMatter(assessment.matterId);
    expect(matter?.status).toBe("INFO_REQUEST");

    const response = await recomputeRoute(jsonRequest(`${ASSESSMENTS_URL}/${assessment.id}/recompute`, "POST", {}), {
      params: Promise.resolve({ id: assessment.id }),
    });
    expect(response.status).toBe(409);
  });

  it("RECOMPUTE: clears the first-opened record, so an elapsed figure taken after it is measured from the reopening, not the first pass", async () => {
    const assessment = await buildFixtureAssessment();

    const longAgo = new Date(Date.now() - 10_000_000).toISOString();
    recordAssessmentOpened(assessment.id, longAgo);
    const beforeElapsed = elapsedReviewMs(assessment.id, new Date().toISOString());
    expect(beforeElapsed).toBeGreaterThan(1_000_000);

    const response = await recomputeRoute(jsonRequest(`${ASSESSMENTS_URL}/${assessment.id}/recompute`, "POST", {}), {
      params: Promise.resolve({ id: assessment.id }),
    });
    expect(response.status).toBe(200);

    const afterElapsed = elapsedReviewMs(assessment.id, new Date().toISOString());
    expect(afterElapsed).toBeLessThan(beforeElapsed);
    expect(afterElapsed).toBeLessThan(60_000);
  });

  it("RECOMPUTE: leaves a COMPUTED record in the log", async () => {
    const assessment = await buildFixtureAssessment();
    const before = await memoryAuditEventWriter.listByMatter(assessment.matterId);
    const computedBefore = before.filter((event) => event.type === "COMPUTED").length;

    const response = await recomputeRoute(jsonRequest(`${ASSESSMENTS_URL}/${assessment.id}/recompute`, "POST", {}), {
      params: Promise.resolve({ id: assessment.id }),
    });
    expect(response.status).toBe(200);

    const after = await memoryAuditEventWriter.listByMatter(assessment.matterId);
    const computedAfter = after.filter((event) => event.type === "COMPUTED").length;
    expect(computedAfter).toBe(computedBefore + 1);
  });
});
