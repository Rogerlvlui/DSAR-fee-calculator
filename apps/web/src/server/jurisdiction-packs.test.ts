// @vitest-environment node
//
// apps/web/src/server/jurisdiction-packs.test.ts
//
// Runs under the "web" project's include glob but overrides its jsdom
// environment back to node via the docblock above: jsdom always provides a
// `window` global, which trips apps/web/src/server/server-only.ts's browser
// guard the moment this file imports jurisdiction-packs.ts.
//
// Tagged JURISDICTION-PACKS. Fixture packs are built by spreading the real
// committed VN-PDPL pack and overriding only what a test needs (loader.ts's
// own precedent, stale.test.ts), so fixtures stay in sync with the real
// committed shape rather than a hand-maintained parallel one.

import { describe, expect, it } from "vitest";
import { loadRulePackFile } from "@dsar/rulepacks/loader";
import { PACK_JURISDICTIONS } from "@dsar/rulepacks/stub-category-rules";
import { EXPENSE_CATEGORY_CODES } from "@dsar/schemas/taxonomy";
import type { LoadableRulePack } from "@dsar/schemas/rule-pack";

import { resolveRulepacksRoot } from "./rulepacks-root.ts";
import { resolveJurisdictionPackViews, buildJurisdictionPackViews } from "./jurisdiction-packs.ts";

const ROOT = resolveRulepacksRoot();
const basePack: LoadableRulePack = loadRulePackFile(`${ROOT}/VN-PDPL/2026.09.1.json`);

const NOW = "2026-09-19T00:00:00.000Z";

describe("JURISDICTION-PACKS: resolveJurisdictionPackViews", () => {
  it("JURISDICTION-PACKS: given all nine real committed packs, returns exactly nine entries, one per JurisdictionCode", () => {
    const loadedPacks = loadRulePackFileEachJurisdiction();
    const views = resolveJurisdictionPackViews(loadedPacks, NOW);
    const keys = Object.keys(views).sort();
    const expectedKeys = PACK_JURISDICTIONS.map((row) => row.jurisdictionCode).sort();
    expect(keys).toEqual(expectedKeys);
  });

  it("JURISDICTION-PACKS: a jurisdiction whose loaded pack has status DRAFT (true of every committed pack today) resolves to displayStatus DRAFT", () => {
    const loadedPacks = loadRulePackFileEachJurisdiction();
    const views = resolveJurisdictionPackViews(loadedPacks, NOW);
    for (const view of Object.values(views)) {
      expect(view.displayStatus).toBe("DRAFT");
    }
  });

  it("JURISDICTION-PACKS: a hand-built ACTIVE pack with reviewDueOn more than 30 days after now resolves to ACTIVE", () => {
    const pack: LoadableRulePack = { ...basePack, status: "ACTIVE", reviewDueOn: "2026-12-01" };
    const views = resolveJurisdictionPackViews([pack], "2026-09-19");
    expect(views.VN?.displayStatus).toBe("ACTIVE");
  });

  it("JURISDICTION-PACKS: a hand-built ACTIVE pack with reviewDueOn exactly 30 days after now resolves to ACTIVE_REVIEW_DUE_SOON (inclusive boundary)", () => {
    const pack: LoadableRulePack = { ...basePack, status: "ACTIVE", reviewDueOn: "2026-10-19" };
    const views = resolveJurisdictionPackViews([pack], "2026-09-19");
    expect(views.VN?.displayStatus).toBe("ACTIVE_REVIEW_DUE_SOON");
  });

  it("JURISDICTION-PACKS: a hand-built ACTIVE pack with reviewDueOn before now resolves to STALE via deriveEffectiveStatus", () => {
    const pack: LoadableRulePack = { ...basePack, status: "ACTIVE", reviewDueOn: "2026-09-01" };
    const views = resolveJurisdictionPackViews([pack], "2026-09-19");
    expect(views.VN?.displayStatus).toBe("STALE");
  });

  it("JURISDICTION-PACKS: a PACK_JURISDICTIONS-shaped list missing one jurisdiction's pack produces NO_USABLE_PACK for exactly that jurisdiction, every other jurisdiction unaffected", () => {
    const loadedPacksFull = loadRulePackFileEachJurisdiction();
    const loadedPacksMissingSg = loadedPacksFull.filter((pack) => pack.jurisdiction.code !== "SG");

    const fullViews = resolveJurisdictionPackViews(loadedPacksFull, NOW);
    const missingViews = resolveJurisdictionPackViews(loadedPacksMissingSg, NOW);

    const sgView = missingViews.SG;
    expect(sgView?.displayStatus).toBe("NO_USABLE_PACK");
    expect(sgView?.packId).toBeNull();
    expect(sgView?.version).toBeNull();
    expect(sgView?.feePosture).toBeNull();
    expect(sgView?.constraints).toBeNull();
    expect(sgView?.categories).toEqual([]);

    for (const code of Object.keys(missingViews) as (keyof typeof missingViews)[]) {
      if (code === "SG") continue;
      expect(missingViews[code]).toEqual(fullViews[code]);
    }
  });

  it("JURISDICTION-PACKS: categories has one entry per EXPENSE_CATEGORY_CODES member, with NOT_YET_AUTHORED_HINT where no CategoryRule exists", () => {
    const loadedPacks = loadRulePackFileEachJurisdiction();
    const views = resolveJurisdictionPackViews(loadedPacks, NOW);
    const vnView = views.VN;
    expect(vnView?.categories.length).toBe(EXPENSE_CATEGORY_CODES.length);
    expect(vnView?.categories.every((category) => typeof category.hint === "string")).toBe(true);
  });

  it("JURISDICTION-PACKS: buildJurisdictionPackViews resolves against the real committed nine packs with no arguments", () => {
    const views = buildJurisdictionPackViews();
    expect(Object.keys(views).length).toBe(PACK_JURISDICTIONS.length);
  });
});

function loadRulePackFileEachJurisdiction(): LoadableRulePack[] {
  const versionByPackId: Record<string, string> = {
    "VN-PDPL": "2026.09.1",
    "HK-PDPO": "2026.09.1",
    "SG-PDPA": "2026.09.1",
    "AU-PRIVACY-ACT": "2026.09.1",
    "NZ-PRIVACY-ACT": "2026.09.1",
    "JP-APPI": "2026.09.1",
    "KR-PIPA": "2026.09.1",
    "CN-PIPL": "2026.09.1",
    "IN-DPDP": "2026.09.1",
  };
  return PACK_JURISDICTIONS.map((row) => {
    const version = versionByPackId[row.packId] ?? "2026.09.1";
    return loadRulePackFile(`${ROOT}/${row.packId}/${version}.json`);
  });
}
