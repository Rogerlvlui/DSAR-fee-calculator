# HANDOFF — Phase 3 (Rule Packs and Pack Admin)

## Branch state

- Branch: `claude/gsd-execute-phase-3-8d8826`, pushed to `origin`, no PR open.
- Worktree: `.claude/worktrees/gsd-execute-phase-3-96530d`.
- HEAD: `wip: checkpoint phase 3 execution (03-01, 03-02 complete; GSD runtime state)`.
- Working tree clean. Nothing staged, nothing pending.
- 03-03 execution attempt failed mid-dispatch on a session rate limit — it died before writing any file or commit. No partial state to reconcile.

## Phase 3 plans: done vs not

5 plans, 3 waves. Waves 2's three plans have no `files_modified` overlap but this repo runs with `workflow.use_worktrees=false`, so everything executes sequentially regardless.

| Plan | Wave | Status | What it is |
|------|------|--------|------------|
| 03-01 | 1 | ✅ done (6 commits) | `packages/rulepacks` scaffold, loader, PACK-11 banned-word gate, VN-PDPL stub pack |
| 03-02 | 2 | ✅ done (7 commits) | AU/NZ/JP/KR/CN/IN stub packs (7 jurisdictions total incl. VN) |
| 03-03 | 2 | ❌ not started | PACK-02 categoryRules exhaustiveness + PACK-03 ACTIVE-readiness gate |
| 03-04 | 2 | ❌ not started | Staleness derivation (`stale.ts`) + version pinning/lookup |
| 03-05 | 3 | ❌ not started (depends on 03-01+03-02, both satisfied) | HK-PDPO + SG-PDPA authored packs, flat-fee (`FlatFeeSchema`) wiring |

Requirements landed so far: PACK-01, PACK-10, PACK-11. Outstanding: PACK-02, PACK-03, PACK-04, PACK-05, PACK-09, PACK-12.

## Design decisions settled this session

**1. Constraints: `boolean | null`, `null` = unresearched, `false` = researched-and-negative.**
`RulePackConstraintsSchema` (frozen, Phase 1) keeps all 9 booleans required, no `.nullable()`, no defaults — an authored pack can never silently inherit permissive `true`. That leaves no way to express "nobody has looked at this yet" for a stub. Fix: a **new parallel type**, not a widened frozen field.
- `StubConstraintsSchema` (`packages/schemas/src/rule-pack.ts`) — every key `.nullable()`, same field order, same shape otherwise.
- Widening the frozen schema in place was explicitly rejected (D-18): it re-opens a freeze mid-phase while Phases 4/5 build against it concurrently, and "add nullable to a required field" isn't obviously additive.
- `null` and `false` are never collapsed. `false` means counsel researched it and the answer is no.

**2. Stub vs. authored discriminant: `packKind: "stub" | "authored"` on the `PACK_JURISDICTIONS` table row, not on the pack JSON itself.**
Lives in `PackJurisdiction` (`packages/rulepacks/src/stub-category-rules.ts`), consumed by `generateStubPack()`/`generateStubCategoryRules()`. It exists from 03-01 even though every row was `"stub"` until 03-05, specifically so 03-05's HK/SG rows (partly authored, but still need generated placeholder rules for whatever categories aren't hand-written) reuse the **same table and same generator** instead of forking a second "authored packs" list that could drift out of sync with the stub one. `generateStubPack()` throws `NotAStubPackError` if called on an `"authored"` row — an authored pack is assembled by hand, never generated wholesale.
- This is a design-time/tooling discriminant. The committed pack JSON has no `packKind` field; a pack's actual state is read from its own content (`verificationStatus`, the `UNAUTHORED_TOKEN` marker, `status: DRAFT`).

**3. Committed JSON + regeneration drift test, not load-time generation.**
Every stub pack's `categoryRules` is committed literal JSON (PRD §7.3: "the repository is the source of truth; the database copy is a cache" — same logic extended to generated content). `stub-category-rules.test.ts` re-runs `generateStubCategoryRules()` at test time and deep-equals it against every `UNAUTHORED_TOKEN`-bearing rule in the committed tree. A hand-authored rule (no token) is excluded from the comparison. An unknown `packId` in the tree fails loudly rather than being silently skipped (blind-spot guard). Rules are **never** generated at load time — that would make the repo stop being the literal source of truth.

**4. Canonical "unauthored" marker: `UNAUTHORED_TOKEN = "UNAUTHORED"` (`packages/schemas/src/constants.ts`), embedded as a substring inside `verificationNote` and `requestorNoticeTemplate`.**
Not a separate boolean field, not `verificationStatus` alone (that's a real 2-value enum, `VERIFIED | NEEDS_VERIFICATION`, and every hand-authored-but-unverified line would also be `NEEDS_VERIFICATION` — it can't distinguish "nobody wrote this" from "someone wrote this and it needs sign-off"). The token is prefixed onto the free-text field instead: `` `${UNAUTHORED_TOKEN} — ${authoringNote}` ``. Both the drift test (item 3) and the future PACK-03 ACTIVE-readiness gate (03-03, not yet built) key off this **same single token** — CONTEXT.md's Claude's Discretion item 1 was explicit that there must be no second, independently-maintained list of "which rules are still placeholders."

## Next three concrete tasks

1. **Run 03-03** (`packages/rulepacks/src/validate.ts` + `validate.test.ts` + 5 new fixtures). Adds PACK-02 (21-category exhaustiveness for `ACTIVE` packs) and PACK-03 (ACTIVE-readiness gate: no `UNAUTHORED_TOKEN` anywhere, `authoredBy`/`reviewedBy`/`reviewedOn` all non-null). Depends only on 03-01 (loader/validator scaffold) — already satisfied.
2. **Run 03-04** (`packages/rulepacks/src/stale.ts` + `loader.ts` version lookup). Derives "is this pack usable now" from `reviewDueOn` vs. current date, and pins an assessment to a specific committed version. Depends only on 03-01 — already satisfied. No file overlap with 03-03; order between them doesn't matter.
3. **Run 03-05** (HK-PDPO + SG-PDPA authored packs, flat-fee marker). Needs `PACK_JURISDICTIONS` to accept `packKind: "authored"` rows (03-01 already shaped the table for this) and needs 03-02's seven stub packs present as the sibling set the drift test scans (both satisfied). This is the last plan in the phase — after it, run phase verification.

Resume with `/gsd-execute-phase 3` — it detects 03-01/03-02 as summarized and skips them automatically.

## Assumptions a fresh session would get wrong

- **`RulePackConstraintsSchema` is frozen and must not be touched.** The fix for "stub packs need nullable constraints" is `StubConstraintsSchema`, a new type. Do not add `.nullable()` to the frozen schema's fields — that was considered and explicitly rejected (D-18).
- **`LoadableRulePackSchema` is the primary load-boundary shape now, not `RulePackSchema`.** Every committed pack (`loadRulePackFile`/`loadAllRulePacks`) parses as `LoadableRulePackSchema` (constraints may be `null`). `RulePackSchema` is the *narrower*, ACTIVE-ready variant that `packages/engine` consumes — re-parsing a `LoadableRulePack` through the untouched `RulePackSchema` is exactly what 03-03's ACTIVE gate uses to reject a surviving `null`. Don't assume `RulePackSchema` is still "the" pack type.
- **`packKind` is not a runtime/schema field.** It's compile-time metadata in `PACK_JURISDICTIONS` (a TS source file), used only by the generator. Don't look for it in the committed JSON or in `RulePackSchema`/`LoadableRulePackSchema` — it isn't there.
- **Don't inject real defects into production code to manufacture TDD RED.** Where the underlying gate is already correct from an earlier task in the same plan (common here — Task 1 usually builds the real thing, Tasks 2/3 prove gates against it), RED evidence uses a deliberately-inverted assertion (`.not.toThrow()` etc.) against the *correct* code, not a corrupted implementation. This is an established, repeated pattern in this phase (03-01, 03-02) — expect it again in 03-03/03-04/03-05.
- **A known, pre-existing test failure is expected and is not yours to fix:** `packages/schemas/src/json-schema.test.ts`'s byte-identical drift check fails on this Windows checkout (CRLF-committed artifact vs. LF-regenerated output). Confirmed pre-existing (git-stash-verified against the unmodified Phase 1/2 baseline), logged in `WINDOWS.md` (id 1, `open`) and `.planning/phases/03-rule-packs-and-pack-admin/deferred-items.md`. Don't spend a task "fixing" this unless a plan is explicitly scoped to it — it's tracked, not silently broken.
- **`workflow.use_worktrees` is `false` project-wide.** Don't assume Wave 2's three plans (03-03/03-04/03-05... actually 03-02/03-03/03-04) can run in parallel just because their `files_modified` lists don't overlap — this runtime forces sequential dispatch on the main tree regardless.
- **VN's `citation.provision` is deliberately `""`, not a missing field.** Several jurisdictions (VN, JP, KR partial) have empty or partial `provisions` arrays by design (D-14: no invented citations where the PRD names none) — don't "fix" these by inventing article numbers.
