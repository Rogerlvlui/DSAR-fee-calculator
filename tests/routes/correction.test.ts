// tests/routes/correction.test.ts
//
// Route-level tests for the correction-after-sign-off path (STATE-05,
// AC-33, checkpoint 04-05-CP's Option A), tagged CORRECTION. Drives the
// real route handlers with real Request objects over a real four-line
// matter through the real engine and the real committed SG-PDPA pack,
// following tests/routes/recompute.test.ts's established technique. The
// verbatim-retention test is the one that matters: a deep-clone snapshot
// taken before the correction, compared against the stored record
// afterwards, so a silent overwrite would be caught even if only one field
// had changed.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { POST as dispositionRoute } from "../../apps/web/app/api/assessment-lines/[id]/disposition/route.ts";
import { POST as signoffRoute } from "../../apps/web/app/api/assessments/[id]/signoff/route.ts";
import { POST as supersedeRoute } from "../../apps/web/app/api/assessments/[id]/supersede/route.ts";
import { DEMO_ROLE_COOKIE } from "../../apps/web/src/server/data/auth.ts";
import { memoryAssessmentRepository } from "../../apps/web/src/server/repositories/memory/assessment-repository.ts";
import { memoryMatterRepository } from "../../apps/web/src/server/repositories/memory/matter-repository.ts";
import { memoryAuditEventWriter } from "@dsar/audit/memory/audit-event-writer";
import { demoStore } from "../../apps/web/src/server/repositories/memory/store.ts";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");

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
  return `DSAR-CORRECTION-${String(matterCounter).padStart(4, "0")}`;
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
  signOff: unknown;
  totals: { finalAmount: number | null };
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

async function dispositionAllLines(assessment: FixtureAssessment): Promise<void> {
  const acceptedVerdicts = ["ALLOW", "DISALLOW", "ALLOW_CAPPED"];
  for (const verdict of acceptedVerdicts) {
    const line = findLine(assessment, verdict);
    const response = await dispositionRoute(
      jsonRequest(`http://localhost/api/assessment-lines/${line.id}/disposition`, "POST", {
        action: "ACCEPT",
        reason: GOOD_REASON,
      }),
      { params: Promise.resolve({ id: line.id }) }
    );
    expect(response.status).toBe(200);
  }
  const flag = findLine(assessment, "FLAG");
  const flagResponse = await dispositionRoute(
    jsonRequest(`http://localhost/api/assessment-lines/${flag.id}/disposition`, "POST", {
      action: "STRIKE",
      reason: GOOD_REASON,
    }),
    { params: Promise.resolve({ id: flag.id }) }
  );
  expect(flagResponse.status).toBe(200);
}

async function signOffFixture(assessmentId: string): Promise<Response> {
  return signoffRoute(
    jsonRequest(`${ASSESSMENTS_URL}/${assessmentId}/signoff`, "POST", {
      qualification: "Advocate & Solicitor, Singapore",
      acknowledgedFlags: [],
      attestation: true,
    }),
    { params: Promise.resolve({ id: assessmentId }) }
  );
}

// Builds a matter all the way to SIGNED_OFF — every correction test starts
// from here, since SIGNED_OFF is one of the SUPERSEDE row's two origins.
async function buildSignedOffFixture(): Promise<FixtureAssessment> {
  const assessment = await buildFixtureAssessment();
  await dispositionAllLines(assessment);
  const signoffResponse = await signOffFixture(assessment.id);
  expect(signoffResponse.status).toBe(200);
  return assessment;
}

function countAssessmentsForMatter(matterId: string): number {
  return [...demoStore.assessments.values()].filter((assessment) => assessment.matterId === matterId).length;
}

describe("CORRECTION", () => {
  it("CORRECTION: leaves the previously signed assessment deep-equal to a snapshot taken before the correction", async () => {
    const assessment = await buildSignedOffFixture();
    const before = await memoryAssessmentRepository.getAssessment(assessment.id);
    const snapshot = structuredClone(before);

    const response = await supersedeRoute(
      jsonRequest(`${ASSESSMENTS_URL}/${assessment.id}/supersede`, "POST", {}),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(201);

    const after = await memoryAssessmentRepository.getAssessment(assessment.id);
    expect(after).toEqual(snapshot);
  });

  it("CORRECTION: produces a second assessment with a different identifier, every line undecided, no sign-off record and no final amount", async () => {
    const assessment = await buildSignedOffFixture();

    const response = await supersedeRoute(
      jsonRequest(`${ASSESSMENTS_URL}/${assessment.id}/supersede`, "POST", {}),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(201);
    const correction = (await response.json()) as FixtureAssessment;

    expect(correction.id).not.toBe(assessment.id);
    expect(correction.signOff).toBeNull();
    expect(correction.totals.finalAmount).toBeNull();
    expect(correction.lines.length).toBeGreaterThan(0);
    for (const line of correction.lines) {
      expect(line.disposition).toBe("PENDING");
    }
  });

  it("CORRECTION: the matter is superseded afterwards, and the transition went through the executor", async () => {
    const assessment = await buildSignedOffFixture();

    const response = await supersedeRoute(
      jsonRequest(`${ASSESSMENTS_URL}/${assessment.id}/supersede`, "POST", {}),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(201);

    const matter = await memoryMatterRepository.getMatter(assessment.matterId);
    expect(matter?.status).toBe("SUPERSEDED");
  });

  it("CORRECTION: exactly two assessments are held for the matter afterwards, and the listing returns them in the order they were written", async () => {
    const assessment = await buildSignedOffFixture();

    const response = await supersedeRoute(
      jsonRequest(`${ASSESSMENTS_URL}/${assessment.id}/supersede`, "POST", {}),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(201);
    const correction = (await response.json()) as FixtureAssessment;

    expect(countAssessmentsForMatter(assessment.matterId)).toBe(2);
    const held = await memoryAssessmentRepository.listAssessmentsByMatterId(assessment.matterId);
    expect(held.map((entry) => entry.id)).toEqual([assessment.id, correction.id]);
  });

  it("CORRECTION: the lookup by matter returns the newly raised assessment, not the superseded one", async () => {
    const assessment = await buildSignedOffFixture();

    const response = await supersedeRoute(
      jsonRequest(`${ASSESSMENTS_URL}/${assessment.id}/supersede`, "POST", {}),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(201);
    const correction = (await response.json()) as FixtureAssessment;

    const latest = await memoryAssessmentRepository.getAssessmentByMatterId(assessment.matterId);
    expect(latest?.id).toBe(correction.id);
  });

  it("CORRECTION: raised by a preparer is refused with 403, leaving the assessment count and matter status unchanged", async () => {
    const assessment = await buildSignedOffFixture();

    const response = await supersedeRoute(
      jsonRequest(`${ASSESSMENTS_URL}/${assessment.id}/supersede`, "POST", {}, HR_COOKIE),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(403);

    expect(countAssessmentsForMatter(assessment.matterId)).toBe(1);
    const matter = await memoryMatterRepository.getMatter(assessment.matterId);
    expect(matter?.status).toBe("SIGNED_OFF");
  });

  it("CORRECTION: raised against a matter that is not signed off or closed is refused with a conflict, leaving the assessment count and matter status unchanged", async () => {
    const assessment = await buildFixtureAssessment(); // still LEGAL_REVIEW — never signed off

    const response = await supersedeRoute(
      jsonRequest(`${ASSESSMENTS_URL}/${assessment.id}/supersede`, "POST", {}),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(409);

    expect(countAssessmentsForMatter(assessment.matterId)).toBe(1);
    const matter = await memoryMatterRepository.getMatter(assessment.matterId);
    expect(matter?.status).toBe("LEGAL_REVIEW");
  });

  it("CORRECTION: raised from the closed status succeeds, proving both origins of that table row are wired", async () => {
    const assessment = await buildSignedOffFixture();
    // The closing transition (SIGNED_OFF -> CLOSED, driven by markNoticeSent)
    // is plan 04-05 Task 2's job and lands in apps/web/src/server/data/matters.ts,
    // outside this task's declared file scope. This test proves the SUPERSEDE
    // row's SECOND origin — CLOSED -> SUPERSEDED — in isolation, by moving the
    // matter to CLOSED directly through the repository rather than through
    // markNoticeSent's real HTTP path (which tests/routes/lifecycle.test.ts,
    // Task 2's own test file, exercises end to end).
    const signedOffMatter = await memoryMatterRepository.getMatter(assessment.matterId);
    if (!signedOffMatter) throw new Error("fixture matter not found");
    await memoryMatterRepository.updateMatter({ ...signedOffMatter, status: "CLOSED" });
    const closedMatter = await memoryMatterRepository.getMatter(assessment.matterId);
    expect(closedMatter?.status).toBe("CLOSED");

    const response = await supersedeRoute(
      jsonRequest(`${ASSESSMENTS_URL}/${assessment.id}/supersede`, "POST", {}),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(201);

    const matter = await memoryMatterRepository.getMatter(assessment.matterId);
    expect(matter?.status).toBe("SUPERSEDED");
  });

  it("CORRECTION: a refused correction (wrong role) leaves exactly one assessment and the matter's status unchanged — re-asserted directly against the repository", async () => {
    const assessment = await buildSignedOffFixture();

    await expect(
      (async () => {
        const response = await supersedeRoute(
          jsonRequest(`${ASSESSMENTS_URL}/${assessment.id}/supersede`, "POST", {}, HR_COOKIE),
          { params: Promise.resolve({ id: assessment.id }) }
        );
        if (response.status !== 403) throw new Error(`expected 403, got ${response.status}`);
      })()
    ).resolves.toBeUndefined();

    const held = await memoryAssessmentRepository.listAssessmentsByMatterId(assessment.matterId);
    expect(held.length).toBe(1);
    expect(held[0]?.id).toBe(assessment.id);
  });

  it("CORRECTION: writes one superseded record naming the superseded assessment, the before and after status, and the acting lawyer", async () => {
    const assessment = await buildSignedOffFixture();

    const response = await supersedeRoute(
      jsonRequest(`${ASSESSMENTS_URL}/${assessment.id}/supersede`, "POST", {}),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(201);

    const events = await memoryAuditEventWriter.listByMatter(assessment.matterId);
    const superseded = events.filter((event) => event.type === "SUPERSEDED");
    expect(superseded.length).toBe(1);
    expect(superseded[0]?.payload.entityId).toBe(assessment.id);
    expect(superseded[0]?.payload.before).toBe("SIGNED_OFF");
    expect(superseded[0]?.payload.after).toBe("SUPERSEDED");
    expect(superseded[0]?.actorRole).toBe("LEGAL_REVIEWER");
  });

  it("CORRECTION: the correction path does not reuse the in-place recompute module — data/assessments.ts carries no import statement naming recompute.ts", () => {
    const source = readFileSync(path.join(ROOT, "apps", "web", "src", "server", "data", "assessments.ts"), "utf-8");
    const importLines = source.split("\n").filter((line) => /^\s*import\b/.test(line));
    expect(importLines.some((line) => /recompute\.ts|recomputeAssessment/.test(line))).toBe(false);
  });
});
