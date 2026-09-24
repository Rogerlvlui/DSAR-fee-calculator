// tests/routes/add-expense-line-other-description.test.ts
//
// A "Something else" (OTHER_UNCLASSIFIED) line is always sent to Legal, and
// HR's description is all Legal has to classify it from. The intake form
// refuses a description under 10 non-whitespace characters; this proves the
// real route handler refuses the same thing when the UI is bypassed.

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { DEMO_ROLE_COOKIE } from "../../apps/web/src/server/data/auth.ts";

const MATTERS_URL = "http://localhost/api/matters";
const HR_COOKIE = `${DEMO_ROLE_COOKIE}=HR_PREPARER`;

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: HR_COOKIE },
    body: JSON.stringify(body),
  });
}

let matterCounter = 0;
async function createMatter(): Promise<{ id: string }> {
  matterCounter += 1;
  const response = await createMatterRoute(
    jsonRequest(MATTERS_URL, {
      reference: `DSAR-OTHER-DESC-${String(matterCounter).padStart(4, "0")}`,
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
    })
  );
  expect(response.status).toBe(201);
  return (await response.json()) as { id: string };
}

function otherLine(description: string) {
  return {
    categoryCode: "OTHER_UNCLASSIFIED",
    description,
    quantity: 1,
    unit: "FIXED",
    unitRate: 4500,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  };
}

async function postLine(matterId: string, body: unknown): Promise<Response> {
  return addLineRoute(jsonRequest(`${MATTERS_URL}/${matterId}/lines`, body), {
    params: Promise.resolve({ id: matterId }),
  });
}

describe("ADD-EXPENSE-LINE-OTHER-DESCRIPTION: a 'Something else' line must be described", () => {
  it("ADD-EXPENSE-LINE-OTHER-DESCRIPTION: refuses a blank or too-short description with 400", async () => {
    const matter = await createMatter();
    for (const description of ["", "misc", "  a b c  "]) {
      const response = await postLine(matter.id, otherLine(description));
      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toMatch(/Something else/);
    }
  });

  it("ADD-EXPENSE-LINE-OTHER-DESCRIPTION: accepts a description of 10+ non-whitespace characters", async () => {
    const matter = await createMatter();
    const response = await postLine(matter.id, otherLine("Archive retrieval fee for off-site records"));
    expect(response.status).toBe(201);
  });
});
