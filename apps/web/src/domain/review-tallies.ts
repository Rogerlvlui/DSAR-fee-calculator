// apps/web/src/domain/review-tallies.ts
//
// Two pure exports over an array of assessment lines. This is the
// review-time arithmetic this demo needs — it lives outside packages/engine
// because the engine's frozen surface has no disposition-aware recompute,
// and the build order (PRD §0) forbids reopening it this phase. Phase 6
// owns the production version of this computation. It is pure and lives
// under src/domain/ so the totals rail and (Plan 04) the sign-off panel
// read the same numbers computeFinalAmount does.
//
// Integer addition only — no division, no rounding, no floating-point
// intermediate anywhere: this is the money path, and the branded Minor
// type is the only representation it has.

import type { AssessmentLine } from "@dsar/schemas/assessment";
import type { Minor } from "@dsar/schemas/primitives";

export interface ReviewTallies {
  accepted: number;
  reduced: number;
  struck: number;
  lawyerAllowed: number;
  lawyerAllowedAmount: Minor;
}

export function computeReviewTallies(lines: readonly AssessmentLine[]): ReviewTallies {
  let accepted = 0;
  let reduced = 0;
  let struck = 0;
  let lawyerAllowed = 0;
  let lawyerAllowedAmount = 0;

  for (const line of lines) {
    switch (line.disposition) {
      case "ACCEPTED":
        accepted += 1;
        break;
      case "REDUCED":
        reduced += 1;
        break;
      case "STRUCK":
        struck += 1;
        break;
      case "ALLOWED_BY_LAWYER":
        lawyerAllowed += 1;
        lawyerAllowedAmount += line.lawyerAmount ?? 0;
        break;
      default:
        break;
    }
  }

  return {
    accepted,
    reduced,
    struck,
    lawyerAllowed,
    lawyerAllowedAmount: lawyerAllowedAmount as Minor,
  };
}

// Throws while any line is PENDING — there is no final amount to report
// until every line has a decision (PRD §0 non-negotiable #2/#4). The sum:
// the engine's own amount for an accepted line, the lawyer's amount for a
// reduced or lawyer-allowed line, and zero for a struck line.
export function computeFinalAmount(lines: readonly AssessmentLine[]): Minor {
  if (lines.some((line) => line.disposition === "PENDING")) {
    throw new Error("computeFinalAmount: cannot compute a final amount while any line is still PENDING");
  }

  let total = 0;
  for (const line of lines) {
    switch (line.disposition) {
      case "ACCEPTED":
        total += line.engineAmount;
        break;
      case "REDUCED":
      case "ALLOWED_BY_LAWYER":
        total += line.lawyerAmount ?? 0;
        break;
      case "STRUCK":
      default:
        break;
    }
  }
  return total as Minor;
}
