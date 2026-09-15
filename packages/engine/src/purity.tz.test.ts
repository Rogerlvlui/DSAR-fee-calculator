// packages/engine/src/purity.tz.test.ts
//
// Success Criterion 2 (ENGINE-15) — the timezone leg. Proves assess()
// produces deeply-identical output under two host timezones fourteen hours
// apart, over three fixtures including a pack whose review falls exactly on
// the 30-day STALE_PACK_WARNING boundary (calendar-math.ts's own note: this
// is the only place a day-boundary bug could surface at all).
//
// The LOCALE half of Success Criterion 2 is deliberately NOT tested here.
// 02-RESEARCH.md Pattern 6 verified empirically, on this machine, that the
// `LANG`/`LC_ALL` environment variables do not move Node's `Intl` default
// locale — a locale-flip test would pass while testing nothing, exactly the
// Phase 1 failure mode this phase exists to stop repeating. Its enforcement
// is plan 02-02's static ESLint ban on `Intl`/`toLocale*` inside
// packages/engine (eslint.config.js), proven to fire by
// tests/toolchain/lint-engine-determinism.test.ts. Do not "complete" this
// file by adding an inert locale flip.
//
// vi.stubEnv/vi.unstubAllEnvs (not a direct `process.env.TZ =` mutation) is
// Vitest's own env-stubbing API, guaranteed to restore the prior value even
// if a test throws — paired with an afterEach below so no sibling engine
// test can ever observe a leaked TZ stub.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { RulePack } from "@dsar/schemas/rule-pack";
import { assess } from "./assess.ts";
import { REFERENCE_LINE, REFERENCE_MATTER, REFERENCE_NOW, buildReferencePack } from "./__fixtures__/reference-matter.ts";
import { REFERENCE_FIXTURE_PACK } from "./__fixtures__/reference-pack.ts";
import { REFERENCE_FIXTURE_LINES } from "./__fixtures__/reference-lines.ts";
import { buildFlatFeeFixturePack } from "./__fixtures__/flat-fee-pack.ts";

// UTC and the most extreme currently-observed positive offset (UTC+14) —
// chosen (02-RESEARCH.md Pattern 6) to maximise the chance of exposing a
// hidden day-boundary bug in the reviewDueOn/STALE_PACK_WARNING comparisons.
const TZ_A = "UTC";
const TZ_B = "Pacific/Kiritimati";

afterEach(() => {
  vi.unstubAllEnvs();
});

function runReferenceFixtureAssess() {
  return assess({
    matter: REFERENCE_MATTER,
    lines: REFERENCE_FIXTURE_LINES,
    pack: REFERENCE_FIXTURE_PACK,
    now: REFERENCE_NOW,
  });
}

function runFlatFeeFixtureAssess() {
  return assess({
    matter: REFERENCE_MATTER,
    lines: [REFERENCE_LINE],
    pack: buildFlatFeeFixturePack(),
    now: REFERENCE_NOW,
  });
}

// reviewDueOn exactly 30 calendar days after REFERENCE_NOW
// ("2026-09-15T00:00:00Z") — the inclusive STALE_PACK_WARNING boundary
// (matter-flags.ts: `daysUntil(now, reviewDueOn) <= 30`). This is the one
// place in the engine a day-boundary bug could surface at all
// (calendar-math.ts's own module note); building it fresh per call avoids
// any shared-mutable-fixture concern across the two TZ runs below.
function buildStalenessBoundaryPack(): RulePack {
  return { ...buildReferencePack(), reviewDueOn: "2026-10-15" };
}

function runStalenessBoundaryAssess() {
  return assess({
    matter: REFERENCE_MATTER,
    lines: [REFERENCE_LINE],
    pack: buildStalenessBoundaryPack(),
    now: REFERENCE_NOW,
  });
}

// The one deliberate reference to the `Date` global in this file (and, per
// plan 02-02's static ban, the only place in packages/engine at all where it
// is permitted to appear — never in production source, where the ESLint
// rule below correctly forbids it). This is the control that proves
// vi.stubEnv('TZ', ...) actually changes what the platform's own date
// handling returns — without it, a bug in the stub itself (or a Vitest
// isolation setting that does not honour per-file env stubs) could make
// every deep-equality assertion above pass vacuously, for the wrong reason.
function readPlatformTzOffsetMinutes(): number {
  // eslint-disable-next-line no-restricted-globals -- deliberate control proving the TZ stub takes effect; never used in packages/engine's production source (see module comment above).
  return new Date(2026, 0, 1).getTimezoneOffset();
}

describe("engine output is invariant across a fourteen-hour timezone swing", () => {
  it("the PRD §14 reference fixture — full result, including matter flag ordering and every total", () => {
    vi.stubEnv("TZ", TZ_A);
    const resultA = runReferenceFixtureAssess();
    vi.stubEnv("TZ", TZ_B);
    const resultB = runReferenceFixtureAssess();
    expect(resultB).toEqual(resultA);
  });

  it("the flat-fee fixture — full result", () => {
    vi.stubEnv("TZ", TZ_A);
    const resultA = runFlatFeeFixtureAssess();
    vi.stubEnv("TZ", TZ_B);
    const resultB = runFlatFeeFixtureAssess();
    expect(resultB).toEqual(resultA);
  });

  it("a pack whose review falls exactly on the 30-day STALE_PACK_WARNING boundary — full result", () => {
    vi.stubEnv("TZ", TZ_A);
    const resultA = runStalenessBoundaryAssess();
    vi.stubEnv("TZ", TZ_B);
    const resultB = runStalenessBoundaryAssess();
    expect(resultB).toEqual(resultA);

    // Confirm this fixture actually exercises the boundary it is named for —
    // a passing deep-equality between two results that never fired
    // STALE_PACK_WARNING at all would prove nothing about the day-boundary
    // case this test exists for.
    expect(resultA.matterLevelFlags.some((flag) => flag.code === "STALE_PACK_WARNING")).toBe(true);
  });
});

describe("gate integrity — the environment stub actually takes effect", () => {
  it("a control value computed through the platform's own date handling DIFFERS between the two stub settings — proving the deep-equality assertions above are not passing vacuously", () => {
    vi.stubEnv("TZ", TZ_A);
    const offsetA = readPlatformTzOffsetMinutes();
    vi.stubEnv("TZ", TZ_B);
    const offsetB = readPlatformTzOffsetMinutes();
    expect(offsetB).not.toBe(offsetA);
  });
});
