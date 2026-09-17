// packages/rulepacks/src/stale.test.ts
//
// PACK-04 (AC-39) proofs. Test names carry "PACK-04" so 03-VALIDATION.md's
// `-t "PACK-04"` filter selects them. Pack inputs are built by spreading the
// committed VN-PDPL stub pack and overriding only `status` and
// `reviewDueOn`, so the fixtures stay in sync with the real committed shape
// rather than a hand-maintained parallel one (loader.test.ts precedent).

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadRulePackFile } from "./loader.ts";
import { findBannedWord } from "./validate.ts";
import { deriveEffectiveStatus, daysUntilReviewDue, staleReason } from "./stale.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VN_PACK_PATH = path.resolve(__dirname, "..", "VN-PDPL", "2026.09.1.json");
const basePack = loadRulePackFile(VN_PACK_PATH);

describe("deriveEffectiveStatus (PACK-04)", () => {
  it("PACK-04: an ACTIVE pack whose reviewDueOn is one day before now derives STALE", () => {
    const pack = { ...basePack, status: "ACTIVE" as const, reviewDueOn: "2026-06-14" };
    expect(deriveEffectiveStatus(pack, "2026-06-15")).toBe("STALE");
  });

  it("PACK-04: an ACTIVE pack whose reviewDueOn equals now's calendar date derives ACTIVE — past, not on", () => {
    const pack = { ...basePack, status: "ACTIVE" as const, reviewDueOn: "2026-06-15" };
    expect(deriveEffectiveStatus(pack, "2026-06-15")).toBe("ACTIVE");
  });

  it("PACK-04: an ACTIVE pack whose reviewDueOn is one day after now derives ACTIVE", () => {
    const pack = { ...basePack, status: "ACTIVE" as const, reviewDueOn: "2026-06-16" };
    expect(deriveEffectiveStatus(pack, "2026-06-15")).toBe("ACTIVE");
  });

  it("PACK-04: a DRAFT pack past its reviewDueOn derives DRAFT — derivation never overrides a stored non-ACTIVE status", () => {
    const pack = { ...basePack, status: "DRAFT" as const, reviewDueOn: "2026-06-14" };
    expect(deriveEffectiveStatus(pack, "2026-06-15")).toBe("DRAFT");
  });

  it("PACK-04: a WITHDRAWN pack past its reviewDueOn derives WITHDRAWN — derivation never overrides a stored non-ACTIVE status", () => {
    const pack = { ...basePack, status: "WITHDRAWN" as const, reviewDueOn: "2026-06-14" };
    expect(deriveEffectiveStatus(pack, "2026-06-15")).toBe("WITHDRAWN");
  });

  it("PACK-04: a pack whose stored status is STALE with a future reviewDueOn derives STALE — derivation never makes a pack look fresher than its stored status claims", () => {
    const pack = { ...basePack, status: "STALE" as const, reviewDueOn: "2027-06-15" };
    expect(deriveEffectiveStatus(pack, "2026-06-15")).toBe("STALE");
  });
});

describe("staleReason (PACK-04)", () => {
  it("PACK-04: staleReason returns null for a non-stale pack", () => {
    const pack = { ...basePack, status: "ACTIVE" as const, reviewDueOn: "2026-06-16" };
    expect(staleReason(pack, "2026-06-15")).toBeNull();
  });

  it("PACK-04: staleReason for a stale pack returns a string containing both the reviewDueOn value and the now value", () => {
    const pack = { ...basePack, status: "ACTIVE" as const, reviewDueOn: "2026-06-14" };
    const reason = staleReason(pack, "2026-06-15");
    expect(reason).not.toBeNull();
    expect(reason).toContain("2026-06-14");
    expect(reason).toContain("2026-06-15");
  });

  it("PACK-04: findBannedWord(staleReason(stalePack, now)) returns null", () => {
    const pack = { ...basePack, status: "ACTIVE" as const, reviewDueOn: "2026-06-14" };
    const reason = staleReason(pack, "2026-06-15");
    expect(findBannedWord(reason ?? "")).toBeNull();
  });
});

describe("daysUntilReviewDue (PACK-04)", () => {
  it("PACK-04: daysUntilReviewDue returns a positive number for a future reviewDueOn", () => {
    const pack = { ...basePack, reviewDueOn: "2026-06-20" };
    expect(daysUntilReviewDue(pack, "2026-06-15")).toBe(5);
  });

  it("PACK-04: daysUntilReviewDue returns zero for a reviewDueOn equal to today", () => {
    const pack = { ...basePack, reviewDueOn: "2026-06-15" };
    expect(daysUntilReviewDue(pack, "2026-06-15")).toBe(0);
  });

  it("PACK-04: daysUntilReviewDue returns a negative number for a past reviewDueOn", () => {
    const pack = { ...basePack, reviewDueOn: "2026-06-10" };
    expect(daysUntilReviewDue(pack, "2026-06-15")).toBe(-5);
  });
});
