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
  MatterFlagSchema,
  MINOR_MAX,
  MINOR_MIN,
  MinorSchema,
  UlidSchema,
} from "./primitives.ts";
import { AssessmentLineSchema } from "./assessment.ts";

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
  it("has exactly 18 members — 17 PRD §6.0 values plus 06-07's additive FEE_CHOICE_SET (D-11-style extension)", () => {
    expect(AuditEventTypeSchema.options).toHaveLength(18);
    expect(AuditEventTypeSchema.options).toContain("FEE_CHOICE_SET");
  });
});

describe("FlagReasonCodeSchema / MatterFlagCodeSchema cardinality", () => {
  it("FlagReasonCodeSchema has exactly 9 members", () => {
    expect(FlagReasonCodeSchema.options).toHaveLength(9);
  });

  it("MatterFlagCodeSchema has exactly 6 members (D-11 adds AGGREGATE_CAP_APPLIED)", () => {
    expect(MatterFlagCodeSchema.options).toHaveLength(6);
  });
});

// D-11: AGGREGATE_CAP_APPLIED is added to MatterFlagCode as a matter-level
// flag so ENGINE-07's "flag that the cap bit" has somewhere to go without a
// capped line giving up its ALLOW_CAPPED verdict or its contribution to
// draftBaseline. The frozen AssessmentLineSchema.superRefine (flagReasons
// empty unless verdict is FLAG, and vice versa) is untouched by this change.
describe("MatterFlagCodeSchema (D-11)", () => {
  it("parses the new AGGREGATE_CAP_APPLIED cap code", () => {
    expect(MatterFlagCodeSchema.safeParse("AGGREGATE_CAP_APPLIED").success).toBe(true);
  });

  it.each([
    "LITIGATION_POSTURE",
    "REPEAT_REQUEST",
    "STALE_PACK_WARNING",
    "NO_FEE_AUTHORITY_POSTURE",
    "PACK_FLAG",
  ])("still parses the pre-existing code %s", (code) => {
    expect(MatterFlagCodeSchema.safeParse(code).success).toBe(true);
  });
});

describe("MatterFlagSchema — AGGREGATE_CAP_APPLIED (D-11)", () => {
  it("a MatterFlag using the new code parses with a message and requiresAcknowledgement: false", () => {
    const result = MatterFlagSchema.safeParse({
      id: "matter-1.AGGREGATE_CAP_APPLIED",
      code: "AGGREGATE_CAP_APPLIED",
      message: "The pack's aggregate cap reduced one or more lines.",
      requiresAcknowledgement: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requiresAcknowledgement).toBe(false);
    }
  });
});

// D-11 proof that the bidirectional line-level refinement is demonstrably
// unchanged: a capped line still cannot carry a line-level flag reason, and
// a FLAG line still cannot have an empty flagReasons array. The matter-level
// addition above does not touch this invariant.
describe("AssessmentLineSchema.superRefine — unchanged by the MatterFlag D-11 addition", () => {
  function validLine(overrides: Record<string, unknown> = {}) {
    return {
      id: "line-1",
      expenseLineId: "expense-1",
      verdict: "ALLOW",
      engineAmount: 16000,
      appliedRuleId: "SG-PDPA.STAFF_TIME_SEARCH",
      appliedCap: null,
      basis: "Direct labour cost of locating the requested data.",
      citation: { instrument: "PDPA", provision: "s.10" },
      flagReasons: [],
      disposition: "PENDING",
      lawyerAmount: null,
      lawyerReason: null,
      dispositionedBy: null,
      dispositionedAt: null,
      ...overrides,
    };
  }

  it("an ALLOW_CAPPED line with a non-empty flagReasons array still fails to parse", () => {
    expect(() =>
      AssessmentLineSchema.parse(
        validLine({
          verdict: "ALLOW_CAPPED",
          flagReasons: [{ code: "AGGREGATE_CAP_APPLIED", message: "Capped by aggregate cap." }],
        })
      )
    ).toThrow();
  });

  it("a FLAG line with an empty flagReasons array still fails to parse", () => {
    expect(() =>
      AssessmentLineSchema.parse(validLine({ verdict: "FLAG", engineAmount: 0, flagReasons: [] }))
    ).toThrow();
  });
});
