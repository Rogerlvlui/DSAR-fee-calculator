// tests/routes/disposition.test.ts
//
// Route-level tests for the legal review screen's disposition endpoint,
// tagged DISPOSITION. Drives the real route handlers with real Request
// objects — the same technique tests/routes/demo-pipeline.test.ts (03.1-01)
// and tests/routes/intake.test.ts (03.1-02) already use — over a real
// four-line matter through the real engine and the real committed SG-PDPA
// pack. The four lines are sized so each of ALLOW, ALLOW_CAPPED, DISALLOW
// and FLAG survives cross-line materiality (packages/engine's 40%
// threshold) without changing verdict, giving every verdict family a real
// line to disposition against.

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { POST as dispositionRoute } from "../../apps/web/app/api/assessment-lines/[id]/disposition/route.ts";
import { POST as bulkAcceptRoute } from "../../apps/web/app/api/assessments/[id]/bulk-accept/route.ts";
import { DEMO_ROLE_COOKIE, DEMO_USERS } from "../../apps/web/src/server/data/auth.ts";
import {
  applyBulkAcceptDisposition,
  listBulkAcceptableLineIds,
} from "../../apps/web/src/server/data/assessments.ts";
import { memoryAssessmentRepository } from "../../apps/web/src/server/repositories/memory/assessment-repository.ts";
import { AssessmentLineSchema, type AssessmentLine } from "@dsar/schemas/assessment";

const MATTERS_URL = "http://localhost/api/matters";
const DISPOSITION_URL = "http://localhost/api/assessment-lines";
const LEGAL_COOKIE = `${DEMO_ROLE_COOKIE}=LEGAL_REVIEWER`;

function jsonRequest(url: string, method: string, body: unknown, cookie: string = LEGAL_COOKIE): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

const VALID_MATTER_INPUT = {
  reference: "DSAR-DISP-0001",
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

// Sized so each line's share of the 83800 claimed total stays under the
// engine's 40% cross-line materiality threshold — otherwise the ALLOW/
// ALLOW_CAPPED lines below would flip to FLAG regardless of the pack's own
// treatment (same technique as demo-pipeline.test.ts/intake.test.ts).
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
    categoryCode: "STAFF_TIME_ASSESS_EXEMPTIONS", // -> DISALLOW, 60000
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

interface FixtureAssessment {
  id: string;
  lines: { id: string; verdict: string; engineAmount: number; disposition: string }[];
}

async function buildFixtureAssessment(): Promise<FixtureAssessment> {
  const matterResponse = await createMatterRoute(
    jsonRequest(MATTERS_URL, "POST", VALID_MATTER_INPUT, `${DEMO_ROLE_COOKIE}=HR_PREPARER`)
  );
  const matter = (await matterResponse.json()) as { id: string };

  for (const input of LINE_INPUTS) {
    const response = await addLineRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/lines`, "POST", input, `${DEMO_ROLE_COOKIE}=HR_PREPARER`), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(response.status).toBe(201);
  }

  const submitResponse = await submitRoute(
    jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}, `${DEMO_ROLE_COOKIE}=HR_PREPARER`),
    { params: Promise.resolve({ id: matter.id }) }
  );
  expect(submitResponse.status).toBe(200);
  return (await submitResponse.json()) as FixtureAssessment;
}

function findLine(assessment: FixtureAssessment, verdict: string) {
  const line = assessment.lines.find((candidate) => candidate.verdict === verdict);
  if (!line) throw new Error(`fixture has no ${verdict} line — verdicts: ${assessment.lines.map((l) => l.verdict)}`);
  return line;
}

async function storedLine(lineId: string) {
  const assessment = await memoryAssessmentRepository.findByLineId(lineId);
  return assessment?.lines.find((line) => line.id === lineId) ?? null;
}

const GOOD_REASON = "Sighted the vendor invoice separately and it checks out.";

describe("DISPOSITION", () => {
  it("DISPOSITION: a reason shorter than ten non-whitespace characters is refused with 400, and the stored line is unchanged", async () => {
    const assessment = await buildFixtureAssessment();
    const line = findLine(assessment, "ALLOW");

    const response = await dispositionRoute(
      jsonRequest(`${DISPOSITION_URL}/${line.id}/disposition`, "POST", { action: "ACCEPT", reason: "too short" }),
      { params: Promise.resolve({ id: line.id }) }
    );
    expect(response.status).toBe(400);

    const stored = await storedLine(line.id);
    expect(stored?.disposition).toBe("PENDING");
    expect(stored?.lawyerReason).toBeNull();
    expect(stored?.lawyerAmount).toBeNull();
    expect(stored?.dispositionedBy).toBeNull();
  });

  it("DISPOSITION: a reason of ten spaces is refused — the count is of non-whitespace characters", async () => {
    const assessment = await buildFixtureAssessment();
    const line = findLine(assessment, "ALLOW");

    const response = await dispositionRoute(
      jsonRequest(`${DISPOSITION_URL}/${line.id}/disposition`, "POST", { action: "ACCEPT", reason: "          " }),
      { params: Promise.resolve({ id: line.id }) }
    );
    expect(response.status).toBe(400);

    const stored = await storedLine(line.id);
    expect(stored?.disposition).toBe("PENDING");
  });

  it("DISPOSITION: a reason longer than the frozen lawyer-reason cap is refused with 400", async () => {
    const assessment = await buildFixtureAssessment();
    const line = findLine(assessment, "ALLOW");

    const response = await dispositionRoute(
      jsonRequest(`${DISPOSITION_URL}/${line.id}/disposition`, "POST", {
        action: "ACCEPT",
        reason: "x".repeat(1001),
      }),
      { params: Promise.resolve({ id: line.id }) }
    );
    expect(response.status).toBe(400);

    const stored = await storedLine(line.id);
    expect(stored?.disposition).toBe("PENDING");
  });

  it("DISPOSITION: an accepted supported line stores the engine's amount as the decided amount and records the actor and a timestamp", async () => {
    const assessment = await buildFixtureAssessment();
    const line = findLine(assessment, "ALLOW");

    const response = await dispositionRoute(
      jsonRequest(`${DISPOSITION_URL}/${line.id}/disposition`, "POST", { action: "ACCEPT", reason: GOOD_REASON }),
      { params: Promise.resolve({ id: line.id }) }
    );
    expect(response.status).toBe(200);

    const stored = await storedLine(line.id);
    expect(stored?.disposition).toBe("ACCEPTED");
    expect(stored?.engineAmount).toBe(line.engineAmount);
    expect(stored?.lawyerReason).toBe(GOOD_REASON);
    expect(stored?.dispositionedBy).not.toBeNull();
    expect(stored?.dispositionedAt).not.toBeNull();
  });

  it("DISPOSITION: a reduced line stores the lawyer's amount", async () => {
    const assessment = await buildFixtureAssessment();
    const line = findLine(assessment, "ALLOW");
    const reducedAmount = line.engineAmount - 1000;

    const response = await dispositionRoute(
      jsonRequest(`${DISPOSITION_URL}/${line.id}/disposition`, "POST", {
        action: "REDUCE",
        amountMinor: reducedAmount,
        reason: GOOD_REASON,
      }),
      { params: Promise.resolve({ id: line.id }) }
    );
    expect(response.status).toBe(200);

    const stored = await storedLine(line.id);
    expect(stored?.disposition).toBe("REDUCED");
    expect(stored?.lawyerAmount).toBe(reducedAmount);
  });

  it("DISPOSITION: a reduction above the engine's own amount is refused with 400", async () => {
    const assessment = await buildFixtureAssessment();
    const line = findLine(assessment, "ALLOW");

    const response = await dispositionRoute(
      jsonRequest(`${DISPOSITION_URL}/${line.id}/disposition`, "POST", {
        action: "REDUCE",
        amountMinor: line.engineAmount + 1,
        reason: GOOD_REASON,
      }),
      { params: Promise.resolve({ id: line.id }) }
    );
    expect(response.status).toBe(400);

    const stored = await storedLine(line.id);
    expect(stored?.disposition).toBe("PENDING");
  });

  it("DISPOSITION: an allowed-anyway amount above the underlying expense line's claimed amount is refused with 400", async () => {
    const assessment = await buildFixtureAssessment();
    const line = findLine(assessment, "DISALLOW"); // claimed 60000

    const response = await dispositionRoute(
      jsonRequest(`${DISPOSITION_URL}/${line.id}/disposition`, "POST", {
        action: "ALLOW_ANYWAY",
        amountMinor: 70000,
        reason: GOOD_REASON,
      }),
      { params: Promise.resolve({ id: line.id }) }
    );
    expect(response.status).toBe(400);

    const stored = await storedLine(line.id);
    expect(stored?.disposition).toBe("PENDING");
  });

  it("DISPOSITION: an action that does not belong to the line's verdict is refused with 400", async () => {
    const assessment = await buildFixtureAssessment();
    const flagLine = findLine(assessment, "FLAG");

    const response = await dispositionRoute(
      jsonRequest(`${DISPOSITION_URL}/${flagLine.id}/disposition`, "POST", {
        action: "REDUCE",
        amountMinor: 100,
        reason: GOOD_REASON,
      }),
      { params: Promise.resolve({ id: flagLine.id }) }
    );
    expect(response.status).toBe(400);

    const stored = await storedLine(flagLine.id);
    expect(stored?.disposition).toBe("PENDING");
  });

  it("DISPOSITION: a request carrying the HR role cookie is refused with 403 and changes nothing", async () => {
    const assessment = await buildFixtureAssessment();
    const line = findLine(assessment, "ALLOW");

    const response = await dispositionRoute(
      jsonRequest(
        `${DISPOSITION_URL}/${line.id}/disposition`,
        "POST",
        { action: "ACCEPT", reason: GOOD_REASON },
        `${DEMO_ROLE_COOKIE}=HR_PREPARER`
      ),
      { params: Promise.resolve({ id: line.id }) }
    );
    expect(response.status).toBe(403);

    const stored = await storedLine(line.id);
    expect(stored?.disposition).toBe("PENDING");
  });
});

const BULK_ACCEPT_URL = "http://localhost/api/assessments";

function bulkAssessmentLine(overrides: Record<string, unknown>): AssessmentLine {
  return AssessmentLineSchema.parse({
    id: "line-1",
    expenseLineId: "expense-1",
    verdict: "ALLOW",
    engineAmount: 1000,
    appliedRuleId: "SG-PDPA.STAFF_TIME_SEARCH",
    appliedCap: null,
    basis: "Test basis.",
    citation: { instrument: "Test instrument", provision: "s.1" },
    flagReasons: [],
    disposition: "PENDING",
    lawyerAmount: null,
    lawyerReason: null,
    dispositionedBy: null,
    dispositionedAt: null,
    ...overrides,
  });
}

describe("BULK-ACCEPT", () => {
  it("BULK-ACCEPT: the eligible set for the real demo assessment is empty — every relevant rule in the committed pack is NEEDS_VERIFICATION", async () => {
    const assessment = await buildFixtureAssessment();
    // buildFixtureAssessment() returns the route's own JSON shape; re-fetch
    // through the repository to get the real, schema-validated Assessment
    // listBulkAcceptableLineIds expects.
    const stored = await memoryAssessmentRepository.getAssessment(assessment.id);
    expect(stored).not.toBeNull();
    expect(listBulkAcceptableLineIds(stored!)).toEqual([]);
  });

  it("BULK-ACCEPT: the eligibility filter excludes capped, not-supported, flagged, unverified-rule and already-decided lines, in one fixture", () => {
    // The real committed SG-PDPA pack has no VERIFIED rule at all (every
    // relevant rule is NEEDS_VERIFICATION), so distinguishing "wrong
    // verdict" from "unverified rule" needs a fixture pack with at least
    // one VERIFIED rule — hence the injected `pack` override
    // listBulkAcceptableLineIds accepts for exactly this reason. Cast via
    // `unknown`: only `categoryRules` is read by the function under test.
    const fixturePack = {
      categoryRules: [
        { ruleId: "TEST.VERIFIED_RULE", verificationStatus: "VERIFIED" },
        { ruleId: "TEST.UNVERIFIED_RULE", verificationStatus: "NEEDS_VERIFICATION" },
      ],
    } as unknown as Parameters<typeof listBulkAcceptableLineIds>[1];

    const assessment = {
      lines: [
        bulkAssessmentLine({ id: "capped", verdict: "ALLOW_CAPPED", appliedRuleId: "TEST.VERIFIED_RULE" }),
        bulkAssessmentLine({ id: "disallow", verdict: "DISALLOW", engineAmount: 0, appliedRuleId: "TEST.VERIFIED_RULE" }),
        bulkAssessmentLine({
          id: "flagged",
          verdict: "FLAG",
          engineAmount: 0,
          appliedRuleId: "TEST.VERIFIED_RULE",
          flagReasons: [{ code: "UNCATEGORISED", message: "Test." }],
        }),
        bulkAssessmentLine({ id: "unverified", verdict: "ALLOW", appliedRuleId: "TEST.UNVERIFIED_RULE" }),
        bulkAssessmentLine({
          id: "already-decided",
          verdict: "ALLOW",
          appliedRuleId: "TEST.VERIFIED_RULE",
          disposition: "ACCEPTED",
        }),
        bulkAssessmentLine({ id: "eligible", verdict: "ALLOW", appliedRuleId: "TEST.VERIFIED_RULE" }),
      ],
    } as unknown as Parameters<typeof listBulkAcceptableLineIds>[0];

    expect(listBulkAcceptableLineIds(assessment, fixturePack)).toEqual(["eligible"]);
  });

  it("BULK-ACCEPT: a bulk-accept request with a reason shorter than ten non-whitespace characters is refused with 400 and no line is dispositioned", async () => {
    const assessment = await buildFixtureAssessment();
    const allowLine = findLine(assessment, "ALLOW");

    const response = await bulkAcceptRoute(
      jsonRequest(`${BULK_ACCEPT_URL}/${assessment.id}/bulk-accept`, "POST", {
        lineIds: [allowLine.id],
        reason: "short",
      }),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(400);

    const stored = await storedLine(allowLine.id);
    expect(stored?.disposition).toBe("PENDING");
  });

  it("BULK-ACCEPT: a bulk-accept request naming an ineligible line is refused with 400 and no line in the batch is dispositioned", async () => {
    const assessment = await buildFixtureAssessment();
    const allowLine = findLine(assessment, "ALLOW"); // ineligible: NEEDS_VERIFICATION
    const flagLine = findLine(assessment, "FLAG"); // ineligible: wrong verdict

    const response = await bulkAcceptRoute(
      jsonRequest(`${BULK_ACCEPT_URL}/${assessment.id}/bulk-accept`, "POST", {
        lineIds: [allowLine.id, flagLine.id],
        reason: GOOD_REASON,
      }),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(400);

    const storedAllow = await storedLine(allowLine.id);
    const storedFlag = await storedLine(flagLine.id);
    expect(storedAllow?.disposition).toBe("PENDING");
    expect(storedFlag?.disposition).toBe("PENDING");
  });

  it("BULK-ACCEPT: applyBulkAcceptDisposition records the same reason, actor and timestamp on every named line and leaves every other line pending", () => {
    const lines = [
      bulkAssessmentLine({ id: "line-1" }),
      bulkAssessmentLine({ id: "line-2" }),
      bulkAssessmentLine({ id: "line-3" }),
    ];
    const now = "2026-09-18T12:00:00Z";

    const updated = applyBulkAcceptDisposition(lines, ["line-1", "line-2"], GOOD_REASON, DEMO_USERS.LEGAL_REVIEWER.user, now);

    const line1 = updated.find((line) => line.id === "line-1")!;
    const line2 = updated.find((line) => line.id === "line-2")!;
    const line3 = updated.find((line) => line.id === "line-3")!;

    for (const line of [line1, line2]) {
      expect(line.disposition).toBe("ACCEPTED");
      expect(line.lawyerReason).toBe(GOOD_REASON);
      expect(line.dispositionedBy).toEqual(DEMO_USERS.LEGAL_REVIEWER.user);
      expect(line.dispositionedAt).toBe(now);
    }
    expect(line3.disposition).toBe("PENDING");
  });
});
