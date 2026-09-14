import { describe, expect, it } from "vitest";
import { MATTER_STATUSES, MatterStatusSchema } from "./matter-status.ts";
import {
  EXPENSE_CATEGORY_CODES,
  EXPENSE_CATEGORY_LABELS,
  ExpenseCategoryCodeSchema,
} from "./taxonomy.ts";

describe("MatterStatusSchema", () => {
  it("accepts all seven lifecycle values", () => {
    for (const status of MATTER_STATUSES) {
      expect(MatterStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it("has exactly seven entries in PRD §5 lifecycle order", () => {
    expect(MATTER_STATUSES).toEqual([
      "DRAFT",
      "COMPUTING",
      "LEGAL_REVIEW",
      "INFO_REQUEST",
      "SIGNED_OFF",
      "CLOSED",
      "SUPERSEDED",
    ]);
    expect(MATTER_STATUSES).toHaveLength(7);
  });

  it("rejects a lowercase variant", () => {
    expect(MatterStatusSchema.safeParse("draft").success).toBe(false);
  });

  it("rejects a whitespace-padded variant", () => {
    expect(MatterStatusSchema.safeParse(" DRAFT ").success).toBe(false);
  });

  it("rejects the empty string", () => {
    expect(MatterStatusSchema.safeParse("").success).toBe(false);
  });

  it("rejects null", () => {
    expect(MatterStatusSchema.safeParse(null).success).toBe(false);
  });

  it("rejects undefined", () => {
    expect(MatterStatusSchema.safeParse(undefined).success).toBe(false);
  });
});

describe("ExpenseCategoryCodeSchema / taxonomy", () => {
  it("has exactly 21 entries", () => {
    expect(EXPENSE_CATEGORY_CODES).toHaveLength(21);
  });

  it("includes OTHER_UNCLASSIFIED as the escape hatch", () => {
    expect(EXPENSE_CATEGORY_CODES).toContain("OTHER_UNCLASSIFIED");
  });

  it("every code parses", () => {
    for (const code of EXPENSE_CATEGORY_CODES) {
      expect(ExpenseCategoryCodeSchema.safeParse(code).success).toBe(true);
    }
  });

  it("has a non-empty label for every code", () => {
    for (const code of EXPENSE_CATEGORY_CODES) {
      expect(EXPENSE_CATEGORY_LABELS[code].length).toBeGreaterThan(0);
    }
  });
});
