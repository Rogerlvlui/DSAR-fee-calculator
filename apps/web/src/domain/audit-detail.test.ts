// apps/web/src/domain/audit-detail.test.ts
//
// Tagged via the "audit-detail" -t filter (07.1-02-PLAN.md Task 1). Covers
// the four payload shapes the plan names explicitly, and the closed-set
// no-JSON-dump discipline (T-07.1-02-03).

import { describe, expect, it } from "vitest";
import { composeAuditEventDetail, NO_AUDIT_DETAIL_SENTENCE } from "./audit-detail.ts";
import type { AuditPayload } from "@dsar/schemas/audit-event";

describe("audit-detail: composeAuditEventDetail", () => {
  it("audit-detail: a payload with all five keys names the changed field, the before/after pair and the entity id", () => {
    const payload: AuditPayload = {
      entityId: "01LINE00000000000000000001",
      field: "disposition",
      before: "PENDING",
      after: "ACCEPTED",
      elapsedReviewMs: 4200,
    };

    const detail = composeAuditEventDetail(payload);

    expect(detail).toContain("disposition");
    expect(detail).toContain("PENDING");
    expect(detail).toContain("ACCEPTED");
    expect(detail).toContain("01LINE00000000000000000001");
    expect(detail).not.toContain('{"');
  });

  it("audit-detail: a payload with only entityId and elapsedReviewMs does not claim a field changed", () => {
    const payload: AuditPayload = {
      entityId: "01LINE00000000000000000002",
      elapsedReviewMs: 1500,
    };

    const detail = composeAuditEventDetail(payload);

    expect(detail).not.toContain("Changed");
    expect(detail).toContain("01LINE00000000000000000002");
    expect(detail).toContain("1500");
    expect(detail).not.toContain('{"');
  });

  it("audit-detail: a payload with only a before/after pair (a status-transition payload) names the transition, not a field", () => {
    const payload: AuditPayload = {
      before: "DRAFT",
      after: "COMPUTING",
    };

    const detail = composeAuditEventDetail(payload);

    expect(detail).toContain("DRAFT");
    expect(detail).toContain("COMPUTING");
    expect(detail).not.toContain('{"');
  });

  it("audit-detail: an empty payload renders a non-empty placeholder sentence, never an empty string", () => {
    const detail = composeAuditEventDetail({});

    expect(detail).toBe(NO_AUDIT_DETAIL_SENTENCE);
    expect(detail.length).toBeGreaterThan(0);
    expect(detail).not.toBe("");
    expect(detail).not.toContain('{"');
  });

  it("audit-detail: an object-shaped before/after (e.g. an expense-line snapshot) never leaks a raw JSON dump", () => {
    const payload: AuditPayload = {
      entityId: "01LINE00000000000000000003",
      field: "expenseLine",
      after: { categoryCode: "STAFF_TIME_SEARCH", quantity: 2 },
    };

    const detail = composeAuditEventDetail(payload);

    expect(detail).not.toContain('{"');
    expect(detail).not.toContain("categoryCode");
  });
});
