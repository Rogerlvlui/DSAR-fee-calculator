// packages/engine/src/evaluate-line.ts
//
// PRD §8.1 step 3 — per-line evaluation via the five CategoryRule
// treatments, plus the step-2 posture-gate override and AC-19's
// OTHER_UNCLASSIFIED override. Ordering matters and is fixed by this
// function's own structure: the posture gate is checked first (forcing a
// terminal DISALLOW/FLAG for every line when it fires), then the
// unclassified-category override, and only then the treatment table —
// that ordering is what makes AC-19's own exception work: when the gate
// has already forced a terminal verdict, an OTHER_UNCLASSIFIED line's
// always-FLAG rule never gets the chance to override it (AC-14 wins over
// AC-19 in that case).
//
// Every branch returns a line whose flagReasons/verdict pairing satisfies
// AssessmentLineSchema's bidirectional superRefine — proven by this
// module's own tests via AssessmentLineSchema.parse(), not merely by
// checking the verdict field.
//
// ALLOW_WITH_CAP sets verdict ALLOW_CAPPED only where the cap actually
// reduced the claim (PRD §8.1 step 3: "verdict ALLOW_CAPPED if reduced") —
// a line whose cap did not bind is plain ALLOW, with appliedCap left null.
// This matters for totals: disallowedTotal absorbs the trimmed remainder
// of every ALLOW_CAPPED line, so marking an untrimmed line as capped would
// misrepresent it to the reviewing lawyer even though it adds a zero term
// to the total today.

import type { CategoryRule, FeePosture } from "@dsar/schemas/rule-pack";
import type { ExpenseLine } from "@dsar/schemas/expense-line";
import type { Matter } from "@dsar/schemas/matter";
import type { AssessmentLine } from "@dsar/schemas/assessment";
import type { Minor } from "@dsar/schemas/primitives";
import { applyCap } from "./apply-cap.ts";
import { evaluateConditions } from "./conditions.ts";
import { EngineComputationFailure } from "./errors.ts";
import {
  allowWithCapMissingCapMessage,
  conditionsNotMetMessage,
  noFeeAuthorityMessage,
  ruleAuthoredFlagMessage,
  uncategorisedMessage,
} from "./messages.ts";
import { applyPostureGate } from "./posture-gate.ts";

const ZERO_MINOR = 0 as Minor;

export interface EvaluateLineInput {
  line: ExpenseLine;
  matter: Matter;
  rule: CategoryRule;
  feePosture: FeePosture;
  assessmentLineId: string;
}

export function evaluateLine(input: EvaluateLineInput): AssessmentLine {
  const { line, matter, rule, feePosture, assessmentLineId } = input;

  // Fields every branch shares — always taken from the CategoryRule this
  // line's categoryCode resolved to, regardless of whether the posture
  // gate or the unclassified override goes on to replace the verdict:
  // AC-20 requires a DISALLOW/FLAG line to still show its rule's basis
  // and citation, not a blank provenance.
  const base = {
    id: assessmentLineId,
    expenseLineId: line.id,
    appliedRuleId: rule.ruleId,
    basis: rule.basis,
    citation: rule.citation,
    disposition: "PENDING" as const,
    lawyerAmount: null,
    lawyerReason: null,
    dispositionedBy: null,
    dispositionedAt: null,
  };

  const postureOutcome = applyPostureGate(feePosture);
  if (postureOutcome.forced) {
    if (postureOutcome.verdict === "DISALLOW") {
      return { ...base, verdict: "DISALLOW", engineAmount: ZERO_MINOR, appliedCap: null, flagReasons: [] };
    }
    return {
      ...base,
      verdict: "FLAG",
      engineAmount: ZERO_MINOR,
      appliedCap: null,
      flagReasons: [{ code: postureOutcome.flagReasonCode, message: noFeeAuthorityMessage() }],
    };
  }

  // AC-19: OTHER_UNCLASSIFIED always FLAG, regardless of the pack's own
  // rule.treatment for that category — checked after the (non-forcing)
  // posture gate above and before the treatment table below.
  if (line.categoryCode === "OTHER_UNCLASSIFIED") {
    return {
      ...base,
      verdict: "FLAG",
      engineAmount: ZERO_MINOR,
      appliedCap: null,
      flagReasons: [{ code: "UNCATEGORISED", message: uncategorisedMessage() }],
    };
  }

  switch (rule.treatment) {
    case "ALLOW":
      return {
        ...base,
        verdict: "ALLOW",
        engineAmount: line.claimedAmount,
        appliedCap: null,
        flagReasons: [],
      };

    case "ALLOW_WITH_CAP": {
      if (!rule.cap) {
        throw new EngineComputationFailure(
          {
            code: "ALLOW_WITH_CAP_MISSING_CAP",
            detail: { ruleId: rule.ruleId, categoryCode: rule.categoryCode },
          },
          allowWithCapMissingCapMessage(rule.ruleId, rule.categoryCode)
        );
      }
      const cappedAmount = applyCap(rule.cap, line);
      const reduced = cappedAmount < line.claimedAmount;
      return {
        ...base,
        verdict: reduced ? "ALLOW_CAPPED" : "ALLOW",
        engineAmount: cappedAmount,
        appliedCap: reduced ? rule.cap : null,
        flagReasons: [],
      };
    }

    case "ALLOW_IF": {
      const { met, failed } = evaluateConditions(rule.conditions, { line, matter });
      if (met) {
        return {
          ...base,
          verdict: "ALLOW",
          engineAmount: line.claimedAmount,
          appliedCap: null,
          flagReasons: [],
        };
      }
      return {
        ...base,
        verdict: "FLAG",
        engineAmount: ZERO_MINOR,
        appliedCap: null,
        flagReasons: [{ code: "CONDITIONS_NOT_MET", message: conditionsNotMetMessage(failed) }],
      };
    }

    case "DISALLOW":
      return { ...base, verdict: "DISALLOW", engineAmount: ZERO_MINOR, appliedCap: null, flagReasons: [] };

    case "FLAG":
      return {
        ...base,
        verdict: "FLAG",
        engineAmount: ZERO_MINOR,
        appliedCap: null,
        flagReasons: [{ code: "UNCATEGORISED", message: ruleAuthoredFlagMessage(rule.ruleId) }],
      };
  }
}
