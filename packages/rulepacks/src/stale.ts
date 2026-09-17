// packages/rulepacks/src/stale.ts
//
// PACK-04 (AC-39) — a pack's usability is a derived answer, never a stored
// literal trusted at face value. A repository JSON file cannot flip its own
// `status` when a date passes, so a stored `ACTIVE` is not evidence of
// currency; it must be recomputed at the point of use, against an injected
// `now`, exactly as packages/engine/src/preconditions.ts already does for
// the engine's own precondition.
//
// The day-counting arithmetic is imported from `@dsar/engine/calendar-math`,
// never reimplemented here. `daysUntil` is proven timezone-invariant by an
// existing Phase 2 test, and a second copy of the same calendar arithmetic
// is exactly the "two places that must agree" failure mode CONTEXT.md
// records Phase 1 losing four gates to.

import { daysUntil } from "@dsar/engine/calendar-math";
import type { LoadableRulePack, RulePackStatus } from "@dsar/schemas/rule-pack";

// Two asymmetries that are easy to get backwards:
//
// 1. The strict `< 0` is AC-39's "past, not on" boundary — the same one
//    packages/engine/src/preconditions.ts draws for its own precondition. A
//    pack whose `reviewDueOn` equals `now`'s calendar date is NOT stale.
// 2. Derivation only ever downgrades, never upgrades: a non-`ACTIVE` stored
//    status (`DRAFT`, `WITHDRAWN`, or an already-`STALE` pack) passes
//    through unchanged. A `DRAFT` pack past its review date stays `DRAFT`
//    — it was never usable in the first place, and derivation does not
//    invent a reason it now is. A pack whose stored status is `STALE`
//    reports `STALE` regardless of what its `reviewDueOn` says — a stored
//    `STALE` is never "revived" by a future-dated review date.
export function deriveEffectiveStatus(pack: LoadableRulePack, now: string): RulePackStatus {
  if (pack.status === "ACTIVE" && daysUntil(now, pack.reviewDueOn) < 0) {
    return "STALE";
  }
  return pack.status;
}

// A thin pass-through to `daysUntil`, exported so later phases (the 30-day
// advance warning, the in-flight-review notice) have one place to read this
// from rather than each re-deriving it independently.
export function daysUntilReviewDue(pack: LoadableRulePack, now: string): number {
  return daysUntil(now, pack.reviewDueOn);
}

// `null` unless `deriveEffectiveStatus` says the pack is `STALE`; otherwise a
// sentence naming both `reviewDueOn` and `now` — phrased the way
// `packPastReviewDueMessage` (packages/engine/src/messages.ts) already
// phrases the same fact. It reports a date having passed; it says nothing
// about what is or is not permitted (no LEGAL_CONCLUSION_BANNED_WORDS member
// appears in this template).
export function staleReason(pack: LoadableRulePack, now: string): string | null {
  if (deriveEffectiveStatus(pack, now) !== "STALE") return null;
  return `Rule pack reviewDueOn '${pack.reviewDueOn}' is before now '${now}' — the pack is past its review date.`;
}
