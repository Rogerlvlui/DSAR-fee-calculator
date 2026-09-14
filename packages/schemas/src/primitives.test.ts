import { describe, expect, it } from "vitest";
import {
  AuditEventTypeSchema,
  CurrencyCodeSchema,
  FlagReasonCodeSchema,
  FlagReasonSchema,
  IsoDateTimeSchema,
  JURISDICTION_CURRENCY,
  JurisdictionCodeSchema,
  MatterFlagCodeSchema,
  MINOR_MAX,
  MINOR_MIN,
  MinorSchema,
  UlidSchema,
} from "./primitives.ts";

describe("MinorSchema", () => {
  it("accepts 0", () => {
    expect(MinorSchema.safeParse(0).success).toBe(true);
  });

  it("rejects a non-integer (1.5) rather than rounding it", () => {
    expect(MinorSchema.safeParse(1.5).success).toBe(false);
  });

  it("rejects NaN", () => {
    expect(MinorSchema.safeParse(Number.NaN).success).toBe(false);
  });

  // WR-03: every Minor-typed Prisma column is a 4-byte `Int`
  // (±2,147,483,647); a value outside that range must fail here, at the zod
  // boundary, rather than surface as a raw Postgres integer-overflow error.
  it("accepts the 32-bit signed integer boundary values (MINOR_MIN, MINOR_MAX)", () => {
    expect(MinorSchema.safeParse(MINOR_MIN).success).toBe(true);
    expect(MinorSchema.safeParse(MINOR_MAX).success).toBe(true);
  });

  it("rejects one past the 32-bit signed integer ceiling", () => {
    expect(MinorSchema.safeParse(MINOR_MAX + 1).success).toBe(false);
  });

  it("rejects one past the 32-bit signed integer floor", () => {
    expect(MinorSchema.safeParse(MINOR_MIN - 1).success).toBe(false);
  });

  it("rejects a value that would previously have passed as a safe integer (product-overflow shape, AC-08-adjacent)", () => {
    // The exact WR-03 scenario: quantity 50_000_000 * unitRate 100, which is
    // a valid JS safe integer but far outside Postgres's Int32 range.
    expect(MinorSchema.safeParse(50_000_000 * 100).success).toBe(false);
  });
});

describe("JURISDICTION_CURRENCY", () => {
  it("has exactly nine entries, one per JurisdictionCode", () => {
    const keys = Object.keys(JURISDICTION_CURRENCY);
    expect(keys).toHaveLength(9);
    for (const key of keys) {
      expect(JurisdictionCodeSchema.safeParse(key).success).toBe(true);
    }
  });

  it("maps every jurisdiction to a value that is itself a valid CurrencyCode", () => {
    for (const currency of Object.values(JURISDICTION_CURRENCY)) {
      expect(CurrencyCodeSchema.safeParse(currency).success).toBe(true);
    }
  });
});

describe("FlagReasonSchema", () => {
  it("rejects a message longer than 200 characters", () => {
    const result = FlagReasonSchema.safeParse({
      code: "MATERIALITY",
      message: "x".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("accepts a message at exactly 200 characters", () => {
    const result = FlagReasonSchema.safeParse({
      code: "MATERIALITY",
      message: "x".repeat(200),
    });
    expect(result.success).toBe(true);
  });
});

describe("UlidSchema", () => {
  it("rejects a plainly non-ULID string", () => {
    expect(UlidSchema.safeParse("not-a-ulid").success).toBe(false);
  });

  it("accepts a well-formed ULID", () => {
    expect(UlidSchema.safeParse("01ARZ3NDEKTSV4RRFFQ69G5FAV").success).toBe(true);
  });
});

describe("IsoDateTimeSchema", () => {
  it("rejects a value carrying an explicit timezone offset", () => {
    expect(IsoDateTimeSchema.safeParse("2026-08-20T10:00:00+08:00").success).toBe(false);
  });

  it("accepts a UTC ('Z') datetime", () => {
    expect(IsoDateTimeSchema.safeParse("2026-08-20T10:00:00Z").success).toBe(true);
  });
});

describe("AuditEventTypeSchema", () => {
  it("has exactly 17 members", () => {
    expect(AuditEventTypeSchema.options).toHaveLength(17);
  });
});

describe("FlagReasonCodeSchema / MatterFlagCodeSchema cardinality", () => {
  it("FlagReasonCodeSchema has exactly 9 members", () => {
    expect(FlagReasonCodeSchema.options).toHaveLength(9);
  });

  it("MatterFlagCodeSchema has exactly 5 members", () => {
    expect(MatterFlagCodeSchema.options).toHaveLength(5);
  });
});
