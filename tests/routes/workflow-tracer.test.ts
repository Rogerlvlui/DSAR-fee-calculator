// tests/routes/workflow-tracer.test.ts
//
// The Phase 4 tracer's proof (04-01-PLAN.md Task 1): drives the real
// create/add-line/submit route handlers with real Request objects over the
// real committed SG-PDPA pack, then reads the audit store through the
// writer's own list method to assert exactly one record exists for the
// matter with every provenance field populated, and that the matter's
// stored status is the executor's own returned destination — not a value
// the calling function chose. Every test name is tagged WORKFLOW-TRACER.

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { memoryMatterRepository } from "../../apps/web/src/server/repositories/memory/matter-repository.ts";
import { memoryAuditEventWriter } from "@dsar/audit/memory/audit-event-writer";
import { ENGINE_VERSION } from "@dsar/engine";

const BASE_URL = "http://localhost/api/matters";

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validMatterInput(reference: string) {
  return {
    reference,
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
}

async function createDemoMatter(reference: string): Promise<{ id: string }> {
  const response = await createMatterRoute(jsonRequest(BASE_URL, validMatterInput(reference)));
  return (await response.json()) as { id: string };
}

describe("WORKFLOW-TRACER — one guarded, audited transition end to end", () => {
  it("WORKFLOW-TRACER: a permitted submission writes the executor's own destination and exactly one provenance-complete audit record", async () => {
    const matter = await createDemoMatter("DSAR-WORKFLOW-TRACER-0001");

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

    const submitResponse = await submitRoute(jsonRequest(`${BASE_URL}/${matter.id}/submit`, {}), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(submitResponse.status).toBe(200);

    // The route's own pipeline continues past the guarded SUBMIT edge (this
    // plan's one converted edge) into the untouched COMPUTING -> LEGAL_REVIEW
    // edge once assessMatter succeeds — asserted here, separately from the
    // audit record's before/after pair below, so this test proves BOTH that
    // the transition happened (the matter's final status) AND what the
    // guarded executor itself returned for the one edge this plan converted
    // (the audit record's payload).
    const storedMatter = await memoryMatterRepository.getMatter(matter.id);
    expect(storedMatter?.status).toBe("LEGAL_REVIEW");

    const events = await memoryAuditEventWriter.listByMatter(matter.id);
    expect(events).toHaveLength(1);

    const event = events[0];
    if (!event) throw new Error("expected exactly one audit event");
    expect(event.type).toBe("SUBMITTED");
    expect(event.matterId).toBe(matter.id);
    expect(event.actor.id).toEqual(expect.any(String));
    expect(event.actorRole).toBe("HR_PREPARER");
    expect(event.at).toEqual(expect.any(String));
    expect(event.payload.before).toBe("DRAFT");
    expect(event.payload.after).toBe("COMPUTING");
    expect(event.rulePackVersion).toBe("2026.09.1");
    expect(event.engineVersion).toBe(ENGINE_VERSION);
  });

  it("WORKFLOW-TRACER: a matter with no expense lines is refused, leaves the matter in DRAFT, and writes no audit record", async () => {
    const matter = await createDemoMatter("DSAR-WORKFLOW-TRACER-0002");

    const submitResponse = await submitRoute(jsonRequest(`${BASE_URL}/${matter.id}/submit`, {}), {
      params: Promise.resolve({ id: matter.id }),
    });

    // This refusal fires from the pre-existing 03.1 business-rule check
    // (matters.ts's own module note explains why that check, not the
    // guard, is what a zero-line submission hits through this real route);
    // the guard's identical condition is proven directly and separately in
    // packages/workflow/src/evaluate-transition.test.ts. What this test
    // proves is the OUTCOME every refusal path — pre-existing check or
    // guard — must share: the matter stays in DRAFT and no audit record is
    // written.
    expect(submitResponse.status).toBeGreaterThanOrEqual(400);
    const body = (await submitResponse.json()) as { error?: string };
    expect(body.error?.toLowerCase()).toContain("expense line");

    const storedMatter = await memoryMatterRepository.getMatter(matter.id);
    expect(storedMatter?.status).toBe("DRAFT");

    const events = await memoryAuditEventWriter.listByMatter(matter.id);
    expect(events).toHaveLength(0);
  });
});
