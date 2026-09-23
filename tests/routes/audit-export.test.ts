// tests/routes/audit-export.test.ts
//
// Tagged AUDIT-EXPORT. Proves the Legal reviewer's combined demo identity
// (2026-09-23: carries both LEGAL_REVIEWER and DPO_ADMIN access — see
// auth.ts's own header note) resolves from the real cookie-resolution
// function (never constructed by hand — 04-RESEARCH Pitfall 4), that an
// unrecognised cookie (including the retired "DPO_ADMIN" value) still falls
// back to the least-privileged HR preparer, and that exportAuditLog returns
// both streams together, refuses the preparer role by name, still accepts a
// DPO_ADMIN-role actor structurally even with no demo persona attached to
// it, orders events globally rather than per-matter, and hands back deep
// copies. The store is seeded by driving the real create/add-line/submit
// route handlers where practical, so the exported matter-scoped events are
// ones the system actually wrote — the pack-lifecycle half is seeded
// directly through its writer, since no admin route drives it (04-03-PLAN.md).

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import {
  DEMO_ROLE_COOKIE,
  DEMO_USERS,
  resolveActorFromCookieHeader,
  type DemoActor,
} from "../../apps/web/src/server/data/auth.ts";
import { exportAuditLog } from "../../apps/web/src/server/data/audit.ts";
import { memoryPackLifecycleEventWriter } from "@dsar/audit/memory/pack-lifecycle-event-writer";
import { packActivatedPayload } from "@dsar/audit/payload-builders";
import { RoleSchema, UlidSchema } from "@dsar/schemas/primitives";

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

// A hand-built actor carrying DPO_ADMIN, never constructed via DEMO_USERS —
// that identity is retired (2026-09-23), but DPO_ADMIN remains a valid Role
// in the frozen schema, and exportAuditLog's gate must keep accepting it
// structurally even with no demo persona attached to it.
function buildRawDpoAdminActor(): DemoActor {
  return {
    user: DEMO_USERS.LEGAL_REVIEWER.user,
    role: RoleSchema.parse("DPO_ADMIN"),
  };
}

describe("AUDIT-EXPORT — the combined Legal/DPO identity and the whole-log export", () => {
  it("AUDIT-EXPORT: the retired DPO_ADMIN cookie value is no longer recognised — falls back to the preparer, not left as a silent escalation path", () => {
    const actor = resolveActorFromCookieHeader(`${DEMO_ROLE_COOKIE}=DPO_ADMIN`);
    expect(actor.role).toBe("HR_PREPARER");
  });

  it("AUDIT-EXPORT: a cookie naming the Legal reviewer resolves to that identity, with the LEGAL_REVIEWER role attached", () => {
    const actor = resolveActorFromCookieHeader(`${DEMO_ROLE_COOKIE}=LEGAL_REVIEWER`);
    expect(actor.role).toBe("LEGAL_REVIEWER");
    expect(actor.user.id).toBe(DEMO_USERS.LEGAL_REVIEWER.user.id);
  });

  it("AUDIT-EXPORT: an absent or unrecognised cookie still resolves to the preparer, unchanged from before", () => {
    expect(resolveActorFromCookieHeader(null).role).toBe("HR_PREPARER");
    expect(resolveActorFromCookieHeader(`${DEMO_ROLE_COOKIE}=SOMETHING_UNKNOWN`).role).toBe("HR_PREPARER");
  });

  it("AUDIT-EXPORT: the Legal reviewer identity's identifier parses against the identifier schema", () => {
    expect(() => UlidSchema.parse(DEMO_USERS.LEGAL_REVIEWER.user.id)).not.toThrow();
  });

  it("AUDIT-EXPORT: the export, called with an actor resolved from the Legal reviewer's cookie, returns every matter-scoped event and every pack-lifecycle event written so far", async () => {
    const matter = await submitDemoMatter("DSAR-AUDIT-EXPORT-0001");
    const packEvent = await memoryPackLifecycleEventWriter.append({
      packId: "pack-audit-export-basic",
      packVersion: "2026.09.1",
      actor: DEMO_USERS.LEGAL_REVIEWER.user,
      actorRole: "RULEPACK_AUTHOR",
      at: new Date().toISOString(),
      type: "PACK_ACTIVATED",
      payload: packActivatedPayload("DRAFT", "ACTIVE"),
    });

    const reviewer = resolveActorFromCookieHeader(`${DEMO_ROLE_COOKIE}=LEGAL_REVIEWER`);
    const exported = await exportAuditLog(reviewer);

    expect(exported.matterEvents.some((event) => event.matterId === matter.id && event.type === "SUBMITTED")).toBe(
      true
    );
    expect(exported.packLifecycleEvents.some((event) => event.id === packEvent.id)).toBe(true);
  });

  it("AUDIT-EXPORT: the export called as a preparer is refused, and the refusal names an accepted role", async () => {
    const preparer = resolveActorFromCookieHeader(`${DEMO_ROLE_COOKIE}=HR_PREPARER`);
    await expect(exportAuditLog(preparer)).rejects.toThrow(/DPO_ADMIN/);
  });

  it("AUDIT-EXPORT: the export called as the Legal reviewer succeeds — the combined identity carries DPO access too (2026-09-23)", async () => {
    await submitDemoMatter("DSAR-AUDIT-EXPORT-LEGAL-OK");
    const reviewer = resolveActorFromCookieHeader(`${DEMO_ROLE_COOKIE}=LEGAL_REVIEWER`);
    const exported = await exportAuditLog(reviewer);
    expect(Array.isArray(exported.matterEvents)).toBe(true);
    expect(Array.isArray(exported.packLifecycleEvents)).toBe(true);
  });

  it("AUDIT-EXPORT: a hand-built DPO_ADMIN-role actor is also still accepted, even with no demo persona carrying that role alone", async () => {
    await submitDemoMatter("DSAR-AUDIT-EXPORT-RAW-DPO-OK");
    const exported = await exportAuditLog(buildRawDpoAdminActor());
    expect(Array.isArray(exported.matterEvents)).toBe(true);
  });

  it("AUDIT-EXPORT: the export returns events in written order across more than one matter, so ordering is proven to be global rather than per-matter", async () => {
    const reviewer = resolveActorFromCookieHeader(`${DEMO_ROLE_COOKIE}=LEGAL_REVIEWER`);

    const matterA = await submitDemoMatter("DSAR-AUDIT-EXPORT-ORDER-A");
    const matterB = await submitDemoMatter("DSAR-AUDIT-EXPORT-ORDER-B");

    const exported = await exportAuditLog(reviewer);
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
    const reviewer = resolveActorFromCookieHeader(`${DEMO_ROLE_COOKIE}=LEGAL_REVIEWER`);
    await submitDemoMatter("DSAR-AUDIT-EXPORT-DEEPCOPY");

    const exported = await exportAuditLog(reviewer);
    const target = exported.matterEvents[0];
    if (!target) throw new Error("expected at least one matter-scoped event");
    target.payload.after = "TAMPERED";

    const reExported = await exportAuditLog(reviewer);
    expect(reExported.matterEvents[0]?.payload.after).not.toBe("TAMPERED");
  });
});
