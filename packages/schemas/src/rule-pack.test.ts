// packages/schemas/src/rule-pack.test.ts
//
// Falsifies RulePackSchema (PRD §7.2) and its component schemas: the
// four-variant Cap discriminated union, the seven-value FeePosture enum
// with a full (both-controller-type) feePosture map, CategoryRule's five
// treatments and 240-char basis cap, MatterFlagRule's three `when` arms,
// the required-with-no-default profitElementPermitted/deterrentUsePermitted
// booleans, z.partialRecord() for rateSanityCeiling, and the D-02 flat-fee
// extension (optional, no `currency` sub-field — see rule-pack.ts).

import { describe, expect, it } from "vitest";
import {
  CapSchema,
  CategoryRuleSchema,
  FeePostureSchema,
  FlatFeeSchema,
  MatterFlagRuleSchema,
  RulePackSchema,
} from "./rule-pack.ts";

function validCategoryRule() {
  return {
    ruleId: "HK-PDPO.STAFF_TIME_SEARCH",
    categoryCode: "STAFF_TIME_SEARCH",
    treatment: "ALLOW",
    cap: null,
    conditions: [],
    basis: "Direct labour cost of locating and retrieving the requested data.",
    citation: { instrument: "PDPO", provision: "s.28(2)-(3)" },
    verificationStatus: "VERIFIED",
    verificationNote: null,
  };
}

function validPack(overrides: Record<string, unknown> = {}) {
  const { flatFee, ...rest } = overrides;
  const base = {
    packId: "HK-PDPO",
    jurisdiction: { code: "HK", name: "Hong Kong SAR" },
    version: "2026.09.1",
    status: "DRAFT",
    authoredBy: null,
    reviewedBy: null,
    reviewedOn: null,
    reviewDueOn: "2027-09-01",
    instruments: [
      { title: "Personal Data (Privacy) Ordinance (Cap. 486)", provisions: ["s.19", "s.28(2)"] },
    ],
    feePosture: {
      PRIVATE_ORGANISATION: "PERMITTED_NOT_EXCESSIVE",
      PUBLIC_AGENCY: "NO_EXPRESS_AUTHORITY",
    },
    appliesTo: ["PRIVATE_ORGANISATION"],
    rateSanityCeiling: { ADMIN: 3000, EXECUTIVE: 5000 },
    constraints: {
      noChargeForMakingRequest: false,
      estimateRequiredBeforeCharging: false,
      feeNotificationDeadlineDays: 40,
      deadlineBasis: "CALENDAR_DAYS",
      responseDeadlineDays: 40,
      advancePaymentPermitted: true,
      mayWithholdDataUntilPaid: true,
      profitElementPermitted: false,
      deterrentUsePermitted: false,
      regulatorMayReviewFee: true,
      aggregateCap: null,
    },
    categoryRules: [validCategoryRule()],
    matterFlagRules: [{ flagId: "HK.NOTIFY_40_DAYS", when: { always: true }, message: "Notify within 40 days." }],
    requestorNoticeTemplate: "...",
    openQuestions: [],
    ...rest,
  };
  if (flatFee !== undefined) {
    return { ...base, flatFee };
  }
  return base;
}

function validFlatFee() {
  return {
    amount: 250000,
    basis: "A flat fee may be charged for administrative convenience where it stays below direct cost.",
    citation: { instrument: "PDPO", provision: "s.28(2)" },
    verificationStatus: "NEEDS_VERIFICATION",
  };
}

describe("RulePackSchema — flat fee extension (D-02 / PACK-12)", () => {
  it("parses a pack with every §7.2 field and no flat fee, and the parsed result has no flatFee key", () => {
    const result = RulePackSchema.safeParse(validPack());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.hasOwn(result.data, "flatFee")).toBe(false);
    }
  });

  it("parses the same pack JSON with a valid flatFee object added", () => {
    const result = RulePackSchema.safeParse(validPack({ flatFee: validFlatFee() }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.flatFee).toEqual(validFlatFee());
    }
  });

  it("rejects a flatFee whose amount is fractional, because it is a branded Minor", () => {
    const result = FlatFeeSchema.safeParse({ ...validFlatFee(), amount: 2500.5 });
    expect(result.success).toBe(false);
  });

  it("FlatFeeSchema carries no currency sub-field", () => {
    const shape = (FlatFeeSchema as unknown as { shape: Record<string, unknown> }).shape;
    expect(Object.keys(shape)).not.toContain("currency");
  });

  it("rejects a flatFee JSON payload carrying a currency key (strict object)", () => {
    const result = FlatFeeSchema.safeParse({ ...validFlatFee(), currency: "HKD" });
    expect(result.success).toBe(false);
  });
});

describe("RulePackSchema — feePosture", () => {
  it("requires an entry for both controller types; omitting one fails", () => {
    const pack = validPack();
    const withoutPublic = {
      ...pack,
      feePosture: { PRIVATE_ORGANISATION: "PERMITTED_NOT_EXCESSIVE" },
    };
    expect(RulePackSchema.safeParse(withoutPublic).success).toBe(false);
  });

  it("rejects a FeePosture value outside the seven declared", () => {
    const result = FeePostureSchema.safeParse("PERMITTED_FOREVER");
    expect(result.success).toBe(false);
  });

  it("accepts each of the seven declared FeePosture values", () => {
    const values = [
      "PERMITTED_REASONABLE",
      "PERMITTED_NOT_EXCESSIVE",
      "PERMITTED_ACTUAL_COST",
      "PERMITTED_PRESCRIBED_CAP",
      "PERMITTED_NARROW_EXCEPTION",
      "NO_EXPRESS_AUTHORITY",
      "PROHIBITED",
    ];
    for (const value of values) {
      expect(FeePostureSchema.safeParse(value).success).toBe(true);
    }
  });
});

describe("CapSchema", () => {
  it("parses each of the four Cap variants", () => {
    expect(CapSchema.safeParse({ type: "PER_UNIT", amount: 150, unit: "PAGE" }).success).toBe(
      true
    );
    expect(CapSchema.safeParse({ type: "PER_LINE", amount: 500 }).success).toBe(true);
    expect(CapSchema.safeParse({ type: "PER_MATTER", amount: 100000 }).success).toBe(true);
    expect(CapSchema.safeParse({ type: "PERCENT_OF_CLAIM", percent: 50 }).success).toBe(true);
  });

  it("fails for a fifth type value", () => {
    const result = CapSchema.safeParse({ type: "PER_REQUEST", amount: 100 });
    expect(result.success).toBe(false);
  });

  it("a PERCENT_OF_CLAIM cap carries percent and no amount", () => {
    const result = CapSchema.safeParse({ type: "PERCENT_OF_CLAIM", percent: 50, amount: 100 });
    expect(result.success).toBe(false);
  });

  it("a PER_LINE cap carries amount and no unit", () => {
    const result = CapSchema.safeParse({ type: "PER_LINE", amount: 500, unit: "PAGE" });
    expect(result.success).toBe(false);
  });
});

describe("CategoryRuleSchema — basis length", () => {
  it("a basis string of 240 characters parses", () => {
    const rule = { ...validCategoryRule(), basis: "x".repeat(240) };
    expect(CategoryRuleSchema.safeParse(rule).success).toBe(true);
  });

  it("a basis string of 241 characters fails", () => {
    const rule = { ...validCategoryRule(), basis: "x".repeat(241) };
    expect(CategoryRuleSchema.safeParse(rule).success).toBe(false);
  });

  it("has exactly 5 treatment members", () => {
    const treatments = ["ALLOW", "ALLOW_WITH_CAP", "ALLOW_IF", "DISALLOW", "FLAG"];
    for (const treatment of treatments) {
      expect(CategoryRuleSchema.safeParse({ ...validCategoryRule(), treatment }).success).toBe(
        true
      );
    }
    expect(
      CategoryRuleSchema.safeParse({ ...validCategoryRule(), treatment: "MAYBE" }).success
    ).toBe(false);
  });
});

describe("RulePackSchema — rateSanityCeiling", () => {
  it("parses with a subset of staff grades", () => {
    const result = RulePackSchema.safeParse(
      validPack({ rateSanityCeiling: { ADMIN: 3000 } })
    );
    expect(result.success).toBe(true);
  });

  it("parses with an empty object", () => {
    const result = RulePackSchema.safeParse(validPack({ rateSanityCeiling: {} }));
    expect(result.success).toBe(true);
  });
});

describe("MatterFlagRuleSchema — when arms", () => {
  it("parses the always arm", () => {
    const result = MatterFlagRuleSchema.safeParse({
      flagId: "HK.NOTIFY_40_DAYS",
      when: { always: true },
      message: "Notify within 40 days.",
    });
    expect(result.success).toBe(true);
  });

  it("parses a Condition arm", () => {
    const result = MatterFlagRuleSchema.safeParse({
      flagId: "HK.PHOTOCOPY_UNIT_CHECK",
      when: { field: "unit", op: "eq", value: "PAGE" },
      message: "Photocopy cap applies.",
    });
    expect(result.success).toBe(true);
  });

  it("parses the lineCount arm", () => {
    const result = MatterFlagRuleSchema.safeParse({
      flagId: "HK.FLAT_FEE_CHECK",
      when: { field: "lineCount", op: "gte", value: 8 },
      message: "Consider a flat fee.",
    });
    expect(result.success).toBe(true);
  });

  it("requiresAcknowledgement defaults to false", () => {
    const result = MatterFlagRuleSchema.safeParse({
      flagId: "HK.NOTIFY_40_DAYS",
      when: { always: true },
      message: "Notify within 40 days.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requiresAcknowledgement).toBe(false);
    }
  });
});

describe("RulePackSchema — constraints without permissive defaults", () => {
  function constraintsWithout(omit: "profitElementPermitted" | "deterrentUsePermitted") {
    const full: Record<string, unknown> = {
      noChargeForMakingRequest: false,
      estimateRequiredBeforeCharging: false,
      feeNotificationDeadlineDays: 40,
      deadlineBasis: "CALENDAR_DAYS",
      responseDeadlineDays: 40,
      advancePaymentPermitted: true,
      mayWithholdDataUntilPaid: true,
      profitElementPermitted: false,
      deterrentUsePermitted: false,
      regulatorMayReviewFee: true,
      aggregateCap: null,
    };
    delete full[omit];
    return full;
  }

  it("profitElementPermitted is required, with no default filling it in when omitted", () => {
    const result = RulePackSchema.safeParse(
      validPack({ constraints: constraintsWithout("profitElementPermitted") })
    );
    expect(result.success).toBe(false);
  });

  it("deterrentUsePermitted is required, with no default filling it in when omitted", () => {
    const result = RulePackSchema.safeParse(
      validPack({ constraints: constraintsWithout("deterrentUsePermitted") })
    );
    expect(result.success).toBe(false);
  });
});

describe("RulePackSchema — full fixture", () => {
  it("parses a complete pack end to end", () => {
    const result = RulePackSchema.safeParse(validPack());
    expect(result.success).toBe(true);
  });
});
