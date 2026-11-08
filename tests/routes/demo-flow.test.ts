// tests/routes/demo-flow.test.ts
//
// Pins every figure docs/DEMO-WALKTHROUGH.md's presenter flow quotes: the six
// example rows, with the vendor line's invoice ticked and reference entered,
// plus one hand-typed "Something else" line — driven over the real HTTP
// routes, real engine and the committed SG-PDPA pack. If a pack or engine
// change moves any of these numbers, this fails and the walkthrough must be
// updated with it.

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { POST as dispositionRoute } from "../../apps/web/app/api/assessment-lines/[id]/disposition/route.ts";
import { POST as signoffRoute } from "../../apps/web/app/api/assessments/[id]/signoff/route.ts";
import { DEMO_ROLE_COOKIE } from "../../apps/web/src/server/data/auth.ts";
import type { AddExpenseLineInput } from "../../apps/web/src/server/data/matters.ts";
import {
  REFERENCE_MATTER_INPUT,
  REFERENCE_FIXTURE_LINE_INPUTS,
} from "../../apps/web/src/server/__fixtures__/reference-fixture.ts";

const MATTERS_URL = "http://localhost/api/matters";
const HR_COOKIE = `${DEMO_ROLE_COOKIE}=HR_PREPARER`;
const LEGAL_COOKIE = `${DEMO_ROLE_COOKIE}=LEGAL_REVIEWER`;

function jsonRequest(url: string, body: unknown, cookie: string): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

const DEMO_LINES: AddExpenseLineInput[] = [
  ...REFERENCE_FIXTURE_LINE_INPUTS.map((line, index) =>
    index === 4
      ? { ...line, isThirdPartyInvoiced: true, vendorName: "Payroll Archive Services Pte Ltd", evidenceRef: "INV-2026-0417" }
      : line
  ),
  {
    categoryCode: "OTHER_UNCLASSIFIED",
    description: "Locksmith fee to open a locked filing cabinet holding the requested records",
    quantity: 1,
    unit: "FIXED",
    unitRate: 6000,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
];

interface DemoAssessment {
  id: string;
  totals: {
    claimedTotal: number;
    draftBaseline: number;
    disallowedTotal: number;
    flaggedTotal: number;
    finalAmount: number | null;
  };
  lines: { id: string; verdict: string; engineAmount: number; flagReasons: { code: string }[] }[];
}

let counter = 0;
async function submitDemoClaim(): Promise<DemoAssessment> {
  counter += 1;
  const matterResponse = await createMatterRoute(
    jsonRequest(
      MATTERS_URL,
      { ...REFERENCE_MATTER_INPUT, reference: `DSAR-DEMO-FLOW-${counter}`, isKnownDisputeOrLitigation: false },
      HR_COOKIE
    )
  );
  expect(matterResponse.status).toBe(201);
  const matter = (await matterResponse.json()) as { id: string };
  for (const line of DEMO_LINES) {
    const response = await addLineRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/lines`, line, HR_COOKIE), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(response.status).toBe(201);
  }
  const submit = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, {}, HR_COOKIE), {
    params: Promise.resolve({ id: matter.id }),
  });
  expect(submit.status).toBe(200);
  return (await submit.json()) as DemoAssessment;
}

async function disposition(lineId: string, body: Record<string, unknown>): Promise<Response> {
  return dispositionRoute(
    jsonRequest(`http://localhost/api/assessment-lines/${lineId}/disposition`, body, LEGAL_COOKIE),
    { params: Promise.resolve({ id: lineId }) }
  );
}

describe("DEMO-FLOW: the presenter flow in docs/DEMO-WALKTHROUGH.md", () => {
  it("DEMO-FLOW: before any decision — 948.00 claimed, 266.40 supported, 126.60 not supported, 555.00 across 3 flagged lines", async () => {
    const assessment = await submitDemoClaim();

    expect(assessment.totals).toMatchObject({
      claimedTotal: 94800,
      draftBaseline: 26640,
      disallowedTotal: 12660,
      flaggedTotal: 55500,
      finalAmount: null,
    });
    expect(assessment.lines.map((line) => line.verdict)).toEqual([
      "ALLOW",
      "ALLOW",
      "DISALLOW",
      "ALLOW_CAPPED",
      "FLAG",
      "FLAG",
      "FLAG",
    ]);
    // Invoice ticked and referenced: the vendor line's only remaining reason is materiality.
    expect(assessment.lines[4]!.flagReasons.map((reason) => reason.code)).toEqual(["MATERIALITY"]);
  });

  it("DEMO-FLOW: four reasonless Accepts, vendor allowed at 450.00, example 'Something else' struck, locksmith rejected (struck) — final fee 716.40", async () => {
    const assessment = await submitDemoClaim();
    const [line1, line2, line3, line4, vendor, exampleOther, locksmith] = assessment.lines;
    const reason = "Invoice and reference sighted; amount is consistent with the request.";

    for (const line of [line1!, line2!, line3!, line4!]) {
      expect((await disposition(line.id, { action: "ACCEPT" })).status).toBe(200);
    }
    expect((await disposition(vendor!.id, { action: "ALLOW_WITH_AMOUNT", amountMinor: 45000, reason })).status).toBe(200);
    expect(
      (await disposition(exampleOther!.id, { action: "STRIKE", reason: "No description of what this cost actually was." }))
        .status
    ).toBe(200);
    expect(
      (await disposition(locksmith!.id, { action: "STRIKE", reason: "Not a chargeable cost of responding to this request, because company, rather than requestor, should be responsible for fixing deficiency in its storage equipment." }))
        .status
    ).toBe(200);

    const signoff = await signoffRoute(
      jsonRequest(
        `http://localhost/api/assessments/${assessment.id}/signoff`,
        { qualification: "Advocate & Solicitor, Singapore", acknowledgedFlags: [], attestation: true },
        LEGAL_COOKIE
      ),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(signoff.status).toBe(200);
    const body = (await signoff.json()) as { assessment: { totals: { finalAmount: number } } };
    // 16000 + 8000 + 0 + 2640 + 45000 + 0 + 0 (locksmith struck)
    expect(body.assessment.totals.finalAmount).toBe(71640);
  });
});
