// apps/web/src/server/engine-invocation.ts
//
// Two pack-resolution exports, plus one coercion, and one hard rule between
// them: `resolveCurrentPackForJurisdiction(jurisdictionCode)` answers "what
// pack does a NEW assessment for this jurisdiction get computed against" —
// resolved by the matter's own `jurisdictionCode`, used by every
// submit/resubmit/recompute/correction call site. `resolvePinnedRulePack
// (rulePackId, rulePackVersion)` answers "what pack does an EXISTING
// assessment's own review-time reads use" — resolved by the assessment's own
// pinned fields, never "whichever pack is current," so a later pack-version
// activation can never retroactively change what an already-computed
// assessment displays (PACK-05). `coercePackForDemoEngine()` is the ONLY
// place in this codebase allowed to build an in-memory copy with a different
// status, and it exists solely so packages/engine's checkPreconditions() does
// not refuse to compute against a pack that is still, correctly, DRAFT.
//
// Why the coercion exists at all: every committed pack (all nine
// jurisdictions, not just SG) is DRAFT with null reviewer fields for at
// least some categories, and cannot legitimately reach an authored ACTIVE
// state before full PACK-09 authoring (D-16, STATE.md). The committed files
// must not be edited (03.1-RESEARCH.md Assumption A3, confirmed by the
// product owner, 2026-09-18) — so the ACTIVE status checkPreconditions()
// demands exists only on this in-memory copy, never in the file, and never
// in anything the UI renders as a pack's own real, uncoerced standing.

import "./server-only.ts";
import { loadAllRulePacks, resolveRulePack } from "@dsar/rulepacks/loader";
import { assess } from "@dsar/engine";
import { AssessmentSchema, type Assessment } from "@dsar/schemas/assessment";
import type { LoadableRulePack, RulePack } from "@dsar/schemas/rule-pack";
import type { Matter } from "@dsar/schemas/matter";
import type { JurisdictionCode } from "@dsar/schemas/primitives";
import type { ExpenseLine } from "@dsar/schemas/expense-line";
import { resolveRulepacksRoot } from "./rulepacks-root.ts";
import { findLoadedPackForJurisdiction } from "./jurisdiction-packs.ts";
import { NotFoundError } from "./errors.ts";

// Resolves whichever jurisdiction's real committed pack a matter actually
// needs, for a NEW assessment (submit, resubmit, recompute, correction) —
// used by assessMatter and every direct submit/resubmit/recompute call
// site. Throws if no pack resolves for the jurisdiction (should be
// unreachable in production — every one of the nine jurisdictions has a
// committed pack — but this must fail loudly, not silently substitute
// another jurisdiction's pack, if it ever is).
export function resolveCurrentPackForJurisdiction(jurisdictionCode: JurisdictionCode): LoadableRulePack {
  const loadedPacks = loadAllRulePacks(resolveRulepacksRoot());
  const pack = findLoadedPackForJurisdiction(loadedPacks, jurisdictionCode);
  if (!pack) {
    throw new NotFoundError(`No rule pack found for jurisdiction '${jurisdictionCode}'`);
  }
  return pack;
}

// Resolves the exact pinned version an EXISTING assessment was computed
// against — the assessment's own rulePackId/rulePackVersion fields are
// always the argument, never a jurisdiction lookup, so a later pack-version
// activation can never retroactively change what an already-computed
// assessment shows (PACK-05).
export function resolvePinnedRulePack(rulePackId: string, rulePackVersion: string): LoadableRulePack {
  return resolveRulePack(rulePackId, rulePackVersion, resolveRulepacksRoot());
}

// DEMO-ONLY TRANSFORM — spreads the loaded pack and overrides only `status`;
// `constraints` is re-cast (not changed in value — every committed pack's
// constraints are already all non-null) because LoadableRulePack's
// StubConstraints type is structurally wider (every key nullable) than
// RulePack's frozen RulePackConstraints.
export function coercePackForDemoEngine(loaded: LoadableRulePack): RulePack {
  return {
    ...loaded,
    status: "ACTIVE",
    constraints: loaded.constraints as RulePack["constraints"],
  };
}

export interface AssessMatterInput {
  matter: Matter;
  lines: readonly ExpenseLine[];
}

// Live wall-clock `now` (the product owner's decision, 03.1-RESEARCH.md Open
// Question 2): STALE_PACK_WARNING correctly will not fire against any real
// pack's still-future review date, and no success criterion asks for it.
export function assessMatter(input: AssessMatterInput): Assessment {
  const loaded = resolveCurrentPackForJurisdiction(input.matter.jurisdictionCode);
  const pack = coercePackForDemoEngine(loaded);
  const now = new Date().toISOString();
  const result = assess({ matter: input.matter, lines: input.lines, pack, now });
  // assess() never parses its own output — this boundary does.
  return AssessmentSchema.parse(result);
}
