// packages/rulepacks/src/authored-packs.test.ts
//
// PACK-09/PACK-12 — the reference-pack assertions named against HK-PDPO and
// SG-PDPA by name, per 03-VALIDATION.md's binding filter map. Counts are
// driven from the committed files via loadAllRulePacks()/readFileSync,
// never from a hand-maintained constant (03-02's stub-packs.test.ts
// precedent) — a regression that drops or adds a rule fails here rather
// than passing vacuously.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { UNAUTHORED_TOKEN } from "@dsar/schemas/constants";
import { EXPENSE_CATEGORY_CODES } from "@dsar/schemas/taxonomy";
import { loadAllRulePacks, RULEPACKS_ROOT } from "./loader.ts";
import { assertActiveReady, findBannedWord } from "./validate.ts";

const NON_PACK_DIRECTORIES = new Set(["src", "scripts", "node_modules", "dist"]);

function committedPackDirNames(): string[] {
  return readdirSync(RULEPACKS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !NON_PACK_DIRECTORIES.has(entry.name))
    .map((entry) => entry.name);
}

function unauthoredCount(pack: ReturnType<typeof loadAllRulePacks>[number]): {
  authored: number;
  unauthored: number;
} {
  const unauthored = pack.categoryRules.filter((rule) =>
    rule.verificationNote?.startsWith(UNAUTHORED_TOKEN)
  ).length;
  return { authored: pack.categoryRules.length - unauthored, unauthored };
}

function hkAndSg() {
  const packs = loadAllRulePacks();
  const hk = packs.find((p) => p.packId === "HK-PDPO");
  const sg = packs.find((p) => p.packId === "SG-PDPA");
  return { hk, sg };
}

describe("PACK-09: HK-PDPO and SG-PDPA — shape and DRAFT status", () => {
  it("PACK-09: both HK-PDPO and SG-PDPA parse, are DRAFT, and have exactly 21 categoryRules whose codes in file order equal EXPENSE_CATEGORY_CODES", () => {
    const { hk, sg } = hkAndSg();
    expect(hk).toBeDefined();
    expect(sg).toBeDefined();
    for (const pack of [hk!, sg!]) {
      expect(pack.status).toBe("DRAFT");
      expect(pack.categoryRules).toHaveLength(21);
      expect(pack.categoryRules.map((rule) => rule.categoryCode)).toEqual([
        ...EXPENSE_CATEGORY_CODES,
      ]);
    }
  });

  it("PACK-09: HK-PDPO has exactly 9 rules without the UNAUTHORED token and 12 with", () => {
    const { hk } = hkAndSg();
    const { authored, unauthored } = unauthoredCount(hk!);
    expect(authored).toBe(9);
    expect(unauthored).toBe(12);
  });

  it("PACK-09: SG-PDPA has exactly 6 rules without the UNAUTHORED token and 15 with", () => {
    const { sg } = hkAndSg();
    const { authored, unauthored } = unauthoredCount(sg!);
    expect(authored).toBe(6);
    expect(unauthored).toBe(15);
  });

  it("PACK-09: every categoryRule in both HK-PDPO and SG-PDPA is NEEDS_VERIFICATION, and every basis is non-empty and banned-word-free", () => {
    const { hk, sg } = hkAndSg();
    for (const pack of [hk!, sg!]) {
      for (const rule of pack.categoryRules) {
        expect(rule.verificationStatus).toBe("NEEDS_VERIFICATION");
        expect(rule.basis.length).toBeGreaterThan(0);
        expect(findBannedWord(rule.basis)).toBeNull();
      }
    }
  });
});

describe("PACK-09: named spot-checks against the PRD", () => {
  it("PACK-09: HK-PDPO.STAFF_TIME_REDACT_EXEMPT is DISALLOW", () => {
    const { hk } = hkAndSg();
    const rule = hk!.categoryRules.find((r) => r.categoryCode === "STAFF_TIME_REDACT_EXEMPT");
    expect(rule?.treatment).toBe("DISALLOW");
  });

  it("PACK-09: SG-PDPA.STAFF_TIME_ASSESS_EXEMPTIONS is DISALLOW", () => {
    const { sg } = hkAndSg();
    const rule = sg!.categoryRules.find((r) => r.categoryCode === "STAFF_TIME_ASSESS_EXEMPTIONS");
    expect(rule?.treatment).toBe("DISALLOW");
  });

  it("PACK-09: SG-PDPA.PHOTOCOPY_PRINT is ALLOW_WITH_CAP with a PER_UNIT cap of 12 per PAGE", () => {
    const { sg } = hkAndSg();
    const rule = sg!.categoryRules.find((r) => r.categoryCode === "PHOTOCOPY_PRINT");
    expect(rule?.treatment).toBe("ALLOW_WITH_CAP");
    expect(rule?.cap).toEqual({ type: "PER_UNIT", amount: 12, unit: "PAGE" });
  });

  it("PACK-09: SG-PDPA.VENDOR_PAYROLL is ALLOW_IF with two conditions", () => {
    const { sg } = hkAndSg();
    const rule = sg!.categoryRules.find((r) => r.categoryCode === "VENDOR_PAYROLL");
    expect(rule?.treatment).toBe("ALLOW_IF");
    expect(rule?.conditions).toHaveLength(2);
  });

  it("PACK-09: OTHER_UNCLASSIFIED is FLAG in both HK-PDPO and SG-PDPA", () => {
    const { hk, sg } = hkAndSg();
    for (const pack of [hk!, sg!]) {
      const rule = pack.categoryRules.find((r) => r.categoryCode === "OTHER_UNCLASSIFIED");
      expect(rule?.treatment).toBe("FLAG");
    }
  });
});

describe("PACK-09: ruleId uniqueness across all nine committed packs", () => {
  it("PACK-09: every ruleId across all nine committed packs is unique and equals `${packId}.${categoryCode}`", () => {
    const packs = loadAllRulePacks();
    const seen = new Set<string>();
    for (const pack of packs) {
      for (const rule of pack.categoryRules) {
        expect(rule.ruleId).toBe(`${pack.packId}.${rule.categoryCode}`);
        expect(seen.has(rule.ruleId)).toBe(false);
        seen.add(rule.ruleId);
      }
    }
  });
});

describe("PACK-09/D-16: assertActiveReady refuses both reference packs by name", () => {
  // D-16: HK-PDPO and SG-PDPA stay DRAFT this phase; full authoring is
  // deferred to before Phase 6's convergence gate. Both packs' authoredBy/
  // reviewedBy/reviewedOn are transcribed as null exactly as PRD §7.5/§7.6
  // print them (D-14 forbids inventing a reviewer identity the PRD does not
  // supply — D-17's seeded prototype identity is Phase 3.2's job, not
  // this plan's). Given that, ACTIVE_READY_CHECK_ORDER's REVIEWER_IDENTITY
  // check (established in plan 03-03, unmodified here) fires before
  // UNAUTHORED_CONTENT — MISSING_REVIEWER, not UNAUTHORED_CONTENT, is the
  // code both packs actually throw. Both codes are genuine assertActiveReady
  // refusals proving the same substantive fact this test exists to prove —
  // D-16's DRAFT deferral is enforced, not merely documented — so the
  // assertion below is against the real, verified thrown code rather than
  // a code that does not occur given honestly-transcribed reviewer fields.
  it("PACK-09: assertActiveReady throws MISSING_REVIEWER for HK-PDPO, naming the pack", () => {
    const { hk } = hkAndSg();
    expect(() => assertActiveReady(hk!)).toThrow();
    try {
      assertActiveReady(hk!);
      expect.fail("expected assertActiveReady to throw for HK-PDPO");
    } catch (error) {
      expect((error as { code?: string }).code).toBe("MISSING_REVIEWER");
      expect((error as { packId?: string }).packId).toBe("HK-PDPO");
    }
  });

  it("PACK-09: assertActiveReady throws MISSING_REVIEWER for SG-PDPA, naming the pack", () => {
    const { sg } = hkAndSg();
    expect(() => assertActiveReady(sg!)).toThrow();
    try {
      assertActiveReady(sg!);
      expect.fail("expected assertActiveReady to throw for SG-PDPA");
    } catch (error) {
      expect((error as { code?: string }).code).toBe("MISSING_REVIEWER");
      expect((error as { packId?: string }).packId).toBe("SG-PDPA");
    }
  });
});

describe("PACK-12: HK's flat fee is the only one — the other eight packs are untouched", () => {
  it("PACK-12: HK-PDPO's raw JSON has a flatFee key; each of the other eight committed pack files does not", () => {
    const packIds = committedPackDirNames();
    expect(packIds).toContain("HK-PDPO");
    expect(packIds).toHaveLength(9);

    for (const packId of packIds) {
      const packDir = path.join(RULEPACKS_ROOT, packId);
      const [fileName] = readdirSync(packDir).filter((f) => f.endsWith(".json"));
      const raw = JSON.parse(readFileSync(path.join(packDir, fileName!), "utf-8")) as Record<
        string,
        unknown
      >;
      if (packId === "HK-PDPO") {
        expect("flatFee" in raw).toBe(true);
      } else {
        expect("flatFee" in raw).toBe(false);
      }
    }
  });
});
