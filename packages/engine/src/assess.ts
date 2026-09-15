// packages/engine/src/assess.ts
//
// PRD §8.1's seven-step algorithm, orchestrated. This plan (02-01)
// implements step 1 (preconditions) and step 6 (totals) fully, and step 3
// (per-line evaluation) for the ALLOW treatment only. Steps 2, 4, 5 and 7,
// plus the remaining per-line treatments (ALLOW_WITH_CAP, ALLOW_IF,
// DISALLOW, FLAG), are later plans in this phase — the dispatch below is
// shaped for their extension but does not pre-write empty branches for
// treatments this plan does not implement.
//
// assess() never calls .parse() on its own output — validation at the
// boundary is the caller's job, and the ENGINE-17 100ms/50-line budget is
// measured over the un-validated path. Callers (and this plan's tracer
// test) validate with AssessmentSchema.parse() themselves.

import type { Matter } from "@dsar/schemas/matter";
import type { ExpenseLine } from "@dsar/schemas/expense-line";
import type { CategoryRule, RulePack } from "@dsar/schemas/rule-pack";
import type { Assessment, AssessmentLine } from "@dsar/schemas/assessment";
import { checkPreconditions } from "./preconditions.ts";
import { computeTotals } from "./totals.ts";

export const ENGINE_VERSION = "0.1.0";

export interface AssessInput {
  matter: Matter;
  lines: readonly ExpenseLine[];
  pack: RulePack;
  now: string;
}

// assess() has no clock and no randomness, so it cannot mint a ULID.
// Assessment.id and AssessmentLine.id are derived deterministically from
// the inputs instead — both fields are z.string() in the frozen schema, so
// a composite string parses cleanly. A persistence layer assigns a real
// storage identity later; this is never a substitute for one. Nothing here
// may reach for crypto.randomUUID, Math.random or Date.now — all banned in
// this package (plan 02-02's lint rule statically enforces it).
function deriveAssessmentId(matter: Matter, pack: RulePack, now: string): string {
  return `assessment:${matter.id}:${pack.packId}:${pack.version}:${now}`;
}

function deriveAssessmentLineId(assessmentId: string, expenseLineId: string): string {
  return `${assessmentId}:line:${expenseLineId}`;
}

export function assess(input: AssessInput): Assessment {
  const { matter, lines, pack, now } = input;

  checkPreconditions({ matter, lines, pack, now });

  const assessmentId = deriveAssessmentId(matter, pack, now);
  const rulesByCategory = new Map<string, CategoryRule>(
    pack.categoryRules.map((rule) => [rule.categoryCode, rule])
  );

  const assessmentLines: AssessmentLine[] = [];
  const appliedRuleById = new Map<string, CategoryRule>();

  for (const line of lines) {
    const rule = rulesByCategory.get(line.categoryCode);
    if (!rule) {
      throw new Error(
        `assess: no CategoryRule for category '${line.categoryCode}' (expense line '${line.id}') in pack '${pack.packId}'`
      );
    }

    const assessmentLineId = deriveAssessmentLineId(assessmentId, line.id);

    if (rule.treatment === "ALLOW") {
      const assessmentLine: AssessmentLine = {
        id: assessmentLineId,
        expenseLineId: line.id,
        verdict: "ALLOW",
        engineAmount: line.claimedAmount,
        appliedRuleId: rule.ruleId,
        appliedCap: null,
        basis: rule.basis,
        citation: rule.citation,
        flagReasons: [],
        disposition: "PENDING",
        lawyerAmount: null,
        lawyerReason: null,
        dispositionedBy: null,
        dispositionedAt: null,
      };
      assessmentLines.push(assessmentLine);
      appliedRuleById.set(assessmentLine.id, rule);
      continue;
    }

    // Any other treatment (ALLOW_WITH_CAP, ALLOW_IF, DISALLOW, FLAG) is out
    // of this task's scope — plan 02-04 adds them.
    throw new Error(
      `assess: treatment '${rule.treatment}' for category '${line.categoryCode}' is not yet implemented (plan 02-04)`
    );
  }

  const expenseLinesById = new Map(lines.map((line) => [line.id, line]));
  const totals = computeTotals(assessmentLines, expenseLinesById, appliedRuleById);

  return {
    id: assessmentId,
    matterId: matter.id,
    rulePackId: pack.packId,
    rulePackVersion: pack.version,
    engineVersion: ENGINE_VERSION,
    computedAt: now,
    lines: assessmentLines,
    matterLevelFlags: [],
    totals,
    signOff: null,
  };
}
