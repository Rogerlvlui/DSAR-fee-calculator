---
phase: 02-deterministic-fee-engine
plan: "04"
subsystem: engine
tags: [posture-gate, treatments, apply-cap, conditions, golden-fixture, tdd]

requires:
  - phase: 02-deterministic-fee-engine
    provides: "02-01's engine spine (assess.ts, checkPreconditions, computeTotals, calendar-math.ts) this plan extends, and 02-02's determinism/purity gates this plan's new code must pass"
provides:
  - "applyCap(cap, line) — PER_UNIT/PER_LINE exact-integer, PERCENT_OF_CLAIM floored (never rounded), PER_MATTER refused with a typed EngineComputationFailure"
  - "evaluateConditions(conditions, {line, matter}) — all three Condition union arms, all six comparison operators plus in/isNull/isNotNull, strict (non-coercing) equality, returning which conditions failed"
  - "applyPostureGate(posture) — an exhaustive switch over all seven FeePosture values; PROHIBITED/PERMITTED_NARROW_EXCEPTION force DISALLOW, NO_EXPRESS_AUTHORITY forces FLAG/NO_FEE_AUTHORITY, the other four permit the treatment table to run"
  - "evaluateLine(...) — the full §8.1 step-3 dispatch (all five treatments) wired behind the step-2 posture gate and the AC-19 OTHER_UNCLASSIFIED override, every produced line schema-valid"
  - "assess() now runs every treatment, not just ALLOW — the 02-01 tracer dispatch is fully replaced"
  - "The PRD §14 six-line reference fixture (reference-pack.ts, reference-lines.ts) and its golden test, reproducing all six published totals and all six per-line verdicts/amounts exactly"
affects: [02-05-aggregate-cap-and-cross-line-checks, 02-06-matter-flags-and-flat-fee, 02-07-banned-word-and-tz-locale-tests]

actuals:
  tokens: 17493
  tasks: 3
  commits: 8

tech-stack:
  added: []
  patterns:
    - "Deliberately-broken RED stubs matching each task's own named <fails_when> failure mode (a Math.round substitution in applyCap's PERCENT_OF_CLAIM branch; a loose == in evaluateConditions' eq/neq; an always-ALLOW_CAPPED verdict in evaluate-line's ALLOW_WITH_CAP branch; STAFF_TIME_SEARCH authored NEEDS_VERIFICATION in the golden fixture, copying §7.6's real-pack description) — each produces the exact wrong literal the plan's <fails_when> names, verified via gsd-tools check tdd-red-evidence before GREEN, continuing 02-01/02-02/02-03's documented tap-flat + hand-appended TAP-summary workaround for that tool's Node-test-runner-shaped parser"
    - "A second typed-error family (EngineComputationFailure/EngineComputationError in errors.ts) distinct from AssessPreconditionFailure — reserved for mid-computation refusals (a PER_MATTER cap reaching applyCap, an ALLOW_WITH_CAP rule with no cap) rather than step-1 input preconditions"
    - "posture-gate.ts's switch has no default branch — a future FeePosture addition without a matching case is a TS compile error (a code path with no return conflicting with the declared union return type), not a silent fall-through into the permitting branch"
    - "evaluate-line.ts builds every AssessmentLine's basis/citation/appliedRuleId from the resolved CategoryRule unconditionally, even under a posture-gate-forced verdict — AC-20 requires a DISALLOW/FLAG line to still show its rule's provenance, not a blank one"

key-files:
  created:
    - packages/engine/src/apply-cap.ts
    - packages/engine/src/apply-cap.test.ts
    - packages/engine/src/conditions.ts
    - packages/engine/src/conditions.test.ts
    - packages/engine/src/posture-gate.ts
    - packages/engine/src/posture-gate.test.ts
    - packages/engine/src/evaluate-line.ts
    - packages/engine/src/evaluate-line.test.ts
    - packages/engine/src/__fixtures__/reference-pack.ts
    - packages/engine/src/__fixtures__/reference-lines.ts
    - packages/engine/src/reference-fixture.golden.test.ts
  modified:
    - packages/engine/src/assess.ts
    - packages/engine/src/errors.ts
    - packages/engine/src/messages.ts

key-decisions:
  - "PERMITTED_NARROW_EXCEPTION is treated identically to PROHIBITED (forces DISALLOW) rather than modelling a narrow per-line exception the PRD's §8.1 step 2 prose does not itself describe a mechanism for — the 'engine flags/refuses rather than decides' reading (PRD §0 non-negotiable #4), documented in posture-gate.ts's own comment; revisit if a future pack actually authors a narrow exception with machine-evaluable conditions"
  - "A CategoryRule authored with plain treatment FLAG on a category OTHER than OTHER_UNCLASSIFIED reuses the UNCATEGORISED FlagReasonCode (with different, non-misleading message text via a dedicated ruleAuthoredFlagMessage()) — FlagReasonCodeSchema has no code dedicated to 'the pack's own rule always refers this to Legal', and both PRD example packs (§7.5 HK, §7.6 SG) use plain FLAG treatment exclusively for OTHER_UNCLASSIFIED, so this path is exercised by evaluate-line.test.ts directly but not by the golden fixture (whose 15 filler categories all use DISALLOW specifically to avoid this ambiguity). Documented in messages.ts's own comment as a candidate for a dedicated FlagReasonCode if a real pack ever needs to distinguish the two."
  - "ALLOW_WITH_CAP with a null cap (structurally possible under CapSchema.nullable() on CategoryRule) raises a typed EngineComputationFailure rather than silently falling back to an uncapped ALLOW — mirrors the PER_MATTER-on-CategoryRule.cap refusal from Task 1"

requirements-completed: [ENGINE-03, ENGINE-04, ENGINE-05, ENGINE-09, ENGINE-10, ENGINE-12]

coverage:
  - id: D1
    description: "applyCap handles PER_UNIT, PER_LINE and PERCENT_OF_CLAIM (always flooring, never rounding, per AC-07c's literal examples plus a fractional-percent case), and refuses PER_MATTER with a typed, code-checked error"
    requirement: "ENGINE-05"
    verification:
      - kind: unit
        ref: "packages/engine/src/apply-cap.test.ts#applyCap"
        status: pass
    human_judgment: false
  - id: D2
    description: "evaluateConditions covers all three Condition union arms and all six comparison operators plus in/isNull/isNotNull, with strict (non-coercing) equality"
    requirement: "ENGINE-04"
    verification:
      - kind: unit
        ref: "packages/engine/src/conditions.test.ts#conditions — evaluateConditions"
        status: pass
    human_judgment: false
  - id: D3
    description: "The posture gate is exhaustive over all seven FeePosture values — three forcing a terminal verdict, four permitting the treatment table"
    requirement: "ENGINE-03"
    verification:
      - kind: unit
        ref: "packages/engine/src/posture-gate.test.ts#posture gate"
        status: pass
    human_judgment: false
  - id: D4
    description: "All five CategoryRule treatments dispatch correctly under a permitting posture, the posture-gate override fires first (including AC-19's own exception: OTHER_UNCLASSIFIED still DISALLOW under PROHIBITED), and every constructed line satisfies AssessmentLineSchema.parse()"
    requirement: "ENGINE-04"
    verification:
      - kind: unit
        ref: "packages/engine/src/evaluate-line.test.ts#per-line evaluation"
        status: pass
    human_judgment: false
  - id: D5
    description: "assess() over PRD §14's six-line reference fixture reproduces the exact published per-line verdicts/amounts and all six totals (claimedTotal 888.00, draftBaseline 266.40, disallowedTotal 126.60, flaggedTotal 495.00, restingOnUnverifiedRules 106.40, finalAmount null), with no snapshot matcher anywhere in the test file"
    requirement: "ENGINE-09"
    verification:
      - kind: unit
        ref: "packages/engine/src/reference-fixture.golden.test.ts#PRD §14 reference fixture (SG-shaped)"
        status: pass
    human_judgment: true
    rationale: "The fixture's arithmetic is machine-verified by this golden test; whether its proposed legal treatments (e.g. STAFF_TIME_ASSESS_EXEMPTIONS as DISALLOW) are themselves defensible is the plan's own human-check verification step, deferred to the authoring counsel via docs/sg-pack-authoring-worksheet.md — not resolved by this plan."
  - id: D6
    description: "restingOnUnverifiedRules (106.40) is a subset of draftBaseline (266.40), not an addition to it, matching the per-rule verificationStatus the fixture requires"
    requirement: "ENGINE-10"
    verification:
      - kind: unit
        ref: "packages/engine/src/reference-fixture.golden.test.ts#PRD §14 reference fixture (SG-shaped) > reproduces the exact published totals"
        status: pass
    human_judgment: false
  - id: D7
    description: "An OTHER_UNCLASSIFIED line is always FLAG/UNCATEGORISED under a permitting posture regardless of the pack's own rule.treatment, and follows the posture gate (DISALLOW) when it has already forced a terminal verdict"
    requirement: "ENGINE-12"
    verification:
      - kind: unit
        ref: "packages/engine/src/evaluate-line.test.ts#per-line evaluation > AC-19 — OTHER_UNCLASSIFIED under a permitting posture / posture-gate override (step 2)"
        status: pass
    human_judgment: false

duration: 95min
completed: 2026-09-15
status: complete
---

# Phase 2 Plan 4: Posture Gate, Five Treatments, applyCap and the PRD §14 Golden Fixture Summary

**`assess()` now runs the full per-line algorithm — all seven fee postures, all five `CategoryRule` treatments, three cap types with correct flooring, and closed-vocabulary condition evaluation — proven against PRD §14's exact six-line reference fixture with literal, non-snapshot expectations.**

## Performance

- **Duration:** ~95 min
- **Started:** 2026-09-15T17:16:00Z
- **Completed:** 2026-09-15T17:41:00Z
- **Tasks:** 3
- **Files modified:** 14 (11 created, 3 modified)

## Accomplishments

- `applyCap` computes all three single-line cap types correctly — `PER_UNIT`/`PER_LINE` as exact integer arithmetic, `PERCENT_OF_CLAIM` by flooring a multiply-then-divide (never rounding, closing AC-07c's "33, not 34" gap) — and refuses a `PER_MATTER` cap with a typed, code-checked `EngineComputationFailure` rather than misapplying it
- `evaluateConditions` evaluates all three `Condition` union arms and all six comparison operators plus `in`/`isNull`/`isNotNull` over the closed `CONDITION_FIELDS` vocabulary, with strict (non-coercing) equality, returning the specific conditions that failed
- `applyPostureGate` is an exhaustive switch over all seven `FeePosture` values — `PROHIBITED`/`PERMITTED_NARROW_EXCEPTION` force `DISALLOW`, `NO_EXPRESS_AUTHORITY` forces `FLAG`/`NO_FEE_AUTHORITY`, the other four permit the treatment table — with no `default` branch, so a future posture addition is a compile error, never a silent fall-through
- `evaluateLine` dispatches all five `CategoryRule` treatments, ordered correctly behind the posture gate and the AC-19 `OTHER_UNCLASSIFIED` override, with `ALLOW_WITH_CAP` setting verdict `ALLOW_CAPPED` only when the cap actually reduces the claim; `assess()` now delegates every line to it, replacing plan 02-01's ALLOW-only tracer dispatch
- PRD §14's six-line reference fixture (`reference-pack.ts`, `reference-lines.ts`) and its golden test reproduce every published verdict, engine amount and total exactly — `claimedTotal` 888.00, `draftBaseline` 266.40, `disallowedTotal` 126.60, `flaggedTotal` 495.00, `restingOnUnverifiedRules` 106.40, `finalAmount` `null` — with literal expected values compared via `toEqual`, no snapshot matcher anywhere

## Task Commits

Each task followed RED → GREEN (no REFACTOR needed — all three implementations were minimal on first pass):

1. **Task 1: applyCap and condition evaluation**
   - `e08a4f4` — test(02-04): add failing tests for applyCap and evaluateConditions (RED)
   - `44508e7` — feat(02-04): implement applyCap and evaluateConditions (GREEN)
2. **Task 2: The posture gate and all five treatments, wired into assess()**
   - `2f57913` — test(02-04): add failing tests for the posture gate and per-line evaluation (RED)
   - `403b006` — feat(02-04): implement posture gate and per-line evaluation, wire into assess() (GREEN)
3. **Task 3: PRD §14's reference fixture and the golden test**
   - `8150f85` — test(02-04): add PRD §14 reference fixture and failing golden test (RED)
   - `dedd335` — feat(02-04): fix STAFF_TIME_SEARCH verificationStatus, close golden-fixture RED gap (GREEN)

Two follow-up fix commits, both discovered and closed within this plan's own scope (see Deviations):
   - `b8f11d6` — fix(02-04): stop the golden test's own header comment tripping its snapshot-matcher acceptance grep
   - `79a9d53` — docs(02-04): avoid the word 'safe' in an errors.ts comment near CLAUDE.md's banned-word list

**Plan metadata:** committed alongside this SUMMARY (see final commit below).

## TDD Gate Compliance

| Task | RED commit | GREEN commit | RED evidence | Status |
|------|-----------|---------------|---------------|--------|
| 1 | `e08a4f4` | `44508e7` | `RED_EVIDENCE_OK` (apply-cap's fractional-percent test failed 1 vs 0 on a deliberate Math.round; conditions' strict-equality test failed true vs false on a deliberate loose ==) | Pass |
| 2 | `2f57913` | `403b006` | `RED_EVIDENCE_OK` (evaluate-line's "cap does not bind" test failed ALLOW_CAPPED vs ALLOW on a deliberate always-ALLOW_CAPPED verdict) | Pass |
| 3 | `8150f85` | `dedd335` | `RED_EVIDENCE_OK` (golden test's totals assertion failed restingOnUnverifiedRules 26640 vs 10640 on STAFF_TIME_SEARCH deliberately authored NEEDS_VERIFICATION) | Pass |

All three RED phases were validated with `gsd-tools check tdd-red-evidence` before the corresponding GREEN commit, using 02-01/02-02/02-03's documented `vitest --reporter=tap-flat` plus hand-appended TAP summary-line workaround (Vitest's TAP reporters carry no native `# tests`/`# pass`/`# fail` summary line, which the classifier's Node-test-runner-shaped parser expects).

## Files Created/Modified

- `packages/engine/src/apply-cap.ts` — `applyCap()`, three cap types computed with flooring, `PER_MATTER` refused
- `packages/engine/src/conditions.ts` — `evaluateConditions()`, closed-vocabulary condition evaluation
- `packages/engine/src/posture-gate.ts` — `applyPostureGate()`, exhaustive over all seven postures
- `packages/engine/src/evaluate-line.ts` — `evaluateLine()`, §8.1 step 3's full dispatch
- `packages/engine/src/__fixtures__/reference-pack.ts` — the hand-built, SG-shaped fixture pack reproducing §14's numbers (not a rule pack — see its own module header)
- `packages/engine/src/__fixtures__/reference-lines.ts` — §14's six expense lines in minor units
- `packages/engine/src/reference-fixture.golden.test.ts` — the golden file for §14's verdicts, amounts and totals
- `packages/engine/src/apply-cap.test.ts`, `conditions.test.ts`, `posture-gate.test.ts`, `evaluate-line.test.ts` — the four new test suites
- `packages/engine/src/assess.ts` — steps 2-3 now delegate to `posture-gate.ts`/`evaluate-line.ts` for every treatment
- `packages/engine/src/errors.ts` — `EngineComputationFailure`/`EngineComputationError` (`PER_MATTER_CAP_ON_LINE`, `ALLOW_WITH_CAP_MISSING_CAP`)
- `packages/engine/src/messages.ts` — `perMatterCapOnLineMessage`, `allowWithCapMissingCapMessage`, `noFeeAuthorityMessage`, `uncategorisedMessage`, `ruleAuthoredFlagMessage`, `conditionsNotMetMessage`

## Decisions Made

- `PERMITTED_NARROW_EXCEPTION` is treated identically to `PROHIBITED` (forces `DISALLOW`) rather than inventing a narrow-exception mechanism the PRD's step 2 prose does not itself describe — documented in `posture-gate.ts`
- A CategoryRule authored with plain treatment `FLAG` on a category other than `OTHER_UNCLASSIFIED` reuses the `UNCATEGORISED` code with distinct message text — no PRD example pack does this, and the golden fixture's 15 filler categories deliberately use `DISALLOW` instead to sidestep the question; flagged in `messages.ts` as a candidate for a dedicated `FlagReasonCode` if ever needed for real
- `ALLOW_WITH_CAP` with a null `cap` raises a typed `EngineComputationFailure`, mirroring the `PER_MATTER`-on-`CategoryRule.cap` refusal

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `messages.ts`'s `conditionsNotMetMessage` helper failed `tsc` — a discriminated-union narrowing check on `Condition.op` did not narrow reliably**
- **Found during:** Task 2, GREEN phase, `pnpm run typecheck`
- **Issue:** `condition.op === "isNull" || condition.op === "isNotNull"` (both as a ternary condition and as an `if` guard) left the `else`/fallthrough branch's inferred type still including the null-check arm, so `condition.value` failed to typecheck (`Property 'value' does not exist on type '{ ...; op: "isNull" | "isNotNull"; }'`) — a control-flow narrowing limitation on this three-armed zod union under this codebase's tsconfig, not a logic bug.
- **Fix:** Narrowed on `"value" in condition` (a presence check) instead of an `op`-equality check; TypeScript narrows this reliably.
- **Files modified:** `packages/engine/src/messages.ts`
- **Verification:** `pnpm run typecheck` clean; `pnpm vitest run --project engine` unaffected (75/75 at the time)
- **Committed in:** `403b006` (Task 2 GREEN)

**2. [Rule 1 - Bug] The golden test's own header comment tripped the plan's snapshot-matcher acceptance grep**
- **Found during:** post-Task-3 self-review, re-running the plan's own acceptance criteria literally
- **Issue:** `reference-fixture.golden.test.ts`'s module comment named `toMatchSnapshot`/`toMatchInlineSnapshot` literally, to explain why they are banned. The plan's own acceptance check (`grep -c "toMatchSnapshot\|toMatchInlineSnapshot" ... ` expected `0`) counted that prose mention as a hit — a false positive from explanation, not usage.
- **Fix:** Reworded the comment to describe the ban without repeating the literal matcher names.
- **Files modified:** `packages/engine/src/reference-fixture.golden.test.ts`
- **Verification:** `grep -c "toMatchSnapshot\|toMatchInlineSnapshot" packages/engine/src/reference-fixture.golden.test.ts` → `0`; `pnpm vitest run --project engine -t "reference fixture"` still 6/6 passing
- **Committed in:** `b8f11d6`

**3. [Rule 1 - Bug] A code comment in `errors.ts` used the word "safe", one of CLAUDE.md's banned engine-output words**
- **Found during:** post-Task-3 self-review, banned-word scan
- **Issue:** The word appeared only in a source comment (not in `messages.ts`, the single home for engine-authored output text), so it was not a real violation of the PRD §0 non-negotiable — but it sat close enough to a future grep-based check to be worth removing.
- **Fix:** Reworded "the only safe option" to "the only sound option".
- **Files modified:** `packages/engine/src/errors.ts`
- **Verification:** `pnpm run lint` clean; banned-word grep over `packages/engine/src/messages.ts` and the other new files finds no violation
- **Committed in:** `79a9d53`

---

**Total deviations:** 3 auto-fixed (1 bug — tsc narrowing limitation, 2 bugs — self-inflicted false positives against this plan's own literal acceptance checks)
**Impact on plan:** All three were caught and fixed before this SUMMARY was written; no scope creep beyond the plan's own three tasks and their stated acceptance criteria.

## Issues Encountered

None beyond the deviations above — all resolved within this plan's own scope.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `packages/engine` now computes a correct verdict and amount for every posture/treatment/cap combination this phase's requirements name, proven against PRD §14's own published numbers rather than against reasoning about the spec.
- Plan 02-05 (aggregate cap and cross-line checks) can extend `reference-fixture.golden.test.ts` with `MATERIALITY`, `POSSIBLE_DUPLICATE`, `RATE_ABOVE_EXPECTED` and `VENDOR_EVIDENCE_MISSING` assertions on the same six lines — this plan deliberately left line 5's flag reasons at `CONDITIONS_NOT_MET` only, per the plan's own scope boundary.
- Plan 02-06 (matter flags and flat fee) can extend the same fixture with `matterLevelFlags` assertions — `assess()` still returns an empty array there, unchanged from plan 02-01.
- `ENGINE-09` and `ENGINE-10` were shared with sibling plan 02-01 (already `Complete`); both plans declaring them have now produced a `SUMMARY.md`, so the shared-ID gate (#2388) should report both ready to mark complete. `ENGINE-03`, `ENGINE-04`, `ENGINE-05`, `ENGINE-12` were exclusive to this plan.
- No blockers for the next plan in this phase.

## Self-Check: PASSED

- All 11 created files verified present on disk (`[ -f ]`).
- All 8 commit hashes verified present in `git log --oneline --all`.
- Full engine test suite re-run: `pnpm vitest run --project engine` — 80/80 passing.
- Full monorepo suite re-run: `pnpm test` — 276/276 passing.
- `pnpm run typecheck`, `pnpm run lint`, `pnpm run depcruise` all re-run clean.
- `grep -c "toMatchSnapshot\|toMatchInlineSnapshot" packages/engine/src/reference-fixture.golden.test.ts` → `0`.
- `plan_head_before: 8b1099d5083ca7adb513a135f17bdaf45ab72ce3`, `commits: 8` (measured via `git rev-list --count`).

---
*Phase: 02-deterministic-fee-engine*
*Completed: 2026-09-15*
