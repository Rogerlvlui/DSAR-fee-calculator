// packages/engine/src/assess.ts
//
// PRD §8.1's seven-step algorithm, orchestrated. Step 1 (preconditions) and
// step 6 (totals) are plan 02-01's; step 2 (the posture gate) and step 3
// (all five per-line treatments, plus the AC-19 unclassified override) are
// plan 02-04's, in posture-gate.ts/evaluate-line.ts. Step 4 (cross-line
// checks, cross-line-checks.ts) and step 5 (the aggregate cap,
// aggregate-cap.ts) are plan 02-05's, which also raises step 7's
// AGGREGATE_CAP_APPLIED matter flag as part of the cap step itself. Step 7's
// remaining matter-level flags — the pack's own matterFlagRules and the
// four derived codes (LITIGATION_POSTURE, REPEAT_REQUEST,
// STALE_PACK_WARNING, NO_FEE_AUTHORITY_POSTURE) — are plan 02-06's, in
// matter-flags.ts.
//
// assess() never calls .parse() on its own output — validation at the
// boundary is the caller's job, and the ENGINE-17 100ms/50-line budget is
// measured over the un-validated path. Callers (and this plan's tests)
// validate with AssessmentSchema.parse() themselves.

import type { Matter } from "@dsar/schemas/matter";
import type { ExpenseLine } from "@dsar/schemas/expense-line";
import type { CategoryRule, RulePack } from "@dsar/schemas/rule-pack";
import type { Assessment, AssessmentLine } from "@dsar/schemas/assessment";
import type { FlagReason, Minor } from "@dsar/schemas/primitives";
import { checkPreconditions } from "./preconditions.ts";
import { computeTotals } from "./totals.ts";
import { evaluateLine } from "./evaluate-line.ts";
import { computeCrossLineFlagReasons, type CrossLineCheckLine } from "./cross-line-checks.ts";
import { applyAggregateCapStep } from "./aggregate-cap.ts";
import { composeMatterLevelFlags, computeDerivedMatterFlags, evaluatePackFlagRules } from "./matter-flags.ts";

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

// §8.1 step 4 — applies the flag reasons cross-line-checks.ts computed, in
// exactly one place, making the verdict consequence explicit here rather
// than in cross-line-checks.ts itself (which only computes reasons; it
// never rewrites a verdict).
//
// Why a tripped ALLOW/ALLOW_CAPPED line becomes FLAG with engineAmount 0
// (and NOT merely an ALLOW line carrying an extra annotation): the frozen
// AssessmentLineSchema.superRefine forbids a non-empty flagReasons array on
// any verdict other than FLAG, AC-11 requires a FLAG line to contribute
// zero to draftBaseline with its claimed value visible only in
// flaggedTotal, and CLAUDE.md's fourth PRD §0 non-negotiable states outright
// that a flagged line contributes nothing to any total until a lawyer
// dispositions it. All three point the same way, and the alternative —
// annotating the line while leaving its amount in the baseline — is
// unrepresentable in the frozen schema regardless of which of the three
// reasons is consulted.
//
// A DISALLOW line does NOT acquire cross-line reasons: its amount is
// already zero, the pack has already spoken, and a second reason gives the
// reviewing lawyer nothing new to act on while inflating the flag count the
// review screen would otherwise show.
function applyCrossLineReasons(
  lines: readonly AssessmentLine[],
  reasonsByLineId: ReadonlyMap<string, FlagReason[]>
): AssessmentLine[] {
  return lines.map((line) => {
    const additionalReasons = reasonsByLineId.get(line.id);
    if (!additionalReasons || additionalReasons.length === 0) {
      return line;
    }
    if (line.verdict === "DISALLOW") {
      return line;
    }
    return {
      ...line,
      verdict: "FLAG",
      engineAmount: 0 as Minor,
      appliedCap: null,
      flagReasons: [...line.flagReasons, ...additionalReasons],
    };
  });
}

export function assess(input: AssessInput): Assessment {
  const { matter, lines, pack, now } = input;

  checkPreconditions({ matter, lines, pack, now });

  const assessmentId = deriveAssessmentId(matter, pack, now);
  const rulesByCategory = new Map<string, CategoryRule>(
    pack.categoryRules.map((rule) => [rule.categoryCode, rule])
  );

  const expenseLinesById = new Map(lines.map((line) => [line.id, line]));
  const claimedTotal = lines.reduce((total, line) => total + line.claimedAmount, 0) as Minor;

  let assessmentLines: AssessmentLine[] = [];
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

  // §8.1 step 4 — cross-line checks. Computed once every line has its
  // per-line verdict (step 3 above), applied in exactly one place
  // (applyCrossLineReasons) so the verdict-and-reason invariant is
  // enforced once, not scattered across call sites.
  const crossLineInputs: CrossLineCheckLine[] = assessmentLines.map((assessmentLine) => {
    const expenseLine = expenseLinesById.get(assessmentLine.expenseLineId);
    if (!expenseLine) {
      throw new Error(
        `assess: assessment line '${assessmentLine.id}' references unknown expense line '${assessmentLine.expenseLineId}'`
      );
    }
    const appliedRule = appliedRuleById.get(assessmentLine.id);
    if (!appliedRule) {
      throw new Error(`assess: no applied rule recorded for assessment line '${assessmentLine.id}'`);
    }
    return { assessmentLine, expenseLine, appliedRule };
  });
  const crossLineReasons = computeCrossLineFlagReasons(crossLineInputs, matter, pack, claimedTotal);
  assessmentLines = applyCrossLineReasons(assessmentLines, crossLineReasons);

  // §8.1 step 5 — the aggregate cap, run over the lines that survive step 4:
  // a line step 4 moved to FLAG is no longer an allowed line and must not
  // consume cap headroom.
  const aggregateCapResult = applyAggregateCapStep({ lines: assessmentLines, pack, claimedTotal });
  assessmentLines = aggregateCapResult.lines;

  const totals = computeTotals(assessmentLines, expenseLinesById, appliedRuleById);

  // §8.1 step 7 — matter-level flags. composeMatterLevelFlags() owns the
  // final array's ordering: the derived codes first (declared order,
  // matter-flags.ts), then plan 02-05's aggregate-cap flag if it fired, then
  // the pack's own matterFlagRules in the order they appear in the pack.
  const matterLevelFlags = composeMatterLevelFlags({
    derivedFlags: computeDerivedMatterFlags(matter, pack, now),
    aggregateCapFlag: aggregateCapResult.matterFlag,
    packFlags: evaluatePackFlagRules(pack, matter, lines),
  });

  return {
    id: assessmentId,
    matterId: matter.id,
    rulePackId: pack.packId,
    rulePackVersion: pack.version,
    engineVersion: ENGINE_VERSION,
    computedAt: now,
    lines: assessmentLines,
    matterLevelFlags,
    totals,
    signOff: null,
  };
}
