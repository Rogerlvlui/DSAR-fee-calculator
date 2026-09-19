// tests/routes/audit-trail.test.ts
//
// Route-level tests proving every remaining Phase 3.1 status-literal call
// site now leaves a provenance-complete audit record behind, tagged
// AUDIT-TRAIL. Drives the real route handlers with real Request objects
// over the real committed SG-PDPA pack, the same technique
// tests/routes/workflow-tracer.test.ts established. Every count assertion
// here counts records of a NAMED event type, never a matter's total record
// count, per 04-04-PLAN.md's own instruction — a later plan in this phase
// adding a further event type must not break an assertion that was never
// about it.

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { memoryMatterRepository } from "../../apps/web/src/server/repositories/memory/matter-repository.ts";
import { memoryAssessmentRepository } from "../../apps/web/src/server/repositories/memory/assessment-repository.ts";
import { memoryAuditEventWriter } from "@dsar/audit/memory/audit-event-writer";
import { ENGINE_VERSION } from "@dsar/engine";

const MATTERS_URL = "http://localhost/api/matters";

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

let matterCounter = 0;
function nextReference(): string {
  matterCounter += 1;
  return `DSAR-AUDITTRAIL-${String(matterCounter).padStart(4, "0")}`;
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

async function createMatterWithOneLine(overrides: Partial<typeof VALID_MATTER_INPUT_BASE> = {}): Promise<{ id: string }> {
  const matterResponse = await createMatterRoute(
    jsonRequest(MATTERS_URL, "POST", { ...VALID_MATTER_INPUT_BASE, ...overrides, reference: nextReference() })
  );
  const matter = (await matterResponse.json()) as { id: string };

  const lineResponse = await addLineRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/lines`, "POST", ONE_LINE_INPUT), {
    params: Promise.resolve({ id: matter.id }),
  });
  expect(lineResponse.status).toBe(201);

  return matter;
}

function eventsOfType(events: Awaited<ReturnType<typeof memoryAuditEventWriter.listByMatter>>, type: string) {
  return events.filter((event) => event.type === type);
}

describe("AUDIT-TRAIL", () => {
  it("AUDIT-TRAIL: a successful submission leaves exactly one SUBMITTED and one COMPUTED record, each carrying full provenance", async () => {
    const matter = await createMatterWithOneLine();

    const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(submitResponse.status).toBe(200);

    const events = await memoryAuditEventWriter.listByMatter(matter.id);
    const submitted = eventsOfType(events, "SUBMITTED");
    const computed = eventsOfType(events, "COMPUTED");
    expect(submitted).toHaveLength(1);
    expect(computed).toHaveLength(1);

    for (const event of [submitted[0]!, computed[0]!]) {
      expect(event.matterId).toBe(matter.id);
      expect(event.actor.id).toEqual(expect.any(String));
      expect(event.actorRole).toBe("HR_PREPARER");
      expect(event.at).toEqual(expect.any(String));
      expect(event.rulePackVersion).toBe("2026.09.1");
      expect(event.engineVersion).toBe(ENGINE_VERSION);
    }
    expect(submitted[0]!.payload.before).toBe("DRAFT");
    expect(submitted[0]!.payload.after).toBe("COMPUTING");
    expect(computed[0]!.payload.before).toBe("COMPUTING");
    expect(computed[0]!.payload.after).toBe("LEGAL_REVIEW");
  });

  it("AUDIT-TRAIL: when the engine throws, the matter lands back in draft, a COMPUTE_FAILED record carries the reason, and no assessment is stored", async () => {
    // PUBLIC_AGENCY is not in the committed SG-PDPA pack's appliesTo list —
    // the SUBMIT guard does not check controllerType (only the engine's own
    // precondition does), so this passes the guard and fails inside
    // assessMatter() itself, exercising the real rollback path.
    const matter = await createMatterWithOneLine({ controllerType: "PUBLIC_AGENCY" });

    const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(submitResponse.status).toBe(500);

    const storedMatter = await memoryMatterRepository.getMatter(matter.id);
    expect(storedMatter?.status).toBe("DRAFT");

    const storedAssessment = await memoryAssessmentRepository.getAssessmentByMatterId(matter.id);
    expect(storedAssessment).toBeNull();

    const events = await memoryAuditEventWriter.listByMatter(matter.id);
    const failed = eventsOfType(events, "COMPUTE_FAILED");
    expect(failed).toHaveLength(1);
    expect(failed[0]!.payload.before).toBe("COMPUTING");
    expect(typeof failed[0]!.payload.after).toBe("string");
    expect((failed[0]!.payload.after as string).length).toBeGreaterThan(0);
  });
});
