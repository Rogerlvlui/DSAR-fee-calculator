// packages/workflow/src/transitions.ts
//
// PRD §5's guard table as a declared array of transition-specification
// objects, each carrying its own guard predicate over the frozen
// GuardInput — the same declared-array style this codebase already uses
// for DERIVED_MATTER_FLAG_SPECS (packages/engine) and ACTIVE_READY_CHECKS
// (packages/rulepacks), rather than a switch or if-chain, so the array can
// be diffed row by row against the PRD table and counted by a completeness
// check (04-02).
//
// This plan (04-01, the phase's tracer) authors exactly one row — DRAFT
// --SUBMIT--> COMPUTING — with the full guard list PRD §5 gives that row.
// The remaining eight rows land in plan 04-02; this array is deliberately
// incomplete until then, and its row order is kept identical to the PRD
// table's own order so the two can be diffed directly.
//
// The guard never reads a clock. "Past its review date" is resolved
// upstream (the rule-pack loader's deriveEffectiveStatus, Phase 3) into
// `pack.status === "STALE"` before this guard ever sees it — GuardInput's
// frozen eleven-member shape has no `now` field, and packages/workflow
// must stay pure (no I/O, no clock reads) in exactly the sense
// packages/engine already is.

import { JURISDICTION_CURRENCY } from "@dsar/schemas/primitives";
import type { GuardInput } from "@dsar/schemas/guard-input";
import type { MatterStatus } from "@dsar/schemas/matter-status";

// Names an action a caller performs, not a data shape — kept out of
// @dsar/schemas' additive-only freeze deliberately (04-RESEARCH.md Open
// Question 2, resolved): a construct this phase is still iterating on is a
// poor fit for that freeze discipline.
export type TransitionEvent = "SUBMIT";

export type GuardResult = { allowed: true } | { allowed: false; reason: string };

export interface TransitionSpec {
  from: MatterStatus;
  event: TransitionEvent;
  to: MatterStatus;
  guard: (input: GuardInput) => GuardResult;
}

// The status a newly created matter is born in, named once so no module
// anywhere has to spell it as a bare literal.
export const INITIAL_MATTER_STATUS: MatterStatus = "DRAFT";

// One row per PRD §5 guard-table line, in the PRD's own order.
export const TRANSITIONS: readonly TransitionSpec[] = [
  {
    from: "DRAFT",
    event: "SUBMIT",
    to: "COMPUTING",
    guard: (input) => {
      if (input.expenseLineCount < 1) {
        return {
          allowed: false,
          reason: "At least one expense line is required before submitting",
        };
      }
      if (!input.pack) {
        return {
          allowed: false,
          reason: `No rule pack is available for jurisdiction '${input.jurisdictionCode}'`,
        };
      }
      if (input.pack.status === "STALE") {
        return {
          allowed: false,
          reason: `The rule pack for jurisdiction '${input.jurisdictionCode}' is past its review date (${input.pack.reviewDueOn}) and is STALE`,
        };
      }
      if (input.pack.status !== "ACTIVE") {
        return {
          allowed: false,
          reason: `The rule pack for jurisdiction '${input.jurisdictionCode}' is not ACTIVE (currently ${input.pack.status})`,
        };
      }
      const expectedCurrency = JURISDICTION_CURRENCY[input.jurisdictionCode];
      if (input.currency !== expectedCurrency) {
        return {
          allowed: false,
          reason: `Matter currency '${input.currency}' does not match jurisdiction '${input.jurisdictionCode}''s designated currency '${expectedCurrency}'`,
        };
      }
      if (!input.attestationsAddressed) {
        return {
          allowed: false,
          reason:
            "The identity-verification and scope-clarification attestations must be addressed before submitting",
        };
      }
      return { allowed: true };
    },
  },
];
