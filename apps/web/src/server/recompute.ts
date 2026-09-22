// apps/web/src/server/recompute.ts
//
// The in-place recompute mechanics shared by resubmitAfterInfoRequest and
// recomputeAgainstCurrentPack (data/matters.ts) — the mirror-image rule
// that is easy to get backwards (PRD §5, ./CLAUDE.md's state-machine
// paragraph): a recompute MUTATES the existing Assessment (same id), it
// never creates a second record. The engine derives its own identifier
// from its inputs; that derived id is deliberately discarded in favour of
// the one already on file. Do not "fix" this to use the engine's own
// derived id — a different frozen lifecycle status (SUPERSEDED) exists for
// the correction-after-sign-off case, and this module's callers both run
// strictly before sign-off.
//
// Also clears the assessment's first-opened record (packages/audit's
// review-session) as part of the SAME operation, so no caller can perform
// a recompute and forget the reset (04-RESEARCH.md Pitfall 3) — a second
// review pass measured from the first pass's opening would silently
// corrupt the one signal AUDIT-03's elapsed figure exists to produce.
//
// NOT used by data/assessments.ts's raiseCorrection() (04-05, the
// SUPERSEDE row) — that function's whole point is the mirror image of this
// one: it CREATES a new identity because the record it corrects is final
// (SIGNED_OFF or CLOSED) and must survive untouched, where this module
// PRESERVES an identity because the record it mutates is not yet final.
// See raiseCorrection()'s own module note, which points back here.

import "./server-only.ts";
import type { Matter } from "@dsar/schemas/matter";
import type { ExpenseLine } from "@dsar/schemas/expense-line";
import type { Assessment } from "@dsar/schemas/assessment";
import { assessMatter } from "./engine-invocation.ts";
import { clearAssessmentOpened } from "@dsar/audit/review-session";

export interface RecomputeAssessmentArgs {
  matter: Matter;
  lines: readonly ExpenseLine[];
  existing: Assessment;
}

// Re-runs the engine over the matter's CURRENT lines and returns the
// result carrying the EXISTING assessment's identity — never the engine's
// own derived one (see module note above). assessMatter() itself starts
// every line PENDING with no lawyer amount, reason, actor or timestamp, so
// nothing from the old dispositions can survive the overwrite the caller
// performs with this return value.
export function recomputeAssessment(args: RecomputeAssessmentArgs): Assessment {
  const { matter, lines, existing } = args;
  const recomputed = assessMatter({ matter, lines });
  clearAssessmentOpened(existing.id);
  return { ...recomputed, id: existing.id };
}
