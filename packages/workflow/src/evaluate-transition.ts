// packages/workflow/src/evaluate-transition.ts
//
// The pure executor. It finds the matching row, runs that row's guard, and
// returns — it reads no clock, touches no repository, performs no I/O and
// writes no event. GuardInput's own header (packages/schemas/src/guard-input.ts)
// already commits this package to that; the next plan (04-02) makes it a
// CI fact via dependency-cruiser.

import { TRANSITIONS, type TransitionEvent } from "./transitions.ts";
import type { GuardInput } from "@dsar/schemas/guard-input";
import type { MatterStatus } from "@dsar/schemas/matter-status";

export type TransitionOutcome =
  | { allowed: true; to: MatterStatus }
  | { allowed: false; reason: string };

export function evaluateTransition(
  from: MatterStatus,
  event: TransitionEvent,
  input: GuardInput
): TransitionOutcome {
  const spec = TRANSITIONS.find((candidate) => candidate.from === from && candidate.event === event);
  if (!spec) {
    return { allowed: false, reason: `No transition '${event}' from '${from}'` };
  }
  const result = spec.guard(input);
  return result.allowed ? { allowed: true, to: spec.to } : result;
}
