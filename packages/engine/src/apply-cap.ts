// packages/engine/src/apply-cap.ts
//
// PRD §8.1 step 3 / AC-07c — computes the capped figure for the three
// single-line Cap types (PER_UNIT, PER_LINE, PERCENT_OF_CLAIM). Every
// branch returns `min(claimedAmount, cappedFigure)` — a cap reduces a
// line's amount, never increases it. PER_MATTER is the aggregate-cap
// variant (§8.1 step 5, plan 02-05): a function that only ever sees one
// line's data cannot evaluate it correctly, so it is refused with a typed
// EngineComputationFailure rather than silently misapplied as a per-line
// figure (02-RESEARCH.md Pattern 2). Phase 3's pack validator should also
// reject this combination at build time — this runtime refusal is a
// backstop, not the only gate.
//
// RED (plan 02-04 Task 1): PERCENT_OF_CLAIM below deliberately rounds
// instead of floors — the exact substitution AC-07c's "33, not 34" exists
// to catch. GREEN replaces Math.round with Math.floor.

import type { Cap } from "@dsar/schemas/rule-pack";
import type { Minor } from "@dsar/schemas/primitives";
import { EngineComputationFailure } from "./errors.ts";
import { perMatterCapOnLineMessage } from "./messages.ts";

export interface ApplyCapLine {
  claimedAmount: Minor;
  quantity: number;
  unit: string;
}

export function applyCap(cap: Cap, line: ApplyCapLine): Minor {
  switch (cap.type) {
    case "PER_UNIT": {
      const cappedAmount = cap.amount * line.quantity;
      return Math.min(line.claimedAmount, cappedAmount) as Minor;
    }
    case "PER_LINE": {
      return Math.min(line.claimedAmount, cap.amount) as Minor;
    }
    case "PERCENT_OF_CLAIM": {
      // RED: Math.round, not Math.floor — deliberately wrong (see module
      // note above). GREEN fixes this to Math.floor.
      const cappedAmount = Math.round((line.claimedAmount * cap.percent) / 100);
      return Math.min(line.claimedAmount, cappedAmount) as Minor;
    }
    case "PER_MATTER": {
      throw new EngineComputationFailure(
        { code: "PER_MATTER_CAP_ON_LINE", detail: { capType: "PER_MATTER" } },
        perMatterCapOnLineMessage()
      );
    }
  }
}
