// tests/routes/demo-pipeline.test.ts
//
// The tracer's proof (03.1-01 Task 1): drives the three route handlers
// directly with real Request objects, exercising the real repository, the
// real engine-invocation boundary, and the real committed SG-PDPA pack — no
// figure anywhere in this path is computed by apps/web itself. Every test
// name is tagged PIPELINE.

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { DEMO_ROLE_COOKIE } from "../../apps/web/src/server/data/auth.ts";

const BASE_URL = "http://localhost/api/matters";

function jsonRequest(url: string, body: unknown, cookie?: string): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

const VALID_MATTER_INPUT = {
  reference: "DSAR-DEMO-0001",
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
  isKnownDisputeOrLitigation: true,
};

async function createDemoMatter(): Promise<{ id: string }> {
  const response = await createMatterRoute(jsonRequest(BASE_URL, VALID_MATTER_INPUT));
  const matter = (await response.json()) as { id: string };
  return matter;
}

describe("PIPELINE — one determination end to end", () => {
  it("PIPELINE: create, itemise, submit reaches the real engine over the real SG-PDPA pack", async () => {
    const matter = await createDemoMatter();

    const lineResponse = await addLineRoute(
      jsonRequest(`${BASE_URL}/${matter.id}/lines`, {
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
      }),
      { params: Promise.resolve({ id: matter.id }) }
    );
    expect(lineResponse.status).toBe(201);

    // A second line, DISALLOW under the real pack regardless of amount
    // (SG-PDPA.STAFF_TIME_ASSESS_EXEMPTIONS carries no conditions), sized so
    // the first line's claimed amount sits under packages/engine's 40%
    // cross-line materiality threshold (cross-line-checks.ts) — a
    // single-line matter is trivially 100% material and would otherwise
    // flip line 1 to FLAG regardless of the pack's own ALLOW treatment. A
    // DISALLOW line never acquires a cross-line reason (assess.ts), so this
    // addition changes nothing else about the assertions below.
    const secondLineResponse = await addLineRoute(
      jsonRequest(`${BASE_URL}/${matter.id}/lines`, {
        categoryCode: "STAFF_TIME_ASSESS_EXEMPTIONS",
        description: "Staff time deciding which items may be withheld under an exemption",
        quantity: 30,
        unit: "HOUR",
        unitRate: 1000,
        incurredByGrade: null,
        isThirdPartyInvoiced: false,
        vendorName: null,
        evidenceRef: null,
        hrNote: null,
      }),
      { params: Promise.resolve({ id: matter.id }) }
    );
    expect(secondLineResponse.status).toBe(201);

    const submitResponse = await submitRoute(
      jsonRequest(`${BASE_URL}/${matter.id}/submit`, {}),
      { params: Promise.resolve({ id: matter.id }) }
    );
    expect(submitResponse.status).toBe(200);

    const assessment = await submitResponse.json();

    expect(assessment.totals.draftBaseline).toBe(16000);
    expect(assessment.lines[0].verdict).toBe("ALLOW");
    expect(assessment.rulePackId).toBe("SG-PDPA");
    expect(assessment.rulePackVersion).toBe("2026.09.1");
  });

  it("PIPELINE: submitting a matter with zero expense lines returns 400 and leaves the matter in DRAFT", async () => {
    const matter = await createDemoMatter();

    const submitResponse = await submitRoute(jsonRequest(`${BASE_URL}/${matter.id}/submit`, {}), {
      params: Promise.resolve({ id: matter.id }),
    });

    expect(submitResponse.status).toBe(400);

    // Re-fetch via a fresh line-add attempt is unnecessary here — the
    // matter's status is proven by exercising the same submit path again:
    // a matter stuck anywhere other than DRAFT would fail with a different
    // (409/ConflictError-shaped) status the second time, not the same 400.
    const secondAttempt = await submitRoute(jsonRequest(`${BASE_URL}/${matter.id}/submit`, {}), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(secondAttempt.status).toBe(400);
  });

  it("PIPELINE: a request whose cookie names the legal role gets 403 from matter creation, with a message body", async () => {
    const response = await createMatterRoute(
      jsonRequest(BASE_URL, VALID_MATTER_INPUT, `${DEMO_ROLE_COOKIE}=LEGAL_REVIEWER`)
    );

    expect(response.status).toBe(403);
    const body = (await response.json()) as { error?: string };
    expect(typeof body.error).toBe("string");
    expect(body.error?.length).toBeGreaterThan(0);
  });
});
