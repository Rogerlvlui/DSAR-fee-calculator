// packages/audit/src/memory/audit-event-writer.test.ts
//
// Tagged AUDIT-WRITER. This plan's Task 1 proves append/deep-copy-isolation
// and undeclared-payload-key refusal; Task 2 extends this file with
// ordering, export and the elapsedReviewMs enforcement tests.

import { describe, expect, it } from "vitest";
import { memoryAuditEventWriter } from "./audit-event-writer.ts";
import type { NewAuditEvent } from "../interface.ts";

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
});
