// packages/engine/src/calendar-math.test.ts
//
// Falsifies calendar-math.ts: the epoch anchor, the 1900-vs-2000 leap-year
// pair (a naive `year % 4` rule fails this — 02-RESEARCH.md Pattern 4),
// daysUntil's three day-boundary cases, malformed-input rejection, and a
// fast-check property over antisymmetry / add-then-difference round-tripping.

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { civilToDayNumber, daysUntil, parseIsoCalendarParts } from "./calendar-math.ts";

// Test-only inverse of civilToDayNumber (the standard "civil from days"
// companion algorithm) — used solely to construct round-trip fixtures for
// the property test below. Not part of packages/engine's public surface;
// the plan's exports are parseIsoCalendarParts, civilToDayNumber, daysUntil
// only.
function civilFromDayNumber(dayNumber: number): { year: number; month: number; day: number } {
  const z = dayNumber + 719468;
  const era = Math.floor((z >= 0 ? z : z - 146096) / 146097);
  const doe = z - era * 146097; // [0, 146096]
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365
  ); // [0, 399]
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)); // [0, 365]
  const mp = Math.floor((5 * doy + 2) / 153); // [0, 11]
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1; // [1, 31]
  const month = mp + (mp < 10 ? 3 : -9); // [1, 12]
  const year = y + (month <= 2 ? 1 : 0);
  return { year, month, day };
}

describe("calendar-math", () => {
  it("anchors the Unix epoch: civilToDayNumber(1970, 1, 1) is 0", () => {
    expect(civilToDayNumber(1970, 1, 1)).toBe(0);
  });

  it("treats 2000 as a leap year (divisible by 400)", () => {
    expect(civilToDayNumber(2000, 3, 1) - civilToDayNumber(2000, 2, 29)).toBe(1);
  });

  it("treats 1900 as NOT a leap year (divisible by 100, not by 400) — a naive year % 4 rule fails this", () => {
    expect(civilToDayNumber(1900, 3, 1) - civilToDayNumber(1900, 2, 28)).toBe(1);
  });

  it("daysUntil: a target 16 calendar days after now is 16", () => {
    expect(daysUntil("2026-09-15T00:00:00Z", "2026-10-01")).toBe(16);
  });

  it("daysUntil: a target on the same calendar day as now (any time-of-day) is 0", () => {
    expect(daysUntil("2026-10-01T23:59:59Z", "2026-10-01")).toBe(0);
  });

  it("daysUntil: a target one calendar day before now is -1", () => {
    expect(daysUntil("2026-10-02T00:00:00Z", "2026-10-01")).toBe(-1);
  });

  it("rejects malformed input rather than silently coercing", () => {
    expect(() => parseIsoCalendarParts("2026-9-15")).toThrow();
    expect(() => parseIsoCalendarParts("not-a-date")).toThrow();
    expect(() => parseIsoCalendarParts("2026-13-01")).toThrow();
  });

  it("is antisymmetric and round-trips add-then-difference (fast-check property, bounded 1970-2100)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1970, max: 2100 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 1970, max: 2100 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: -10_000, max: 10_000 }),
        (yearA, monthA, dayA, yearB, monthB, dayB, n) => {
          const numA = civilToDayNumber(yearA, monthA, dayA);
          const numB = civilToDayNumber(yearB, monthB, dayB);
          // Antisymmetry. `-(numA - numB)` evaluates to `-0` when the two
          // dates coincide, and `.toBe` is `Object.is`, which separates `-0`
          // from `+0` — so the strict matcher rejects a genuinely
          // antisymmetric result roughly once every few hundred full-suite
          // runs, whenever fast-check (which deliberately biases toward
          // repeated values) draws the same date twice. `===` is the correct
          // equality for this claim: it is the mathematical statement itself,
          // and it treats the two signed zeros as equal.
          expect(
            numB - numA === -(numA - numB),
            `antisymmetry failed: numA=${numA}, numB=${numB}`
          ).toBe(true);

          const shifted = civilFromDayNumber(numA + n);
          const shiftedNum = civilToDayNumber(shifted.year, shifted.month, shifted.day);
          expect(shiftedNum - numA).toBe(n);
        }
      ),
      { numRuns: 500 }
    );
  });
});
