// packages/rulepacks/src/loader.test.ts
//
// The end-to-end proof (Task 1): a committed pack JSON travels file to
// loader to a parsed LoadableRulePack. Test names carry the requirement IDs
// exactly as 03-VALIDATION.md's map specifies, so `-t "PACK-01"` and
// `-t "PACK-10"` select the right tests.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LoadableRulePackSchema } from "@dsar/schemas/rule-pack";
import { loadAllRulePacks, loadRulePackFile, RULEPACKS_ROOT } from "./loader.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("loadAllRulePacks (PACK-01)", () => {
  it("PACK-01: returns every committed pack, each packId matching its directory name", () => {
    const packs = loadAllRulePacks();
    expect(packs.length).toBeGreaterThan(0);

    const packDirNames = readdirSync(RULEPACKS_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !["src", "scripts", "node_modules", "dist"].includes(entry.name))
      .map((entry) => entry.name);

    expect(packs.map((pack) => pack.packId).sort()).toEqual([...packDirNames].sort());
    for (const pack of packs) {
      expect(packDirNames).toContain(pack.packId);
    }
  });

  // The assumption-delta companion invariant (03-01-PLAN.md): every pack in
  // the real tree round-trips through the primary load path. This test goes
  // red the instant a future phase re-points the loader at the narrower
  // RulePackSchema instead of LoadableRulePackSchema.
  it("every committed pack round-trips through LoadableRulePackSchema (parse, re-serialise, re-parse, deep-equal)", () => {
    const packs = loadAllRulePacks();
    expect(packs.length).toBeGreaterThan(0);

    for (const pack of packs) {
      const reparsed = LoadableRulePackSchema.parse(JSON.parse(JSON.stringify(pack)));
      expect(reparsed).toEqual(pack);
    }
  });

  it("PACK-10: the VN-PDPL stub pack is DRAFT, has 21 FLAG/NEEDS_VERIFICATION categoryRules, and all eleven constraints are null", () => {
    const vnPackPath = path.resolve(__dirname, "..", "VN-PDPL", "2026.09.1.json");
    const pack = loadRulePackFile(vnPackPath);

    expect(pack.status).toBe("DRAFT");
    expect(pack.categoryRules).toHaveLength(21);
    for (const rule of pack.categoryRules) {
      expect(rule.treatment).toBe("FLAG");
      expect(rule.verificationStatus).toBe("NEEDS_VERIFICATION");
    }

    const constraintValues = Object.values(pack.constraints);
    expect(constraintValues).toHaveLength(11);
    for (const value of constraintValues) {
      expect(value).toBeNull();
    }
  });
});
