// packages/schemas/src/audit-event.test.ts
//
// Falsifies AuditEventSchema: the 17-value AuditEventType enum, the closed
// declared payload key set (§12.1 — an undeclared key is a validation
// error, never a silently-archived extra), the ISO datetime constraint on
// `at`, and the empty/null/undefined edge.

import { describe, expect, it } from "vitest";
import { AUDIT_PAYLOAD_KEYS, AuditEventSchema } from "./audit-event.ts";

function validEvent() {
  return {
    id: "01ARZ3NDEKTSV4RRFFQ69G5FAX",
    matterId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    actor: {
      id: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
      displayName: "Jane HR",
      email: "jane@example.com",
    },
    actorRole: "HR_PREPARER",
    at: "2026-08-20T03:14:15Z",
    type: "MATTER_CREATED",
    payload: {},
    rulePackVersion: null,
    engineVersion: null,
  };
}

describe("AuditEventSchema", () => {
  it("parses an event carrying all required fields", () => {
    expect(AuditEventSchema.safeParse(validEvent()).success).toBe(true);
  });

  it("fails when type is outside the 17 declared types", () => {
    const result = AuditEventSchema.safeParse({ ...validEvent(), type: "NOT_A_TYPE" });
    expect(result.success).toBe(false);
  });

  it("parses a payload containing only declared keys", () => {
    const payload = Object.fromEntries(AUDIT_PAYLOAD_KEYS.map((k) => [k, "x"]));
    const result = AuditEventSchema.safeParse({ ...validEvent(), payload });
    expect(result.success).toBe(true);
  });

  it("fails when the payload contains one undeclared key, naming that key", () => {
    const result = AuditEventSchema.safeParse({
      ...validEvent(),
      payload: { notADeclaredKey: "x" },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = JSON.stringify(result.error.issues);
      expect(messages).toContain("notADeclaredKey");
    }
  });

  it("fails when the payload is a whole request body with many undeclared keys", () => {
    const result = AuditEventSchema.safeParse({
      ...validEvent(),
      payload: {
        requestorName: "x",
        ssn: "y",
        headers: { auth: "z" },
        rawBody: "everything",
        internalNotes: "more",
      },
    });
    expect(result.success).toBe(false);
  });

  it("accepts rulePackVersion and engineVersion as null", () => {
    const result = AuditEventSchema.safeParse({
      ...validEvent(),
      rulePackVersion: null,
      engineVersion: null,
    });
    expect(result.success).toBe(true);
  });

  it("fails when at is not an ISO datetime", () => {
    const result = AuditEventSchema.safeParse({ ...validEvent(), at: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("preserves AUDIT_PAYLOAD_KEYS declaration order", () => {
    const keys = [...AUDIT_PAYLOAD_KEYS];
    expect(keys).toEqual(AUDIT_PAYLOAD_KEYS as unknown as string[]);
    // Pin the exact order so a later reorder is a visible, reviewed diff.
    expect(AUDIT_PAYLOAD_KEYS).toEqual([
      "entityId",
      "field",
      "before",
      "after",
      "elapsedReviewMs",
    ]);
  });

  it("fails on null", () => {
    expect(AuditEventSchema.safeParse(null).success).toBe(false);
  });

  it("fails on undefined", () => {
    expect(AuditEventSchema.safeParse(undefined).success).toBe(false);
  });

  it("fails on an empty object", () => {
    expect(AuditEventSchema.safeParse({}).success).toBe(false);
  });
});
