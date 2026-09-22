// packages/audit/src/memory/audit-event-writer.test.ts
//
// Tagged AUDIT-WRITER. Task 1 proves append/deep-copy-isolation and
// undeclared-payload-key refusal; Task 2 extends this file with ordering,
// export and the elapsedReviewMs enforcement tests.

import { describe, expect, it } from "vitest";
import { memoryAuditEventWriter } from "./audit-event-writer.ts";
import type { NewAuditEvent } from "../interface.ts";
import {
  AuditPayloadSchema,
  type AuditPayload,
} from "@dsar/schemas/audit-event";
import {
  dispositionPayload,
  informationRequestPayload,
  signOffPayload,
  transitionPayload,
} from "../payload-builders.ts";

const BASE_EVENT: NewAuditEvent = {
  matterId: "matter-test-000",
  actor: {
    id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    displayName: "Test Actor",
    email: "test@example.invalid",
  },
  actorRole: "HR_PREPARER",
  at: "2026-09-19T00:00:00Z",
  type: "SUBMITTED",
  payload: { field: "status", before: "DRAFT", after: "COMPUTING" },
  rulePackVersion: "2026.09.1",
  engineVersion: "0.1.0",
};

describe("AUDIT-WRITER — memoryAuditEventWriter", () => {
  it("AUDIT-WRITER: stores an event, returns a deep copy, and a caller mutating the returned object leaves the stored record unchanged", async () => {
    const stored = await memoryAuditEventWriter.append({ ...BASE_EVENT, matterId: "matter-deepcopy" });
    stored.payload.after = "TAMPERED";

    const rereadEvents = await memoryAuditEventWriter.listByMatter("matter-deepcopy");
    expect(rereadEvents).toHaveLength(1);
    expect(rereadEvents[0]?.payload.after).toBe("COMPUTING");
  });

  it("AUDIT-WRITER: refuses a payload carrying a key outside the declared set, and nothing is stored", async () => {
    const badEvent = {
      ...BASE_EVENT,
      matterId: "matter-undeclared-key",
      payload: { field: "status", before: "DRAFT", after: "COMPUTING", notDeclared: "oops" },
    } as unknown as NewAuditEvent;

    await expect(memoryAuditEventWriter.append(badEvent)).rejects.toThrow();

    const events = await memoryAuditEventWriter.listByMatter("matter-undeclared-key");
    expect(events).toHaveLength(0);
  });

  it("AUDIT-WRITER: listing a matter's events returns only that matter's events, in identifier (write) order, even for two events sharing the same millisecond timestamp", async () => {
    const matterId = "matter-ordering";
    const other = "matter-ordering-other";
    const sharedAt = "2026-09-19T00:00:00Z";

    await memoryAuditEventWriter.append({ ...BASE_EVENT, matterId: other, at: sharedAt });
    const first = await memoryAuditEventWriter.append({ ...BASE_EVENT, matterId, at: sharedAt });
    const second = await memoryAuditEventWriter.append({ ...BASE_EVENT, matterId, at: sharedAt });

    const events = await memoryAuditEventWriter.listByMatter(matterId);
    expect(events.map((event) => event.id)).toEqual([first.id, second.id]);
  });

  it("AUDIT-WRITER: exporting returns every matter's events in identifier order, and returns deep copies", async () => {
    const matterA = "matter-export-a";
    const matterB = "matter-export-b";
    await memoryAuditEventWriter.append({ ...BASE_EVENT, matterId: matterA });
    await memoryAuditEventWriter.append({ ...BASE_EVENT, matterId: matterB });

    const exported = await memoryAuditEventWriter.exportAll();
    const ids = exported.map((event) => event.id);
    expect(ids).toEqual([...ids].sort());
    expect(exported.some((event) => event.matterId === matterA)).toBe(true);
    expect(exported.some((event) => event.matterId === matterB)).toBe(true);

    const firstExported = exported[0];
    if (!firstExported) throw new Error("expected at least one exported event");
    firstExported.payload.after = "TAMPERED";
    const reExported = await memoryAuditEventWriter.exportAll();
    expect(reExported[0]?.payload.after).not.toBe("TAMPERED");
  });

  it("AUDIT-WRITER: refuses a LINE_DISPOSITIONED event whose payload carries no elapsedReviewMs figure, and nothing is stored", async () => {
    const matterId = "matter-disposition-no-elapsed";
    const badPayload: AuditPayload = { entityId: "line-1", field: "disposition", before: "PENDING", after: "ACCEPTED" };

    await expect(
      memoryAuditEventWriter.append({
        ...BASE_EVENT,
        matterId,
        type: "LINE_DISPOSITIONED",
        payload: badPayload,
      })
    ).rejects.toThrow(/LINE_DISPOSITIONED/);

    expect(await memoryAuditEventWriter.listByMatter(matterId)).toHaveLength(0);
  });

  it("AUDIT-WRITER: refuses a SIGNED_OFF event whose payload carries no elapsedReviewMs figure, and nothing is stored", async () => {
    const matterId = "matter-signoff-no-elapsed";
    const badPayload: AuditPayload = { field: "signOff", after: "SIGNED_OFF" };

    await expect(
      memoryAuditEventWriter.append({
        ...BASE_EVENT,
        matterId,
        type: "SIGNED_OFF",
        payload: badPayload,
      })
    ).rejects.toThrow(/SIGNED_OFF/);

    expect(await memoryAuditEventWriter.listByMatter(matterId)).toHaveLength(0);
  });

  it("AUDIT-WRITER: appending any other event type with no elapsedReviewMs figure succeeds", async () => {
    const matterId = "matter-other-type-no-elapsed";
    const stored = await memoryAuditEventWriter.append({
      ...BASE_EVENT,
      matterId,
      type: "SUBMITTED",
      payload: transitionPayload("DRAFT", "COMPUTING"),
    });
    expect(stored.payload.elapsedReviewMs).toBeUndefined();
  });

  it("AUDIT-WRITER: appending a LINE_DISPOSITIONED event with an elapsedReviewMs figure succeeds and the figure round-trips unchanged", async () => {
    const matterId = "matter-disposition-with-elapsed";
    const stored = await memoryAuditEventWriter.append({
      ...BASE_EVENT,
      matterId,
      type: "LINE_DISPOSITIONED",
      payload: dispositionPayload({ lineId: "line-1", before: "PENDING", after: "ACCEPTED", elapsedReviewMs: 4200 }),
    });
    expect(stored.payload.elapsedReviewMs).toBe(4200);

    const [reread] = await memoryAuditEventWriter.listByMatter(matterId);
    expect(reread?.payload.elapsedReviewMs).toBe(4200);
  });

  it("AUDIT-WRITER: every payload builder's return value parses cleanly against the frozen AuditPayloadSchema", () => {
    const payloads: AuditPayload[] = [
      transitionPayload("DRAFT", "COMPUTING"),
      dispositionPayload({ lineId: "line-1", before: "PENDING", after: "STRUCK", elapsedReviewMs: 1000 }),
      signOffPayload("LEGAL_REVIEW", "SIGNED_OFF", 5000),
      informationRequestPayload({ assessmentLineId: "line-1", query: "Please confirm the vendor invoice" }),
    ];
    for (const payload of payloads) {
      expect(() => AuditPayloadSchema.parse(payload)).not.toThrow();
    }
  });
});
