---
phase: 02-deterministic-fee-engine
plan: "06"
subsystem: engine
tags: [matter-flags, flat-fee, tdd, pack-rules, aggregate-cap-interaction]

requires:
  - phase: 02-deterministic-fee-engine
    provides: "02-05's full §8.1 steps 1-6 (preconditions through totals) and its AGGREGATE_CAP_APPLIED matter flag, which this plan's composeMatterLevelFlags() appends alongside; 02-03's Totals.flatFeeComparison schema field (D-12), which this plan is the first code to consume."
provides:
  - "matter-flags.ts's evaluatePackFlagRules() — evaluates every matterFlagRule a pack authors across all three MatterFlagRuleSchema when arms (always, condition, line-count), reusing conditions.ts's evaluateConditions() rather than a second evaluator; an unrecognised when shape throws (T-2-23)"
  - "matter-flags.ts's computeDerivedMatterFlags() — the four derived matter-flag codes (LITIGATION_POSTURE, REPEAT_REQUEST, STALE_PACK_WARNING, NO_FEE_AUTHORITY_POSTURE) in a declared DERIVED_MATTER_FLAG_ORDER constant, plus composeMatterLevelFlags() which owns the final array's ordering (derived, then the aggregate-cap flag, then pack flags) — wired into assess.ts as the rest of §8.1 step 7"
  - "flat-fee.ts's computeFlatFeeComparison() — D-12/ENGINE-16's flat-fee-vs-itemised-direct-cost comparison, a pure function wired into totals.ts (computed last, from the already-finalised draftBaseline) and assess.ts (pack.flatFee threaded through); omitted entirely (not undefined) when the pack carries no flat fee"
  - "assess() now implements all seven of §8.1's steps end to end; PRD §14's reference fixture reproduces the exact five expected matter flags"
affects: [02-07-banned-word-and-tz-locale-tests]

actuals:
  tokens: 13097
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Structural (not tag-based) discrimination of MatterFlagRuleSchema's three when arms — isAlwaysArm/isLineCountArm/isConditionArm type-guard functions checking for the `always` key, the `field === \"lineCount\"` literal, and closed-vocabulary membership respectively — with a final throw for anything matching none of the three, so a pack-authored warning can never silently fail to fire (T-2-23)"
    - "A matter-field condition is evaluated via evaluateConditions() with a placeholder ExpenseLine ({} as unknown as ExpenseLine) that is never actually read — conditions.ts's resolveFieldValue() falls through to the matter whenever a field is absent from the line, and no matter field name ever collides with an ExpenseLine key, so this lets one evaluator (not two) serve both matter-scoped and line-scoped condition arms, including when lines is empty"
    - "Derived matter flags are computed from a declared array of specs (DERIVED_MATTER_FLAG_SPECS), filtered and mapped, rather than a sequence of if-statements — the array's declaration order IS the output order, exported separately (DERIVED_MATTER_FLAG_ORDER) so a test can assert the order directly rather than only inferring it from a produced array"
    - "computeFlatFeeComparison() is spread into Totals conditionally (`...(flatFeeComparison ? { flatFeeComparison } : {})`), never set to an explicit undefined — this is what keeps a non-flat-fee pack's Totals literally at six keys, verified by Object.keys().sort() rather than a looser presence check"
    - "Deliberately-broken RED stubs matching each task's own named <fails_when> failure mode (a non-inclusive >/< in the line-count arm boundary; an off-by-one <= 31 in the staleness window; an inclusive >= in the flat-fee comparison) — each verified via `gsd-tools check tdd-red-evidence` before GREEN, continuing 02-01..02-05's documented tap-flat + hand-appended TAP-summary workaround"

key-files:
  created:
    - packages/engine/src/matter-flags.ts
    - packages/engine/src/matter-flags.test.ts
    - packages/engine/src/flat-fee.ts
    - packages/engine/src/flat-fee.test.ts
    - packages/engine/src/__fixtures__/flat-fee-pack.ts
  modified:
    - packages/engine/src/assess.ts
    - packages/engine/src/totals.ts
    - packages/engine/src/messages.ts
    - packages/engine/src/reference-fixture.golden.test.ts

key-decisions:
  - "D-12's schema field was clean to consume: FlatFeeComparisonSchema (assessment.ts) and RulePack.flatFee (rule-pack.ts) both already carried exactly the fields this plan needed (flatFeeAmount/itemisedDirectCostAmount/flatFeeExceedsItemisedCost; FlatFee.amount/basis/citation/verificationStatus), so computeFlatFeeComparison() is a direct, single-branch mapping with no impedance mismatch or awkward re-derivation. The one real design decision left to this plan — confirmed, not re-litigated — was WHEN in the pipeline to compute it: totals.ts computes it last, from the already-finalised draftBaseline, so it automatically reflects whatever the cross-line checks and aggregate cap did upstream without needing its own copy of that logic."
  - "NO_FEE_AUTHORITY_POSTURE's derived flag reuses the per-line NO_FEE_AUTHORITY reason's underlying fact (pack.feePosture[matter.controllerType] === 'NO_EXPRESS_AUTHORITY') rather than inspecting the already-computed per-line verdicts — computing it from the posture directly is simpler and cannot disagree with what evaluateLine() independently derives from the same posture."
  - "Derived-flag messages not given exact PRD wording (REPEAT_REQUEST, STALE_PACK_WARNING, NO_FEE_AUTHORITY_POSTURE — PRD §8.1 step 7 names the codes but not literal copy for these three) were authored in messages.ts's existing register, naming the specific values involved (reviewDueOn date and days remaining for staleness) rather than a bare 'this may not apply' sentence. LITIGATION_POSTURE alone is PRD §9.4's verbatim AC-24 quote, transcribed exactly."

requirements-completed: [ENGINE-11, ENGINE-16]

coverage:
  - id: D1
    description: "Every matterFlagRule in a pack is evaluated across all three when arms (always, condition, line-count), each with a matching and non-matching case; requiresAcknowledgement comes from the rule (including a false case); an unrecognised when shape throws; every produced flag parses through MatterFlagSchema"
    requirement: "ENGINE-11"
    verification:
      - kind: unit
        ref: "packages/engine/src/matter-flags.test.ts#matterFlagRules — evaluatePackFlagRules"
        status: pass
    human_judgment: false
  - id: D2
    description: "The four derived matter-flag codes (LITIGATION_POSTURE, REPEAT_REQUEST, STALE_PACK_WARNING, NO_FEE_AUTHORITY_POSTURE) fire/stand-down correctly, with both staleness boundaries (30 fires, 31 does not) asserted, the declared derived-flag order asserted directly, and composeMatterLevelFlags' three-part ordering (derived, aggregate-cap, pack) asserted"
    requirement: "ENGINE-11"
    verification:
      - kind: unit
        ref: "packages/engine/src/matter-flags.test.ts#matter flags — derived and composed"
        status: pass
    human_judgment: false
  - id: D3
    description: "PRD §14's reference fixture reproduces the exact five expected matter flags (LITIGATION_POSTURE and STALE_PACK_WARNING, both requiring acknowledgement, plus the three informational SG pack flags) in one toEqual covering id/code/message/requiresAcknowledgement; a NO_FEE_AUTHORITY_POSTURE case is asserted alongside every line being flagged; matterLevelFlags is asserted deterministic across two consecutive assess() calls"
    requirement: "ENGINE-11"
    verification:
      - kind: unit
        ref: "packages/engine/src/reference-fixture.golden.test.ts#PRD §14 reference fixture (SG-shaped) / §8.1 step 7 — the NO_FEE_AUTHORITY_POSTURE matter-level code"
        status: pass
    human_judgment: true
    rationale: "The five-flag array's arithmetic/wiring is machine-verified by this golden test; whether LITIGATION_POSTURE's exact PRD-quoted wording is itself the right legal framing (as opposed to correctly transcribed) is a judgment already made by the PRD's own author, not re-litigated here."
  - id: D4
    description: "computeFlatFeeComparison reports the flat figure, the itemised direct cost (draftBaseline), and whether it exceeds — strictly greater than, so an exact-equality figure reports not-exceeding; a pack with no flat fee leaves Totals at exactly six keys; a case with a binding aggregate cap proves the comparison reads the POST-cap draftBaseline, not the pre-cap sum; draftBaseline and finalAmount are unchanged by the presence of a flat fee"
    requirement: "ENGINE-16"
    verification:
      - kind: unit
        ref: "packages/engine/src/flat-fee.test.ts"
        status: pass
    human_judgment: false

duration: 48min
completed: 2026-09-15
status: complete
---

# Phase 2 Plan 6: Matter-Level Flags and the Flat-Fee Comparison Summary

**`assess()` now implements all seven steps of PRD §8.1: matterFlagRules evaluated across all three `when` arms, four derived matter-flag codes composed in a declared order alongside plan 02-05's aggregate-cap flag, and a strict flat-fee-vs-itemised-direct-cost comparison (D-12) that reports without choosing — reproducing PRD §14's exact five expected matter flags.**

## Performance

- **Duration:** ~48 min
- **Started:** 2026-09-15T10:27:00Z
- **Completed:** 2026-09-15T11:15:00Z
- **Tasks:** 3
- **Files modified:** 9 (5 created, 4 modified)

## Accomplishments

- `matter-flags.ts`'s `evaluatePackFlagRules()` discriminates `MatterFlagRuleSchema`'s three `when` arms structurally (always / line-count / condition), reuses `conditions.ts`'s `evaluateConditions()` for the condition arm (evaluating a matter-field condition once, a line-field condition against every line with "any line" semantics), and throws on an unrecognised shape rather than silently skipping it (T-2-23) — proven by a matching-and-non-matching test case for every arm, including both line-count boundaries
- `matter-flags.ts`'s `computeDerivedMatterFlags()` adds `LITIGATION_POSTURE` (PRD §9.4's verbatim AC-24 quote), `REPEAT_REQUEST`, `STALE_PACK_WARNING` (inclusive 30-day window, both boundaries asserted) and `NO_FEE_AUTHORITY_POSTURE`, from a declared `DERIVED_MATTER_FLAG_SPECS` array rather than a sequence of `if` statements, so the output order is a reviewable constant (`DERIVED_MATTER_FLAG_ORDER`) rather than incidental; `composeMatterLevelFlags()` owns the final array's ordering (derived, then plan 02-05's aggregate-cap flag, then pack flags) and is wired into `assess.ts` as the rest of §8.1 step 7
- `flat-fee.ts`'s `computeFlatFeeComparison()` (D-12/ENGINE-16) compares a pack's flat figure against `draftBaseline` — "itemised direct cost" per 02-CONTEXT.md's D-12 — strictly greater than, so an exact-equality figure reports not-exceeding; wired into `totals.ts` so it is computed LAST, from the already-finalised `draftBaseline` (after cross-line checks and the aggregate cap), and spread into `Totals` only when present so a non-flat-fee pack keeps exactly six keys
- PRD §14's reference fixture now asserts the exact five expected matter flags — `LITIGATION_POSTURE` and `STALE_PACK_WARNING` (both requiring acknowledgement) plus the three informational SG pack flags — in one `toEqual`, with a dedicated `NO_FEE_AUTHORITY_POSTURE` case and a determinism check (two consecutive `assess()` calls produce `toEqual`-identical `matterLevelFlags`)
- `packages/engine/src/__fixtures__/flat-fee-pack.ts` — a hand-built, HK-shaped fixture pack carrying a flat fee, authoring no legal position, with an `overrides.aggregateCap` hook used to prove the flat-fee comparison reads the post-cap baseline rather than the pre-cap sum

## Task Commits

Each task followed RED → GREEN (no REFACTOR needed — all three implementations were minimal on first pass):

1. **Task 1: Evaluate the pack's own matterFlagRules**
   - `5fe70c9` — test(02-06): add failing tests for matterFlagRules evaluation (RED)
   - `90fc9a6` — feat(02-06): implement matterFlagRules evaluation across all three when arms (GREEN)
2. **Task 2: The three derived matter flags, wired in as step 7**
   - `dae0152` — test(02-06): extend fixtures with the four derived matter flags, wired as step 7 (RED)
   - `5021047` — feat(02-06): wire the four derived matter flags into assess() as the rest of step 7 (GREEN)
3. **Task 3: D-12 — the flat-fee comparison**
   - `68070a1` — test(02-06): add failing tests for the D-12 flat-fee comparison (RED)
   - `af925ea` — feat(02-06): fix the flat-fee comparison to strict greater-than (GREEN)

**Plan metadata:** committed alongside this SUMMARY (see final commit below).

## TDD Gate Compliance

| Task | RED commit | GREEN commit | RED evidence | Status |
|------|-----------|---------------|---------------|--------|
| 1 | `5fe70c9` | `90fc9a6` | `RED_EVIDENCE_OK` (line-count arm's "fires inclusively at the boundary" test failed `[]` vs length-1 on a deliberate non-inclusive `>`/`<`) | Pass |
| 2 | `dae0152` | `5021047` | `RED_EVIDENCE_OK` (31-day boundary test failed — a `STALE_PACK_WARNING` flag was present when asserted absent, on a deliberate off-by-one `<= 31`) | Pass |
| 3 | `68070a1` | `af925ea` | `RED_EVIDENCE_OK` (exact-equality boundary test failed `true` vs `false` on a deliberate inclusive `>=`) | Pass |

All three RED phases were validated with `gsd-tools check tdd-red-evidence` before the corresponding GREEN commit, using 02-01..02-05's documented `vitest --reporter=tap-flat` plus hand-appended TAP summary-line workaround (Vitest's TAP reporters carry no native `# tests`/`# pass`/`# fail` summary line, which the classifier's Node-test-runner-shaped parser expects).

## Files Created/Modified

- `packages/engine/src/matter-flags.ts` — `evaluatePackFlagRules()`, `computeDerivedMatterFlags()`, `composeMatterLevelFlags()`, `DERIVED_MATTER_FLAG_ORDER`
- `packages/engine/src/matter-flags.test.ts` — 22 tests: all three `when` arms (matching/non-matching, boundaries), requiresAcknowledgement sourcing, unrecognised-shape throw, the four derived codes and their boundaries, order/composition assertions
- `packages/engine/src/flat-fee.ts` — `computeFlatFeeComparison()`, a pure function
- `packages/engine/src/flat-fee.test.ts` — 8 tests: the pure function's four behaviours plus three wired-through-assess() cases (no flat fee, plain, post-aggregate-cap)
- `packages/engine/src/__fixtures__/flat-fee-pack.ts` — `buildFlatFeeFixturePack()`, an HK-shaped fixture carrying a flat fee
- `packages/engine/src/assess.ts` — step 7 fully wired (`composeMatterLevelFlags` call); `pack.flatFee` threaded into `computeTotals()`
- `packages/engine/src/totals.ts` — `computeTotals()` gains an optional `flatFee` parameter and computes/spreads `flatFeeComparison` last
- `packages/engine/src/messages.ts` — `litigationPostureMessage` (verbatim PRD §9.4 quote), `repeatRequestMessage`, `stalePackWarningMessage`, `noFeeAuthorityPostureMessage`
- `packages/engine/src/reference-fixture.golden.test.ts` — extended with the exact five-flag assertion, a determinism check, and a `NO_FEE_AUTHORITY_POSTURE` case

## Decisions Made

- D-12's schema field (from plan 02-03) was clean to consume — no impedance mismatch between `FlatFeeComparisonSchema`'s three fields and `FlatFee`'s own shape; the only real decision was pipeline placement (last, from the finalised `draftBaseline`), already settled by the plan's own instruction
- `NO_FEE_AUTHORITY_POSTURE` derives directly from `pack.feePosture[matter.controllerType]`, not from inspecting per-line verdicts, so it cannot disagree with `evaluateLine()`'s independent posture-gate computation
- `REPEAT_REQUEST`/`STALE_PACK_WARNING`/`NO_FEE_AUTHORITY_POSTURE` message text is authored (PRD names the codes, not literal copy for these three); `LITIGATION_POSTURE` alone transcribes PRD §9.4's AC-24 quote verbatim

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The NO_FEE_AUTHORITY_POSTURE golden test's single-line fixture also tripped step 4's materiality check**
- **Found during:** Task 2, GREEN phase, `pnpm vitest run --project engine`
- **Issue:** A test asserting `flagReasons` equalled exactly `["NO_FEE_AUTHORITY"]` failed because a lone `REFERENCE_LINE` is unavoidably 100% of its own claim, so step 4's materiality check also fires — the same interaction plan 02-05's SUMMARY documented for its own single-line tracer test. This is the cross-line check working as specified, not a bug in this plan's matter-flags code.
- **Fix:** Relaxed the assertion to check every line's verdict is `FLAG` and that `NO_FEE_AUTHORITY` is present among the reasons (`toContain`, not exact `toEqual`), matching the test's actual subject (the posture gate's reason and the new matter-level code), not an exhaustive list of every reason a coincidental cross-line check adds on top.
- **Files modified:** `packages/engine/src/reference-fixture.golden.test.ts`
- **Verification:** `pnpm vitest run --project engine` 141/141 passing at the time
- **Committed in:** `5021047` (Task 2 GREEN)

---

**Total deviations:** 1 auto-fixed (1 bug — a test fixture's own assumption invalidated by a correctly-firing pre-existing check, not this plan's code)
**Impact on plan:** Caught and fixed within the same task's RED→GREEN cycle before that task's GREEN commit; no scope creep beyond the plan's own three tasks and their stated acceptance criteria.

## Issues Encountered

None beyond the deviation above — resolved within the task that found it.

`packages/engine/src/index.ts` was listed in this plan's `files_modified` frontmatter but was not touched: no new type introduced by this plan (`evaluatePackFlagRules`, `computeDerivedMatterFlags`, `composeMatterLevelFlags`, `computeFlatFeeComparison`) needed re-exporting from the package's public surface — every schema type these functions consume or produce (`MatterFlag`, `FlatFeeComparison`, `RulePack`) already comes from `@dsar/schemas`, not from `packages/engine`'s own index. This mirrors 02-04/02-05's precedent of a plan's projected file list being a ceiling, not a floor.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `assess()` now implements the complete PRD §8.1 seven-step algorithm; every requirement this phase names for the core engine (`ENGINE-01` through `ENGINE-16`) has a plan behind it.
- `ENGINE-11` and `ENGINE-16` are exclusive to this plan (`gsd-tools query requirements.ready-ids` confirms 2/2 ready) and are marked `Complete` below.
- Plan 02-07 (banned-word and TZ/locale tests) can now scan `messages.ts` exhaustively, including this plan's four new derived-flag message templates and the pack-authored `matterFlagRules` text (which passes through verbatim and is Phase 3's pack-validator responsibility, not re-validated here).
- No blockers for the next plan in this phase. `packages/engine` remains green across the full workspace (344/344 tests, lint, typecheck, depcruise all clean).

## Self-Check: PASSED

- All 5 created files verified present on disk (`[ -f ]`): `matter-flags.ts`, `matter-flags.test.ts`, `flat-fee.ts`, `flat-fee.test.ts`, `__fixtures__/flat-fee-pack.ts`.
- All 6 task commit hashes verified present in `git log --oneline --all`.
- Full engine test suite re-run: `pnpm vitest run --project engine` — 148/148 passing.
- Full monorepo suite re-run: `pnpm test` — 344/344 passing.
- `pnpm run typecheck`, `pnpm run lint`, `pnpm run depcruise` all re-run clean.
- `gsd-tools query requirements.ready-ids` — 2/2 ready (ENGINE-11, ENGINE-16).
- `plan_head_before: d52df7358fda525a09f8d70a335cbd1bed750130`, `commits: 6` (measured via `git rev-list --count`).

---
*Phase: 02-deterministic-fee-engine*
*Completed: 2026-09-15*
