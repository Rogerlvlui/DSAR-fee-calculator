// packages/engine/src/totals.ts
//
// PRD §8.1 step 6 — the five Totals formulas, derived from PRD §14's own
// published numbers (02-RESEARCH.md Pattern 1), not from step 6's prose
// alone: disallowedTotal must also absorb the cap-trimmed remainder of
// every ALLOW_CAPPED line, or the reference fixture's 126.60 comes out as
// 120.00 (02-RESEARCH.md Pitfall 1 — 120.00 + (33.00 − 26.40) = 126.60).
//
// finalAmount is set to `null` literally and unconditionally below, with no
// parameter and no branch that could ever assign draftBaseline to it
// (AC-25) — a lawyer's sign-off is what populates finalAmount, never
// assess().
//
// Every computed total is round-tripped through MinorSchema.parse() before
// being returned: a JS number can silently exceed the 32-bit Postgres Int
// range these fields are bounded to without throwing on its own, so this
// converts a silent overflow into a thrown bound error at the point of
// computation (threat T-2-02).

import { MinorSchema } from "@dsar/schemas/primitives";
import type { AssessmentLine, Totals } from "@dsar/schemas/assessment";
import type { ExpenseLine } from "@dsar/schemas/expense-line";
import type { CategoryRule } from "@dsar/schemas/rule-pack";

export function computeTotals(
  assessmentLines: readonly AssessmentLine[],
  expenseLinesById: ReadonlyMap<string, ExpenseLine>,
  appliedRuleById: ReadonlyMap<string, CategoryRule>
): Totals {
  let claimedTotal = 0;
  let draftBaseline = 0;
  let disallowedTotal = 0;
  let flaggedTotal = 0;
  let restingOnUnverifiedRules = 0;

  for (const line of assessmentLines) {
    const expenseLine = expenseLinesById.get(line.expenseLineId);
    if (!expenseLine) {
      throw new Error(
        `computeTotals: assessment line '${line.id}' references unknown expense line '${line.expenseLineId}'`
      );
    }
    claimedTotal += expenseLine.claimedAmount;

    if (line.verdict === "ALLOW" || line.verdict === "ALLOW_CAPPED") {
      draftBaseline += line.engineAmount;

      const rule = appliedRuleById.get(line.id);
      if (rule?.verificationStatus === "NEEDS_VERIFICATION") {
        // AC-22: a SUBSET of draftBaseline, never an addition to it.
        restingOnUnverifiedRules += line.engineAmount;
      }
    }

    if (line.verdict === "ALLOW_CAPPED") {
      // The cap-trimmed remainder is disallowed, not merely "not allowed".
      disallowedTotal += expenseLine.claimedAmount - line.engineAmount;
    }

    if (line.verdict === "DISALLOW") {
      disallowedTotal += expenseLine.claimedAmount;
    }

    if (line.verdict === "FLAG") {
      // AC-11: a FLAG line's engineAmount is 0 and contributes nothing to
      // draftBaseline; flaggedTotal instead sums claimedAmount so "what's at
      // stake" is visible without touching the fee.
      flaggedTotal += expenseLine.claimedAmount;
    }
  }

  return {
    claimedTotal: MinorSchema.parse(claimedTotal),
    draftBaseline: MinorSchema.parse(draftBaseline),
    disallowedTotal: MinorSchema.parse(disallowedTotal),
    flaggedTotal: MinorSchema.parse(flaggedTotal),
    restingOnUnverifiedRules: MinorSchema.parse(restingOnUnverifiedRules),
    // AC-25: the literal, unconditional null — never draftBaseline, never a
    // default. See module comment above.
    finalAmount: null,
  };
}
