import { describe, expect, it } from "vitest";
import { CurrencyCodeSchema, toMinor } from "./primitives.ts";
import { MINOR_UNIT_DECIMALS, formatMinor, minorToMajorParts } from "./money.ts";

describe("MINOR_UNIT_DECIMALS", () => {
  it("has exactly nine keys whose key set equals the CurrencyCode member set", () => {
    const keys = Object.keys(MINOR_UNIT_DECIMALS);
    expect(keys).toHaveLength(9);
    for (const key of keys) {
      expect(CurrencyCodeSchema.safeParse(key).success).toBe(true);
    }
  });

  it("JPY, KRW and VND are zero-decimal currencies", () => {
    expect(MINOR_UNIT_DECIMALS.JPY).toBe(0);
    expect(MINOR_UNIT_DECIMALS.KRW).toBe(0);
    expect(MINOR_UNIT_DECIMALS.VND).toBe(0);
  });

  it("the remaining six currencies use two decimal places", () => {
    expect(MINOR_UNIT_DECIMALS.SGD).toBe(2);
    expect(MINOR_UNIT_DECIMALS.HKD).toBe(2);
    expect(MINOR_UNIT_DECIMALS.AUD).toBe(2);
    expect(MINOR_UNIT_DECIMALS.NZD).toBe(2);
    expect(MINOR_UNIT_DECIMALS.CNY).toBe(2);
    expect(MINOR_UNIT_DECIMALS.INR).toBe(2);
  });
});

describe("formatMinor", () => {
  it("renders a zero-decimal currency (JPY) with no decimal separator", () => {
    const rendered = formatMinor(toMinor(1000), "JPY");
    expect(rendered).toContain("1,000");
    expect(rendered).not.toContain(".");
  });

  it("renders a two-decimal currency (SGD) with exactly two decimal places", () => {
    const rendered = formatMinor(toMinor(1000), "SGD");
    expect(rendered).toContain("10.00");
  });

  it("renders zero as a normal value with two decimal places, not an empty state", () => {
    const rendered = formatMinor(toMinor(0), "SGD");
    expect(rendered).toContain("0.00");
  });

  it("renders the maximum plausible minor-unit value under SGD and JPY without throwing or scientific notation", () => {
    const sgd = () => formatMinor(toMinor(2147483647), "SGD");
    const jpy = () => formatMinor(toMinor(2147483647), "JPY");
    expect(sgd).not.toThrow();
    expect(jpy).not.toThrow();
    expect(sgd()).not.toMatch(/e\+/i);
    expect(jpy()).not.toMatch(/e\+/i);
  });

  it("returns different strings for the same integer under currencies of differing decimal counts", () => {
    const sgd = formatMinor(toMinor(1000), "SGD");
    const jpy = formatMinor(toMinor(1000), "JPY");
    expect(sgd).not.toBe(jpy);
  });
});

describe("minorToMajorParts", () => {
  it("splits using integer division and remainder, never a float", () => {
    expect(minorToMajorParts(toMinor(1050), "SGD")).toEqual({ units: 10, fraction: 50 });
  });

  it("has zero fraction for a zero-decimal currency", () => {
    expect(minorToMajorParts(toMinor(1000), "JPY")).toEqual({ units: 1000, fraction: 0 });
  });
});
