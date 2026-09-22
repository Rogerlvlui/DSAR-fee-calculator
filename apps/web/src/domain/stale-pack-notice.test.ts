// apps/web/src/domain/stale-pack-notice.test.ts
//
// AC-39's in-flight-review half. Tagged STALE-PACK-NOTICE. Every committed
// pack's review-due date is 2027-03-12 (never stale against today's real
// content — 06-RESEARCH.md Pitfall 5's same honest-fixture problem this
// phase inherits for the stale case), so the fixture is a real, loaded
// pack (loadRulePackFile, the same technique
// packages/rulepacks/src/stale.test.ts already established) spread with an
// overridden reviewDueOn, never a hand-built literal that could silently
// drift from the real committed shape.
//
// Also proves SIGNOFF-03's other, already-built half still holds
// (renderAttestation's extended §9.5 wording, appended only when the
// stale flag is set) — the plan's own instruction to prove both directions
// of the same requirement in this file, not a second, separate test file.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadRulePackFile } from "@dsar/rulepacks/loader";
import { shouldRenderStalePackNotice } from "./stale-pack-notice.ts";
import { ATTESTATION_TEMPLATE_VERSION, renderAttestation } from "./attestation.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SG_PACK_PATH = path.resolve(__dirname, "..", "..", "..", "..", "packages", "rulepacks", "SG-PDPA", "2026.09.1.json");
const basePack = loadRulePackFile(SG_PACK_PATH);

describe("STALE-PACK-NOTICE: shouldRenderStalePackNotice (both directions)", () => {
  it("STALE-PACK-NOTICE: evaluated one day before reviewDueOn -> false, no notice", () => {
    const pack = { ...basePack, status: "ACTIVE" as const, reviewDueOn: "2026-06-15" };
    expect(shouldRenderStalePackNotice(pack, "2026-06-14")).toBe(false);
  });

  it("STALE-PACK-NOTICE: evaluated exactly on reviewDueOn -> false — the helper's own past-not-on boundary", () => {
    const pack = { ...basePack, status: "ACTIVE" as const, reviewDueOn: "2026-06-15" };
    expect(shouldRenderStalePackNotice(pack, "2026-06-15")).toBe(false);
  });

  it("STALE-PACK-NOTICE: evaluated one day after reviewDueOn -> true, notice renders", () => {
    const pack = { ...basePack, status: "ACTIVE" as const, reviewDueOn: "2026-06-15" };
    expect(shouldRenderStalePackNotice(pack, "2026-06-16")).toBe(true);
  });
});

describe("STALE-PACK-NOTICE: renderAttestation's stale-extension half still holds (SIGNOFF-03)", () => {
  it("STALE-PACK-NOTICE: packIsStale true -> the extended §9.5 sentence is appended verbatim", () => {
    const text = renderAttestation({
      jurisdiction: "Singapore",
      packId: "SG-PDPA",
      packVersion: "2026.09.1",
      reviewedOn: "2026-06-01",
      packIsStale: true,
    });
    expect(text).toContain(
      "I am aware this rule pack is past its review date and I have satisfied myself as to the current position."
    );
  });

  it("STALE-PACK-NOTICE: packIsStale false -> the extended §9.5 sentence is absent", () => {
    const text = renderAttestation({
      jurisdiction: "Singapore",
      packId: "SG-PDPA",
      packVersion: "2026.09.1",
      reviewedOn: "2026-06-01",
      packIsStale: false,
    });
    expect(text).not.toContain("I am aware this rule pack is past its review date");
  });

  it("STALE-PACK-NOTICE: a real sign-off's recorded version equals ATTESTATION_TEMPLATE_VERSION", () => {
    expect(ATTESTATION_TEMPLATE_VERSION).toBe("SIGNOFF-ATTESTATION-2026.09");
  });
});
