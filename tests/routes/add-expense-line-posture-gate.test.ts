// tests/routes/add-expense-line-posture-gate.test.ts
//
// Regression test for the 05-REVIEW-ADDENDUM.md security finding (low
// severity): apps/web/src/ui/intake/matter-details-fields.tsx's
// canOfferExpenseEntry predicate — the gate deciding whether HR is even
// offered the expense-line repeater for a matter's jurisdiction/controller-
// type combination — was enforced client-side only. A direct POST to
// /api/matters/[id]/lines, bypassing the UI entirely, could still add a
// cost line to a matter whose jurisdiction has no usable rule pack, a STALE
// pack, or a heads-up posture (NO_EXPRESS_AUTHORITY/PROHIBITED).
//
// This file proves the real HTTP route handler now refuses that direct
// bypass the same way the UI already prevented it, mirroring hr-result.
// test.ts's route-handler-as-plain-function invocation style (no server
// needs to be running).
//
// SG-PDPA's own committed pack (packages/rulepacks/SG-PDPA/2026.09.1.json)
// gives PRIVATE_ORGANISATION a PERMITTED_REASONABLE posture (usable) and
// PUBLIC_AGENCY a NO_EXPRESS_AUTHORITY posture (blocking) — no hand-built
// fixture needed to exercise the real gate end-to-end.

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { DEMO_ROLE_COOKIE } from "../../apps/web/src/server/data/auth.ts";

const MATTERS_URL = "http://localhost/api/matters";
const HR_COOKIE = `${DEMO_ROLE_COOKIE}=HR_PREPARER`;

function jsonRequest(url: string, method: string, body: unknown, cookie: string = HR_COOKIE): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

const VALID_MATTER_INPUT_BASE = {
  jurisdictionCode: "SG",
  legalEntity: "Acme Pte Ltd",
  requestReceivedOn: "2026-09-01",
  requestorClass: "FORMER_EMPLOYEE",
  currency: "SGD",
  identityVerified: true,
  identityVerifiedNote: null,
  scopeClarified: true,
  isRepeatRequestWithin12Months: false,
  isKnownDisputeOrLitigation: false,
};

const ONE_LINE_INPUT = {
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
};

let matterCounter = 0;
function nextReference(): string {
  matterCounter += 1;
  return `DSAR-POSTURE-GATE-${String(matterCounter).padStart(4, "0")}`;
}

async function createMatter(controllerType: "PRIVATE_ORGANISATION" | "PUBLIC_AGENCY"): Promise<{ id: string }> {
  const response = await createMatterRoute(
    jsonRequest(MATTERS_URL, "POST", { ...VALID_MATTER_INPUT_BASE, controllerType, reference: nextReference() }, HR_COOKIE)
  );
  expect(response.status).toBe(201);
  return (await response.json()) as { id: string };
}

describe("ADD-EXPENSE-LINE-POSTURE-GATE: a direct API call cannot add a cost line where the UI's own gate would refuse", () => {
  it("ADD-EXPENSE-LINE-POSTURE-GATE: refuses a line on a PUBLIC_AGENCY matter in SG — NO_EXPRESS_AUTHORITY is a blocking posture", async () => {
    const matter = await createMatter("PUBLIC_AGENCY");

    const response = await addLineRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/lines`, "POST", ONE_LINE_INPUT, HR_COOKIE), {
      params: Promise.resolve({ id: matter.id }),
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/does not currently permit charging a fee/);
  });

  it("ADD-EXPENSE-LINE-POSTURE-GATE: allows a line on the same jurisdiction for a permitted controller type (PRIVATE_ORGANISATION), proving the gate discriminates rather than blocking everything", async () => {
    const matter = await createMatter("PRIVATE_ORGANISATION");

    const response = await addLineRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/lines`, "POST", ONE_LINE_INPUT, HR_COOKIE), {
      params: Promise.resolve({ id: matter.id }),
    });

    expect(response.status).toBe(201);
  });
});
