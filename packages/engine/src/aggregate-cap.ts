// packages/engine/src/aggregate-cap.ts
//
// PRD §8.1 step 5 / D-11 / PROJECT.md's settled residue policy — a binding
// aggregate cap reduces every ALLOW/ALLOW_CAPPED line pro-rata, rounding
// each line's share down and leaving the remainder unallocated; a cap that
// does not bind changes nothing and raises nothing. See 02-CONTEXT.md D-11
// and 02-RESEARCH.md Pattern 3 for the full account of why this shape was
// chosen over the two rejected allocation schemes (largest-remainder,
// by-sequence) — both hit the cap exactly but introduce an ordering rule a
// lawyer would have to defend.
//
// applyAggregateCap() is the pure allocation primitive: sum the allowed
// amounts, compare to the cap, and — only if the sum exceeds it —
// floor(cap * share / sum) per line, multiplying before dividing exactly
// once. The zero-sum / non-binding guard runs before any division, so a
// matter with no allowed lines (or a cap that does not bind) never divides
// by zero and never runs the pro-rata pass as a no-op.
//
// applyAggregateCapStep() is the higher-level function assess.ts calls: it
// resolves the pack's constraints.aggregateCap to a single Minor figure
// (PER_MATTER used directly; PERCENT_OF_CLAIM floored against claimedTotal
// — the only other floor in this file, resolved BEFORE applyAggregateCap
// ever runs, so the pro-rata pass itself still contains exactly one
// division), maps the allocation back onto the ALLOW/ALLOW_CAPPED lines,
// and raises the matter-level AGGREGATE_CAP_APPLIED flag only when the cap
// actually bound.
//
// D-11: a reduced line keeps verdict ALLOW_CAPPED and keeps its reduced
// amount in draftBaseline — it does NOT acquire a flagReasons entry. The
// frozen AssessmentLineSchema.superRefine makes a reason on a non-FLAG line
// unrepresentable, and flipping the line to FLAG instead would drop an
// amount the pack allows out of the fee entirely (AC-11), changing the
// computed figure rather than merely how it is presented. Both alternatives
// were considered and rejected at the D-11 gate (02-CONTEXT.md).

import type { AssessmentLine } from "@dsar/schemas/assessment";
import type { Cap, RulePack } from "@dsar/schemas/rule-pack";
import type { Minor, MatterFlag } from "@dsar/schemas/primitives";
import { EngineComputationFailure } from "./errors.ts";
import { aggregateCapAppliedMessage, aggregateCapInvalidTypeMessage } from "./messages.ts";

export interface AggregateCapAllocation {
  allocated: readonly Minor[];
  residue: Minor;
  bound: boolean;
}

// Pure pro-rata allocator. `allowedAmounts` is every currently-ALLOW/
// ALLOW_CAPPED line's engineAmount, in line order; the returned `allocated`
// array is positionally aligned with it.
export function applyAggregateCap(capAmount: Minor, allowedAmounts: readonly Minor[]): AggregateCapAllocation {
  const sum = allowedAmounts.reduce((total, amount) => total + amount, 0);

  // Guard the zero-sum case (and the non-binding case) before any division
  // runs. A cap at or above the sum does nothing — running the pro-rata
  // pass anyway would be a no-op that nonetheless implies the cap acted.
  if (sum === 0 || sum <= capAmount) {
    return { allocated: [...allowedAmounts], residue: 0 as Minor, bound: false };
  }

  const floored = allowedAmounts.map((amount) => Math.floor((capAmount * amount) / sum));
  const flooredSum = floored.reduce((total, amount) => total + amount, 0);
  let residueToDistribute = capAmount - flooredSum;

  // NOTE (deliberate RED-phase bug, plan 02-05 Task 2): distributes the
  // floored residue to the lines with the largest fractional remainder,
  // one unit each, until exhausted — the "largest-remainder" allocation
  // scheme PROJECT.md explicitly rejected (it hits the cap exactly but
  // introduces an ordering rule a lawyer would have to defend). GREEN phase
  // removes this and leaves the residue unallocated instead.
  const remainders = allowedAmounts.map((amount, index) => ({
    index,
    fraction: (capAmount * amount) % sum,
  }));
  remainders.sort((a, b) => b.fraction - a.fraction);
  const allocated = [...floored];
  for (const { index } of remainders) {
    if (residueToDistribute <= 0) break;
    allocated[index] = (allocated[index] ?? 0) + 1;
    residueToDistribute -= 1;
  }

  const allocatedSum = allocated.reduce((total, amount) => total + amount, 0);
  const residue = (capAmount - allocatedSum) as Minor;

  return { allocated: allocated as Minor[], residue, bound: true };
}

export interface ApplyAggregateCapStepInput {
  lines: readonly AssessmentLine[];
  pack: RulePack;
  claimedTotal: Minor;
}

export interface ApplyAggregateCapStepResult {
  lines: AssessmentLine[];
  matterFlag: MatterFlag | null;
}

function resolveAggregateCapAmount(cap: Cap, claimedTotal: Minor): Minor {
  switch (cap.type) {
    case "PER_MATTER":
      return cap.amount;
    case "PERCENT_OF_CLAIM":
      // The only other floor in this file — resolved before
      // applyAggregateCap ever runs, so the pro-rata pass itself still
      // contains exactly one division.
      return Math.floor((claimedTotal * cap.percent) / 100) as Minor;
    case "PER_UNIT":
    case "PER_LINE":
      throw new EngineComputationFailure(
        { code: "AGGREGATE_CAP_INVALID_TYPE", detail: { capType: cap.type } },
        aggregateCapInvalidTypeMessage(cap.type)
      );
  }
}

export function applyAggregateCapStep(input: ApplyAggregateCapStepInput): ApplyAggregateCapStepResult {
  const { lines, pack, claimedTotal } = input;
  const cap = pack.constraints.aggregateCap;

  if (!cap) {
    return { lines: [...lines], matterFlag: null };
  }

  const capAmount = resolveAggregateCapAmount(cap, claimedTotal);

  const eligibleIndices: number[] = [];
  const allowedAmounts: Minor[] = [];
  lines.forEach((line, index) => {
    if (line.verdict === "ALLOW" || line.verdict === "ALLOW_CAPPED") {
      eligibleIndices.push(index);
      allowedAmounts.push(line.engineAmount);
    }
  });

  const { allocated, bound } = applyAggregateCap(capAmount, allowedAmounts);

  if (!bound) {
    return { lines: [...lines], matterFlag: null };
  }

  const updatedLines = [...lines];
  eligibleIndices.forEach((lineIndex, position) => {
    const original = updatedLines[lineIndex]!;
    updatedLines[lineIndex] = {
      ...original,
      verdict: "ALLOW_CAPPED",
      engineAmount: allocated[position]!,
      appliedCap: cap,
    };
  });

  const matterFlag: MatterFlag = {
    id: "AGGREGATE_CAP_APPLIED",
    code: "AGGREGATE_CAP_APPLIED",
    message: aggregateCapAppliedMessage(),
    requiresAcknowledgement: true,
  };

  return { lines: updatedLines, matterFlag };
}
