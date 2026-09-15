// packages/engine/src/perf.test.ts
//
// ENGINE-17 / PRD §11 — a 50-line assessment must complete in under 100ms.
// 02-RESEARCH.md Pattern 5: median-of-N `performance.now()` timing in a
// plain `it()`, never `vitest bench`/tinybench — tinybench is built for
// trend-dashboard tracking across controlled hardware, not a single-run
// pass/fail CI gate, and its documented run-to-run variance on shared
// hardware is exactly the "flaky perf test gets deleted" failure mode
// 02-CONTEXT.md's Claude's Discretion warns against.
//
// `performance` is Node's `perf_hooks` high-resolution timer — not the
// banned `Date` global, and unaffected by TZ/locale, so it carries none of
// purity.tz.test.ts's concerns.
//
// The median (not the mean, not the max) is asserted: a single scheduling
// hiccup on a loaded machine moves the mean and dominates the max, and a
// gate that fails because another process was briefly busy is a gate that
// gets deleted.

import { describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";
import { assess } from "./assess.ts";
import { REFERENCE_MATTER, REFERENCE_NOW } from "./__fixtures__/reference-matter.ts";
import { REFERENCE_FIXTURE_PACK } from "./__fixtures__/reference-pack.ts";
import { FIFTY_LINE_FIXTURE_LENGTH, FIFTY_LINE_FIXTURE_LINES } from "./__fixtures__/fifty-line-fixture.ts";

const BUDGET_MS = 100;
const DEFAULT_WARMUP_RUNS = 5;
const DEFAULT_MEASURED_SAMPLES = 20;

function median(samples: readonly number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

// The one sampling helper both the real budget assertion and the
// deliberately-slow control below call — proving the SAME timing path
// backs both. `warmupRuns`/`measuredSamples` are parameterised (not
// hardcoded) so the control test below can use a smaller sample count
// (its busy-loop's outcome is not remotely close to the boundary, so 20
// full samples would only add wall-clock time without adding certainty).
function medianElapsedMs(
  fn: () => void,
  warmupRuns: number = DEFAULT_WARMUP_RUNS,
  measuredSamples: number = DEFAULT_MEASURED_SAMPLES
): number {
  for (let i = 0; i < warmupRuns; i++) {
    fn(); // JIT warm-up — discarded, never contributes a sample
  }
  const samples: number[] = [];
  for (let i = 0; i < measuredSamples; i++) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  return median(samples);
}

describe("performance budget — 50 lines under 100ms (ENGINE-17, PRD §11)", () => {
  it("the fifty-line fixture has exactly 50 lines", () => {
    expect(FIFTY_LINE_FIXTURE_LENGTH).toBe(50);
    expect(FIFTY_LINE_FIXTURE_LINES).toHaveLength(50);
  });

  it("assesses 50 lines with a median under 100ms across 20 samples after a discarded 5-run warm-up", () => {
    // Fixture construction and every other setup step sit OUTSIDE the timed
    // region — only assess() itself is measured, matching ENGINE-17's own
    // scope (assess() is never validated with .parse() in its hot path;
    // see assess.ts's module note).
    const m = medianElapsedMs(() => {
      assess({
        matter: REFERENCE_MATTER,
        lines: FIFTY_LINE_FIXTURE_LINES,
        pack: REFERENCE_FIXTURE_PACK,
        now: REFERENCE_NOW,
      });
    });
    expect(m).toBeLessThan(BUDGET_MS);
  });

  it("the same sampling helper exceeds the budget on a deliberately slow control function — proving the harness can fail", () => {
    // A local, in-file busy-loop — never a change to assess() itself, and
    // never a temporary edit removed afterwards. Spins comfortably past the
    // budget (120ms, not a hair over it) so this stays robust to scheduler
    // jitter on a loaded machine; a smaller sample count is enough here
    // because a 120ms-vs-100ms gap is nowhere near the boundary the real
    // assertion above cares about.
    function slowControl(): void {
      const start = performance.now();
      while (performance.now() - start < 120) {
        // deliberately busy — proves the timing path is live, not a no-op
      }
    }
    const m = medianElapsedMs(slowControl, 2, 5);
    expect(m).toBeGreaterThan(BUDGET_MS);
  });
});
