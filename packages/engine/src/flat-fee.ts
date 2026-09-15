// packages/engine/src/flat-fee.ts
//
// D-12 (02-CONTEXT.md) / ENGINE-16 — the flat-fee comparison. A pure
// function: given the pack's optional FlatFee and the computed
// draftBaseline, returns the comparison block plan 02-03's
// TotalsSchema.flatFeeComparison exists to hold, or undefined where the
// pack carries no flat fee.
//
// "Itemised direct cost" is draftBaseline. This reading is not PRD-defined
// and cannot be: FlatFeeSchema (rule-pack.ts) is itself Phase 1 invention
// filling a gap ENGINE-16 needs and that PRD §7.2 leaves open — the PRD's
// only flat-fee mechanism is §7.5's advisory HK.FLAT_FEE_CHECK
// matterFlagRule, prose for a lawyer, not a figure an engine can compare.
// draftBaseline is the defensible reading: rule-pack.ts's own module note
// says a flat figure cannot be shown to stay below direct cost without an
// itemised baseline to compare it against, and draftBaseline is exactly
// that baseline — the itemised allowable total before any lawyer
// disposition (02-CONTEXT.md D-12).
//
// The comparison is strictly greater than. A flat figure exactly at direct
// cost has NOT exceeded it: the HK guidance PROJECT.md cites permits a flat
// fee that stays below direct cost, and an inclusive (>=) comparison would
// report a figure sitting exactly at the boundary as exceeding — the wrong
// answer to "has this exceeded direct cost".
//
// The engine reports; it does not choose. This function never adjusts
// draftBaseline or finalAmount, and totals.ts/assess.ts (below) never
// substitute the flat figure for either — PROJECT.md's decision is
// itemise-then-choose, and the choosing is a lawyer's, at sign-off.

import type { FlatFee } from "@dsar/schemas/rule-pack";
import type { FlatFeeComparison } from "@dsar/schemas/assessment";
import type { Minor } from "@dsar/schemas/primitives";

export function computeFlatFeeComparison(
  flatFee: FlatFee | undefined,
  itemisedDirectCostAmount: Minor
): FlatFeeComparison | undefined {
  if (!flatFee) {
    return undefined;
  }
  return {
    flatFeeAmount: flatFee.amount,
    itemisedDirectCostAmount,
    // RED (deliberate, Task 3 red phase): inclusive `>=` instead of the
    // strict `>` this comparison requires, so a flat figure exactly at
    // direct cost is (wrongly) reported as exceeding it.
    flatFeeExceedsItemisedCost: flatFee.amount >= itemisedDirectCostAmount,
  };
}
