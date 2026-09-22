// tests/routes/reference-fixture.test.ts
//
// Drives the full HTTP path — create, six line posts, submit — from PRD
// §14's reference fixture (apps/web/src/server/__fixtures__/reference-fixture.ts)
// and asserts the returned assessment against the REAL committed SG-PDPA
// pack's own figures. Every test name is tagged FIXTURE-TOTALS.
//
// restingOnUnverifiedRules is 26640, not PRD §14's published literal 10640.
// This is correct and is the product owner's recorded decision
// (03.1-RESEARCH.md Assumption A2, rejected Option B, 2026-09-18): the real,
// committed SG-PDPA/2026.09.1.json pack marks EVERY one of its six relevant
// category rules NEEDS_VERIFICATION (not just two, as PRD §14's own worked
// example and packages/engine's internal fixture pack assume) — so all
// three allowed/capped lines here rest on unverified rules, and the whole
// draftBaseline (26640) is "resting on unverified rules". The pack content
// is not edited to force PRD §14's number; the real pack's own content
// dictates this figure.

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import {
  REFERENCE_MATTER_INPUT,
  REFERENCE_FIXTURE_LINE_INPUTS,
} from "../../apps/web/src/server/__fixtures__/reference-fixture.ts";

const BASE_URL = "http://localhost/api/matters";

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function submitReferenceFixture() {
  const createResponse = await createMatterRoute(jsonRequest(BASE_URL, REFERENCE_MATTER_INPUT));
  expect(createResponse.status).toBe(201);
  const matter = (await createResponse.json()) as { id: string };

  for (const lineInput of REFERENCE_FIXTURE_LINE_INPUTS) {
    const lineResponse = await addLineRoute(jsonRequest(`${BASE_URL}/${matter.id}/lines`, lineInput), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(lineResponse.status).toBe(201);
  }

  const submitResponse = await submitRoute(jsonRequest(`${BASE_URL}/${matter.id}/submit`, {}), {
    params: Promise.resolve({ id: matter.id }),
  });
  expect(submitResponse.status).toBe(200);
  return submitResponse.json();
}

describe("FIXTURE-TOTALS — PRD §14 reference fixture through the real HTTP path", () => {
  it("FIXTURE-TOTALS: applies the real committed SG-PDPA pack", async () => {
    const assessment = await submitReferenceFixture();

    expect(assessment.rulePackId).toBe("SG-PDPA");
    expect(assessment.rulePackVersion).toBe("2026.09.1");
  });

  it("FIXTURE-TOTALS: per-line verdicts and engine amounts match the real pack's own content, in order", async () => {
    const assessment = await submitReferenceFixture();

    const verdictsAndAmounts = assessment.lines.map((line: { verdict: string; engineAmount: number }) => [
      line.verdict,
      line.engineAmount,
    ]);

    expect(verdictsAndAmounts).toEqual([
      ["ALLOW", 16000],
      ["ALLOW", 8000],
      ["DISALLOW", 0],
      ["ALLOW_CAPPED", 2640],
      ["FLAG", 0],
      ["FLAG", 0],
    ]);
  });

  it("FIXTURE-TOTALS: the six published totals, including the real pack's restingOnUnverifiedRules of 26640", async () => {
    const assessment = await submitReferenceFixture();

    expect(assessment.totals).toEqual({
      claimedTotal: 88800,
      draftBaseline: 26640,
      disallowedTotal: 12660,
      flaggedTotal: 49500,
      restingOnUnverifiedRules: 26640,
      finalAmount: null,
    });
  });

  it("FIXTURE-TOTALS: line 5's flag reasons are exactly CONDITIONS_NOT_MET then MATERIALITY, line 6's exactly UNCATEGORISED", async () => {
    const assessment = await submitReferenceFixture();

    expect(assessment.lines[4].flagReasons.map((r: { code: string }) => r.code)).toEqual([
      "CONDITIONS_NOT_MET",
      "MATERIALITY",
    ]);
    expect(assessment.lines[5].flagReasons.map((r: { code: string }) => r.code)).toEqual(["UNCATEGORISED"]);
  });

  it("FIXTURE-TOTALS: every line's disposition is PENDING", async () => {
    const assessment = await submitReferenceFixture();

    for (const line of assessment.lines) {
      expect(line.disposition).toBe("PENDING");
    }
  });

  it("FIXTURE-TOTALS: matter-level flags carry the litigation-posture flag and the three SG pack flags, and never the stale-pack warning", async () => {
    const assessment = await submitReferenceFixture();

    const flagCodes = assessment.matterLevelFlags.map((flag: { id: string }) => flag.id);
    expect(flagCodes).toContain("LITIGATION_POSTURE");
    expect(flagCodes).toContain("SG.WRITTEN_ESTIMATE");
    expect(flagCodes).toContain("SG.RESPOND_30_DAYS");
    expect(flagCodes).toContain("SG.NOT_A_DETERRENT");
    // Live wall-clock `now` against the pack's 2027-03-12 review date is why
    // this is absent — asserting the absence is what stops a later silent
    // change of that clock from going unnoticed.
    expect(flagCodes).not.toContain("STALE_PACK_WARNING");
  });
});
