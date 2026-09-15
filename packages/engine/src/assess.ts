// packages/engine/src/assess.ts
//
// PRD §8.1's seven-step algorithm, orchestrated. Step 1 (preconditions) and
// step 6 (totals) are plan 02-01's; step 2 (the posture gate) and step 3
// (all five per-line treatments, plus the AC-19 unclassified override) are
// plan 02-04's, in posture-gate.ts/evaluate-line.ts. Step 4 (cross-line
// checks), step 5 (the aggregate cap) and the rest of step 7 (matter flags
// beyond the empty array below) are later plans in this phase.
//
// assess() never calls .parse() on its own output — validation at the
// boundary is the caller's job, and the ENGINE-17 100ms/50-line budget is
// measured over the un-validated path. Callers (and this plan's tests)
// validate with AssessmentSchema.parse() themselves.

import type { Matter } from "@dsar/schemas/matter";
import type { ExpenseLine } from "@dsar/schemas/expense-line";
import type { CategoryRule, RulePack } from "@dsar/schemas/rule-pack";
import type { Assessment, AssessmentLine } from "@dsar/schemas/assessment";
import { checkPreconditions } from "./preconditions.ts";
import { computeTotals } from "./totals.ts";
import { evaluateLine } from "./evaluate-line.ts";

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

    const assessmentLine = evaluateLine({
      line,
      matter,
      rule,
      feePosture: pack.feePosture[matter.controllerType],
      assessmentLineId,
    });
    assessmentLines.push(assessmentLine);
    appliedRuleById.set(assessmentLine.id, rule);
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
