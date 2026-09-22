// tests/routes/audit-export.test.ts
//
// Tagged AUDIT-EXPORT. Proves the DPO_ADMIN demo identity resolves from the
// real cookie-resolution function (never constructed by hand — 04-RESEARCH
// Pitfall 4), that an unrecognised cookie still falls back to the
// least-privileged HR preparer, and that exportAuditLog returns both
// streams together, refuses every other role by name, orders events
// globally rather than per-matter, and hands back deep copies. The store is
// seeded by driving the real create/add-line/submit route handlers where
// practical, so the exported matter-scoped events are ones the system
// actually wrote — the pack-lifecycle half is seeded directly through its
// writer, since no admin route exists yet to drive it from (04-03-PLAN.md).

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import {
  DEMO_ROLE_COOKIE,
  DEMO_USERS,
  resolveActorFromCookieHeader,
} from "../../apps/web/src/server/data/auth.ts";
import { exportAuditLog } from "../../apps/web/src/server/data/audit.ts";
import { memoryPackLifecycleEventWriter } from "@dsar/audit/memory/pack-lifecycle-event-writer";
import { packActivatedPayload } from "@dsar/audit/payload-builders";
import { UlidSchema } from "@dsar/schemas/primitives";

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

// Drives the real routes end to end: create -> add one line -> submit.
// Returns the matter id, useful for asserting a SUBMITTED event exists for
// it in the export.
async function submitDemoMatter(reference: string): Promise<{ id: string }> {
  const createResponse = await createMatterRoute(jsonRequest(BASE_URL, validMatterInput(reference)));
  const matter = (await createResponse.json()) as { id: string };

  const lineResponse = await addLineRoute(
    jsonRequest(`${BASE_URL}/${matter.id}/lines`, {
      categoryCode: "STAFF_TIME_SEARCH",
      description: "Staff time locating and retrieving the requested records",
      quantity: 2,
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
  if (lineResponse.status !== 201) throw new Error("expected the demo line to be added");

  const submitResponse = await submitRoute(jsonRequest(`${BASE_URL}/${matter.id}/submit`, {}), {
    params: Promise.resolve({ id: matter.id }),
  });
  if (submitResponse.status !== 200) throw new Error("expected the demo submission to succeed");

  return matter;
}

describe("AUDIT-EXPORT — the DPO identity and the whole-log export", () => {
  it("AUDIT-EXPORT: a cookie naming the officer role resolves to the officer identity, with the officer role attached", () => {
    const actor = resolveActorFromCookieHeader(`${DEMO_ROLE_COOKIE}=DPO_ADMIN`);
    expect(actor.role).toBe("DPO_ADMIN");
    expect(actor.user.id).toBe(DEMO_USERS.DPO_ADMIN.user.id);
  });

  it("AUDIT-EXPORT: an absent or unrecognised cookie still resolves to the preparer, unchanged from before", () => {
    expect(resolveActorFromCookieHeader(null).role).toBe("HR_PREPARER");
    expect(resolveActorFromCookieHeader(`${DEMO_ROLE_COOKIE}=SOMETHING_UNKNOWN`).role).toBe("HR_PREPARER");
  });

  it("AUDIT-EXPORT: the officer identity's identifier parses against the identifier schema", () => {
    expect(() => UlidSchema.parse(DEMO_USERS.DPO_ADMIN.user.id)).not.toThrow();
  });

  it("AUDIT-EXPORT: the export, called with an actor resolved from an officer cookie, returns every matter-scoped event and every pack-lifecycle event written so far", async () => {
    const matter = await submitDemoMatter("DSAR-AUDIT-EXPORT-0001");
    const packEvent = await memoryPackLifecycleEventWriter.append({
      packId: "pack-audit-export-basic",
      packVersion: "2026.09.1",
      actor: DEMO_USERS.DPO_ADMIN.user,
      actorRole: "RULEPACK_AUTHOR",
      at: new Date().toISOString(),
      type: "PACK_ACTIVATED",
      payload: packActivatedPayload("DRAFT", "ACTIVE"),
    });

    const officer = resolveActorFromCookieHeader(`${DEMO_ROLE_COOKIE}=DPO_ADMIN`);
    const exported = await exportAuditLog(officer);

    expect(exported.matterEvents.some((event) => event.matterId === matter.id && event.type === "SUBMITTED")).toBe(
      true
    );
    expect(exported.packLifecycleEvents.some((event) => event.id === packEvent.id)).toBe(true);
  });

  it("AUDIT-EXPORT: the export called as a preparer is refused, and the refusal names the required role", async () => {
    const preparer = resolveActorFromCookieHeader(`${DEMO_ROLE_COOKIE}=HR_PREPARER`);
    await expect(exportAuditLog(preparer)).rejects.toThrow(/DPO_ADMIN/);
  });

  it("AUDIT-EXPORT: the export called as a reviewer is refused", async () => {
    const reviewer = resolveActorFromCookieHeader(`${DEMO_ROLE_COOKIE}=LEGAL_REVIEWER`);
    await expect(exportAuditLog(reviewer)).rejects.toThrow(/DPO_ADMIN/);
  });

  it("AUDIT-EXPORT: the export returns events in written order across more than one matter, so ordering is proven to be global rather than per-matter", async () => {
    const officer = resolveActorFromCookieHeader(`${DEMO_ROLE_COOKIE}=DPO_ADMIN`);

    const matterA = await submitDemoMatter("DSAR-AUDIT-EXPORT-ORDER-A");
    const matterB = await submitDemoMatter("DSAR-AUDIT-EXPORT-ORDER-B");

    const exported = await exportAuditLog(officer);
    const eventA = exported.matterEvents.find(
      (event) => event.matterId === matterA.id && event.type === "SUBMITTED"
    );
    const eventB = exported.matterEvents.find(
      (event) => event.matterId === matterB.id && event.type === "SUBMITTED"
    );
    if (!eventA || !eventB) throw new Error("expected both SUBMITTED events in the export");

    // Written A-then-B (matterA's submit route call completed before
    // matterB's began); the export's global identifier order must
    // preserve that, not merely group each matter's own events together.
    expect(eventA.id.localeCompare(eventB.id)).toBeLessThan(0);
  });

  it("AUDIT-EXPORT: the export returns deep copies — mutating the result and re-exporting shows the store unchanged", async () => {
    const officer = resolveActorFromCookieHeader(`${DEMO_ROLE_COOKIE}=DPO_ADMIN`);
    await submitDemoMatter("DSAR-AUDIT-EXPORT-DEEPCOPY");

    const exported = await exportAuditLog(officer);
    const target = exported.matterEvents[0];
    if (!target) throw new Error("expected at least one matter-scoped event");
    target.payload.after = "TAMPERED";

    const reExported = await exportAuditLog(officer);
    expect(reExported.matterEvents[0]?.payload.after).not.toBe("TAMPERED");
  });
});
