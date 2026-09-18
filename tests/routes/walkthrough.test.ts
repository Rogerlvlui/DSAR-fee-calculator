// tests/routes/walkthrough.test.ts
//
// The one test that exercises Phase 03.1 as a whole, tagged WALKTHROUGH:
// create the matter, add the six PRD §14 reference lines, submit,
// disposition all six lines covering every one of the four decided
// outcomes, acknowledge the litigation-posture flag, sign off — then prove
// the HR-facing refusal-then-success ordering, the assessment-count
// invariant, and that a second, independent run does not collide with the
// first. Drives every route with real Request objects over the real
// engine and the real committed SG-PDPA pack, the same technique every
// other tests/routes/*.test.ts file in this phase already uses.

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { POST as dispositionRoute } from "../../apps/web/app/api/assessment-lines/[id]/disposition/route.ts";
import { POST as signoffRoute } from "../../apps/web/app/api/assessments/[id]/signoff/route.ts";
import { DEMO_ROLE_COOKIE, DEMO_USERS } from "../../apps/web/src/server/data/auth.ts";
import {
  REFERENCE_MATTER_INPUT,
  REFERENCE_FIXTURE_LINE_INPUTS,
} from "../../apps/web/src/server/__fixtures__/reference-fixture.ts";
import { getSignedOffAssessmentForHr } from "../../apps/web/src/server/data/assessments.ts";
import { memoryMatterRepository } from "../../apps/web/src/server/repositories/memory/matter-repository.ts";
import { demoStore } from "../../apps/web/src/server/repositories/memory/store.ts";

const MATTERS_URL = "http://localhost/api/matters";
const LEGAL_COOKIE = `${DEMO_ROLE_COOKIE}=LEGAL_REVIEWER`;

function jsonRequest(url: string, method: string, body: unknown, cookie?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  return new Request(url, { method, headers, body: JSON.stringify(body) });
}

let matterCounter = 0;
function nextReference(): string {
  matterCounter += 1;
  return `DSAR-WALKTHROUGH-${String(matterCounter).padStart(4, "0")}`;
}

interface WalkthroughLine {
  id: string;
  verdict: "ALLOW" | "ALLOW_CAPPED" | "DISALLOW" | "FLAG";
  engineAmount: number;
}

interface WalkthroughAssessment {
  id: string;
  matterId: string;
  lines: WalkthroughLine[];
}

// Creates the matter, adds the six PRD §14 reference lines and submits —
// every step over the real HTTP path, every response status asserted so a
// silent partial failure cannot leave the rest of a walkthrough run
// operating on incomplete data.
async function createSubmittedReferenceMatter(): Promise<WalkthroughAssessment> {
  const matterResponse = await createMatterRoute(
    jsonRequest(MATTERS_URL, "POST", { ...REFERENCE_MATTER_INPUT, reference: nextReference() })
  );
  expect(matterResponse.status).toBe(201);
  const matter = (await matterResponse.json()) as { id: string };

  for (const lineInput of REFERENCE_FIXTURE_LINE_INPUTS) {
    const lineResponse = await addLineRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/lines`, "POST", lineInput), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(lineResponse.status).toBe(201);
  }

  const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}), {
    params: Promise.resolve({ id: matter.id }),
  });
  expect(submitResponse.status).toBe(200);
  return (await submitResponse.json()) as WalkthroughAssessment;
}

function findLine(assessment: WalkthroughAssessment, verdict: WalkthroughLine["verdict"], index = 0): WalkthroughLine {
  const matches = assessment.lines.filter((candidate) => candidate.verdict === verdict);
  const line = matches[index];
  if (!line) throw new Error(`fixture has no ${verdict} line at index ${index}`);
  return line;
}

const GOOD_REASON = "Sighted the vendor invoice separately during review and it checks out.";

// Dispositions every line, chosen so the six cover all four decided
// outcomes named in this plan's own action text: accept the two supported
// lines, accept the capped line, accept the not-supported line, allow the
// flagged vendor line at a reduced amount, and strike the flagged
// unclassified line.
async function dispositionEveryLine(assessment: WalkthroughAssessment): Promise<void> {
  const [allow1, allow2] = assessment.lines.filter((line) => line.verdict === "ALLOW");
  const disallow = findLine(assessment, "DISALLOW");
  const capped = findLine(assessment, "ALLOW_CAPPED");
  const [flagVendor, flagUnclassified] = assessment.lines.filter((line) => line.verdict === "FLAG");

  const steps: [WalkthroughLine, Record<string, unknown>][] = [
    [allow1!, { action: "ACCEPT", reason: GOOD_REASON }],
    [allow2!, { action: "ACCEPT", reason: GOOD_REASON }],
    [disallow, { action: "ACCEPT", reason: GOOD_REASON }],
    [capped, { action: "ACCEPT", reason: GOOD_REASON }],
    [flagVendor!, { action: "ALLOW_WITH_AMOUNT", amountMinor: 20000, reason: GOOD_REASON }],
    [flagUnclassified!, { action: "STRIKE", reason: GOOD_REASON }],
  ];

  for (const [line, body] of steps) {
    const response = await dispositionRoute(
      jsonRequest(`http://localhost/api/assessment-lines/${line.id}/disposition`, "POST", body, LEGAL_COOKIE),
      { params: Promise.resolve({ id: line.id }) }
    );
    expect(response.status).toBe(200);
  }
}

async function signOffFixture(assessmentId: string): Promise<Response> {
  return signoffRoute(
    jsonRequest(
      `http://localhost/api/assessments/${assessmentId}/signoff`,
      "POST",
      {
        qualification: "Advocate & Solicitor, Singapore",
        acknowledgedFlags: ["LITIGATION_POSTURE"],
        attestation: true,
      },
      LEGAL_COOKIE
    ),
    { params: Promise.resolve({ id: assessmentId }) }
  );
}

function countAssessmentsForMatter(matterId: string): number {
  return [...demoStore.assessments.values()].filter((assessment) => assessment.matterId === matterId).length;
}

describe("WALKTHROUGH", () => {
  it("WALKTHROUGH: the full path — create, six lines, submit, six dispositions, acknowledge, sign off — runs in one test, every step succeeding", async () => {
    const assessment = await createSubmittedReferenceMatter();
    expect(countAssessmentsForMatter(assessment.matterId)).toBe(1);

    await dispositionEveryLine(assessment);
    expect(countAssessmentsForMatter(assessment.matterId)).toBe(1);

    const signoffResponse = await signOffFixture(assessment.id);
    expect(signoffResponse.status).toBe(200);
    expect(countAssessmentsForMatter(assessment.matterId)).toBe(1);
  });

  it("WALKTHROUGH: after the run the matter is signed off, the assessment carries a sign-off record, and the final amount is the hand-computed integer sum of the six chosen dispositions", async () => {
    const assessment = await createSubmittedReferenceMatter();
    await dispositionEveryLine(assessment);

    const signoffResponse = await signOffFixture(assessment.id);
    expect(signoffResponse.status).toBe(200);
    const body = (await signoffResponse.json()) as {
      assessment: { totals: { finalAmount: number } };
    };

    // Hand arithmetic, not a call to computeFinalAmount — a test that
    // reuses the implementation's own summation would only prove it is
    // self-consistent:
    //   line 1 (ALLOW, accepted):          16000
    //   line 2 (ALLOW, accepted):        +  8000
    //   line 3 (DISALLOW, accepted):     +     0
    //   line 4 (ALLOW_CAPPED, accepted): +  2640
    //   line 5 (FLAG, allowed at 200.00):+ 20000
    //   line 6 (FLAG, struck):           +     0
    //   ----------------------------------------
    //                                     = 46640
    expect(body.assessment.totals.finalAmount).toBe(46640);

    const matter = await memoryMatterRepository.getMatter(assessment.matterId);
    expect(matter?.status).toBe("SIGNED_OFF");
  });

  it("WALKTHROUGH: HR's read of the matter refuses before sign-off and succeeds after it, in the same run — proving the ordering, not just the two endpoints", async () => {
    const assessment = await createSubmittedReferenceMatter();

    await expect(getSignedOffAssessmentForHr(DEMO_USERS.HR_PREPARER, assessment.matterId)).rejects.toThrow();

    await dispositionEveryLine(assessment);
    // Still refused — every line decided is not yet signed off.
    await expect(getSignedOffAssessmentForHr(DEMO_USERS.HR_PREPARER, assessment.matterId)).rejects.toThrow();

    const signoffResponse = await signOffFixture(assessment.id);
    expect(signoffResponse.status).toBe(200);

    const hrAssessment = await getSignedOffAssessmentForHr(DEMO_USERS.HR_PREPARER, assessment.matterId);
    expect(hrAssessment.totals.finalAmount).toBe(46640);
  });

  it("WALKTHROUGH: a second, independent run in the same process produces an independent matter — the store keys by identifier and the two walkthroughs do not collide", async () => {
    const first = await createSubmittedReferenceMatter();
    const second = await createSubmittedReferenceMatter();

    expect(second.matterId).not.toBe(first.matterId);
    expect(second.id).not.toBe(first.id);

    await dispositionEveryLine(first);
    await dispositionEveryLine(second);

    const firstSignoff = await signOffFixture(first.id);
    const secondSignoff = await signOffFixture(second.id);
    expect(firstSignoff.status).toBe(200);
    expect(secondSignoff.status).toBe(200);

    expect(countAssessmentsForMatter(first.matterId)).toBe(1);
    expect(countAssessmentsForMatter(second.matterId)).toBe(1);

    const firstHr = await getSignedOffAssessmentForHr(DEMO_USERS.HR_PREPARER, first.matterId);
    const secondHr = await getSignedOffAssessmentForHr(DEMO_USERS.HR_PREPARER, second.matterId);
    expect(firstHr.totals.finalAmount).toBe(46640);
    expect(secondHr.totals.finalAmount).toBe(46640);
    expect(firstHr.id).not.toBe(secondHr.id);
  });
});
