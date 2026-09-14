// packages/schemas/src/money.ts
//
// SCHEMA-03, marked *(research: not in the PRD)* in REQUIREMENTS.md — the
// PRD gives no field list for this module. MINOR_UNIT_DECIMALS is authored
// explicitly and exhaustively; it must never be derived from Intl's implicit
// per-currency default decimal count (01-RESEARCH.md, Common Pitfalls #6) —
// that default depends on the running Node build's ICU variant and is
// invisible at the call site. The zero-decimal behaviour for JPY, KRW and
// VND is visible in source and testable without trusting the build's ICU.

import type { CurrencyCode, Minor } from "./primitives.ts";

// One entry per CurrencyCode, no default branch — a missing or added
// currency is a compile error, which is the point. ISO 4217 minor-unit
// exponents: JPY, KRW and VND are zero-decimal; the remaining six use two.
export const MINOR_UNIT_DECIMALS: Record<CurrencyCode, 0 | 2> = {
  SGD: 2,
  HKD: 2,
  AUD: 2,
  NZD: 2,
  JPY: 0,
  KRW: 0,
  CNY: 2,
  INR: 2,
  VND: 0,
};

/**
 * Renders a `Minor` integer as a locale-formatted currency string.
 *
 * The decimal count always comes from `MINOR_UNIT_DECIMALS` — never a
 * hard-coded 100 — and is always passed explicitly as both
 * `minimumFractionDigits` and `maximumFractionDigits`, so the rendered
 * figure never depends on the runtime's ICU currency-digits table.
 *
 * This division is the terminal display step and the only division
 * performed anywhere on the money path.
 */
export function formatMinor(value: Minor, currency: CurrencyCode, locale = "en-SG"): string {
  const decimalPlaces = MINOR_UNIT_DECIMALS[currency];
  const divisor = 10 ** decimalPlaces;
  const majorUnits = value / divisor;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(majorUnits);
}

/**
 * Splits a `Minor` integer into its major-unit and fractional-minor-unit
 * parts without a locale, using integer division and remainder so no float
 * touches the arithmetic.
 */
export function minorToMajorParts(
  value: Minor,
  currency: CurrencyCode
): { units: number; fraction: number } {
  const decimalPlaces = MINOR_UNIT_DECIMALS[currency];
  const divisor = 10 ** decimalPlaces;
  const units = Math.trunc(value / divisor);
  const fraction = value - units * divisor;
  return { units, fraction };
}
