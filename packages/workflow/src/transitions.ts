// packages/workflow/src/transitions.ts
//
// PRD §5's guard table as a declared array of transition-specification
// objects, each carrying its own guard predicate over the frozen
// GuardInput — the same declared-array style this codebase already uses
// for DERIVED_MATTER_FLAG_SPECS (packages/engine) and ACTIVE_READY_CHECKS
// (packages/rulepacks), rather than a switch or if-chain, so the array can
// be diffed row by row against the PRD table and counted by a completeness
// check (transitions.test.ts's GUARD-TABLE suite).
//
// PRD §5 has nine table rows; the last names two origins (SIGNED_OFF or
// CLOSED), so this array has ten entries. Row order matches the PRD
// table's own order, and the two supersede entries are kept adjacent.
//
// The guard never reads a clock. "Past its review date" is resolved
// upstream (the rule-pack loader's deriveEffectiveStatus, Phase 3) into
// `pack.status === "STALE"` before this guard ever sees it — GuardInput's
// frozen eleven-member shape has no `now` field, and packages/workflow
// must stay pure (no I/O, no clock reads) in exactly the sense
// packages/engine already is.

import type { GuardInput } from "@dsar/schemas/guard-input";
import type { MatterStatus } from "@dsar/schemas/matter-status";
import {
  checkAtLeastOneLine,
  checkCurrencyMatches,
  checkFlagsAcknowledged,
  checkLawyerIdentity,
  checkNoLinesPending,
  checkPackAvailable,
  checkPackUsable,
  type GuardResult,
} from "./guards.ts";

// Re-exported from guards.ts (the type's canonical home) so existing
// importers of `GuardResult` from this module keep working unchanged.
export type { GuardResult };

// Names an action a caller performs, not a data shape — kept out of
// @dsar/schemas' additive-only freeze deliberately (04-RESEARCH.md Open
// Question 2, resolved): a construct this phase is still iterating on is a
// poor fit for that freeze discipline.
export type TransitionEvent =
  | "SUBMIT"
  | "COMPUTE_SUCCEEDED"
  | "COMPUTE_FAILED"
  | "RAISE_QUERY"
  | "RESUBMIT"
  | "RECOMPUTE"
  | "SIGN_OFF"
  | "MARK_SENT"
  | "SUPERSEDE";

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
      const atLeastOneLine = checkAtLeastOneLine(input.expenseLineCount);
      if (!atLeastOneLine.allowed) return atLeastOneLine;
      const packUsable = checkPackUsable(input.pack, input.jurisdictionCode);
      if (!packUsable.allowed) return packUsable;
      const currencyMatch = checkCurrencyMatches(input.jurisdictionCode, input.currency);
      if (!currencyMatch.allowed) return currencyMatch;
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
  {
    from: "COMPUTING",
    event: "COMPUTE_SUCCEEDED",
    to: "LEGAL_REVIEW",
    guard: (input) => {
      // The frozen GuardInput carries no dedicated "assessment line count"
      // of its own. Right after computation every line is undecided, so
      // pendingLineCount equalling expenseLineCount is the available proxy
      // for "the engine returned a line for every claim" — an inequality
      // means the engine did not return a line for every expense line
      // (04-02-PLAN.md's own documented derivation).
      if (input.expenseLineCount < 1 || input.pendingLineCount !== input.expenseLineCount) {
        return {
          allowed: false,
          reason: `The assessment does not yet cover every expense line (${input.pendingLineCount} of ${input.expenseLineCount} expense lines accounted for)`,
        };
      }
      return { allowed: true };
    },
  },
  {
    from: "COMPUTING",
    event: "COMPUTE_FAILED",
    to: "DRAFT",
    // Permitted unconditionally. The guard's job on a rollback is to let
    // the matter out of computation, never to hold it there — the reason
    // for the failure travels in the audit payload, not in a refusal. An
    // unconditional guard otherwise reads as an oversight; it is not one.
    guard: () => ({ allowed: true }),
  },
  {
    from: "LEGAL_REVIEW",
    event: "RAISE_QUERY",
    to: "INFO_REQUEST",
    // The PRD's "on at least one line" is the calling action's own content
    // (which line(s) the query names), not a state precondition the guard
    // can see.
    guard: (input) => checkLawyerIdentity(input.lawyerIdentity),
  },
  {
    from: "INFO_REQUEST",
    event: "RESUBMIT",
    to: "COMPUTING",
    // The same pack-usability, currency and at-least-one-line predicates
    // the submit row uses, deliberately re-evaluated rather than assumed
    // from the earlier submission — the pack may have changed since.
    guard: (input) => {
      const atLeastOneLine = checkAtLeastOneLine(input.expenseLineCount);
      if (!atLeastOneLine.allowed) return atLeastOneLine;
      const packUsable = checkPackUsable(input.pack, input.jurisdictionCode);
      if (!packUsable.allowed) return packUsable;
      return checkCurrencyMatches(input.jurisdictionCode, input.currency);
    },
  },
  {
    from: "LEGAL_REVIEW",
    event: "RECOMPUTE",
    to: "COMPUTING",
    // The PRD's "confirmed first" is a screen-level confirmation, not a
    // guard condition — a pure function over a typed snapshot cannot
    // observe a confirmation dialog, so it is not encoded here.
    guard: (input) => {
      const lawyer = checkLawyerIdentity(input.lawyerIdentity);
      if (!lawyer.allowed) return lawyer;
      return checkPackAvailable(input.pack, input.jurisdictionCode);
    },
  },
  {
    from: "LEGAL_REVIEW",
    event: "SIGN_OFF",
    to: "SIGNED_OFF",
    guard: (input) => {
      const noPending = checkNoLinesPending(input.pendingLineCount);
      if (!noPending.allowed) return noPending;
      const flagsAck = checkFlagsAcknowledged(
        input.matterLevelFlagsRequiringAck,
        input.acknowledgedFlags
      );
      if (!flagsAck.allowed) return flagsAck;
      const lawyer = checkLawyerIdentity(input.lawyerIdentity);
      if (!lawyer.allowed) return lawyer;
      return checkPackAvailable(input.pack, input.jurisdictionCode);
    },
  },
  {
    from: "SIGNED_OFF",
    event: "MARK_SENT",
    to: "CLOSED",
    // Permitted. The PRD records a date and nothing else here.
    guard: () => ({ allowed: true }),
  },
  {
    from: "SIGNED_OFF",
    event: "SUPERSEDE",
    to: "SUPERSEDED",
    // A correction to a signed record is a legal act and an unattributed
    // one is indefensible.
    guard: (input) => checkLawyerIdentity(input.lawyerIdentity),
  },
  {
    from: "CLOSED",
    event: "SUPERSEDE",
    to: "SUPERSEDED",
    guard: (input) => checkLawyerIdentity(input.lawyerIdentity),
  },
];
