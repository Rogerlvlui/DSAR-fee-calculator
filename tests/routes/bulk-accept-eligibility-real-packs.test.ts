// tests/routes/bulk-accept-eligibility-real-packs.test.ts
//
// Tagged BULK-ACCEPT-REAL-PACKS. Corrects 06-RESEARCH.md's own imprecise
// claim that the HK pack could demonstrate a REVIEW-07 bulk-accept
// positive-path case: HK's one VERIFIED rule (STAFF_TIME_LEGAL_REVIEW)
// carries DISALLOW treatment, so it can never produce an ALLOW verdict and
// can never enter listBulkAcceptableLineIds's eligible set, regardless of
// its verification status. Both real committed packs are empty, but for
// two DIFFERENT, separately-verified reasons — this test documents each
// one explicitly rather than conflating them.

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { DEMO_ROLE_COOKIE } from "../../apps/web/src/server/data/auth.ts";
import { listBulkAcceptableLineIds } from "../../apps/web/src/server/data/assessments.ts";
import { memoryAssessmentRepository } from "../../apps/web/src/server/repositories/memory/assessment-repository.ts";

const MATTERS_URL = "http://localhost/api/matters";
const HR_COOKIE = `${DEMO_ROLE_COOKIE}=HR_PREPARER`;

function jsonRequest(url: string, method: string, body: unknown, cookie?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  return new Request(url, { method, headers, body: JSON.stringify(body) });
}

let matterCounter = 0;
function nextReference(): string {
  matterCounter += 1;
  return `DSAR-BULK-REAL-${String(matterCounter).padStart(4, "0")}`;
}

async function buildAssessmentId(
  matterInput: Record<string, unknown>,
  lineInputs: Record<string, unknown>[]
): Promise<string> {
  const matterResponse = await createMatterRoute(
    jsonRequest(MATTERS_URL, "POST", { ...matterInput, reference: nextReference() }, HR_COOKIE)
  );
  expect(matterResponse.status).toBe(201);
  const matter = (await matterResponse.json()) as { id: string };

  for (const lineInput of lineInputs) {
    const lineResponse = await addLineRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/lines`, "POST", lineInput, HR_COOKIE), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(lineResponse.status).toBe(201);
  }

  const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}, HR_COOKIE), {
    params: Promise.resolve({ id: matter.id }),
  });
  expect(submitResponse.status).toBe(200);
  const submitted = (await submitResponse.json()) as { id: string };
  return submitted.id;
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

// STAFF_TIME_LEGAL_REVIEW is HK-PDPO's own one VERIFIED rule — deliberately
// chosen so this fixture directly exercises the exact rule this file's own
// header comment names. A single DISALLOW line never trips the engine's
// cross-line materiality check (DISALLOW lines are excluded from it), so no
// padding line is needed here the way SG's ALLOW line below needs one.
const HK_LINE_INPUTS = [
  {
    categoryCode: "STAFF_TIME_LEGAL_REVIEW",
    description: "Time spent obtaining advice from counsel",
    quantity: 1,
    unit: "HOUR",
    unitRate: 3000,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
];

const SG_MATTER_INPUT = {
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

// A second, larger DISALLOW line (STAFF_TIME_ASSESS_EXEMPTIONS) pads the
// claimed total so the ALLOW line's own 34.8% share stays under the
// engine's 40% cross-line materiality threshold — otherwise a single ALLOW
// line at 100% of the claim would flip to FLAG (engineAmount 0), making
// this test's own "the line IS ALLOW" premise false. DISALLOW lines are
// never subject to the materiality check, so this padding line is inert
// either way (same technique 06-07's fee-choice.test.ts already uses).
const SG_LINE_INPUTS = [
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
  {
    categoryCode: "STAFF_TIME_ASSESS_EXEMPTIONS",
    description: "Staff time deciding which items may be withheld under an exemption",
    quantity: 1,
    unit: "HOUR",
    unitRate: 15000,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
];

describe("BULK-ACCEPT-REAL-PACKS", () => {
  it("BULK-ACCEPT-REAL-PACKS: HK's real pack — STAFF_TIME_LEGAL_REVIEW is VERIFIED but DISALLOW, so it can never produce an ALLOW verdict and never enters the eligible set", async () => {
    const assessmentId = await buildAssessmentId(HK_MATTER_INPUT, HK_LINE_INPUTS);
    const assessment = await memoryAssessmentRepository.getAssessment(assessmentId);
    if (!assessment) throw new Error("fixture assessment not found");

    // Sanity check on this test's own premise: the line really is DISALLOW,
    // not accidentally ALLOW (which would make the eligibility-empty result
    // meaningless).
    expect(assessment.lines[0]?.verdict).toBe("DISALLOW");

    // No pack override — the real, uncoerced, jurisdiction-resolved pack
    // (resolvePinnedRulePack's own default), per Plan 06-01.
    const eligible = listBulkAcceptableLineIds(assessment);
    expect(eligible).toEqual([]);
  });

  it("BULK-ACCEPT-REAL-PACKS: SG's real pack has zero VERIFIED category rules at all, so the eligible set is empty for a different, independent reason", async () => {
    const assessmentId = await buildAssessmentId(SG_MATTER_INPUT, SG_LINE_INPUTS);
    const assessment = await memoryAssessmentRepository.getAssessment(assessmentId);
    if (!assessment) throw new Error("fixture assessment not found");

    // Sanity check on this test's own premise: the line IS ALLOW (SG's
    // STAFF_TIME_SEARCH rule) — if eligibility were gated ONLY on verdict,
    // this line would qualify; it is excluded purely by verificationStatus.
    expect(assessment.lines[0]?.verdict).toBe("ALLOW");

    const eligible = listBulkAcceptableLineIds(assessment);
    expect(eligible).toEqual([]);
  });
});
