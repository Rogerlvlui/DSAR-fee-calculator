// apps/web/src/server/engine-invocation.ts
//
// Two exports and one hard rule between them: `loadDemoPack()` returns the
// pack's real, uncoerced load result, which every rendered pack status in
// this app reads from — DRAFT, honestly, for the committed
// SG-PDPA/2026.09.1.json. `coercePackForDemoEngine()` is the ONLY place in
// this codebase allowed to build an in-memory copy with a different status,
// and it exists solely so packages/engine's checkPreconditions() does not
// refuse to compute against a pack that is still, correctly, DRAFT.
//
// Why the coercion exists at all: the committed SG-PDPA pack is DRAFT with
// null reviewer fields and cannot legitimately reach an authored ACTIVE
// state before Phase 6 (D-16, STATE.md). The committed file must not be
// edited (03.1-RESEARCH.md Assumption A3, confirmed by the product owner,
// 2026-09-18) — so the ACTIVE status checkPreconditions() demands exists
// only on this in-memory copy, never in the file, and never in anything the
// UI renders.

import "./server-only.ts";
import { resolveRulePack } from "@dsar/rulepacks/loader";
import { assess } from "@dsar/engine";
import { AssessmentSchema, type Assessment } from "@dsar/schemas/assessment";
import type { LoadableRulePack, RulePack } from "@dsar/schemas/rule-pack";
import type { Matter } from "@dsar/schemas/matter";
import type { ExpenseLine } from "@dsar/schemas/expense-line";
import { resolveRulepacksRoot } from "./rulepacks-root.ts";

export const DEMO_PACK_ID = "SG-PDPA";
export const DEMO_PACK_VERSION = "2026.09.1";

// Everything the UI renders about the pack's real, uncoerced standing (the
// status strip, the capability statement) reads this function's return
// value directly — never the coerced copy below.
export function loadDemoPack(): LoadableRulePack {
  return resolveRulePack(DEMO_PACK_ID, DEMO_PACK_VERSION, resolveRulepacksRoot());
}

// DEMO-ONLY TRANSFORM — never used by a real ACTIVE-pack workflow (Phase 6+).
// Spreads the loaded pack and overrides only `status`; `constraints` is
// re-cast (not changed in value — the committed SG pack's constraints are
// already all non-null) because LoadableRulePack's StubConstraints type is
// structurally wider (every key nullable) than RulePack's frozen
// RulePackConstraints.
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
// Question 2): STALE_PACK_WARNING correctly will not fire against the real
// pack's 2027-03-12 review date, and no success criterion asks for it.
export function assessMatter(input: AssessMatterInput): Assessment {
  const loaded = loadDemoPack();
  const pack = coercePackForDemoEngine(loaded);
  const now = new Date().toISOString();
  const result = assess({ matter: input.matter, lines: input.lines, pack, now });
  // assess() never parses its own output — this boundary does.
  return AssessmentSchema.parse(result);
}
