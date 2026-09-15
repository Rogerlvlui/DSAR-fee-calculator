// packages/engine/src/assess.ts
//
// PRD §8.1's seven-step algorithm, orchestrated. This plan (02-01)
// implements steps 1 (preconditions) and 6 (totals) fully, and step 3
// (per-line evaluation) for the ALLOW treatment only. Steps 2, 4, 5 and 7,
// plus the remaining per-line treatments, are later plans in this phase.
//
// TASK 1 RED PHASE: per-line evaluation is not yet implemented — this is
// the tracer test's deliberate failure point, closed in the GREEN commit
// that follows.

import type { Matter } from "@dsar/schemas/matter";
import type { ExpenseLine } from "@dsar/schemas/expense-line";
import type { RulePack } from "@dsar/schemas/rule-pack";
import type { Assessment } from "@dsar/schemas/assessment";
import { checkPreconditions } from "./preconditions.ts";

export const ENGINE_VERSION = "0.1.0";

export interface AssessInput {
  matter: Matter;
  lines: readonly ExpenseLine[];
  pack: RulePack;
  now: string;
}

export function assess(input: AssessInput): Assessment {
  const { matter, lines, pack, now } = input;

  checkPreconditions({ matter, lines, pack, now });

  throw new Error("assess: per-line evaluation not yet implemented (Task 1 RED phase)");
}
