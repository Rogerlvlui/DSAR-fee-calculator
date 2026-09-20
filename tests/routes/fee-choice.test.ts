// tests/routes/fee-choice.test.ts
//
// Route-level tests for POST /api/assessments/{id}/fee-choice, tagged
// FEE-CHOICE. Drives the real route handlers over a real HK matter — HK is
// the only real committed pack carrying a flatFee today (06-RESEARCH.md) —
// through the real engine, proving setFeeChoice's server-side gate is the
// authoritative one, independent of any client-side UI.

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { POST as feeChoiceRoute } from "../../apps/web/app/api/assessments/[id]/fee-choice/route.ts";
import { POST as dispositionRoute } from "../../apps/web/app/api/assessment-lines/[id]/disposition/route.ts";
import { POST as signoffRoute } from "../../apps/web/app/api/assessments/[id]/signoff/route.ts";
import { DEMO_ROLE_COOKIE } from "../../apps/web/src/server/data/auth.ts";
import { memoryAssessmentRepository } from "../../apps/web/src/server/repositories/memory/assessment-repository.ts";
import { memoryMatterRepository } from "../../apps/web/src/server/repositories/memory/matter-repository.ts";
import { memoryAuditEventWriter } from "@dsar/audit/memory/audit-event-writer";

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
  return `DSAR-FEE-CHOICE-${String(matterCounter).padStart(4, "0")}`;
}

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

interface HkAssessmentResult {
  matterId: string;
  assessmentId: string;
}

/** unitRate/quantity control the itemised total against HK's real
 * committed flatFee.amount (HK$100 = 10000 minor units) — the caller picks
 * these to land above or below that figure. */
async function buildHkAssessment(quantity: number, unitRate: number): Promise<HkAssessmentResult> {
  const matterResponse = await createMatterRoute(
    jsonRequest(MATTERS_URL, "POST", { ...HK_MATTER_INPUT, reference: nextReference() }, HR_COOKIE)
  );
  expect(matterResponse.status).toBe(201);
  const matter = (await matterResponse.json()) as { id: string };

  const lineResponse = await addLineRoute(
    jsonRequest(
      `${MATTERS_URL}/${matter.id}/lines`,
      "POST",
      {
        categoryCode: "STAFF_TIME_SEARCH",
        description: "Staff time locating and retrieving the requested data",
        quantity,
        unit: "HOUR",
        unitRate,
        incurredByGrade: null,
        isThirdPartyInvoiced: false,
        vendorName: null,
        evidenceRef: null,
        hrNote: null,
      },
      HR_COOKIE
    ),
    { params: Promise.resolve({ id: matter.id }) }
  );
  expect(lineResponse.status).toBe(201);

  const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}, HR_COOKIE), {
    params: Promise.resolve({ id: matter.id }),
  });
  expect(submitResponse.status).toBe(200);
  const assessment = (await submitResponse.json()) as { id: string; totals: { flatFeeComparison?: unknown } };
  // Guards this whole file's own premise: HK's real committed pack carries
  // a flatFee, so every fixture assessment built here has one to choose
  // between.
  expect(assessment.totals.flatFeeComparison).toBeDefined();
  return { matterId: matter.id, assessmentId: assessment.id };
}

describe("FEE-CHOICE: POST /api/assessments/{id}/fee-choice", () => {
  it("FEE-CHOICE: setFeeChoice('ITEMISED') succeeds unconditionally whenever a flatFeeComparison exists, and records a FEE_CHOICE_SET audit event", async () => {
    const { matterId, assessmentId } = await buildHkAssessment(4, 2000);

    const response = await feeChoiceRoute(
      jsonRequest(`${ASSESSMENTS_URL}/${assessmentId}/fee-choice`, "POST", { choice: "ITEMISED" }, LEGAL_COOKIE),
      { params: Promise.resolve({ id: assessmentId }) }
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { feeChoice: string };
    expect(body.feeChoice).toBe("ITEMISED");

    const stored = await memoryAssessmentRepository.getAssessment(assessmentId);
    expect(stored?.feeChoice).toBe("ITEMISED");

    const events = await memoryAuditEventWriter.listByMatter(matterId);
    const feeChoiceEvents = events.filter((event) => event.type === "FEE_CHOICE_SET");
    expect(feeChoiceEvents).toHaveLength(1);
    expect(feeChoiceEvents[0]?.payload.field).toBe("feeChoice");
    expect(feeChoiceEvents[0]?.payload.before).toBe("NONE");
    expect(feeChoiceEvents[0]?.payload.after).toBe("ITEMISED");
  });

  it("FEE-CHOICE: setFeeChoice('FLAT') succeeds when the flat fee does not exceed itemised direct cost", async () => {
    // 10 HOUR @ 2000 = 20000 claimed (STAFF_TIME_SEARCH, ALLOW), plus a
    // second, larger DISALLOW line (STAFF_TIME_REDACT_EXEMPT, 40000) so the
    // ALLOW line's own 33% share stays under the engine's 40% cross-line
    // materiality threshold — a single ALLOW line at 100% of the claim
    // would otherwise flip to FLAG (engineAmount 0), and DISALLOW lines are
    // never subject to the materiality check (packages/engine/src/
    // cross-line-checks.ts), so this padding line is inert either way.
    // draftBaseline ends up 20000, well above HK's real committed
    // flatFee.amount of 10000 — the flat fee does NOT exceed it.
    const matterResponse = await createMatterRoute(
      jsonRequest(MATTERS_URL, "POST", { ...HK_MATTER_INPUT, reference: nextReference() }, HR_COOKIE)
    );
    const matter = (await matterResponse.json()) as { id: string };
    await addLineRoute(
      jsonRequest(
        `${MATTERS_URL}/${matter.id}/lines`,
        "POST",
        {
          categoryCode: "STAFF_TIME_SEARCH",
          description: "Staff time locating and retrieving the requested data",
          quantity: 10,
          unit: "HOUR",
          unitRate: 2000,
          incurredByGrade: null,
          isThirdPartyInvoiced: false,
          vendorName: null,
          evidenceRef: null,
          hrNote: null,
        },
        HR_COOKIE
      ),
      { params: Promise.resolve({ id: matter.id }) }
    );
    await addLineRoute(
      jsonRequest(
        `${MATTERS_URL}/${matter.id}/lines`,
        "POST",
        {
          categoryCode: "STAFF_TIME_REDACT_EXEMPT",
          description: "Staff time severing exempt data",
          quantity: 1,
          unit: "HOUR",
          unitRate: 40000,
          incurredByGrade: null,
          isThirdPartyInvoiced: false,
          vendorName: null,
          evidenceRef: null,
          hrNote: null,
        },
        HR_COOKIE
      ),
      { params: Promise.resolve({ id: matter.id }) }
    );
    const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}, HR_COOKIE), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(submitResponse.status).toBe(200);
    const submitted = (await submitResponse.json()) as { id: string; totals: { draftBaseline: number; flatFeeComparison?: { flatFeeExceedsItemisedCost: boolean } } };
    expect(submitted.totals.draftBaseline).toBe(20000);
    expect(submitted.totals.flatFeeComparison?.flatFeeExceedsItemisedCost).toBe(false);
    const assessmentId = submitted.id;

    const response = await feeChoiceRoute(
      jsonRequest(`${ASSESSMENTS_URL}/${assessmentId}/fee-choice`, "POST", { choice: "FLAT" }, LEGAL_COOKIE),
      { params: Promise.resolve({ id: assessmentId }) }
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { feeChoice: string; totals: { flatFeeComparison: { flatFeeExceedsItemisedCost: boolean } } };
    expect(body.totals.flatFeeComparison.flatFeeExceedsItemisedCost).toBe(false);
    expect(body.feeChoice).toBe("FLAT");
  });

  it("FEE-CHOICE: setFeeChoice('FLAT') is refused with a ValidationError when the flat fee exceeds itemised direct cost", async () => {
    // 1 HOUR @ 1000 = 1000 claimed, ALLOW -> draftBaseline 1000, well BELOW
    // HK's real committed flatFee.amount of 10000 -> flatFeeExceedsItemisedCost true.
    const { assessmentId } = await buildHkAssessment(1, 1000);

    const response = await feeChoiceRoute(
      jsonRequest(`${ASSESSMENTS_URL}/${assessmentId}/fee-choice`, "POST", { choice: "FLAT" }, LEGAL_COOKIE),
      { params: Promise.resolve({ id: assessmentId }) }
    );
    expect(response.status).toBe(400);

    const stored = await memoryAssessmentRepository.getAssessment(assessmentId);
    expect(stored?.feeChoice).toBeUndefined();
  });

  it("FEE-CHOICE: refused with 400 when the assessment's pack has no flatFeeComparison (SG has no flatFee)", async () => {
    const matterResponse = await createMatterRoute(
      jsonRequest(
        MATTERS_URL,
        "POST",
        {
          reference: nextReference(),
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
        },
        HR_COOKIE
      )
    );
    const matter = (await matterResponse.json()) as { id: string };
    await addLineRoute(
      jsonRequest(
        `${MATTERS_URL}/${matter.id}/lines`,
        "POST",
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
        HR_COOKIE
      ),
      { params: Promise.resolve({ id: matter.id }) }
    );
    const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}, HR_COOKIE), {
      params: Promise.resolve({ id: matter.id }),
    });
    const assessment = (await submitResponse.json()) as { id: string; totals: { flatFeeComparison?: unknown } };
    expect(assessment.totals.flatFeeComparison).toBeUndefined();

    const response = await feeChoiceRoute(
      jsonRequest(`${ASSESSMENTS_URL}/${assessment.id}/fee-choice`, "POST", { choice: "ITEMISED" }, LEGAL_COOKIE),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(400);
  });

  it("FEE-CHOICE: refused with 409 when the matter is not in LEGAL_REVIEW, reusing requireAssessmentInLegalReview", async () => {
    const { matterId, assessmentId } = await buildHkAssessment(4, 2000);
    const matter = await memoryMatterRepository.getMatter(matterId);
    if (!matter) throw new Error("fixture matter not found");
    await memoryMatterRepository.updateMatter({ ...matter, status: "INFO_REQUEST" });

    const response = await feeChoiceRoute(
      jsonRequest(`${ASSESSMENTS_URL}/${assessmentId}/fee-choice`, "POST", { choice: "ITEMISED" }, LEGAL_COOKIE),
      { params: Promise.resolve({ id: assessmentId }) }
    );
    expect(response.status).toBe(409);
  });

  it("FEE-CHOICE: an HR_PREPARER is refused with 403 and writes nothing", async () => {
    const { assessmentId } = await buildHkAssessment(4, 2000);

    const response = await feeChoiceRoute(
      jsonRequest(`${ASSESSMENTS_URL}/${assessmentId}/fee-choice`, "POST", { choice: "ITEMISED" }, HR_COOKIE),
      { params: Promise.resolve({ id: assessmentId }) }
    );
    expect(response.status).toBe(403);

    const stored = await memoryAssessmentRepository.getAssessment(assessmentId);
    expect(stored?.feeChoice).toBeUndefined();
  });

  // CR-01 regression: a FLAT choice must actually change finalAmount, not
  // just be recorded and ignored. Before the fix, signOff() summed the
  // itemised lines unconditionally and the lawyer's FLAT choice had zero
  // effect on the figure that reaches HR.
  it("FEE-CHOICE (CR-01): finalAmount reflects a signed-off FLAT choice, not the itemised sum", async () => {
    // Same padded-fixture shape as the "does not exceed itemised direct
    // cost" test above: draftBaseline 20000, HK's real flatFee.amount
    // 10000 — the two figures must differ for this regression to be
    // meaningful (a bug that returns either total unconditionally would
    // otherwise pass by coincidence).
    const matterResponse = await createMatterRoute(
      jsonRequest(MATTERS_URL, "POST", { ...HK_MATTER_INPUT, reference: nextReference() }, HR_COOKIE)
    );
    const matter = (await matterResponse.json()) as { id: string };
    const allowLineResponse = await addLineRoute(
      jsonRequest(
        `${MATTERS_URL}/${matter.id}/lines`,
        "POST",
        {
          categoryCode: "STAFF_TIME_SEARCH",
          description: "Staff time locating and retrieving the requested data",
          quantity: 10,
          unit: "HOUR",
          unitRate: 2000,
          incurredByGrade: null,
          isThirdPartyInvoiced: false,
          vendorName: null,
          evidenceRef: null,
          hrNote: null,
        },
        HR_COOKIE
      ),
      { params: Promise.resolve({ id: matter.id }) }
    );
    expect(allowLineResponse.status).toBe(201);
    await addLineRoute(
      jsonRequest(
        `${MATTERS_URL}/${matter.id}/lines`,
        "POST",
        {
          categoryCode: "STAFF_TIME_REDACT_EXEMPT",
          description: "Staff time severing exempt data",
          quantity: 1,
          unit: "HOUR",
          unitRate: 40000,
          incurredByGrade: null,
          isThirdPartyInvoiced: false,
          vendorName: null,
          evidenceRef: null,
          hrNote: null,
        },
        HR_COOKIE
      ),
      { params: Promise.resolve({ id: matter.id }) }
    );
    const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}, HR_COOKIE), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(submitResponse.status).toBe(200);
    const submitted = (await submitResponse.json()) as {
      id: string;
      lines: { id: string; verdict: string }[];
      totals: { draftBaseline: number; flatFeeComparison?: { flatFeeAmount: number; flatFeeExceedsItemisedCost: boolean } };
    };
    expect(submitted.totals.draftBaseline).toBe(20000);
    expect(submitted.totals.flatFeeComparison?.flatFeeAmount).toBe(10000);
    expect(submitted.totals.flatFeeComparison?.flatFeeExceedsItemisedCost).toBe(false);
    const assessmentId = submitted.id;

    const goodReason = "Sighted the supporting evidence separately and it checks out.";
    for (const line of submitted.lines) {
      const dispositionResponse = await dispositionRoute(
        jsonRequest(
          `http://localhost/api/assessment-lines/${line.id}/disposition`,
          "POST",
          { action: "ACCEPT", reason: goodReason },
          LEGAL_COOKIE
        ),
        { params: Promise.resolve({ id: line.id }) }
      );
      expect(dispositionResponse.status).toBe(200);
    }

    const feeChoiceResponse = await feeChoiceRoute(
      jsonRequest(`${ASSESSMENTS_URL}/${assessmentId}/fee-choice`, "POST", { choice: "FLAT" }, LEGAL_COOKIE),
      { params: Promise.resolve({ id: assessmentId }) }
    );
    expect(feeChoiceResponse.status).toBe(200);

    const signOffResponse = await signoffRoute(
      jsonRequest(
        `${ASSESSMENTS_URL}/${assessmentId}/signoff`,
        "POST",
        {
          qualification: "Solicitor, Hong Kong",
          acknowledgedFlags: [],
          attestation: true,
        },
        LEGAL_COOKIE
      ),
      { params: Promise.resolve({ id: assessmentId }) }
    );
    expect(signOffResponse.status).toBe(200);
    const signedOff = (await signOffResponse.json()) as {
      assessment: { totals: { finalAmount: number }; signOff: { finalAmount: number } };
    };

    // The bug: finalAmount would be 20000 (the itemised sum) here, silently
    // ignoring the FLAT choice. The fix: it must be the flat fee, 10000.
    expect(signedOff.assessment.totals.finalAmount).toBe(10000);
    expect(signedOff.assessment.signOff.finalAmount).toBe(10000);

    const stored = await memoryAssessmentRepository.getAssessment(assessmentId);
    expect(stored?.totals.finalAmount).toBe(10000);
    expect(stored?.signOff?.finalAmount).toBe(10000);
  });
});
