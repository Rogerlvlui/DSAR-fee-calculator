// tests/routes/intake.test.ts
//
// Route-level tests for the HR intake screen's server side, tagged INTAKE.
// Drives the real route handlers with real Request objects, the same
// technique tests/routes/demo-pipeline.test.ts already uses (03.1-01).

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import {
  POST as addLineRoute,
  PUT as replaceLineRoute,
} from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { memoryMatterRepository } from "../../apps/web/src/server/repositories/memory/matter-repository.ts";

const BASE_URL = "http://localhost/api/matters";

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_MATTER_INPUT = {
  reference: "DSAR-INTAKE-0001",
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

const VALID_LINE_INPUT = {
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

// A second, DISALLOW-verdict line so the first sits under the engine's 40%
// cross-line materiality threshold — same technique as demo-pipeline.test.ts
// (03.1-01), needed here only so submit() succeeds cleanly.
const SECOND_LINE_INPUT = {
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
};

async function createDemoMatter(): Promise<{ id: string }> {
  const response = await createMatterRoute(jsonRequest(BASE_URL, "POST", VALID_MATTER_INPUT));
  return (await response.json()) as { id: string };
}

describe("INTAKE — HR intake screen's server side", () => {
  it("INTAKE: a line edited after submit is refused with a conflict status and the stored line is unchanged", async () => {
    const matter = await createDemoMatter();

    const lineResponse = await addLineRoute(jsonRequest(`${BASE_URL}/${matter.id}/lines`, "POST", VALID_LINE_INPUT), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(lineResponse.status).toBe(201);
    const line = (await lineResponse.json()) as { id: string };

    await addLineRoute(jsonRequest(`${BASE_URL}/${matter.id}/lines`, "POST", SECOND_LINE_INPUT), {
      params: Promise.resolve({ id: matter.id }),
    });

    const submitResponse = await submitRoute(jsonRequest(`${BASE_URL}/${matter.id}/submit`, "POST", {}), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(submitResponse.status).toBe(200);

    const editResponse = await replaceLineRoute(
      jsonRequest(`${BASE_URL}/${matter.id}/lines`, "PUT", {
        lineId: line.id,
        ...VALID_LINE_INPUT,
        quantity: 999,
        unitRate: 999999,
      }),
      { params: Promise.resolve({ id: matter.id }) }
    );
    expect(editResponse.status).toBe(409);

    const storedLines = await memoryMatterRepository.listExpenseLines(matter.id);
    const storedLine = storedLines.find((candidate) => candidate.id === line.id);
    expect(storedLine?.quantity).toBe(VALID_LINE_INPUT.quantity);
    expect(storedLine?.unitRate).toBe(VALID_LINE_INPUT.unitRate);
    expect(storedLine?.claimedAmount).toBe(VALID_LINE_INPUT.quantity * VALID_LINE_INPUT.unitRate);
  });

  it("INTAKE: a line whose claimed amount disagrees with quantity times rate is rejected with 400 by the frozen schema rather than stored", async () => {
    const matter = await createDemoMatter();

    const response = await addLineRoute(
      jsonRequest(`${BASE_URL}/${matter.id}/lines`, "POST", {
        ...VALID_LINE_INPUT,
        claimedAmount: 999999,
      }),
      { params: Promise.resolve({ id: matter.id }) }
    );
    expect(response.status).toBe(400);

    const storedLines = await memoryMatterRepository.listExpenseLines(matter.id);
    expect(storedLines).toHaveLength(0);
  });

  it("INTAKE: a matter whose currency does not match its jurisdiction's designated currency is rejected with 400", async () => {
    const response = await createMatterRoute(
      jsonRequest(BASE_URL, "POST", { ...VALID_MATTER_INPUT, jurisdictionCode: "SG", currency: "HKD" })
    );
    expect(response.status).toBe(400);

    // MatterSchema.parse() throws before createMatter() ever calls the
    // repository — there is no matter id to look up, so the "nothing
    // stored" half of this assertion is the body itself naming the
    // currency/jurisdiction mismatch as a validation issue, not a generic
    // 400.
    const body = (await response.json()) as { issues?: { path: string[] }[] };
    expect(body.issues?.some((issue) => issue.path.includes("currency"))).toBe(true);
  });
});
