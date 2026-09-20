// tests/routes/access-control-review.test.ts
//
// ACCESS-02/ACCESS-03's own explicit tests, and AC-01's literal route
// contract, tagged ACCESS-CONTROL-REVIEW. Drives the new
// GET /api/assessments/{id} export directly with real Request objects and
// hand-built params, matching tests/routes/live-routing.test.ts's own
// established pattern. Reuses the reference fixture's matter/line inputs
// for the LEGAL_REVIEW-status cases, and tests/routes/signoff.test.ts's own
// four-line-fixture-plus-disposition-plus-signoff pipeline shape for the
// ACCESS-03 SIGNED_OFF case, rather than hand-rolling a third variant.

import { describe, expect, it } from "vitest";
import { GET as getAssessmentRoute } from "../../apps/web/app/api/assessments/[id]/route.ts";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { POST as dispositionRoute } from "../../apps/web/app/api/assessment-lines/[id]/disposition/route.ts";
import { POST as signoffRoute } from "../../apps/web/app/api/assessments/[id]/signoff/route.ts";
import { DEMO_ROLE_COOKIE } from "../../apps/web/src/server/data/auth.ts";
import {
  REFERENCE_MATTER_INPUT,
  REFERENCE_FIXTURE_LINE_INPUTS,
} from "../../apps/web/src/server/__fixtures__/reference-fixture.ts";

const MATTERS_URL = "http://localhost/api/matters";
const ASSESSMENTS_URL = "http://localhost/api/assessments";
const HR_COOKIE = `${DEMO_ROLE_COOKIE}=HR_PREPARER`;
const LEGAL_COOKIE = `${DEMO_ROLE_COOKIE}=LEGAL_REVIEWER`;

// A privileged-field denylist matching the plan's own list — scanned as
// substrings over the FULL response body, not a single named field, so a
// leak through a differently-named field would also be caught.
const PRIVILEGED_FIELD_NAMES = ["verdict", "engineAmount", "basis", "draftBaseline", "lawyerReason"];

function jsonRequest(url: string, method: string, body: unknown, cookie?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  return new Request(url, { method, headers, body: JSON.stringify(body) });
}

function getRequest(url: string, cookie?: string): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  return new Request(url, { method: "GET", headers });
}

// A different, unique matter reference per call — this file's own fixture
// drive must not collide with other test files' fixtures within one
// Vitest worker's shared in-memory store.
let matterCounter = 0;
function nextReference(): string {
  matterCounter += 1;
  return `DSAR-ACCESS-CONTROL-${String(matterCounter).padStart(4, "0")}`;
}

interface FixtureAssessment {
  id: string;
  matterId: string;
  lines: { id: string; verdict: string; disposition: string }[];
  matterLevelFlags: { id: string; requiresAcknowledgement: boolean }[];
}

async function buildMatterInLegalReview(): Promise<{ matterId: string; assessmentId: string }> {
  const matterResponse = await createMatterRoute(
    jsonRequest(MATTERS_URL, "POST", { ...REFERENCE_MATTER_INPUT, reference: nextReference() }, HR_COOKIE)
  );
  expect(matterResponse.status).toBe(201);
  const matter = (await matterResponse.json()) as { id: string };

  for (const lineInput of REFERENCE_FIXTURE_LINE_INPUTS) {
    const lineResponse = await addLineRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/lines`, "POST", lineInput, HR_COOKIE), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(lineResponse.status).toBe(201);
  }

  const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}, HR_COOKIE), {
    params: Promise.resolve({ id: matter.id }),
  });
  expect(submitResponse.status).toBe(200);
  const assessment = (await submitResponse.json()) as { id: string };

  return { matterId: matter.id, assessmentId: assessment.id };
}

// Drives a matter all the way to SIGNED_OFF — every line dispositioned
// (ACCEPT for every non-FLAG verdict, STRIKE for FLAG), then a valid
// sign-off — mirroring tests/routes/signoff.test.ts's own established
// dispositionAllLines/VALID_SIGNOFF_INPUT shape rather than a fourth
// hand-rolled variant.
async function buildSignedOffMatter(): Promise<{ matterId: string; assessmentId: string }> {
  const { matterId, assessmentId } = await buildMatterInLegalReview();

  const assessmentResponse = await getAssessmentRoute(getRequest(`${ASSESSMENTS_URL}/${assessmentId}`, LEGAL_COOKIE), {
    params: Promise.resolve({ id: assessmentId }),
  });
  const assessment = (await assessmentResponse.json()) as FixtureAssessment;

  const reason = "Sighted the supporting evidence separately and it checks out.";
  for (const line of assessment.lines) {
    const action = line.verdict === "FLAG" ? "STRIKE" : "ACCEPT";
    const response = await dispositionRoute(
      jsonRequest(`http://localhost/api/assessment-lines/${line.id}/disposition`, "POST", { action, reason }, LEGAL_COOKIE),
      { params: Promise.resolve({ id: line.id }) }
    );
    expect(response.status).toBe(200);
  }

  const acknowledgedFlags = assessment.matterLevelFlags.filter((flag) => flag.requiresAcknowledgement).map((flag) => flag.id);
  const signoffResponse = await signoffRoute(
    jsonRequest(`${ASSESSMENTS_URL}/${assessmentId}/signoff`, "POST", {
      qualification: "Advocate & Solicitor, Singapore",
      acknowledgedFlags,
      attestation: true,
    }, LEGAL_COOKIE),
    { params: Promise.resolve({ id: assessmentId }) }
  );
  expect(signoffResponse.status).toBe(200);

  return { matterId, assessmentId };
}

describe("ACCESS-CONTROL-REVIEW: GET /api/assessments/{id}", () => {
  it("ACCESS-CONTROL-REVIEW: an HR_PREPARER requesting an assessment still in LEGAL_REVIEW gets 403 with no assessment data in the body (AC-01/ACCESS-02)", async () => {
    const { assessmentId } = await buildMatterInLegalReview();

    const response = await getAssessmentRoute(getRequest(`${ASSESSMENTS_URL}/${assessmentId}`, HR_COOKIE), {
      params: Promise.resolve({ id: assessmentId }),
    });

    expect(response.status).toBe(403);
    const bodyText = JSON.stringify(await response.json());
    for (const field of PRIVILEGED_FIELD_NAMES) {
      expect(bodyText).not.toContain(field);
    }
  });

  it("ACCESS-CONTROL-REVIEW: the same request with no cookie at all (default HR_PREPARER identity) behaves identically — no accidental escalation", async () => {
    const { assessmentId } = await buildMatterInLegalReview();

    const response = await getAssessmentRoute(getRequest(`${ASSESSMENTS_URL}/${assessmentId}`), {
      params: Promise.resolve({ id: assessmentId }),
    });

    expect(response.status).toBe(403);
    const bodyText = JSON.stringify(await response.json());
    for (const field of PRIVILEGED_FIELD_NAMES) {
      expect(bodyText).not.toContain(field);
    }
  });

  it("ACCESS-CONTROL-REVIEW: a LEGAL_REVIEWER requesting the same assessment gets 200 and the real assessment body", async () => {
    const { assessmentId } = await buildMatterInLegalReview();

    const response = await getAssessmentRoute(getRequest(`${ASSESSMENTS_URL}/${assessmentId}`, LEGAL_COOKIE), {
      params: Promise.resolve({ id: assessmentId }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { id: string; lines: unknown[] };
    expect(body.id).toBe(assessmentId);
    expect(Array.isArray(body.lines)).toBe(true);
    expect(body.lines.length).toBeGreaterThan(0);
  });

  it("ACCESS-CONTROL-REVIEW: this route is LEGAL_REVIEWER-only regardless of matter status — an HR_PREPARER still gets 403 once the matter is SIGNED_OFF (ACCESS-03)", async () => {
    const { assessmentId } = await buildSignedOffMatter();

    const response = await getAssessmentRoute(getRequest(`${ASSESSMENTS_URL}/${assessmentId}`, HR_COOKIE), {
      params: Promise.resolve({ id: assessmentId }),
    });

    expect(response.status).toBe(403);
    const bodyText = JSON.stringify(await response.json());
    for (const field of PRIVILEGED_FIELD_NAMES) {
      expect(bodyText).not.toContain(field);
    }
  });
});
