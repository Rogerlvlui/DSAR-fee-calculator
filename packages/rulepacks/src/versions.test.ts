// packages/rulepacks/src/versions.test.ts
//
// PACK-05 (AC-40, repository half) proofs. Test names carry "PACK-05" so
// 03-VALIDATION.md's `-t "PACK-05"` filter selects them. Both fixture roots
// live under src/__fixtures__ so loadAllRulePacks() over the real tree never
// globs them (T-03-03) — proven separately by `pnpm run pack:validate`
// exiting 0.
//
// `versions/ACME-FIXTURE` carries two versions of the same fictional pack,
// differing in categoryRules[0].treatment. `versions-single/ACME-FIXTURE`
// is a byte-identical copy of the older version, alone in its own root —
// the pair this test needs to prove the actual AC-40 property: resolving
// the older version returns the SAME content whether or not a newer sibling
// version exists beside it, not merely that a lookup works at all.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadAllRulePacks, resolveRulePack, RulePackNotFoundError } from "./loader.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TWO_VERSION_ROOT = path.resolve(__dirname, "__fixtures__", "versions");
const SINGLE_VERSION_ROOT = path.resolve(__dirname, "__fixtures__", "versions-single");

describe("resolveRulePack (PACK-05)", () => {
  it("PACK-05: resolveRulePack('ACME-FIXTURE', '2026.01.1', twoVersionRoot) returns the pack whose version is 2026.01.1, not the newest one in the directory", () => {
    const pack = resolveRulePack("ACME-FIXTURE", "2026.01.1", TWO_VERSION_ROOT);
    expect(pack.version).toBe("2026.01.1");
    expect(pack.categoryRules[0]?.treatment).toBe("FLAG");
  });

  it("PACK-05: the pack resolved for 2026.01.1 from the two-version root deep-equals the pack resolved for the same id and version from the single-version root — a newer sibling file changes nothing about the older version's resolved content", () => {
    const fromTwoVersionRoot = resolveRulePack("ACME-FIXTURE", "2026.01.1", TWO_VERSION_ROOT);
    const fromSingleVersionRoot = resolveRulePack("ACME-FIXTURE", "2026.01.1", SINGLE_VERSION_ROOT);
    expect(fromTwoVersionRoot).toEqual(fromSingleVersionRoot);
  });

  it("PACK-05: loadAllRulePacks(twoVersionRoot) returns two entries for the same packId, and neither overwrites the other", () => {
    const packs = loadAllRulePacks(TWO_VERSION_ROOT);
    const acmePacks = packs.filter((pack) => pack.packId === "ACME-FIXTURE");
    expect(acmePacks).toHaveLength(2);
    expect(acmePacks.map((pack) => pack.version).sort()).toEqual(["2026.01.1", "2026.06.1"]);
  });

  it("PACK-05: resolving an unknown version throws an error naming both the packId and the requested version", () => {
    let caught: unknown;
    try {
      resolveRulePack("ACME-FIXTURE", "9999.99.9", TWO_VERSION_ROOT);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(RulePackNotFoundError);
    const message = (caught as Error).message;
    expect(message).toContain("ACME-FIXTURE");
    expect(message).toContain("9999.99.9");
  });

  it("PACK-05: resolving an unknown packId throws an error naming the packId", () => {
    let caught: unknown;
    try {
      resolveRulePack("NO-SUCH-PACK", "2026.01.1", TWO_VERSION_ROOT);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(RulePackNotFoundError);
    expect((caught as Error).message).toContain("NO-SUCH-PACK");
  });

  it("PACK-05: resolveRulePack called twice for the same id and version returns deep-equal values", () => {
    const first = resolveRulePack("ACME-FIXTURE", "2026.06.1", TWO_VERSION_ROOT);
    const second = resolveRulePack("ACME-FIXTURE", "2026.06.1", TWO_VERSION_ROOT);
    expect(first).toEqual(second);
  });
});
